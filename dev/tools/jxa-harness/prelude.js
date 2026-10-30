// Stubs so the project's browser-scoped code runs unmodified under
// osascript -l JavaScript. setTimeout runs its callback immediately, which
// is enough for the project's async/await code to resolve correctly.
function setTimeout(fn, _delay) { fn(); return 0; }
function clearTimeout(_id) {}

class AbortController {
  constructor() { this.signal = {}; }
  abort() {}
}

// JXA's built-in `console` only implements .log; the project's error paths
// (e.g. js/api/edhrec.js's fetchEdhrecThemePage) call console.warn/.error,
// which would otherwise throw "console.warn is not a function".
if (typeof console.warn !== "function") console.warn = console.log;
if (typeof console.error !== "function") console.error = console.log;

const localStorage = (function () {
  const store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; }
  };
})();

// fetch is overridden per-harness-run (compare.js defines it against
// prefetch_data.json before calling any project code that needs it), so this
// is only a safety-net default.
function fetch(_url, _opts) {
  return Promise.reject(new Error("fetch stub not configured for this harness run"));
}
