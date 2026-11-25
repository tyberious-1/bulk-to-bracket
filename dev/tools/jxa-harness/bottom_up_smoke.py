#!/usr/bin/env python3
"""Browser smoke test for the Bottom-Up Build tab: loads index.html in headless Firefox with a stand-in
collection made from dev/tools/jxa-harness/owned_raw.json (nothing leaves this machine, your CSV is not
read), clicks through the tab, and prints what the page rendered.

Usage: python3 dev/tools/jxa-harness/bottom_up_smoke.py [index.html|pauper.html]

Steps it takes: open the Bottom-Up tab, "Suggest decks from my collection", build a Control suggestion,
read the Reliability panel and result notes, "Use as commander" on the first owned fit, then a hand-picked Vampire + sacrifice and death layer build. Every
EDHREC budget page is answered with a made-up list of owned cards of the subtype's tribe (so the budget
tiebreak path runs); Scryfall and everything else comes from the fixtures. Prints any JavaScript errors.
Needs headless Firefox on PATH (or Google Chrome in /Applications on macOS).
"""
import json, os, re, sys
from smoke_browser import run_page

INJECT = r"""
<script>
(async () => {
  const errors = [];
  window.addEventListener("error", (e) => errors.push(String(e.message)));
  window.addEventListener("unhandledrejection", (e) => errors.push("rejection: " + String(e.reason && e.reason.message || e.reason)));
  const post = window.fetch.bind(window);
  const done = (obj) => { post("/__result", { method: "POST", body: JSON.stringify(obj) }); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (test, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (test()) return true; await sleep(500); } return false; };
  // textContent, not innerText: a collapsed <details> renders nothing, and the panel starts collapsed.
  const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : null);
  try {
    const base = "";
    const owned = await (await fetch(base + "dev/tools/jxa-harness/owned_raw.json")).json();
    const prefetch = await (await fetch(base + "dev/tools/jxa-harness/prefetch_data.json")).json();
    const realFetch = window.fetch.bind(window);
    const budgetRequests = [];
    window.fetch = function (url, opts) {
      const u = String(url);
      if (new URL(u, location.href).origin === location.origin) return realFetch(url, opts);
      const budget = u.match(/\/pages\/tags\/([^/]+)\/budget\.json/);
      if (budget) {
        budgetRequests.push(budget[1]);
        const tribe = budget[1].replace(/s$/, "");
        const views = owned.filter((r) => new RegExp("\\b" + tribe, "i").test(r.type_line || "") && /creature/i.test(r.type_line || ""))
          .slice(0, 40).map((r, i) => ({ name: r.name, num_decks: 30 - (i % 10), potential_decks: 40 }));
        const payload = { container: { json_dict: { cardlists: [{ header: "Top Commanders", cardviews: [] }, { header: "Creatures", cardviews: views }] } } };
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
      }
      const page = prefetch.edhrecPages[u];
      if (page !== undefined) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(page) });
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
    await sleep(4000);

    const out = { ok: true, errors, steps: [] };
    document.querySelector('.tab-btn[data-tab="bottomup"]').click();
    await sleep(500);
    out.panelBefore = text(document.getElementById("bottomUpPanel"));

    const suggestBtn = document.getElementById("bottomUpSuggestBtn");
    out.suggestButton = Boolean(suggestBtn);
    if (suggestBtn) suggestBtn.click();
    out.suggestionsAppeared = await waitFor(() => document.querySelectorAll(".bu-group").length > 0, 150000);
    out.groups = [...document.querySelectorAll(".bu-group")].map((g) => ({ id: g.dataset.buGroup, label: text(g.querySelector("summary")), buttons: g.querySelectorAll(".bu-suggestion").length }));
    out.distinctSubtypes = new Set([...document.querySelectorAll(".bu-suggestion")].map((b) => b.childNodes[0].textContent.trim())).size;

    // Build the first Control suggestion (its button exists even while the group is collapsed).
    const control = document.querySelector('.bu-group[data-bu-group="control"] .bu-suggestion');
    out.controlSuggestion = control ? text(control) : null;
    if (control) control.click();
    out.resultAppeared = await waitFor(() => Boolean(document.querySelector(".bu-result")), 120000);
    await sleep(1500);
    const result = document.querySelector(".bu-result");
    if (result) {
      out.title = text(result.querySelector("h3"));
      out.summaryNote = text(result.querySelector(".detail-note"));
      const rel = result.querySelector(".bu-reliability");
      out.reliabilitySummary = rel ? text(rel.querySelector("summary")) : null;
      out.reliabilityLines = rel ? [...rel.querySelectorAll("li")].map((li) => text(li)) : [];
      out.reliabilityNotes = rel ? [...rel.querySelectorAll(".detail-note")].map((n) => text(n)) : [];
      out.sections = [...result.querySelectorAll(".priority-section-label")].map((l) => text(l));
      out.ownedFitButtons = result.querySelectorAll("[data-bu-commander]").length;
    }
    out.budgetRequests = budgetRequests;

    // Use the first owned commander and check the panel redraws.
    const use = document.querySelector("[data-bu-commander]:not([disabled])");
    if (use) {
      use.click();
      await sleep(3000);
      const after = document.querySelector(".bu-result");
      out.commanderBox = after ? text(after.querySelector(".bu-commander")) : null;
      const rel2 = after && after.querySelector(".bu-reliability");
      out.reliabilityAfterCommander = rel2 ? text(rel2.querySelector("summary")) : null;
      out.noteAfterCommander = after ? text(after.querySelector(".detail-note")) : null;
    }
    // Pick a tribe by hand with a second layer: Vampire + sacrifice and death triggers, in black and red.
    const subSel = document.getElementById("buSubtype");
    const vamp = subSel && [...subSel.options].find((o) => /^tribal:/.test(o.value) && /vampire/i.test(o.textContent));
    out.layerPicker = Boolean(document.getElementById("buLayer"));
    if (vamp) {
      subSel.value = vamp.value; subSel.dispatchEvent(new Event("change", { bubbles: true }));
      const layerSel = document.getElementById("buLayer");
      layerSel.value = "aristocrats"; layerSel.dispatchEvent(new Event("change", { bubbles: true }));
      for (const c of ["B", "R"]) { const b = document.querySelector('[data-bu-color="' + c + '"]'); if (b && !b.classList.contains("active")) b.click(); await sleep(300); }
      const keepTitle = out.title;
      document.getElementById("buBuildBtn").click();
      out.layerResultAppeared = await waitFor(() => { const h = document.querySelector(".bu-result h3"); return h && /\+ Sacrifice/.test(h.textContent); }, 120000);
      const lr = document.querySelector(".bu-result");
      out.layerTitle = lr ? text(lr.querySelector("h3")) : null;
      out.layerNote = lr ? text(lr.querySelector(".detail-note")) : null;
    }
    out.errors = errors.slice();
    done(out);
  } catch (e) { done({ ok: false, error: String(e && e.stack || e), errors }); }
})();
</script>
"""

