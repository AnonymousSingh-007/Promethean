<div align="center">

# ⚛️ Promethean

**Webcam-controlled nuclear fission chain reaction simulator**

Point one finger, hold to charge, release to bombard. Nine real isotopes, real scattering, a real k_eff. Toggle between an uncontrolled weapon and a feedback-controlled reactor.

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
cascade unfolds you watch a branching web of light grow across the cluster.
Neutrons that hit an atom and **scatter** instead of reacting bounce visibly
to a neighboring atom rather than vanishing — watch a Th-232 or U-238
cluster and you'll see neutrons genuinely bounce several times before
settling down, exactly like real thermal neutrons interacting with a poor
absorber.

**The busier the cascade, the more the whole simulation smoothly slows
down** — a global bullet-time system tied to live neutron count. Toggle
**Reactor mode (C)** to watch a simplified control-rod feedback loop
actively hold the reaction near steady-state instead of letting it run
away. **Switching isotopes does a full hard reset** — no leftover neutrons,
stats, lineage lines, or ambient heat carry over from whatever you were
just testing.

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
| **1–9** | Select isotope (hard resets the simulation) |
| **Tab** | Toggle isotope menu |
| **C** | Toggle Reactor (containment) / Weapon mode |
| **-** | Fire LOW |
| **Space** | Fire MED |
| **=** | Fire HIGH |
| **0** | Fire ULTRA |

A **help overlay** covering all of this shows automatically on first load, reopenable anytime via the **?** button.

### Isotope roster

| Key | Isotope | Fission (thermal / fast) | Scatter (thermal / fast) | Yield | Behavior |
|-----|---------|---------------------------|----------------------------|-------|----------|
| 1 | Uranium-235 | 85.5% / 60% | 1.7% / 70% | 2–3 | Classic fissile — thermal neutrons absorbed almost on contact |
| 2 | Thorium-232 | 1% / 12% | 61.9% / 70% | 0–1 | Nearly transparent to thermal neutrons — mostly bounces |
| 3 | Plutonium-239 | 73.5% / 65% | 1.2% / 70% | 2–4 | Highly volatile — decisive, fast cascades |
| 4 | Uranium-238 | 2% / 7% | 81.6% / 70% | 0–1 | Real-world near-transparent to thermal neutrons |
| 5 | Californium-252 | 97% / 85% | 0.4% / 70% | 3–5 | Anomalously high thermal cross-section — vaporizes clusters |
| 6 | Plutonium-241 | 73.3% / 62% | 0.86% / 70% | 2–4 | Near-Cf volatility with Pu's neutron yield |
| 7 | Uranium-233 | 91.9% / 70% | 2% / 70% | 2–3 | Thorium fuel cycle's fissile product |
| 8 | Neptunium-237 | 2% / 25% | 6.25% / 70% | 1–3 | Threshold fissioner — inert thermal, fissionable fast |
| 9 | Americium-241 | 0.47% / 10% | 1.72% / 70% | 0–1 | Smoke-detector isotope — primarily an alpha emitter |

Selecting an isotope always gives you a **fresh, full 80-atom cluster with zero carryover** from whatever was selected before.

## The physics layer

### Energy-dependent interactions, now with scattering

Every neutron is fast or thermal, and every collision now resolves through
**two stages** instead of one:

1. **Does it scatter or get absorbed?** `P(scatter) = σ_scatter / (σ_scatter + σ_absorption)`, using an assumed representative elastic cross-section (~12 barns, documented as an assumption, not a per-isotope sourced value) against the real sourced absorption cross-sections. This produces genuinely physical behavior: Th-232/U-238/Np-237 (tiny thermal absorption) scatter 62–82% of the time at thermal energy — near-transparent, matching reality — while U-235/Pu-239/Cf-252 (huge thermal absorption) scatter under 2% of the time, getting absorbed almost immediately.
2. **If absorbed, fission or capture?** Same energy-dependent `fissionProbability` from the previous physics pass, sourced from published thermal (2200 m/s) cross-sections — full citations in `src/physics/IsotopeData.js`.

Scattering **continues the same neutron** (not a new fission generation) toward a random living neighbor, and has a probability of thermalizing it — the actual mechanism now producing thermal neutrons, replacing an earlier stand-in that just randomly assigned energy state at spawn. Real elastic scattering off a heavy nucleus barely changes a neutron's energy per collision (documented in `ChainReaction.js`); simulating hundreds of collisions per neutron isn't practical here, so a per-scatter thermalization probability stands in for the real per-collision energy-transfer physics — stated plainly as a simplification.

If a scattering neutron has no living neighbor left to bounce to, it's tracked as **escaped** — a real reactor-physics concept (leakage), not silently dropped.

### Live k_eff, correctly isolated from scattering

`k_eff` is still computed as the ratio of neutron counts between consecutive
generations in the branching tree — but scatter-continuations of an
existing neutron are explicitly **not** counted as new births, so they
can't inflate the generation counts k_eff depends on. Only genuine
fission-spawned or initial user-fired neutrons count.

- **k_eff < 0.97** — subcritical, the chain dies out
- **0.97 ≤ k_eff ≤ 1.03** — critical, self-sustaining
- **k_eff > 1.03** — supercritical, the chain grows

