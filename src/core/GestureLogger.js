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

    if (import.meta.env.DEV) {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => {});
    }
  }
}