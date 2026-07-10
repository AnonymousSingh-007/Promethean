// Stylized, not textbook-accurate — tuned for visual pacing, not nuclear engineering.
// fissionProbability: chance a neutron hit causes this atom to fission
// neutronsEmitted: [min, max] neutrons released on fission
// energy: arbitrary units, drives shader intensity + HUD score
// criticalMassHint: rough atom count in a cluster before cascades tend to run away
// color: hex, used for atom material + fission burst tint

export const ISOTOPES = {
  U235: {
    id: 'U235',
    label: 'Uranium-235',
    fissionProbability: 0.85,
    neutronsEmitted: [2, 3],
    energy: 200,
    criticalMassHint: 40,
    color: 0x7CFC9C,
  },
  U238: {
    id: 'U238',
    label: 'Uranium-238',
    fissionProbability: 0.15, // mostly absorbs neutrons without fissioning — "fertile" not "fissile"
    neutronsEmitted: [0, 1],
    energy: 60,
    criticalMassHint: 200,
    color: 0x6C8CFF,
  },
  Pu239: {
    id: 'Pu239',
    label: 'Plutonium-239',
    fissionProbability: 0.9,
    neutronsEmitted: [2, 4],
    energy: 260,
    criticalMassHint: 25,
    color: 0xFF6C6C,
  },
  Th232: {
    id: 'Th232',
    label: 'Thorium-232',
    fissionProbability: 0.05,
    neutronsEmitted: [0, 1],
    energy: 30,
    criticalMassHint: 300,
    color: 0xFFD76C,
  },
};

export function getIsotope(id) {
  const iso = ISOTOPES[id];
  if (!iso) throw new Error(`Unknown isotope: ${id}`);
  return iso;
}

export function randomNeutronCount([min, max]) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
