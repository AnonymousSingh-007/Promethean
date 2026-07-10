// Turns raw 21-point hand landmarks into semantic gestures:
//   - PINCH       : thumb tip + index tip close together -> "select" (open radial menu / pick isotope)
//   - OPEN_PALM   : all fingers extended -> "arm" state, shown as a HUD hint
//   - THROW       : rapid forward velocity (landmark z decreasing fast) while pinch releases -> fire neutron
//
// MediaPipe landmark indices (per hand), the ones we actually use:
//   0 = wrist, 4 = thumb tip, 8 = index tip, 12 = middle tip, 16 = ring tip, 20 = pinky tip

const LM = { WRIST: 0, THUMB_TIP: 4, INDEX_TIP: 8, MIDDLE_TIP: 12, RING_TIP: 16, PINKY_TIP: 20 };

const PINCH_THRESHOLD = 0.06;      // normalized distance, tune against your webcam/lighting
const THROW_VELOCITY_THRESHOLD = 0.9; // normalized units/sec, tune empirically
const VELOCITY_SMOOTHING = 0.6;

export const GESTURES = {
  PINCH_START: 'pinch_start',
  PINCH_END: 'pinch_end',
  OPEN_PALM: 'open_palm',
  THROW: 'throw',
  HAND_LOST: 'hand_lost',
};

export class GestureController {
  constructor() {
    this.listeners = {};
    this._wasPinching = false;
    this._prevWrist = null;
    this._prevTime = null;
    this._smoothedVelocity = { x: 0, y: 0, z: 0 };
    this._hadHand = false;
  }

  on(event, cb) {
    (this.listeners[event] ??= []).push(cb);
    return () => { this.listeners[event] = this.listeners[event].filter(fn => fn !== cb); };
  }

  _emit(event, payload) {
    (this.listeners[event] || []).forEach(fn => fn(payload));
  }

  /** Feed this directly from HandTracker's onResults callback. */
  update({ landmarks }) {
    const now = performance.now() / 1000;

    if (!landmarks.length) {
      if (this._hadHand) this._emit(GESTURES.HAND_LOST, {});
      this._hadHand = false;
      this._wasPinching = false;
      this._prevWrist = null;
      return;
    }
    this._hadHand = true;

    const hand = landmarks[0];
    const thumb = hand[LM.THUMB_TIP];
    const index = hand[LM.INDEX_TIP];
    const wrist = hand[LM.WRIST];

    // --- Pinch detection ---
    const pinchDist = dist3(thumb, index);
    const isPinching = pinchDist < PINCH_THRESHOLD;

    if (isPinching && !this._wasPinching) {
      this._emit(GESTURES.PINCH_START, { position: normToScreen(index) });
    } else if (!isPinching && this._wasPinching) {
      this._emit(GESTURES.PINCH_END, { position: normToScreen(index) });
    }

    // --- Open palm detection (all tips far from wrist relative to palm size) ---
    const spread = [LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP]
      .map(i => dist3(hand[i], wrist))
      .every(d => d > 0.18);
    if (spread && !isPinching) {
      this._emit(GESTURES.OPEN_PALM, { position: normToScreen(wrist) });
    }

    // --- Throw detection: wrist velocity spike, primarily toward camera (z decreasing) ---
    if (this._prevWrist && this._prevTime) {
      const dt = Math.max(now - this._prevTime, 1 / 120);
      const vRaw = {
        x: (wrist.x - this._prevWrist.x) / dt,
        y: (wrist.y - this._prevWrist.y) / dt,
        z: (wrist.z - this._prevWrist.z) / dt,
      };
      this._smoothedVelocity = {
        x: lerp(this._smoothedVelocity.x, vRaw.x, VELOCITY_SMOOTHING),
        y: lerp(this._smoothedVelocity.y, vRaw.y, VELOCITY_SMOOTHING),
        z: lerp(this._smoothedVelocity.z, vRaw.z, VELOCITY_SMOOTHING),
      };
      const speed = Math.hypot(this._smoothedVelocity.x, this._smoothedVelocity.y, this._smoothedVelocity.z);

      if (speed > THROW_VELOCITY_THRESHOLD && this._wasPinching) {
        // releasing a pinch with high velocity = a throw. Direction is screen-space, magnitude drives particle speed.
        this._emit(GESTURES.THROW, {
          origin: normToScreen(index),
          direction: { x: this._smoothedVelocity.x, y: -this._smoothedVelocity.y }, // flip y: screen space is inverted vs. normalized coords
          speed,
        });
      }
    }

    this._prevWrist = wrist;
    this._prevTime = now;
    this._wasPinching = isPinching;
  }
}

function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// MediaPipe landmarks are normalized [0,1] with origin top-left, mirrored vs. a selfie-view webcam.
// Convert to NDC [-1, 1] for Three.js raycasting, flipping X for the mirror.
function normToScreen(point) {
  return { x: -(point.x * 2 - 1), y: -(point.y * 2 - 1) };
}
