// Thermal neutrons travel slower than fast ones — real physics (~10,000:1 in
// reality, compressed here for visibility). The factor was 0.4, which
// compounded badly with global time dilation (a thermal neutron during a
// dense cascade ended up ~10x slower than a fast neutron at normal speed,
// which read as "frozen," not "dramatic"). Raised to 0.55 so the direction
// of the effect stays real but the compounding stays watchable.
export const NEUTRON_SPEED = 7;
export const THERMAL_SPEED_FACTOR = 0.55;
export const MIN_NEUTRON_TRAVEL_TIME = 0.18;

export function computeTravelTime(from, to, energyState = 'fast') {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const speed = NEUTRON_SPEED * (energyState === 'thermal' ? THERMAL_SPEED_FACTOR : 1);
  return Math.max(MIN_NEUTRON_TRAVEL_TIME, distance / speed);
}