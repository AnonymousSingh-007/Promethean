// Buffers recent gesture events in memory (window.__gestureLog — inspect anytime
// in devtools) AND mirrors each one to the actual terminal running `npm run dev`
// via the /api/log dev-server middleware in vite.config.js. Nothing persists to
// disk; restarting the dev server clears everything. This is intentionally
// throwaway — it's for comparing gesture behavior take-to-take, not analytics.

const MAX_BUFFER = 300;

export class GestureLogger {
  constructor() {
    this.buffer = [];
    this._startTime = performance.now();
    if (typeof window !== 'undefined') {
      window.__gestureLog = this.buffer; // quick inspection: type `__gestureLog` in devtools console
    }
  }

  log(event, payload = {}) {
    const entry = { t: Math.round(performance.now() - this._startTime), event, payload };
    this.buffer.push(entry);
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();

    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {}); // dev-only endpoint — silently no-ops in production builds
  }
}