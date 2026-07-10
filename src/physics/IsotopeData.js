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
  Cf252: {
    id: 'Cf252',
    label: 'Californium-252',
    fissionProbability: 0.97, // real Cf-252 undergoes spontaneous fission — stylized as near-certain here
    neutronsEmitted: [3, 5],
    energy: 320,
    color: 0xE28CFF,
  },
};

// Held-up finger count -> isotope. Thumb is now counted as a 5th digit to
// unlock Cf-252 — flagged as less reliable than the original 4 (see
// GestureController.js), since thumb-extension detection is inherently
// noisier than the other four fingers. Keyboard fallback key '5' always works.
export const FINGER_COUNT_TO_ISOTOPE = {
  1: 'U235',
  2: 'Th232',
  3: 'Pu239',
  4: 'U238',
  5: 'Cf252',
};

export function getIsotope(id) {
  const iso = ISOTOPES[id];
  if (!iso) throw new Error(`Unknown isotope: ${id}`);
  return iso;
}

export function randomNeutronCount([min, max]) {
  return min + Math.floor(Math.random() * (max - min + 1));
}