// Name autocomplete, instantiated once per input.
//
// Raw Scryfall suggestions render immediately, then a second pass filters them
// to cards the caller considers eligible. That pass is best-effort: if it
// fails, the raw suggestions stay on screen. Stale responses are discarded by
// comparing requestId and the live input value.
//
// Two instances exist -- the commander field and the partner field -- so all
// state lives per instance rather than per module. The partner field passes a
// predicate that consults the currently selected commander, which is why the
// predicate is called fresh on every response rather than captured once.
//
// Depends on: cards.js, scryfall.js, status.js, text.js

function createNameAutocomplete(config) {
  const input = config.input;
  const list = config.list;
  const isEligible = config.isEligible || canBeCommander;
  const loadingLabel = config.loadingLabel || "Searching commanders...";
  const emptyLabel = config.emptyLabel || "No legal commanders found";
  const onSelect = config.onSelect || function () {};

  let timer = null;
  let activeIndex = -1;
  let items = [];
  let requestId = 0;

  function renderLoading() {
    list.innerHTML = "";
    const div = document.createElement("div");
    div.className = "autocomplete-item";
    div.textContent = loadingLabel;
    list.appendChild(div);
    list.classList.remove("hidden");
  }

  function render(names) {
    items = names;
    activeIndex = -1;
    list.innerHTML = "";

    if (!names.length) {
      const div = document.createElement("div");
      div.className = "autocomplete-item";
      div.textContent = emptyLabel;
      list.appendChild(div);
      list.classList.remove("hidden");
      return;
    }

    names.forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "autocomplete-item";
      div.textContent = item;
      div.dataset.index = String(index);
      div.addEventListener("click", () => select(item));
      list.appendChild(div);
    });

    list.classList.remove("hidden");
  }

  function refreshActive() {
    const nodes = list.querySelectorAll(".autocomplete-item");
    nodes.forEach((el) => el.classList.remove("active"));
    if (activeIndex >= 0 && nodes[activeIndex]) {
      nodes[activeIndex].classList.add("active");
    }
  }

  function select(name) {
    input.value = name;
    hide();
    onSelect(name);
  }

  function hide() {
    list.classList.add("hidden");
    list.innerHTML = "";
    items = [];
    activeIndex = -1;
  }

  async function filterToEligible(names) {
    if (!names.length) return [];
    const cardMap = await fetchCardDataBatchWithProgress(names);
    const eligible = [];
    for (const name of names) {
      const card = cardMap.get(normalizeCardName(name));
      if (card && isEligible(card)) eligible.push(card.name);
    }
    return eligible;
  }

  async function onInput() {
    const query = input.value.trim();
    updateGenerateButtonState();

    if (timer) clearTimeout(timer);

    if (query.length < 2) {
      hide();
      return;
    }

    const id = ++requestId;

    timer = setTimeout(async () => {
      try {
        renderLoading();
        const matches = await fetchCommanderAutocomplete(query);

        if (id !== requestId || input.value.trim() !== query) return;

        render(matches);

        // Refine to eligible cards, but never block showing suggestions.
        try {
          const eligible = await filterToEligible(matches);
          if (id !== requestId || input.value.trim() !== query) return;
          if (eligible.length) render(eligible);
        } catch (eligibilityError) {
          console.warn("Autocomplete eligibility refinement failed; showing raw results.", eligibilityError);
        }
      } catch (error) {
        console.error(error);
        hide();
      }
    }, 120);
  }

  function onKeydown(event) {
    if (list.classList.contains("hidden")) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      refreshActive();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      refreshActive();
    } else if (event.key === "Enter") {
      if (activeIndex >= 0 && items[activeIndex]) {
        event.preventDefault();
        select(items[activeIndex]);
      }
    } else if (event.key === "Escape") {
      hide();
    }
  }

  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKeydown);

  return {
    input,
    list,
    hide,
    ownsEvent(target) {
      return list.contains(target) || target === input;
    }
  };
}
