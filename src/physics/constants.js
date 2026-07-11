// Neutrons now travel at a constant SPEED, not a constant TIME. This matters:
// with fixed travel time, a long incoming shot (from your hand, ~14 units away)
// and a short cascade hop (~2-3 units between neighboring atoms) both took the
// same 0.5s — so the shot you actually want to watch was moving proportionally
// faster (blurring past) than the routine internal hops. Fixed speed means
// distance determines duration naturally: incoming shots are slow and visible,
// cascade hops stay snappy.

export const NEUTRON_SPEED = 10; // units per second
export const MIN_NEUTRON_TRAVEL_TIME = 0.18; // floor so extremely short hops don't feel instantaneous

export function computeTravelTime(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Math.max(MIN_NEUTRON_TRAVEL_TIME, distance / NEUTRON_SPEED);
}