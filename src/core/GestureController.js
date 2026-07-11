// FINGER COUNT (one hand, debounced, angle-based): selects an isotope.
//
// Detection method: each finger is counted as "extended" based on the joint
// ANGLE at its middle knuckle (PIP), not distance from the wrist. A straight
// finger has a PIP angle near 180°; a curled one is well under 150°. This is
// far more robust than the old wrist-distance-ratio method — in particular it
// correctly handles the very common case where someone's ring finger can't
// fully curl independently of the pinky (a real biomechanical limitation, not
// a user error) — a distance-ratio check misreads that stuck-halfway ring
// finger as "extended" about half the time; an angle check correctly sees
// that the knuckle really is bent and counts it as curled.
//
// Once a selection locks in, finger-count changes are ignored for
// SELECTION_LOCK_COOLDOWN seconds — this stops rapid back-and-forth
// reselection from residual noise, forcing a deliberate pause before
// switching again.
//
// CLAP remains the charge-hold gesture from before: hold hands together,
// release to fire, hold duration sets the tier.

const FINGER_JOINTS = [
  { mcp: 5, pip: 6, tip: 8 },    // index
  { mcp: 9, pip: 10, tip: 12 },  // middle
  { mcp: 13, pip: 14, tip: 16 }, // ring
  { mcp: 17, pip: 18, tip: 20 }, // pinky
];
const THUMB_JOINTS = { mcp: 2, ip: 3, tip: 4 };

const FINGER_EXTENDED_ANGLE = (150 * Math.PI) / 180; // finger counted extended if its PIP angle exceeds this
const THUMB_EXTENDED_ANGLE = (140 * Math.PI) / 180;  // thumb rarely fully straightens, slightly looser threshold

const CLAP_DISTANCE_RATIO = 2.2;
const CLAP_COOLDOWN = 0.45;
const STABLE_FRAMES_REQUIRED = 7; // ~115ms at 60fps — slightly stricter than before, cheap now that detection itself is more accurate
const SELECTION_LOCK_COOLDOWN = 1.2; // seconds a fresh selection is immune to being overridden

const CHARGE_TAP_MAX = 0.15;
const CHARGE_MED_MAX = 0.6;
const CHARGE_FULL = 1.0;

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
    this._lastSelectionTime = -999;
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
      const count = countExtendedFingers(hand);
      return { hand, wrist, palmSize, count };
    });

    if (handCount === 1) {
      const primary = handsInfo[0];
      const lockRemaining = Math.max(0, SELECTION_LOCK_COOLDOWN - (now - this._lastSelectionTime));

      if (primary.count >= 1 && primary.count <= 5) {
        if (primary.count === this._pendingCount) {
          this._pendingStreak++;
        } else {
          this._pendingCount = primary.count;
          this._pendingStreak = 1;
        }
        if (
          this._pendingStreak >= STABLE_FRAMES_REQUIRED &&
          primary.count !== this._lastFingerCount &&
          lockRemaining <= 0
        ) {
          this._lastFingerCount = primary.count;
          this._lastSelectionTime = now;
          this._emit(GESTURES.ISOTOPE_SELECTED, { fingerCount: primary.count });
        }
      } else {
        this._pendingCount = null;
        this._pendingStreak = 0;
      }

      if (this._isCharging) {
        this._isCharging = false;
        this._handsTogetherSince = null;
        this._emit(GESTURES.CHARGE_CANCEL, {});
      }
      this._wasHandsClose = false;

      this._emit(GESTURES.HANDS_UPDATE, {
        handCount,
        counts: handsInfo.map(h => h.count),
        selectedFingerCount: this._lastFingerCount,
        pendingCount: this._pendingCount,
        pendingStreak: this._pendingStreak,
        lockCooldownRemaining: lockRemaining,
        clapDistance: null,
        charging: false,
        chargeProgress: 0,
      });
      return;
    }

    // --- Two+ hands: freeze selection, run charge-hold state machine ---
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
      lockCooldownRemaining: 0,
      clapDistance: clapDistance.toFixed(2),
      charging: this._isCharging,
      chargeProgress: this._isCharging ? Math.min(1, (now - this._handsTogetherSince) / CHARGE_FULL) : 0,
    });
  }
}

function countExtendedFingers(hand) {
  let count = 0;
  for (const f of FINGER_JOINTS) {
    const angle = jointAngle(hand[f.mcp], hand[f.pip], hand[f.tip]);
    if (angle > FINGER_EXTENDED_ANGLE) count++;
  }
  const thumbAngle = jointAngle(hand[THUMB_JOINTS.mcp], hand[THUMB_JOINTS.ip], hand[THUMB_JOINTS.tip]);
  if (thumbAngle > THUMB_EXTENDED_ANGLE) count++;
  return count;
}

/** Angle at point b, between rays b->a and b->c, in radians. */
function jointAngle(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = a.z - b.z;
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = c.z - b.z;
  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const m1 = Math.hypot(v1x, v1y, v1z), m2 = Math.hypot(v2x, v2y, v2z);
  const cos = dot / ((m1 * m2) || 1e-6);
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function normToScreen(point) {
  return { x: -(point.x * 2 - 1), y: -(point.y * 2 - 1) };
}