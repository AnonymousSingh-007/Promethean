// FINGER COUNT (one hand, held up, debounced): selects an isotope.
//   1-4 = index/middle/ring/pinky, as before.
//   5   = all four PLUS thumb. Thumb detection is noisier than the other
//         four digits (shorter range of motion, more orientation-dependent),
//         so isotope 5 (Cf-252) may take a bit more deliberate effort to
//         trigger reliably. Keyboard key '5' always works as a fallback.
//
// CLAP (two hands together): launches a bombardment. IMPORTANT: the moment a
// second hand appears in frame, finger-count reading freezes entirely (the
// pending debounce buffer is cleared and not resumed until back to exactly
// one hand). This exists because MediaPipe's hand ordering isn't guaranteed
// stable frame-to-frame — without this freeze, your clapping hand could
// occasionally get misread as the "primary" selection hand mid-clap and
// silently overwrite your locked-in choice.

const FINGER_TIP_PIP = [
  { tip: 8, pip: 6 },   // index
  { tip: 12, pip: 10 }, // middle
  { tip: 16, pip: 14 }, // ring
  { tip: 20, pip: 18 }, // pinky
];
const THUMB_TIP_IP = { tip: 4, pip: 3 };

const EXTENDED_RATIO = 1.15;
const EXTENDED_RATIO_THUMB = 1.1; // thumb has a shorter natural extension range, slightly looser threshold
const CLAP_DISTANCE_RATIO = 2.2;
const CLAP_COOLDOWN = 0.45;
const STABLE_FRAMES_REQUIRED = 5;

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

    // --- Debounced isotope selection — ONLY when exactly one hand is visible ---
    if (handCount === 1) {
      const primary = handsInfo[0];
      if (primary.count >= 1 && primary.count <= 5) {
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
    } else {
      // Two (or more) hands present — freeze selection reading so a clap can't corrupt it.
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
    if (dist3(wrist, hand[f.tip]) > dist3(wrist, hand[f.pip]) * EXTENDED_RATIO) count++;
  }
  if (dist3(wrist, hand[THUMB_TIP_IP.tip]) > dist3(wrist, hand[THUMB_TIP_IP.pip]) * EXTENDED_RATIO_THUMB) count++;
  return count;
}

function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function normToScreen(point) {
  return { x: -(point.x * 2 - 1), y: -(point.y * 2 - 1) };
}