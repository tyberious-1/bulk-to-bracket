#!/usr/bin/env python3
"""Browser smoke test: builds one deck through the real page (index.html or pauper.html) in headless
Chrome, with every network call served from the harness fixtures (nothing leaves this machine, and your
CSV is not read; a stand-in collection is made from dev/tools/jxa-harness/owned_raw.json).

Usage: python3 dev/tools/jxa-harness/browser_smoke.py index.html "Greasefang, Okiba Boss"
       python3 dev/tools/jxa-harness/browser_smoke.py index.html "Omnath, Locus of Rage" --toggle   (also clicks the Event Engines switch)
       python3 dev/tools/jxa-harness/browser_smoke.py pauper.html "<an uncommon creature you own>"

       python3 dev/tools/jxa-harness/browser_smoke.py index.html "Kaza, Roil Chaser" --combo   (also drives the Single / Combo theme picker)

Prints: whether the build finished, any JavaScript errors, how many export lines it made, and the
"Engine enablers ..." report line as the page rendered it. Needs Google Chrome in /Applications.
The commander must be a card in the fixtures (owned_raw.json or prefetch_data.json commanderCards).
"""
import html as htmlmod, json, os, re, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
INJECT = r"""
<script>
(async () => {
  const R = document.createElement("pre"); R.id = "__result"; document.body.appendChild(R);
  const errors = [];
  window.addEventListener("error", (e) => errors.push(String(e.message)));
  window.addEventListener("unhandledrejection", (e) => errors.push("rejection: " + String(e.reason && e.reason.message || e.reason)));
  const done = (obj) => { R.textContent = JSON.stringify(obj); };
  try {
    const base = "file://ROOT";
    const owned = await (await fetch(base + "dev/tools/jxa-harness/owned_raw.json")).json();
    const prefetch = await (await fetch(base + "dev/tools/jxa-harness/prefetch_data.json")).json();
    const realFetch = window.fetch.bind(window);
    const byName = new Map();
    for (const r of owned) byName.set(r.name.toLowerCase(), r);
    for (const r of Object.values(prefetch.commanderCards)) byName.set(r.name.toLowerCase(), r);
    window.fetch = function (url, opts) {
      const u = String(url);
      if (u.startsWith("file:")) return realFetch(url, opts);
      const page = prefetch.edhrecPages[u];
      if (page !== undefined) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(page) });
      if (u.includes("api.scryfall.com/cards/named")) {
        const name = decodeURIComponent((u.split(/[?&](?:fuzzy|exact)=/)[1] || "").split("&")[0]).replace(/\+/g, " ").toLowerCase();
        const hit = byName.get(name) || [...byName.values()].find((r) => r.name.toLowerCase().startsWith(name));
        if (hit) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(hit) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    };
    for (const raw of owned) {
      const card = convertScryfallCard(raw);
      cardCache.set(normalizeCardName(card.name), card);
      indexCardByFrontFace(cardCache, card);
    }
    const q = (s) => /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    const seen = new Set(); const lines = ["Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Signed,Condition,Language,Proxy,Purchase price currency,Added"];
    for (const r of owned) { if (seen.has(r.name)) continue; seen.add(r.name); lines.push(["test", "binder", q(r.name), "TST", "Test", "1", "normal", "common", "1", "1", "1", "0", "false", "false", "false", "near_mint", "en", "false", "USD", "2026"].join(",")); }
    const file = new File([lines.join("\n")], "collection.csv", { type: "text/csv" });
    const dt = new DataTransfer(); dt.items.add(file);
    csvFileInput.files = dt.files;
    csvFileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 4000));
    commanderInput.value = "COMMANDER";
    commanderInput.dispatchEvent(new Event("input", { bubbles: true }));
    generateBtn.click();
    const started = Date.now();
    while (Date.now() - started < 90000) {
      await new Promise((r) => setTimeout(r, 1000));
      if (document.getElementById("buildBreakdown").textContent.trim() && document.getElementById("moxfieldExport").value.trim()) break;
    }
    await new Promise((r) => setTimeout(r, 1500));
    const exportText = document.getElementById("moxfieldExport").value;
    const first = {
      ok: true,
      errors,
      exportLines: exportText.split("\n").filter(Boolean).length,
      breakdown: document.getElementById("buildBreakdown").innerText,
      engineNote: (document.querySelector(".build-breakdown-note") || {}).innerText || null,
      notes: [...document.querySelectorAll(".build-breakdown-note")].map((n) => n.innerText)
    };
    if (!exportText.trim()) first.pageText = "toast=[" + toast.textContent + "] progress=[" + ((document.getElementById("progressText")||{}).textContent) + "] generateDisabled=" + generateBtn.disabled + " commanderValue=" + commanderInput.value + " csvFiles=" + (csvFileInput.files ? csvFileInput.files.length : "?") + " :: " + document.body.innerText.replace(/\n+/g, " | ").slice(0, 1200);
    if (window.__SMOKE_TOGGLE) {
      const toggle = document.getElementById("eventEnginesToggle");
      first.toggleFound = Boolean(toggle);
      first.toggleActiveBefore = toggle ? toggle.classList.contains("active") : null;
      if (toggle) toggle.click();
      await new Promise((r) => setTimeout(r, 12000));
      first.toggleActiveAfter = toggle ? toggle.classList.contains("active") : null;
      first.notesAfterToggle = [...document.querySelectorAll(".build-breakdown-note")].map((n) => n.innerText);
      first.errorsAfterToggle = errors.slice();
    }
    if (window.__SMOKE_COMBO) {
      const pause = (ms) => new Promise((r) => setTimeout(r, ms));
      const c = { focusBefore: getCurrentThemeFocus(), singleDropdownBefore: Boolean(document.getElementById("themeDropdown")) };
      const comboBtn = document.querySelector('.pick-mode-btn[data-pick-mode="combo"]');
      c.comboToggleFound = Boolean(comboBtn);
      if (comboBtn) comboBtn.click();
      await pause(500);
      const selects = [...document.querySelectorAll("#priorityButtons .combo-select")];
      c.selectCount = selects.length;
      c.optionCount = selects[0] ? selects[0].options.length - 1 : 0;
      c.buildDisabledAtStart = (document.getElementById("comboBuildBtn") || {}).disabled;
      c.coverageAtStart = (document.getElementById("comboCoverage") || {}).textContent;
      c.singleSectionsGone = !document.getElementById("themeDropdown") && !document.querySelector(".priority-section-buttons .priority-btn");
      c.panelHtmlHead = (document.getElementById("priorityButtons") || {}).innerHTML.slice(0, 600);
      if (!selects.length) { c.errors = errors.slice(); first.combo = c; done(first); return; }
      const pickOne = async (select) => {
        const v = [...select.options].find((o) => o.value && !o.disabled);
        if (v) { select.value = v.value; select.dispatchEvent(new Event("change", { bubbles: true })); await pause(300); }
        return v ? v.value : null;
      };
      c.picks = [await pickOne(selects[0]), await pickOne(selects[1])];
      c.duplicateBlocked = selects[1] ? [...selects[1].options].some((o) => o.value === c.picks[0] && o.disabled) : null;
      c.buildDisabledAfterTwo = (document.getElementById("comboBuildBtn") || {}).disabled;
      c.coverageAfterTwo = (document.getElementById("comboCoverage") || {}).textContent;
      const go = document.getElementById("comboBuildBtn");
      if (go && !go.disabled) go.click();
      await pause(15000);
      c.focusAfter = getCurrentThemeFocus();
      c.modeStillCombo = Boolean(document.querySelector(".combo-select"));
      c.selectValuesAfter = [...document.querySelectorAll("#priorityButtons .combo-select")].map((x) => x.value);
      c.exportLinesAfter = document.getElementById("moxfieldExport").value.split("\n").filter(Boolean).length;
      c.errors = errors.slice();
      first.combo = c;
    }
    done(first);
  } catch (e) { done({ ok: false, error: String(e && e.stack || e), errors }); }
})();
</script>
"""

