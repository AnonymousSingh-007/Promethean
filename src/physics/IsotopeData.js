// Stylized, not textbook-accurate — tuned for visual pacing and variety, not
// nuclear engineering. Selection is now keyboard-driven (see KEY_TO_ISOTOPE)
// rather than gesture-counted, so we're no longer capped at 5 — nine real
// fissionable/radioactive isotopes spanning highly volatile to nearly inert.

export const ISOTOPES = {
  U235: {
    id: 'U235', label: 'Uranium-235',
    fissionProbability: 0.85, neutronsEmitted: [2, 3], energy: 200, color: 0x7CFC9C,
  },
  Th232: {
    id: 'Th232', label: 'Thorium-232',
    fissionProbability: 0.05, neutronsEmitted: [0, 1], energy: 30, color: 0xFFD76C,
  },
  Pu239: {
    id: 'Pu239', label: 'Plutonium-239',
    fissionProbability: 0.9, neutronsEmitted: [2, 4], energy: 260, color: 0xFF6C6C,
  },
  U238: {
    id: 'U238', label: 'Uranium-238',
    fissionProbability: 0.15, neutronsEmitted: [0, 1], energy: 60, color: 0x6C8CFF,
  },
  Cf252: {
    id: 'Cf252', label: 'Californium-252',
    fissionProbability: 0.97, neutronsEmitted: [3, 5], energy: 320, color: 0xE28CFF,
  },
  Pu241: {
    id: 'Pu241', label: 'Plutonium-241',
    fissionProbability: 0.92, neutronsEmitted: [2, 4], energy: 240, color: 0xFF6CD4,
  },
  U233: {
    id: 'U233', label: 'Uranium-233',
    fissionProbability: 0.88, neutronsEmitted: [2, 3], energy: 210, color: 0x6CFFD4,
  },
  Np237: {
    id: 'Np237', label: 'Neptunium-237',
    fissionProbability: 0.55, neutronsEmitted: [1, 3], energy: 150, color: 0xFFA85C,
  },
  Am241: {
    id: 'Am241', label: 'Americium-241', // real-world: mostly an alpha emitter (smoke detectors), barely fissile — stylized as nearly inert here
    fissionProbability: 0.03, neutronsEmitted: [0, 1], energy: 15, color: 0xB0B0C8,
  },
};

// Selection is via keyboard number keys 1-9, shown in the palm-triggered menu.
export const KEY_TO_ISOTOPE = {
  1: 'U235', 2: 'Th232', 3: 'Pu239', 4: 'U238', 5: 'Cf252',
  6: 'Pu241', 7: 'U233', 8: 'Np237', 9: 'Am241',
};

export function getIsotope(id) {
  const iso = ISOTOPES[id];
  if (!iso) throw new Error(`Unknown isotope: ${id}`);
  return iso;
}

export function randomNeutronCount([min, max]) {
  return min + Math.floor(Math.random() * (max - min + 1));
}