// Two gestures, both chosen to be easy to get right on the first try:
//
//   FINGER COUNT (one hand, held up): selects an isotope.
//     1 finger  -> Uranium-235
//     2 fingers -> Thorium-232
//     3 fingers -> Plutonium-239
//     4 fingers -> Uranium-238
//     (thumb is deliberately ignored — thumb extension detection is unreliable
//      and hand-orientation-dependent; counting only index/middle/ring/pinky
//      is far more consistent across webcams and lighting.)
//
//   CLAP (two hands brought together): launches a neutron bombardment at
//     whatever isotope is currently selected.
//
// Both use DISTANCE RATIOS relative to each hand's own palm size, not raw
// normalized coordinates — this is what makes them work at any distance from
// the camera, unlike the old fixed-threshold pinch/fist detection.

const FINGER_TIP_PIP = [
  { tip: 8, pip: 6 },   // index
  { tip: 12, pip: 10 }, // middle
  { tip: 16, pip: 14 }, // ring
  { tip: 20, pip: 18 }, // pinky
];

const EXTENDED_RATIO = 1.15;    // tip must be this many times farther from wrist than pip to count as "extended"
const CLAP_DISTANCE_RATIO = 2.2; // wrist-to-wrist distance, in units of avg palm size, below which hands count as "clapped"
const CLAP_COOLDOWN = 0.45;      // seconds — prevents one clap re-firing repeatedly while hands linger close together

export const GESTURES = {
  ISOTOPE_SELECTED: 'isotope_selected', // { fingerCount }
  CLAP: 'clap',                          // { position }
  HANDS_UPDATE: 'hands_update',          // continuous, for debug HUD only — not logged to terminal
  HAND_FOUND: 'hand_found',
  HAND_LOST: 'hand_lost',
};

export class GestureController {
  constructor() {
    this.listeners = {};
    this._lastFingerCount = null;
    this._lastClapTime = -999;
    this._wasHandsClose = false;
    this._prevHandCount = 0;
  }

  on(event, cb) {
    (this.listeners[event] ??= []).push(cb);
    return () => { this.listeners[event] = this.listeners[event].filter(fn => fn !== cb); };
  }

  _emit(event, payload) {
    (this.listeners[event] || []).forEach(fn => fn(payload));
  }

  /** Feed this directly from HandTracker's onResults callback — pass `results.landmarks`. */
  update(landmarksList) {
    const now = performance.now() / 1000;
    const handCount = landmarksList.length;

    if (handCount > 0 && this._prevHandCount === 0) this._emit(GESTURES.HAND_FOUND, { handCount });
    if (handCount === 0 && this._prevHandCount > 0) this._emit(GESTURES.HAND_LOST, {});
    this._prevHandCount = handCount;

    if (handCount === 0) {
      this._wasHandsClose = false;
      this._emit(GESTURES.HANDS_UPDATE, { handCount: 0, counts: [], selectedFingerCount: this._lastFingerCount });
      return;
    }

    const handsInfo = landmarksList.map((hand) => {
      const wrist = hand[0];
      const middleMcp = hand[9];
      const palmSize = Math.max(dist3(wrist, middleMcp), 0.001);
      const count = countExtendedFingers(hand, wrist);
      return { hand, wrist, palmSize, count };
    });

    // Primary hand (first in the list) drives isotope selection.
    const primary = handsInfo[0];
    if (primary.count >= 1 && primary.count <= 4 && primary.count !== this._lastFingerCount) {
      this._lastFingerCount = primary.count;
      this._emit(GESTURES.ISOTOPE_SELECTED, { fingerCount: primary.count });
    }

    // Clap needs two hands present.
    let clapDistance = null;
    if (handsInfo.length >= 2) {
      const [a, b] = handsInfo;
      const avgPalm = (a.palmSize + b.palmSize) / 2;
      clapDistance = dist3(a.wrist, b.wrist) / avgPalm;
      const isClose = clapDistance < CLAP_DISTANCE_RATIO;

      if (isClose && !this._wasHandsClose && (now - this._lastClapTime) > CLAP_COOLDOWN) {
        this._lastClapTime = now;
        const midpoint = { x: (a.wrist.x + b.wrist.x) / 2, y: (a.wrist.y + b.wrist.y) / 2 };
        this._emit(GESTURES.CLAP, { position: normToScreen(midpoint) });
      }
      this._wasHandsClose = isClose;
    } else {
      this._wasHandsClose = false;
    }

    this._emit(GESTURES.HANDS_UPDATE, {
      handCount,
      counts: handsInfo.map(h => h.count),
      selectedFingerCount: this._lastFingerCount,
      clapDistance: clapDistance !== null ? clapDistance.toFixed(2) : null,
    });
  }
}

function countExtendedFingers(hand, wrist) {
  let count = 0;
  for (const f of FINGER_TIP_PIP) {
    const dTip = dist3(wrist, hand[f.tip]);
    const dPip = dist3(wrist, hand[f.pip]);
    if (dTip > dPip * EXTENDED_RATIO) count++;
  }
  return count;
}

function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function normToScreen(point) {
  return { x: -(point.x * 2 - 1), y: -(point.y * 2 - 1) };
}