// Neutrons travel at constant SPEED (distance-dependent, not time-fixed), and
// now that speed differs by energy state: thermal neutrons ARE physically
// slower than fast ones — in reality dramatically so (~2200 m/s thermal vs
// ~2×10^7 m/s for a ~2 MeV fission neutron, a ratio of roughly 10,000:1).
// We compress that to a visible 1:0.4 ratio here — a real thermal-speed
// neutron at true scale would be imperceptibly slow relative to a fast one
// on screen. The DIRECTION of the effect (thermal is slower) is real physics;
// the MAGNITUDE is compressed for visibility. This is a deliberate, documented
// simplification, not an attempt at literal speed accuracy.

export const NEUTRON_SPEED = 7;           // base speed for FAST neutrons, units/sec
export const THERMAL_SPEED_FACTOR = 0.4;  // thermal neutrons travel at this fraction of NEUTRON_SPEED
export const MIN_NEUTRON_TRAVEL_TIME = 0.18;

export function computeTravelTime(from, to, energyState = 'fast') {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const speed = NEUTRON_SPEED * (energyState === 'thermal' ? THERMAL_SPEED_FACTOR : 1);
  return Math.max(MIN_NEUTRON_TRAVEL_TIME, distance / speed);
}