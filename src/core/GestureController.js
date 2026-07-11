// FINGER COUNT (one hand, debounced): selects an isotope, unchanged from before.
//
// CLAP is now a CHARGE-HOLD gesture:
//   1. Hands come together  -> CHARGE_START fires, charging begins
//   2. While held together  -> CHARGING fires every frame with a 0-1 progress
//      value (for VFX to show a growing charge effect at the hands)
//   3. Hands pull apart      -> CLAP fires, with a tier based on how long they
//      were held together: quick tap = LOW, brief hold = MED, longer hold = HIGH
//   4. If hands are lost entirely while charging (not separated deliberately,
//      just tracking lost) -> CHARGE_CANCEL fires instead of CLAP, so losing
//      hand tracking mid-charge never accidentally fires a burst.
//
// This replaces the old "clap height = intensity" scheme, which turned out to
// be miscalibrated: a natural clap in front of a face-level webcam sits in the
// lower half of frame, so HIGH (which required clapping near the top) almost
// never fired. Hold duration doesn't have that problem — it's a 1D signal,
// not tied to camera framing.

const FINGER_TIP_PIP = [
  { tip: 8, pip: 6 },
  { tip: 12, pip: 10 },
  { tip: 16, pip: 14 },
  { tip: 20, pip: 18 },
];
const THUMB_TIP_IP = { tip: 4, pip: 3 };

const EXTENDED_RATIO = 1.15;
const EXTENDED_RATIO_THUMB = 1.1;
const CLAP_DISTANCE_RATIO = 2.2;
const CLAP_COOLDOWN = 0.45;
const STABLE_FRAMES_REQUIRED = 5;

const CHARGE_TAP_MAX = 0.15;  // hold shorter than this -> LOW
const CHARGE_MED_MAX = 0.6;   // hold shorter than this (but over tap) -> MED, longer -> HIGH
const CHARGE_FULL = 1.0;      // hold duration at which the charge VFX progress caps at 1.0

export const GESTURES = {
  ISOTOPE_SELECTED: 'isotope_selected',
  CHARGE_START: 'charge_start',
  CHARGING: 'charging',
  CHARGE_CANCEL: 'charge_cancel',
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
    this._isCharging = false;
    this._handsTogetherSince = null;
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
      if (this._isCharging) {
        this._isCharging = false;
        this._handsTogetherSince = null;
        this._emit(GESTURES.CHARGE_CANCEL, {});
      }
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

    // --- Debounced isotope selection — only when exactly one hand is visible ---
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
      if (this._isCharging) {
        // second hand vanished without a clean separation — cancel rather than fire
        this._isCharging = false;
        this._handsTogetherSince = null;
        this._emit(GESTURES.CHARGE_CANCEL, {});
      }
      this._wasHandsClose = false;
    } else {
      // Two+ hands present — freeze isotope selection, run the charge-hold state machine.
      this._pendingCount = null;
      this._pendingStreak = 0;

      const [a, b] = handsInfo;
      const avgPalm = (a.palmSize + b.palmSize) / 2;
      const clapDistance = dist3(a.wrist, b.wrist) / avgPalm;
      const isClose = clapDistance < CLAP_DISTANCE_RATIO;
      const midpoint = { x: (a.wrist.x + b.wrist.x) / 2, y: (a.wrist.y + b.wrist.y) / 2 };

      if (isClose && !this._wasHandsClose && (now - this._lastClapTime) > CLAP_COOLDOWN) {
        this._handsTogetherSince = now;
        this._isCharging = true;
        this._emit(GESTURES.CHARGE_START, { position: normToScreen(midpoint) });
      }

      if (isClose && this._isCharging) {
        const holdDuration = now - this._handsTogetherSince;
        const progress = Math.min(1, holdDuration / CHARGE_FULL);
        this._emit(GESTURES.CHARGING, { position: normToScreen(midpoint), progress, holdDuration });
      }

      if (!isClose && this._wasHandsClose && this._isCharging) {
        const holdDuration = now - this._handsTogetherSince;
        this._isCharging = false;
        this._handsTogetherSince = null;
        this._lastClapTime = now;
        const tier = holdDuration < CHARGE_TAP_MAX ? 'LOW' : holdDuration < CHARGE_MED_MAX ? 'MED' : 'HIGH';
        this._emit(GESTURES.CLAP, { position: normToScreen(midpoint), tier, holdDuration });
      }

      this._wasHandsClose = isClose;

      this._emit(GESTURES.HANDS_UPDATE, {
        handCount,
        counts: handsInfo.map(h => h.count),
        selectedFingerCount: this._lastFingerCount,
        pendingCount: null,
        pendingStreak: 0,
        clapDistance: clapDistance.toFixed(2),
        charging: this._isCharging,
        chargeProgress: this._isCharging ? Math.min(1, (now - this._handsTogetherSince) / CHARGE_FULL) : 0,
      });
      return;
    }

    this._emit(GESTURES.HANDS_UPDATE, {
      handCount,
      counts: handsInfo.map(h => h.count),
      selectedFingerCount: this._lastFingerCount,
      pendingCount: this._pendingCount,
      pendingStreak: this._pendingStreak,
      clapDistance: null,
      charging: false,
      chargeProgress: 0,
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