def main():
    page = sys.argv[1] if len(sys.argv) > 1 else "index.html"
    d = run_page(page, INJECT, 900)
    if d is None:
        sys.exit("no result: the page did not finish (is Firefox installed?)")
    if not d.get("ok"):
        print("failure:", d.get("error"), "| errors:", d.get("errors"))
        sys.exit(1)
    print("JavaScript errors:", d.get("errors"))
    print("suggest button:", d.get("suggestButton"), "| suggestions appeared:", d.get("suggestionsAppeared"))
    for g in d.get("groups") or []:
        print("  group", g["id"], "|", g["label"], "|", g["buttons"], "buttons")
    print("distinct subtypes:", d.get("distinctSubtypes"))
    print("control suggestion:", d.get("controlSuggestion"), "| result appeared:", d.get("resultAppeared"))
    print("title:", d.get("title"))
    print("summary:", d.get("summaryNote"))
    print("reliability:", d.get("reliabilitySummary"))
    for line in d.get("reliabilityLines") or []:
        print("   ", line)
    for note in d.get("reliabilityNotes") or []:
        print("  note:", note[:300])
    print("sections:", d.get("sections"))
    print("budget pages requested:", d.get("budgetRequests"))
    if d.get("commanderBox") is not None or d.get("reliabilityAfterCommander") is not None:
        print("after commander:", d.get("commanderBox"), "|", d.get("reliabilityAfterCommander"))
        print("note after commander:", d.get("noteAfterCommander"))
    print("layer picker:", d.get("layerPicker"), "| layer build appeared:", d.get("layerResultAppeared"))
    print("layer title:", d.get("layerTitle"))
    print("layer summary:", d.get("layerNote"))

main()