def main():
    toggle = "--toggle" in sys.argv
    combo = "--combo" in sys.argv
    args = [a for a in sys.argv[1:] if a not in ("--toggle", "--combo")]
    if len(args) != 2:
        sys.exit(__doc__)
    page, commander = args
    root = ROOT + "/"
    page_html = open(root + page).read()
    inject = INJECT.replace("ROOT", root).replace("COMMANDER", commander.replace('"', ""))
    if toggle:
        inject = "<script>window.__SMOKE_TOGGLE = true;</script>" + inject
    if combo:
        inject = "<script>window.__SMOKE_COMBO = true;</script>" + inject
    page_html = page_html.replace("<head>", '<head><base href="file://%s">' % root, 1).replace("</body>", inject + "</body>", 1)
    with tempfile.TemporaryDirectory() as tmp:
        test = os.path.join(tmp, "smoke.html")
        open(test, "w").write(page_html)
        out = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--user-data-dir=" + os.path.join(tmp, "profile"),
                              "--allow-file-access-from-files", "--virtual-time-budget=240000", "--dump-dom", "file://" + test],
                             capture_output=True, text=True, timeout=600).stdout
    m = re.search(r'<pre id="__result">(.*?)</pre>', out, re.S)
    if not m:
        sys.exit("no result: the page did not finish (is Google Chrome installed?)")
    d = json.loads(htmlmod.unescape(m.group(1)))
    print("build finished:", d.get("ok"), "| JavaScript errors:", d.get("errors"), "| export lines:", d.get("exportLines"))
    print("engine line:", d.get("engineNote") or "none (this commander has no engine need)")
    for note in d.get("notes") or []:
        print("report note:", note[:300])
    if toggle:
        print("Event Engines switch found:", d.get("toggleFound"), "| on before:", d.get("toggleActiveBefore"), "| on after the click:", d.get("toggleActiveAfter"))
        print("report notes after the click:", [n[:120] for n in d.get("notesAfterToggle") or []])
        print("JavaScript errors after the click:", d.get("errorsAfterToggle"))
    if d.get("pageText"):
        print("the export was empty; page text:", d["pageText"])
    if combo:
        for k, v in (d.get("combo") or {}).items():
            print("combo.%s: %s" % (k, v))
    if not d.get("ok"):
        print("failure:", d.get("error"))
        sys.exit(1)

main()
