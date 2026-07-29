// Receives a complete time-stamped event log from the worker and plays it
// back on the main thread at a controlled speed, calling registered
// handlers for each event at the right wall-clock moment.
//
// This is the critical decoupling point: physics ran in microseconds inside
// the worker; playback runs at whatever pace looks right visually. The same
// cascade can be replayed at any speed with zero re-computation.
//
// PLAYBACK_SPEED = 0.3 means a cascade that took 0.5s in simulation time
// plays back over ~1.67s in wall time. Adjust to taste.

const PLAYBACK_SPEED = 0.3;

export class PlaybackEngine {
  constructor() {
    this._handlers = {};
    this._queue = [];
    this._playing = false;
    this._startWallTime = null;
    this._startSimTime = null;
  }

  on(eventType, cb) {
    (this._handlers[eventType] ??= []).push(cb);
    return () => {
      this._handlers[eventType] = (this._handlers[eventType] || []).filter(fn => fn !== cb);
    };
  }

  _fire(eventType, payload) {
    (this._handlers[eventType] || []).forEach(fn => fn(payload));
  }

  /**
   * Load a recorded event log and begin playback. Any currently-playing
   * cascade is discarded — call this whenever the worker sends CASCADE_READY.
   */
  load(eventLog) {
    this._queue = [...eventLog].sort((a, b) => a.simTime - b.simTime);
    this._playing = true;
    this._startWallTime = performance.now() / 1000;
    this._startSimTime = this._queue[0]?.simTime ?? 0;
    this._fire('playback_start', { totalEvents: this._queue.length });
  }

  cancel() {
    this._queue = [];
    this._playing = false;
    this._fire('playback_cancelled', {});
  }

  get isPlaying() {
    return this._playing && this._queue.length > 0;
  }

  /**
   * Call this once per render frame. It dispatches all events whose
   * playback time has been reached, leaving future events in the queue.
   * This keeps the render loop fully in control — no timers, no callbacks
   * that fire outside the frame, no race conditions.
   */
  tick() {
    if (!this._playing || this._queue.length === 0) return;

    const wallNow = performance.now() / 1000;
    const wallElapsed = wallNow - this._startWallTime;
    const simElapsed = wallElapsed * PLAYBACK_SPEED;
    const simNow = this._startSimTime + simElapsed;

    while (this._queue.length > 0 && this._queue[0].simTime <= simNow) {
      const { type, payload } = this._queue.shift();
      this._fire(type, payload);
    }

    if (this._queue.length === 0) {
      this._playing = false;
      this._fire('playback_complete', {});
    }
  }
}