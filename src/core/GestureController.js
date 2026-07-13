const MAX_BUFFER = 300;

export class GestureLogger {
  constructor() {
    this.buffer = [];
    this._startTime = performance.now();
    if (typeof window !== 'undefined') {
      window.__gestureLog = this.buffer;
    }
  }

  log(event, payload = {}) {
    const entry = { t: Math.round(performance.now() - this._startTime), event, payload };
    this.buffer.push(entry);
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();

    // /api/log only exists in `vite dev` (see vite.config.js) — skip the
    // network call entirely in production builds instead of firing a
    // request that will always fail (harmless, but wasteful).
    if (import.meta.env.DEV) {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => {});
    }
  }
}