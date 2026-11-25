// app_build.js "<commander>" <owned json> <out.dck> ["<partner or Background>"]: build a deck through the real app (index.html) in headless Firefox and
// write it as a Forge .dck. Run from the repo root.
// <owned json>: a Scryfall card array of the collection (dev/tools/jxa-harness/fetch_owned.py output), under
// dev/tools/forge-sim/work/. The page gets it as a stand-in collection CSV; EDHREC is fetched live, as the app does. The build
// uses the app's default plan, as a player would get it. The deck's Name= is the commander's name; add " B" for a pod.
// Only index.html, style.css, js/*.js and the owned json are served (127.0.0.1, a free port); the browser profile is thrown away.
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn, execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../../..");
const [commander, ownedArg, out, partner = ""] = process.argv.slice(2);
if (!commander || !ownedArg || !out) { console.error('usage: node app_build.js "<commander>" <owned json> <out.dck> ["<partner>"]'); process.exit(1); }
// A Partner / Background commander is tested with its pair (see the btb-forge-sim skill); both must be in the owned json.
const ownedRel = path.relative(ROOT, path.resolve(ownedArg));
if (!ownedRel.startsWith("dev/tools/forge-sim/work/")) { console.error("owned json must be under dev/tools/forge-sim/work/"); process.exit(1); }

const INJECT = `
<script>
(async () => {
  const errors = [];
  window.addEventListener("error", (e) => errors.push(String(e.message)));
  window.addEventListener("unhandledrejection", (e) => errors.push("rejection: " + String(e.reason && e.reason.message || e.reason)));
  const realFetch = window.fetch.bind(window);
  const done = (obj) => { realFetch("/__result", { method: "POST", body: JSON.stringify(obj) }); };
  try {
    const owned = await (await realFetch(${JSON.stringify("/" + ownedRel)})).json();
    const byName = new Map();
    for (const r of owned) byName.set(r.name.toLowerCase(), r);
    window.fetch = function (url, opts) {
      const u = String(url);
      if (u.includes("api.scryfall.com/cards/named")) {
        const name = decodeURIComponent((u.split(/[?&](?:fuzzy|exact)=/)[1] || "").split("&")[0]).replace(/\\+/g, " ").toLowerCase();
        const hit = byName.get(name);
        if (hit) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(hit) });
      }
      return realFetch(url, opts);
    };
    for (const raw of owned) {
      const card = convertScryfallCard(raw);
      cardCache.set(normalizeCardName(card.name), card);
      indexCardByFrontFace(cardCache, card);
    }
    const q = (s) => /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    const seen = new Set();
    const lines = ["Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Signed,Condition,Language,Proxy,Purchase price currency,Added"];
    for (const r of owned) { if (seen.has(r.name)) continue; seen.add(r.name); lines.push(["b", "binder", q(r.name), "TST", "Test", "1", "normal", "common", "1", "1", "1", "0", "false", "false", "false", "near_mint", "en", "false", "USD", "2026"].join(",")); }
    const dt = new DataTransfer(); dt.items.add(new File([lines.join("\\n")], "collection.csv", { type: "text/csv" }));
    csvFileInput.files = dt.files;
    csvFileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 4000));
    commanderInput.value = ${JSON.stringify(commander)};
    commanderInput.dispatchEvent(new Event("input", { bubbles: true }));
    const partnerName = ${JSON.stringify(partner)};
    if (partnerName) {
      // The app reveals the partner field once it has read the commander's pairing ability; wait for that, then fill it.
      for (let i = 0; i < 30 && partnerRow.classList.contains("hidden"); i++) {
        commanderInput.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 500));
      }
      partnerRow.classList.remove("hidden");
      partnerInput.value = partnerName;
      partnerInput.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 1500));
    }
    generateBtn.click();
    const started = Date.now();
    while (Date.now() - started < 400000) {
      await new Promise((r) => setTimeout(r, 1000));
      if (document.getElementById("buildBreakdown").textContent.trim() && document.getElementById("moxfieldExport").value.trim()) break;
    }
    await new Promise((r) => setTimeout(r, 1500));
    done({ ok: true, errors, exportText: document.getElementById("moxfieldExport").value,
      focus: typeof getCurrentThemeFocus === "function" ? getCurrentThemeFocus() : null,
      plans: (currentRunContext && currentRunContext.planOptions || []).map((p) => p.label + " (" + p.owned + ")") });
  } catch (e) { done({ ok: false, error: String(e && e.stack || e), errors }); }
})();
</script>`;

function allowed(rel) {
  return rel === "index.html" || rel === "style.css" || rel === ownedRel || (rel.startsWith("js/") && rel.endsWith(".js"));
}
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

let browser = null;
let profile = null;
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (req.method === "POST" && urlPath === "/__result") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => { res.writeHead(204); res.end(); finish(JSON.parse(body)); });
    return;
  }
  if (urlPath === "/__page.html") {
    const port = server.address().port;
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
      .replace("<head>", `<head><base href="http://127.0.0.1:${port}/">`)
      .replace("</body>", INJECT + "</body>");
    res.writeHead(200, { "Content-Type": TYPES[".html"] });
    return res.end(html);
  }
  const rel = path.posix.normalize(urlPath.replace(/^\/+/, ""));
  if (!allowed(rel)) { res.writeHead(404); return res.end("not found"); }
  fs.readFile(path.join(ROOT, rel), (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(rel)] || "application/octet-stream" });
    res.end(data);
  });
});

const timer = setTimeout(() => finish(null), 600000);
function cleanup() {
  clearTimeout(timer);
  if (browser && browser.exitCode === null) browser.kill();
  server.close();
  if (profile) fs.rmSync(profile, { recursive: true, force: true });
}

function finish(d) {
  cleanup();
  if (!d || !d.ok || !(d.exportText || "").trim()) { console.error("build failed: " + JSON.stringify(d).slice(0, 1500)); process.exit(1); }
  const main = [];
  for (const raw of d.exportText.split("\n")) {
    const m = /^(\d+)x?\s+(.+?)(\s+\([A-Z0-9]+\).*)?$/.exec(raw.trim());
    if (!m) continue;
    const name = m[2].split(" // ")[0].replace(" *CMDR*", "").trim();
    if (name !== commander && name !== partner) main.push(`${m[1]} ${name}`);
  }
  const count = main.reduce((s, l) => s + Number(l.split(" ")[0]), 0);
  fs.writeFileSync(out, `[metadata]\nName=${commander}\n[commander]\n1 ${commander}\n${partner ? `1 ${partner}\n` : ""}[main]\n${main.join("\n")}\n`);
  console.log(`wrote ${out}: ${count} cards + commander${partner ? " + " + partner : ""} | default plan: ${d.focus} | plans: ${JSON.stringify(d.plans)} | JS errors: ${JSON.stringify(d.errors)}`);
  process.exit(0);
}

server.listen(0, "127.0.0.1", () => {
  let firefox;
  try { firefox = execSync("command -v firefox", { encoding: "utf8" }).trim(); } catch { console.error("firefox not found on PATH"); process.exit(1); }
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "btb-build-"));
  fs.writeFileSync(path.join(profile, "user.js"), [
    'user_pref("browser.shell.checkDefaultBrowser", false);', 'user_pref("browser.aboutwelcome.enabled", false);',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);', 'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
    'user_pref("app.update.enabled", false);', 'user_pref("browser.sessionstore.resume_from_crash", false);',
  ].join("\n"));
  browser = spawn(firefox, ["--headless", "--no-remote", "--profile", profile, `http://127.0.0.1:${server.address().port}/__page.html`], { stdio: "ignore" });
});
