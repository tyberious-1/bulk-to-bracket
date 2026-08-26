// Card image preview on hover.
//
// Listeners are delegated from the preview container once, so re-rendering
// the list does not need to rebind. Images come from the link's
// data-card-image when the deck already had one, otherwise they are fetched
// on first hover and cached (including negative results).
//
// Depends on: cards.js, constants.js, text.js

let hoverPreviewEl = null;
let hoverImageCache = new Map();
let previewHoverBound = false;

function renderPreviewCardLink(cardName, scryfallUrl, imageUrl) {
  const safeName = escapeHtml(cardName || "Unknown Card");
  const safeUrl = escapeHtml(scryfallUrl || "#");
  const safeImage = escapeHtml(imageUrl || "");
  const safeCardName = escapeHtml(cardName || "");

  return `
    <span class="preview-card-link-wrap">
      <a
        class="preview-card-link"
        href="${safeUrl}"
        target="_blank"
        rel="noopener noreferrer"
        data-card-name="${safeCardName}"
        ${safeImage ? `data-card-image="${safeImage}"` : ""}
      >
        ${safeName}
      </a>
    </span>
  `;
}

function ensureHoverPreview() {
  if (hoverPreviewEl) return hoverPreviewEl;

  hoverPreviewEl = document.createElement("div");
  hoverPreviewEl.className = "card-hover-preview";
  hoverPreviewEl.innerHTML = `<img alt="Card preview" />`;
  document.body.appendChild(hoverPreviewEl);

  return hoverPreviewEl;
}

function moveCardHoverPreview(mouseEvent) {
  if (!hoverPreviewEl) return;

  const padding = 18;
  const width = hoverPreviewEl.offsetWidth || 265;
  const height = hoverPreviewEl.offsetHeight || 370;

  let left = mouseEvent.clientX + 18;
  let top = mouseEvent.clientY + 18;

  if (left + width > window.innerWidth - padding) {
    left = mouseEvent.clientX - width - 18;
  }

  if (top + height > window.innerHeight - padding) {
    top = window.innerHeight - height - padding;
  }

  if (top < padding) top = padding;
  if (left < padding) left = padding;

  hoverPreviewEl.style.left = `${left}px`;
  hoverPreviewEl.style.top = `${top}px`;
}

function showCardHoverPreview(imageUrl, mouseEvent) {
  if (!imageUrl || window.innerWidth <= 900) return;

  const el = ensureHoverPreview();
  const img = el.querySelector("img");
  if (img.getAttribute("src") !== imageUrl) {
    img.setAttribute("src", imageUrl);
  }

  moveCardHoverPreview(mouseEvent);
  el.classList.add("visible");
}

async function resolveHoverImageUrl(link) {
  const inlineImage = link.getAttribute("data-card-image") || "";
  if (inlineImage) return inlineImage;

  const cardName = (link.getAttribute("data-card-name") || "").trim();
  if (!cardName) return "";

  if (hoverImageCache.has(cardName)) {
    return hoverImageCache.get(cardName);
  }

  try {
    const response = await fetch(`${SCRYFALL_NAMED}${encodeURIComponent(cardName)}`);
    if (!response.ok) throw new Error(`Failed to fetch image for ${cardName}`);
    const data = await response.json();
    const imageUrl = getCardImageUrl(data);
    hoverImageCache.set(cardName, imageUrl || "");
    if (imageUrl) {
      link.setAttribute("data-card-image", imageUrl);
    }
    return imageUrl || "";
  } catch (error) {
    console.warn("Unable to fetch hover image", cardName, error);
    hoverImageCache.set(cardName, "");
    return "";
  }
}

function hideCardHoverPreview() {
  if (!hoverPreviewEl) return;
  hoverPreviewEl.classList.remove("visible");
}

function bindPreviewHoverImages() {
  if (previewHoverBound) return;

  const preview = document.getElementById("exportPreview");
  if (!preview) return;

  preview.addEventListener("mouseover", async (event) => {
    const link = event.target.closest(".preview-card-link");
    if (!link || !preview.contains(link)) return;

    const imageUrl = await resolveHoverImageUrl(link);
    if (!imageUrl) return;
    if (!link.matches(":hover")) return;

    showCardHoverPreview(imageUrl, event);
  });

  preview.addEventListener("mousemove", (event) => {
    const link = event.target.closest(".preview-card-link");
    if (!link || !preview.contains(link)) return;
    moveCardHoverPreview(event);
  });

  preview.addEventListener("mouseout", (event) => {
    const fromLink = event.target.closest(".preview-card-link");
    if (!fromLink) return;

    const toElement = event.relatedTarget;
    if (toElement && fromLink.contains(toElement)) return;

    hideCardHoverPreview();
  });

  window.addEventListener("scroll", hideCardHoverPreview, { passive: true });
  window.addEventListener("blur", hideCardHoverPreview);
  previewHoverBound = true;
}
