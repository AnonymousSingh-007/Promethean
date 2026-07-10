// Two gestures:
//   FINGER COUNT (one hand, held up): selects an isotope, but only after the
//     SAME count has been stable for STABLE_FRAMES_REQUIRED consecutive frames.
//     This is the debounce fix — without it, natural hand micro-tremor flickers
//     between adjacent counts (2/3, 3/4) and fires selection changes you never
//     intended. At ~60fps, 5 frames is well under 100ms — imperceptible as a
//     delay, but enough to reject single-frame noise.
//   CLAP (two hands brought together): launches a neutron bombardment at
//     whatever isotope is currently selected.

const FINGER_TIP_PIP = [
  { tip: 8, pip: 6 },
  { tip: 12, pip: 10 },
  { tip: 16, pip: 14 },
  { tip: 20, pip: 18 },
];

const EXTENDED_RATIO = 1.15;
const CLAP_DISTANCE_RATIO = 2.2;
const CLAP_COOLDOWN = 0.45;
const STABLE_FRAMES_REQUIRED = 5; // consecutive frames a finger count must hold before it fires

export const GESTURES = {
  ISOTOPE_SELECTED: 'isotope_selected',
  CLAP: 'clap',
  HANDS_UPDATE: 'hands_update',
  HAND_FOUND: 'hand_found',
  HAND_LOST: 'hand_lost',
};

export class GestureController {
  constructor() {
    this.listeners = {};
    this._lastFingerCount = null;
    this._pendingCount = null;
    this._pendingStreak = 0;
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

  update(landmarksList) {
    const now = performance.now() / 1000;
    const handCount = landmarksList.length;

    if (handCount > 0 && this._prevHandCount === 0) this._emit(GESTURES.HAND_FOUND, { handCount });
    if (handCount === 0 && this._prevHandCount > 0) this._emit(GESTURES.HAND_LOST, {});
    this._prevHandCount = handCount;

    if (handCount === 0) {
      this._wasHandsClose = false;
      this._pendingCount = null;
      this._pendingStreak = 0;
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

    // --- Debounced isotope selection ---
    const primary = handsInfo[0];
    if (primary.count >= 1 && primary.count <= 4) {
      if (primary.count === this._pendingCount) {
        this._pendingStreak++;
      } else {
        this._pendingCount = primary.count;
        this._pendingStreak = 1;
      }
      if (this._pendingStreak >= STABLE_FRAMES_REQUIRED && primary.count !== this._lastFingerCount) {
        this._lastFingerCount = primary.count;
        this._emit(GESTURES.ISOTOPE_SELECTED, { fingerCount: primary.count });
      }
    } else {
      this._pendingCount = null;
      this._pendingStreak = 0;
    }

    // --- Clap ---
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
      pendingCount: this._pendingCount,
      pendingStreak: this._pendingStreak,
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