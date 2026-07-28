// Fission probabilities are now ENERGY-DEPENDENT (fast vs. thermal), not a
// single fixed number per isotope. This is the core physical upgrade: real
// neutron-induced fission probability depends heavily on the incoming
// neutron's energy, not just which isotope it's hitting.
//
// THERMAL values (0.025 eV, i.e. "2200 m/s" reference energy) are derived
// from published thermal microscopic cross-sections:
//   P_fission(thermal) = sigma_fission / (sigma_fission + sigma_capture)
// using widely-cited reference cross-section values (barns):
//   U-235:  sigma_f=584,  sigma_capture=99   -> 584/683  = 0.855
//   U-238:  not thermally fissile; thermal fission cross-section is
//           negligible (~2e-5 b) — set near-zero, not exactly zero, since
//           a small nonzero rate is physically present, not purely game balance
//   Pu-239: sigma_f=747,  sigma_capture=270  -> 747/1017 = 0.735
//   Pu-241: sigma_f=1012, sigma_capture=368  -> 1012/1380 = 0.733
//   U-233:  sigma_f=531,  sigma_capture=47   -> 531/578  = 0.919
//   Th-232: not thermally fissile (fission threshold ~1.4 MeV) — near-zero
//   Cf-252: anomalously high thermal cross-section (~2900 b) driven largely
//           by its intrinsic spontaneous-fission character — near-certain
//   Np-237: threshold fissioner (like Th-232/U-238), thermal fission
//           cross-section negligible despite being "fissionable"
//   Am-241: primarily an alpha emitter; small nonzero thermal fission
//           cross-section (~3.2 b) against large capture (~684 b)
//
// FAST values (~1-2 MeV) are ILLUSTRATIVE APPROXIMATIONS reflecting known
// qualitative trends, NOT precision cross-section-ratio figures I can cite
// to a specific reference — stated here plainly rather than presenting
// invented precision as sourced fact:
//   - Threshold fissioners (Th-232, U-238, Np-237) become MEANINGFULLY
//     fissionable at fast energies despite being ~inert at thermal — this
//     is real and is the actual physical basis of "fast fission" in real
//     reactors, even though the exact numbers below are approximate.
//   - Fissile isotopes (U-235, U-233, Pu-239, Pu-241, Cf-252) have somewhat
//     LOWER fission probability at fast energies than their anomalously
//     high thermal cross-sections would suggest, since much of their
//     thermal cross-section comes from a low-energy resonance behavior
//     that doesn't carry over to the fast spectrum.

export const ISOTOPES = {
  U235: {
    id: 'U235', label: 'Uranium-235',
    fissionProbability: { thermal: 0.855, fast: 0.60 },
    neutronsEmitted: [2, 3], // nu ~2.43 in reality
    energy: 200, color: 0x7CFC9C,
  },
  Th232: {
    id: 'Th232', label: 'Thorium-232',
    fissionProbability: { thermal: 0.01, fast: 0.12 }, // threshold fissioner — near-inert thermal, meaningfully fissionable fast
    neutronsEmitted: [0, 1], energy: 30, color: 0xFFD76C,
  },
  Pu239: {
    id: 'Pu239', label: 'Plutonium-239',
    fissionProbability: { thermal: 0.735, fast: 0.65 },
    neutronsEmitted: [2, 4], // nu ~2.87
    energy: 260, color: 0xFF6C6C,
  },
  U238: {
    id: 'U238', label: 'Uranium-238',
    fissionProbability: { thermal: 0.02, fast: 0.07 }, // threshold fissioner, threshold ~1 MeV
    neutronsEmitted: [0, 1], energy: 60, color: 0x6C8CFF,
  },
  Cf252: {
    id: 'Cf252', label: 'Californium-252',
    fissionProbability: { thermal: 0.97, fast: 0.85 },
    neutronsEmitted: [3, 5], // nu ~3.7-3.8
    energy: 320, color: 0xE28CFF,
  },
  Pu241: {
    id: 'Pu241', label: 'Plutonium-241',
    fissionProbability: { thermal: 0.733, fast: 0.62 },
    neutronsEmitted: [2, 4], // nu ~2.93
    energy: 240, color: 0xFF6CD4,
  },
  U233: {
    id: 'U233', label: 'Uranium-233',
    fissionProbability: { thermal: 0.919, fast: 0.70 },
    neutronsEmitted: [2, 3], // nu ~2.50
    energy: 210, color: 0x6CFFD4,
  },
  Np237: {
    id: 'Np237', label: 'Neptunium-237',
    fissionProbability: { thermal: 0.02, fast: 0.25 }, // threshold fissioner, threshold ~0.4 MeV
    neutronsEmitted: [1, 3], energy: 150, color: 0xFFA85C,
  },
  Am241: {
    id: 'Am241', label: 'Americium-241',
    fissionProbability: { thermal: 0.0047, fast: 0.10 }, // primarily an alpha emitter — near-inert at both energies
    neutronsEmitted: [0, 1], energy: 15, color: 0xB0B0C8,
  },
};

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