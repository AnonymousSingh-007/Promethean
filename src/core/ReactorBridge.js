// Thin wrapper around the Web Worker — gives the main thread a clean
// promise/event interface instead of raw postMessage/onmessage.
// The worker does all physics; this file is just the communication layer.

export class ReactorBridge {
  constructor() {
    this._worker = new Worker(new URL('../physics/ReactorCore.worker.js', import.meta.url), { type: 'module' });
    this._listeners = {};
    this._worker.onmessage = ({ data }) => this._dispatch(data);
    this._worker.onerror = (err) => console.error('[ReactorBridge] Worker error:', err);
  }

  on(type, cb) {
    (this._listeners[type] ??= []).push(cb);
    return () => {
      this._listeners[type] = this._listeners[type].filter(fn => fn !== cb);
    };
  }

  _dispatch({ type, payload }) {
    (this._listeners[type] || []).forEach(fn => fn(payload));
  }

  fire(isotopeId, count, origin) {
    this._worker.postMessage({ type: 'FIRE', payload: { isotopeId, count, origin } });
  }

  setIsotope(isotopeId) {
    this._worker.postMessage({ type: 'SET_ISOTOPE', payload: { isotopeId } });
  }

  setContainment(active) {
    this._worker.postMessage({ type: 'SET_CONTAINMENT', payload: { active } });
  }

  setControlRods(insertion) {
    this._worker.postMessage({ type: 'SET_CONTROL_RODS', payload: { insertion } });
  }

  reset(isotopeId) {
    this._worker.postMessage({ type: 'RESET', payload: { isotopeId } });
  }

  terminate() {
    this._worker.terminate();
  }
}