### Weapon vs. Reactor mode

Press **C** to toggle. **Weapon mode** (default) is uncontrolled — supercritical isotopes run away freely. **Reactor mode** applies a simplified proportional negative-feedback controller standing in for control-rod insertion: the more k_eff overshoots 1.0, the more strongly fission gets suppressed, pulling the reaction back toward steady-state. Documented in `ChainReaction.js` as a simplification, not a full PID/rod-worth model.

### Global time dilation

The busier the cascade, the more the entire simulation smoothly slows down — replacing an earlier failure mode where many individual fission freeze-frames stacked into visible stutter. Idle atom animation (breathing, ring spin) deliberately keeps running at real-time speed, so only the action slows.

### Hard reset on isotope switch

Switching isotopes clears every in-flight neutron (even ones targeting a
different isotope, so nothing resolves invisibly in the background),
zeroes all cascade stats and generation tracking, wipes every lingering
visual (trails, lineage web, still-fading bursts), cancels any active
freeze-frame, and snaps ambient heat back to baseline instantly. Nothing
from a previous isotope carries into the next one.

## Rendering architecture

Atoms are **instanced** — one `InstancedMesh` per isotope for all nuclei, one for all electron rings — rather than individual `THREE.Mesh` objects. Positions never change, so instance matrices are set once; per-frame cost is a uniform update per isotope (9 total), not per atom. This is what makes 80-atom clusters affordable.

## Visual effects pipeline

| Effect | Implementation |
|--------|----------------|
| Global time dilation | Sim speed scales smoothly with live neutron count |
| Bloom | `UnrealBloomPass`, strength scales with reactor "heat" |
| Hit-stop | Freeze-frame + flash, shrinks toward negligible during dense cascades |
| Lineage web | Persistent fading `LineSegments` from parent atom to each spawned child |
| Scatter sparks | Small whitish-tinted burst — "survived and kept going," distinct from absorb/fission |
| Split fragments | Two bright white particles flying apart on every fission |
| Speed lines | Radial streak burst on fission impact |
| Neutron trails | Two-layer point sprites, thermal neutrons dimmer than fast, curl-noise advected |
| Charge orb | Grows and heats from blue to orange with hold duration |
| Ambient grading | Background/fog color lerp toward warm orange as reactor heat rises |

## Terminal gesture logging

Every meaningful gesture event prints into the terminal running `npm run dev`. Temporary, in-memory only, dev-only. Also mirrored to `window.__gestureLog`.

## Security

Static client-only app — no backend, no database, no data persistence. `innerHTML` usage was audited for injection risk; camera-permission error text uses `textContent`. No `eval()`, no inline handlers, no committed secrets. A `Content-Security-Policy` meta tag restricts sources to `'self'` plus the CDNs MediaPipe loads from.

## Stack

| Layer | Technology |
|-------|-----------|
| Build | Vite |
| 3D | Three.js — instanced meshes, custom GLSL shaders, GPU particle systems, `UnrealBloomPass` |
| CV | MediaPipe Tasks Vision (`HandLandmarker`) — single-hand, joint-angle gesture detection |
| Audio | Web Audio API — dependency-free synthesized tones |
| Language | Vanilla JS, no framework |
| Deployment | GitHub Pages via GitHub Actions |

## Requirements

- Node.js 18+ and npm
- A webcam (optional — keyboard controls work fully without one)
- A modern WebGL2-capable browser

## Getting started

```bash
git clone https://github.com/AnonymousSingh-007/Promethean.git
cd Promethean
npm install
npm run dev
```

## Project structure
promethean/
├── index.html
├── package.json
├── vite.config.js
├── LICENSE
├── .github/workflows/deploy.yml
└── src/
├── main.js # time dilation, containment toggle, hard reset on select
├── core/
│ ├── HandTracker.js
│ ├── GestureController.js
│ ├── GestureLogger.js
│ ├── SceneManager.js
│ └── AtomField.js
├── physics/
│ ├── constants.js # speed differs by neutron energy state
│ ├── IsotopeData.js # sourced cross-sections, fission + scatter probabilities
│ └── ChainReaction.js # two-stage scatter/absorb resolution, k_eff, containment, hardReset
├── vfx/
│ ├── ParticleSystem.js # scatter sparks, lineage web, clearAll()
│ ├── ChargeEffect.js
│ ├── CurlNoiseField.js
│ ├── HitStop.js # heat-aware suppression, forceClear()
│ └── shaders/
├── ui/
│ ├── HUD.js # k_eff, criticality, mode, scattered/escaped
│ ├── IsotopePanel.js
│ ├── IsotopeMenu.js
│ ├── StatusOverlay.js
│ └── HelpModal.js
└── utils/
├── MathUtils.js
└── Sfx.js

## Roadmap

- [ ] Geometric mean-free-path targeting (Monte Carlo transport, replacing "random alive neighbor")
- [ ] Batch experiment mode (N-trial headless runs, statistics, seeded reproducibility)
- [ ] Chromatic aberration on large bursts
- [ ] Ambient reactor hum + richer sound design
- [ ] First-run tutorial overlay refinements

## License

[MIT](./LICENSE) — Samratth Singh, 2026.

---

<div align="center">
<sub>Solo build — Samratth · DYPIU Pune</sub>
</div>