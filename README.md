<div align="center">

# ⚛️ Promethean

**Webcam-controlled nuclear fission chain reaction simulator**

Point one finger, hold to charge, release to bombard. Nine real isotopes. Toggle between an uncontrolled weapon and a feedback-controlled reactor. Watch the cascade — in slow motion.

[![status](https://img.shields.io/badge/status-active%20development-orange)](https://github.com/AnonymousSingh-007/Promethean)
![stack](https://img.shields.io/badge/stack-Three.js%20%7C%20MediaPipe%20%7C%20WebGL%20%7C%20Vite-6cf7ff)
[![license](https://img.shields.io/badge/license-MIT-blueviolet)](./LICENSE)
![isotopes](https://img.shields.io/badge/isotopes-9%20fissionable%20elements-7CFC9C)
![gestures](https://img.shields.io/badge/gestures-palm%20%7C%20point%20%7C%20charge-ff6c6c)
![made by](https://img.shields.io/badge/made%20by-Samratth-ff6c6c)

**[Live demo →](https://anonymoussingh-007.github.io/Promethean/)**

</div>

---

## What is this

Nine real fissionable and radioactive isotopes — from near-certain
Californium-252 to nearly inert Americium-241 — rendered as glowing
instanced Bohr-model atoms with orbiting electron rings, bloom-lit in 3D
space. Select an isotope with a keyboard press (1–9), or show a flat open
palm to bring up an on-screen reference menu first. Then point a single
finger at your webcam and **hold to charge** — a glowing orb builds at your
fingertip, heating up the longer you hold — and release to fire a neutron
burst sized by how long you charged.

Every fissioned atom that spawns child neutrons draws a glowing **lineage
line** from parent to child that flashes bright then slowly fades — as a
cascade unfolds you watch a branching web of light grow across the cluster,
the actual visual record of the chain reaction forming.

**The busier the cascade, the more the whole simulation smoothly slows
down** — a global bullet-time system tied to live neutron count, so a big
burst reads as cinematic slow-motion instead of a strobe of stacked
freeze-frames. Toggle **Reactor mode (C)** to watch a simplified
control-rod feedback loop actively hold the reaction near steady-state
instead of letting it run away — the same cluster, the same isotope, wildly
different behavior depending on whether it's contained.

## Controls

### Gestures

| Gesture | Action |
|---|---|
| 🖐️ Flat palm (all 5 digits extended) | Opens the isotope selection menu (informational — press a number to select) |
| ☝️ Single pointed finger (index only) | **Hold to charge**, release to fire |

Hold duration → tier:

| Hold | Tier | Neutrons fired |
|---|---|---|
| Quick tap (< 0.2s) | LOW | 8 |
| Brief hold (0.2–0.8s) | MED | 25 |
| Longer hold (0.8–1.8s) | HIGH | 55 |
| Held the longest (1.8s+) | ULTRA | 110 |

### Keyboard (always active — the primary way to select isotopes, not a fallback)

| Key | Action |
|---|---|
| **1–9** | Select isotope |
| **Tab** | Toggle isotope menu |
| **C** | Toggle Reactor (containment) / Weapon mode |
| **-** | Fire LOW |
| **Space** | Fire MED |
| **=** | Fire HIGH |
| **0** | Fire ULTRA |

A **help overlay** covering all of this shows automatically on first load, reopenable anytime via the **?** button.

### Isotope roster

| Key | Isotope | Fission chance (thermal / fast) | Neutron yield | Behavior |
|-----|---------|----------------------------------|----------------|----------|
| 1 | Uranium-235 | 85.5% / 60% | 2–3 | The classic fissile material — reliable cascades |
| 2 | Thorium-232 | 1% / 12% | 0–1 | Threshold fissioner — near-inert thermal, meaningfully fissionable fast |
| 3 | Plutonium-239 | 73.5% / 65% | 2–4 | Highly volatile — fast, violent chain reactions |
| 4 | Uranium-238 | 2% / 7% | 0–1 | Threshold fissioner — fertile but barely fissile |
| 5 | Californium-252 | 97% / 85% | 3–5 | Anomalously high thermal cross-section — vaporizes clusters |
| 6 | Plutonium-241 | 73.3% / 62% | 2–4 | Near-Cf volatility with Pu's neutron yield |
| 7 | Uranium-233 | 91.9% / 70% | 2–3 | Thorium fuel cycle's fissile product |
| 8 | Neptunium-237 | 2% / 25% | 1–3 | Threshold fissioner — near-inert thermal, meaningfully fast-fissionable |
| 9 | Americium-241 | 0.47% / 10% | 0–1 | Smoke-detector isotope — primarily an alpha emitter |

Selecting an isotope always gives you a **fresh, full 80-atom cluster**.

## The physics layer

### Energy-dependent fission probability

Fission probability is no longer a single fixed number — every neutron is
stochastically assigned **fast** or **thermal** energy state at spawn
(40% thermalization probability, a documented simplification standing in
for explicit scattering physics — see below), and each isotope has a
*different* fission probability for each energy state. **Thermal values are
derived from published thermal (2200 m/s) microscopic cross-sections**: