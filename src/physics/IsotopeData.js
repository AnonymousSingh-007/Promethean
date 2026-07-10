// Stylized, not textbook-accurate — tuned for visual pacing, not nuclear engineering.

export const ISOTOPES = {
  U235: {
    id: 'U235',
    label: 'Uranium-235',
    fissionProbability: 0.85,
    neutronsEmitted: [2, 3],
    energy: 200,
    color: 0x7CFC9C,
  },
  Th232: {
    id: 'Th232',
    label: 'Thorium-232',
    fissionProbability: 0.05,
    neutronsEmitted: [0, 1],
    energy: 30,
    color: 0xFFD76C,
  },
  Pu239: {
    id: 'Pu239',
    label: 'Plutonium-239',
    fissionProbability: 0.9,
    neutronsEmitted: [2, 4],
    energy: 260,
    color: 0xFF6C6C,
  },
  U238: {
    id: 'U238',
    label: 'Uranium-238',
    fissionProbability: 0.15,
    neutronsEmitted: [0, 1],
    energy: 60,
    color: 0x6C8CFF,
  },
};

// Held-up finger count -> isotope. Thumb is deliberately excluded from counting
// (see GestureController.js) so this only ever resolves to 1-4.
export const FINGER_COUNT_TO_ISOTOPE = {
  1: 'U235',
  2: 'Th232',
  3: 'Pu239',
  4: 'U238',
};

export function getIsotope(id) {
  const iso = ISOTOPES[id];
  if (!iso) throw new Error(`Unknown isotope: ${id}`);
  return iso;
}

export function randomNeutronCount([min, max]) {
  return min + Math.floor(Math.random() * (max - min + 1));
}