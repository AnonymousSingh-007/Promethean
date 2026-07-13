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

// Slower, deeper charge curve with a 4th tier. Holding longer now meaningfully
// keeps climbing instead of maxing out at "HIGH" after 0.6s.
const CHARGE_TAP_MAX = 0.2;   // < this -> LOW
const CHARGE_MED_MAX = 0.8;   // < this -> MED
const CHARGE_HIGH_MAX = 1.8;  // < this -> HIGH, else -> ULTRA
const CHARGE_FULL = 2.0;      // visual charge-progress caps here (roughly aligned with the ULTRA threshold)

export const GESTURES = {
  PALM_SHOWN: 'palm_shown',
  PALM_HIDDEN: 'palm_hidden',
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
    const isOnePoint = index && !middle && !ring && !pinky;

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
      const tier = holdDuration < CHARGE_TAP_MAX ? 'LOW'
        : holdDuration < CHARGE_MED_MAX ? 'MED'
        : holdDuration < CHARGE_HIGH_MAX ? 'HIGH'
        : 'ULTRA';
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