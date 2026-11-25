"""Shared runner for browser_smoke.py and bottom_up_smoke.py (stdlib only).

run_page() serves a short allowlist of repo files from a http.server bound to 127.0.0.1 on a free port
(the app's index.html/pauper.html, style.css, js/*.js and the two harness fixtures the injected script
fetches; nothing else under the repo, so the friend's collection and your CSVs are never served), serves
the page with the injected test script at /__smoke.html, and opens it in a headless browser with a throwaway
profile. The injected script POSTs its result JSON to /__result; run_page returns it, or None on timeout.
The browser process it started is killed afterwards (other Firefox windows are left alone: the profile is
new and --no-remote is passed). Firefox is used when it is on PATH (Linux); Google Chrome in /Applications
is the fallback (macOS). Chrome's launch is untested on Linux.
"""
import json, mimetypes, os, posixpath, shutil, subprocess, sys, tempfile, threading, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FIXTURES = {"dev/tools/jxa-harness/owned_raw.json", "dev/tools/jxa-harness/prefetch_data.json"}
PAGE_PATH = "/__smoke.html"
RESULT_PATH = "/__result"
USER_JS = """user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("app.update.enabled", false);
user_pref("browser.tabs.warnOnClose", false);
user_pref("browser.sessionstore.resume_from_crash", false);
"""

def allowed(url_path):
    rel = posixpath.normpath(urllib.parse.unquote(urllib.parse.urlsplit(url_path).path).lstrip("/"))
    if rel in ("index.html", "pauper.html", "style.css") or rel in FIXTURES:
        return True
    return rel.startswith("js/") and rel.endswith(".js")

def browser_command(url, profile):
    firefox = shutil.which("firefox")
    if firefox:
        with open(os.path.join(profile, "user.js"), "w") as f:
            f.write(USER_JS)
        return [firefox, "--headless", "--no-remote", "--profile", profile, url]
    if os.path.exists(CHROME):
        return [CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--user-data-dir=" + profile, url]
    sys.exit("no browser found: install Firefox (on PATH) or Google Chrome in /Applications")

def run_page(page, inject, timeout):
    """page: a repo-relative html file (index.html or pauper.html). inject: a <script> block that goes
    before </body> and ends by POSTing its result object to /__result. Returns the parsed result or None."""
    page_html = open(os.path.join(ROOT, page)).read()
    done = threading.Event()
    result = {}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _send(self, code, body, ctype):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = urllib.parse.urlsplit(self.path).path
            if path == PAGE_PATH:
                base = '<base href="http://127.0.0.1:%d/">' % server.server_address[1]
                html = page_html.replace("<head>", "<head>" + base, 1).replace("</body>", inject + "</body>", 1)
                return self._send(200, html.encode("utf-8"), "text/html; charset=utf-8")
            if not allowed(path):
                return self._send(404, b"not found", "text/plain")
            rel = posixpath.normpath(urllib.parse.unquote(path).lstrip("/"))
            try:
                with open(os.path.join(ROOT, rel), "rb") as f:
                    body = f.read()
            except OSError:
                return self._send(404, b"not found", "text/plain")
            ctype = mimetypes.guess_type(rel)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
                ctype += "; charset=utf-8"
            return self._send(200, body, ctype)

        def do_POST(self):
            if urllib.parse.urlsplit(self.path).path != RESULT_PATH or done.is_set():
                return self._send(404, b"", "text/plain")
            body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
            try:
                result.update(json.loads(body.decode("utf-8")))
            except ValueError:
                result["ok"] = False
                result["error"] = "result was not JSON"
            done.set()
            self._send(204, b"", "text/plain")

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    profile = tempfile.mkdtemp(prefix="btb-smoke-")
    proc = subprocess.Popen(browser_command("http://127.0.0.1:%d%s" % (server.server_address[1], PAGE_PATH), profile),
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not done.wait(timeout):
            return None
        return dict(result)
    finally:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
        server.shutdown()
        server.server_close()
        shutil.rmtree(profile, ignore_errors=True)
