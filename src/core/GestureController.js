// Turns raw 21-point hand landmarks into semantic gestures:
//   - PINCH       : thumb tip + index tip close together -> "select" (open radial menu / pick isotope)
//   - OPEN_PALM   : all fingers extended -> "arm" state, shown as a HUD hint
//   - THROW       : rapid forward velocity while pinch releases -> fire single neutron
//   - FIST        : all fingertips curled toward wrist -> bombard the cluster with a
//                    burst of neutrons at once (this is the "let it rip" gesture)
//
// MediaPipe landmark indices (per hand), the ones we actually use:
//   0 = wrist, 4 = thumb tip, 8 = index tip, 12 = middle tip, 16 = ring tip, 20 = pinky tip

const LM = { WRIST: 0, THUMB_TIP: 4, INDEX_TIP: 8, MIDDLE_TIP: 12, RING_TIP: 16, PINKY_TIP: 20 };

const PINCH_THRESHOLD = 0.06;         // normalized distance, tune against your webcam/lighting
const OPEN_PALM_THRESHOLD = 0.18;     // fingertip-to-wrist distance above this = extended
const FIST_THRESHOLD = 0.11;          // fingertip-to-wrist distance below this = curled
const THROW_VELOCITY_THRESHOLD = 0.9; // normalized units/sec
const VELOCITY_SMOOTHING = 0.6;

export const GESTURES = {
  PINCH_START: 'pinch_start',
  PINCH_END: 'pinch_end',
  OPEN_PALM: 'open_palm',
  THROW: 'throw',
  FIST: 'fist',
  HAND_LOST: 'hand_lost',
};

export class GestureController {
  constructor() {
    this.listeners = {};
    this._wasPinching = false;
    this._wasFist = false;
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
      this._wasFist = false;
      this._prevWrist = null;
      return;
    }
    this._hadHand = true;

    const hand = landmarks[0];
    const thumb = hand[LM.THUMB_TIP];
    const index = hand[LM.INDEX_TIP];
    const wrist = hand[LM.WRIST];

    // --- Velocity (needed by both THROW and FIST punch-intensity) ---
    let speed = 0;
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
      speed = Math.hypot(this._smoothedVelocity.x, this._smoothedVelocity.y, this._smoothedVelocity.z);
    }

    // --- Pinch detection ---
    const pinchDist = dist3(thumb, index);
    const isPinching = pinchDist < PINCH_THRESHOLD;

    // --- Fist detection: all four fingertips curled close to the wrist ---
    const tipDistances = [LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP].map(i => dist3(hand[i], wrist));
    const avgTipDist = tipDistances.reduce((a, b) => a + b, 0) / tipDistances.length;
    const isFist = avgTipDist < FIST_THRESHOLD;

    // --- Open palm: all tips extended, and not currently a fist/pinch ---
    const isOpenPalm = tipDistances.every(d => d > OPEN_PALM_THRESHOLD) && !isPinching && !isFist;

    // Fist takes priority over pinch (a closing fist naturally passes through pinch-like
    // distances) — only treat it as a pinch if it's NOT also curling into a fist.
    if (isFist && !this._wasFist) {
      // intensity scales the bombardment size — a fast punch unleashes more neutrons
      const intensity = clamp(speed / THROW_VELOCITY_THRESHOLD, 0.4, 3);
      this._emit(GESTURES.FIST, { position: normToScreen(wrist), intensity });
    }

    if (!isFist) {
      if (isPinching && !this._wasPinching) {
        this._emit(GESTURES.PINCH_START, { position: normToScreen(index) });
      } else if (!isPinching && this._wasPinching) {
        this._emit(GESTURES.PINCH_END, { position: normToScreen(index) });
      }
    }

    if (isOpenPalm) {
      this._emit(GESTURES.OPEN_PALM, { position: normToScreen(wrist) });
    }

    // --- Throw: fast wrist motion while releasing a pinch (single targeted neutron) ---
    if (speed > THROW_VELOCITY_THRESHOLD && this._wasPinching && !isFist) {
      this._emit(GESTURES.THROW, {
        origin: normToScreen(index),
        direction: { x: this._smoothedVelocity.x, y: -this._smoothedVelocity.y },
        speed,
      });
    }

    this._prevWrist = wrist;
    this._prevTime = now;
    this._wasPinching = isPinching && !isFist;
    this._wasFist = isFist;
  }
}

function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// MediaPipe landmarks are normalized [0,1] with origin top-left, mirrored vs. a selfie-view webcam.
// Convert to NDC [-1, 1] for Three.js raycasting, flipping X for the mirror.
function normToScreen(point) {
  return { x: -(point.x * 2 - 1), y: -(point.y * 2 - 1) };
}