// Two binary gestures, both far more reliable than counting:
//
//   FLAT PALM (all five digits extended, hysteresis-smoothed): toggles the
//     isotope selection menu. Selection itself happens via keyboard number
//     keys (see main.js) — the palm just brings up the reference menu, it
//     doesn't select anything itself, so a missed/late palm detection never
//     costs you a wrong selection, only a missing helper panel.
//
//   ONE FINGER (index extended, everything else curled): hold to charge,
//     release to fire. Hold duration sets the tier (LOW/MED/HIGH), same idea
//     as the old two-hand clap-hold, but single-hand and far more reliable
//     since it's one clean binary shape instead of a two-hand distance/timing
//     read.
//
// Every finger's extended/curled state uses per-finger HYSTERESIS: a finger
// needs to clear a higher "enter" angle to become extended, but must drop
// below a lower "exit" angle to become curled again. This kills the flicker
// that happens when a finger's angle hovers right at a single shared
// threshold — a real, common failure mode with plain thresholding.

const FINGER_JOINTS = {
  thumb:  { mcp: 2, pip: 3, tip: 4 },
  index:  { mcp: 5, pip: 6, tip: 8 },
  middle: { mcp: 9, pip: 10, tip: 12 },
  ring:   { mcp: 13, pip: 14, tip: 16 },
  pinky:  { mcp: 17, pip: 18, tip: 20 },
};

const FINGER_ENTER_ANGLE = (155 * Math.PI) / 180;
const FINGER_EXIT_ANGLE = (130 * Math.PI) / 180;
const THUMB_ENTER_ANGLE = (145 * Math.PI) / 180;
const THUMB_EXIT_ANGLE = (115 * Math.PI) / 180;

const PALM_STABLE_FRAMES = 4;

const CLAP_COOLDOWN = 0.45;
const CHARGE_TAP_MAX = 0.15;
const CHARGE_MED_MAX = 0.6;
const CHARGE_FULL = 1.0;

export const GESTURES = {
  PALM_SHOWN: 'palm_shown',
  PALM_HIDDEN: 'palm_hidden',
  CHARGE_START: 'charge_start',
  CHARGING: 'charging',
  CHARGE_CANCEL: 'charge_cancel',
  CLAP: 'clap', // fires on release of the one-finger charge
  HANDS_UPDATE: 'hands_update',
  HAND_FOUND: 'hand_found',
  HAND_LOST: 'hand_lost',
};

export class GestureController {
  constructor() {
    this.listeners = {};
    this._fingerState = { thumb: false, index: false, middle: false, ring: false, pinky: false };
    this._palmStreak = 0;
    this._notPalmStreak = 0;
    this._menuVisible = false;
    this._wasOnePoint = false;
    this._isCharging = false;
    this._chargeSince = null;
    this._lastClapTime = -999;
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
      this._fingerState = { thumb: false, index: false, middle: false, ring: false, pinky: false };
      this._palmStreak = 0;
      this._notPalmStreak = 0;
      if (this._menuVisible) {
        this._menuVisible = false;
        this._emit(GESTURES.PALM_HIDDEN, {});
      }
      if (this._isCharging) {
        this._isCharging = false;
        this._chargeSince = null;
        this._emit(GESTURES.CHARGE_CANCEL, {});
      }
      this._wasOnePoint = false;
      this._emit(GESTURES.HANDS_UPDATE, { handVisible: false });
      return;
    }

    const hand = landmarksList[0];
    for (const [name, joints] of Object.entries(FINGER_JOINTS)) {
      const angle = jointAngle(hand[joints.mcp], hand[joints.pip], hand[joints.tip]);
      const enter = name === 'thumb' ? THUMB_ENTER_ANGLE : FINGER_ENTER_ANGLE;
      const exit = name === 'thumb' ? THUMB_EXIT_ANGLE : FINGER_EXIT_ANGLE;
      this._fingerState[name] = this._fingerState[name] ? angle > exit : angle > enter;
    }

    const { thumb, index, middle, ring, pinky } = this._fingerState;
    const isFlatPalm = thumb && index && middle && ring && pinky;
    const isOnePoint = index && !middle && !ring && !pinky; // thumb ignored — ambiguous during natural pointing

    // --- Palm -> menu toggle ---
    if (isFlatPalm) {
      this._palmStreak++;
      this._notPalmStreak = 0;
      if (this._palmStreak === PALM_STABLE_FRAMES && !this._menuVisible) {
        this._menuVisible = true;
        this._emit(GESTURES.PALM_SHOWN, {});
      }
    } else {
      this._notPalmStreak++;
      this._palmStreak = 0;
      if (this._notPalmStreak === PALM_STABLE_FRAMES && this._menuVisible) {
        this._menuVisible = false;
        this._emit(GESTURES.PALM_HIDDEN, {});
      }
    }

    // --- One-finger charge/fire ---
    const indexTip = normToScreen(hand[8]);

    if (isOnePoint && !this._wasOnePoint && (now - this._lastClapTime) > CLAP_COOLDOWN) {
      this._chargeSince = now;
      this._isCharging = true;
      this._emit(GESTURES.CHARGE_START, { position: indexTip });
    }

    if (isOnePoint && this._isCharging) {
      const holdDuration = now - this._chargeSince;
      const progress = Math.min(1, holdDuration / CHARGE_FULL);
      this._emit(GESTURES.CHARGING, { position: indexTip, progress, holdDuration });
    }

    if (!isOnePoint && this._wasOnePoint && this._isCharging) {
      const holdDuration = now - this._chargeSince;
      this._isCharging = false;
      this._chargeSince = null;
      this._lastClapTime = now;
      const tier = holdDuration < CHARGE_TAP_MAX ? 'LOW' : holdDuration < CHARGE_MED_MAX ? 'MED' : 'HIGH';
      this._emit(GESTURES.CLAP, { position: indexTip, tier, holdDuration });
    }

    this._wasOnePoint = isOnePoint;

    this._emit(GESTURES.HANDS_UPDATE, {
      handVisible: true,
      fingerState: { ...this._fingerState },
      isFlatPalm,
      isOnePoint,
      menuVisible: this._menuVisible,
      charging: this._isCharging,
      chargeProgress: this._isCharging ? Math.min(1, (now - this._chargeSince) / CHARGE_FULL) : 0,
    });
  }
}

function jointAngle(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = a.z - b.z;
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = c.z - b.z;
  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const m1 = Math.hypot(v1x, v1y, v1z), m2 = Math.hypot(v2x, v2y, v2z);
  const cos = dot / ((m1 * m2) || 1e-6);
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

function normToScreen(point) {
  return { x: -(point.x * 2 - 1), y: -(point.y * 2 - 1) };
}