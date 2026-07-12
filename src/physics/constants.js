export const NEUTRON_SPEED = 7; // units/sec — slowed further so incoming shots are clearly watchable, not a blur
export const MIN_NEUTRON_TRAVEL_TIME = 0.18;

export function computeTravelTime(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Math.max(MIN_NEUTRON_TRAVEL_TIME, distance / NEUTRON_SPEED);
}