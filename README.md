<div align="center">

# ⚛️ Promethean

**Webcam-controlled nuclear fission chain reaction simulator**

Point your finger to charge. Release to bombard. Watch isotopes shatter in real time.

[![status](https://img.shields.io/badge/status-active%20development-orange)](https://github.com/AnonymousSingh-007/Promethean)
![stack](https://img.shields.io/badge/stack-Three.js%20%7C%20MediaPipe%20%7C%20WebGL%20%7C%20Vite-6cf7ff)
[![license](https://img.shields.io/badge/license-MIT-blueviolet)](./LICENSE)
![isotopes](https://img.shields.io/badge/isotopes-9%20fissionable%20elements-7CFC9C)
![gestures](https://img.shields.io/badge/gestures-palm%20%7C%20point%20%7C%20charge-ff6c6c)
![made by](https://img.shields.io/badge/made%20by-Samratth-ff6c6c)

<br/>

https://github.com/user-attachments/assets/placeholder

*↑ Replace with a screen recording or GIF once deployed*

</div>

---

## What is this

Nine real fissionable and radioactive isotopes — from near-certain Californium-252
to nearly inert Americium-241 — rendered as glowing Bohr-model atoms with
orbiting electron rings, bloom-lit in 3D space. Select an isotope with a
keyboard press (1-9), then point a single finger at your webcam and **hold to
charge** a neutron burst. Release to fire. Each neutron visibly travels from
your hand toward the cluster — ease-out deceleration on final approach, growing
in size and intensity right before impact — and every hit gets a visual
response: fissions explode in isotope-colored particle bursts with radial speed
lines, while absorptions produce a smaller dim spark so even "failed" hits read
as physical events instead of silent nothing.

Cascading fissions release more neutrons that strike neighboring atoms within
the same cluster, branching exponentially into chain reactions. The scene
ambient shifts from cool blue-black to warm orange-red as live neutron count
climbs, bloom intensity ramps up, and anime-style hit-stop (freeze-frame +
white flash) fires on every fission — scaled by energy so Cf-252 hits visibly
harder than Th-232 ones.

## How it works

### Gesture system

| Gesture | Action |
|---|---|
| 🖐️ **Flat palm** (all fingers extended) | Opens the isotope selection menu |
| ☝️ **Single pointed finger** (index only) | **Hold to charge**, release to fire |
| Quick release | **LOW** burst — 5 neutrons |
| Brief hold (~0.4s) | **MED** burst — 20 neutrons |
| Longer hold (~0.8s+) | **HIGH** burst — 50 neutrons |

Gesture detection uses **per-finger joint-angle measurement** (PIP knuckle
angle, not distance-from-wrist ratios) with **Schmitt-trigger hysteresis** per
digit — a finger must clear 155° to become "extended" but must drop below 130°
to become "curled" again. This eliminates the single-threshold flicker that
plagued earlier distance-ratio detection, especially for the ring finger which
most people can't fully curl independently.

While charging, a glowing orb appears at your fingertip, growing and shifting
from cool blue to hot orange as hold duration approaches the HIGH threshold —
the visual charge-up is the feedback loop, so you always know what tier you're
about to fire.

### Keyboard controls (always active, not just a fallback)

| Key | Action |
|---|---|
| **1–9** | Select isotope (see roster below) |
| **Tab** | Toggle isotope selection menu |
| **Space** | Fire MED burst (20 neutrons) |
| **-** | Fire LOW burst (5 neutrons) |
| **=** | Fire HIGH burst (50 neutrons) |

### Isotope roster

| Key | Isotope | Fission chance | Neutron yield | Behavior |
|-----|---------|----------------|---------------|----------|
| 1 | Uranium-235 | 85% | 2–3 | The classic fissile material — reliable cascades |
| 2 | Thorium-232 | 5% | 0–1 | Nearly inert — absorbs most hits, rare fissions |
| 3 | Plutonium-239 | 90% | 2–4 | Highly volatile — fast, violent chain reactions |
| 4 | Uranium-238 | 15% | 0–1 | Fertile but barely fissile — mostly absorbs |
| 5 | Californium-252 | 97% | 3–5 | Spontaneous fission monster — vaporizes clusters |
| 6 | Plutonium-241 | 92% | 2–4 | Near-Cf volatility with Pu's neutron yield |
| 7 | Uranium-233 | 88% | 2–3 | Thorium fuel cycle's fissile product |
| 8 | Neptunium-237 | 55% | 1–3 | Mid-range — coin-flip fissions, moderate cascades |
| 9 | Americium-241 | 3% | 0–1 | Smoke-detector isotope — barely fissions at all |

Selecting an isotope always gives you a **fresh, full cluster**. High-fission
isotopes (U-235, Pu-239, Cf-252) can fully consume their cluster in a single
cascade — that's accurate to how supercritical material behaves, not a bug.

## The physics (simplified, not simulated)

The chain reaction is a **probability-weighted branching graph**, not a physics
engine. Each atom has a `fissionProbability` and neutron yield specific to its
isotope. A neutron hit rolls against that probability; success releases energy
and emits new neutrons toward random alive neighbors **within the same cluster**
(clusters are spatially separated so cascades never jump isotopes). Exponential
cascades from a few lines of logic — no numerical solvers, no Boltzmann
transport, no cross-section tables.

Neutrons travel at **constant speed** (not constant time), so a long incoming
shot from your hand (~14 units away) takes ~2 seconds to arrive while a short
cascade hop between neighboring atoms (~2.5 units) takes ~0.2s. This makes the
"hero shot" — your fired neutron streaking toward the cluster — visibly dramatic,
while cascade hops stay snappy.

## Visual effects pipeline

| Effect | Implementation | Purpose |
|--------|----------------|---------|
| **Bloom** | Three.js `UnrealBloomPass` | Makes emissive materials and additive particles actually glow |
| **Hit-stop** | 40–130ms freeze-frame + white flash | Anime-style impact emphasis, scaled by fission energy |
| **Speed lines** | Custom GLSL `LineSegments` shader | Radial streak burst on every fission impact |
| **Neutron trails** | Point sprites + `LineSegments` streak | Per-isotope colored, curl-noise advected, ease-out approach |
| **Neutron core** | Two-layer fragment shader (hot white core + soft halo) | Visible against bloomed backgrounds |
| **Absorb sparks** | Smaller, dimmer particle burst | Every hit gets a visual — not just fissions |
| **Charge orb** | Additive-blended sphere at fingertip | Grows and heats up as hold duration increases |
| **Ambient grading** | Background + fog color lerp toward warm orange | Full-screen "reactor temperature" feedback |
| **Curl noise trails** | Divergence-free noise field advection | Neutrons drift like smoke, not straight lines |
| **Atom animation** | Pulsing emissive + orbiting electron rings | Bohr-model atoms that feel alive, not static dots |

## Terminal gesture logging

Every meaningful gesture event prints directly into the terminal running
`npm run dev`:

```
[gesture] +5555ms  clap { isotopeId: 'U235', tier: 'HIGH', holdDuration: '1.07', requested: 50, neutronsFired: 30 }
[gesture] +11703ms isotope_selected { key: 2, isotopeId: 'Th232', source: 'keyboard' }
```

Temporary, in-memory only — resets on restart. Also mirrored to
`window.__gestureLog` in the browser console.

## Stack

| Layer | Technology |
|-------|-----------|
| **Build** | Vite (also hosts the dev-only gesture logging endpoint) |
| **3D** | Three.js — scene, custom GLSL shaders, GPU particle systems, `UnrealBloomPass` post-processing |
| **CV** | MediaPipe Tasks Vision (`HandLandmarker`) — client-side, single-hand, joint-angle gesture detection |
| **Audio** | Web Audio API — dependency-free synthesized tones (no audio files) |
| **Language** | Vanilla JS, no framework |

## Requirements

- **Node.js 18+** and npm
- A **webcam** (optional — keyboard controls work fully without one)
- A modern **WebGL2-capable** browser (Chrome, Edge, Firefox, Safari 15+)

## Getting started

```bash
git clone https://github.com/AnonymousSingh-007/Promethean.git
cd Promethean
npm install
npm run dev
```

Open the printed `localhost` URL, allow webcam access (or skip — keyboard works
fully), press a number key to select an isotope, then point a single finger and
hold to charge.

## Project structure

```
promethean/
├── index.html
├── package.json
├── vite.config.js                # dev-only terminal gesture logging middleware
├── LICENSE
├── .gitignore
├── public/
│   └── models/                   # MediaPipe model (fetched from CDN at runtime)
└── src/
    ├── main.js                    # bootstraps everything, owns the render loop
    ├── core/
    │   ├── HandTracker.js          # MediaPipe wrapper, single-hand, debug skeleton overlay
    │   ├── GestureController.js    # hysteresis-based palm/point detection + charge-hold
    │   ├── GestureLogger.js        # temporary in-memory + terminal gesture logging
    │   └── SceneManager.js         # Three.js scene, 9 isotope clusters, bloom pipeline, ambient grading
    ├── physics/
    │   ├── constants.js            # speed-based (not time-based) neutron travel
    │   ├── IsotopeData.js          # 9 isotopes + keyboard mapping
    │   └── ChainReaction.js        # branching-graph fission sim, per-isotope reset + bombardment
    ├── vfx/
    │   ├── ParticleSystem.js       # fission bursts, absorb sparks, isotope-colored trails, speed lines
    │   ├── ChargeEffect.js         # growing/heating orb at fingertip during charge-hold
    │   ├── CurlNoiseField.js       # fake fluid motion (divergence-free noise)
    │   ├── HitStop.js              # anime-style freeze-frame + flash
    │   └── shaders/
    │       ├── fission.vert.glsl
    │       ├── fission.frag.glsl
    │       ├── trail.vert.glsl     # grows on approach, per-neutron travel time
    │       ├── trail.frag.glsl     # two-layer hot core + soft halo
    │       ├── speedline.vert.glsl
    │       └── speedline.frag.glsl
    ├── ui/
    │   ├── HUD.js                  # live cascade stats
    │   ├── IsotopePanel.js         # selected isotope info + confirmation pulse
    │   ├── IsotopeMenu.js          # palm-triggered / Tab-toggled full isotope roster
    │   └── StatusOverlay.js        # loading / permission-denied / retry states
    └── utils/
        ├── MathUtils.js
        └── Sfx.js                  # dependency-free Web Audio tones
```

## Design decisions

**Why branching graph instead of real nuclear physics?**
A probability roll + neighbor walk gives you visually correct exponential
cascading behavior for a fraction of the complexity of a real transport
simulation. The goal is visceral demonstration, not numerical accuracy.

**Why keyboard for isotope selection instead of finger counting?**
Five-way finger counting on a consumer webcam is an inherently unreliable
computer vision task — adjacent counts (2 vs 3) can't be reliably
distinguished when the ring finger is partially occluded or can't fully curl
independently (a real biomechanical limitation). Routing selection through the
keyboard entirely removes the hardest, most error-prone part of the gesture
system and reduces hand gestures to two simple binary poses (flat palm / single
point) that are dramatically more reliable.

**Why constant speed instead of constant travel time?**
With fixed travel time, a 14-unit incoming shot from your hand and a 2.5-unit
cascade hop both took the same 0.5s — meaning the dramatic "hero shot" moved
proportionally faster than routine cascade hops and blurred past too fast to
watch. Constant speed means distance determines duration naturally: incoming
shots are slow and visible, cascade hops stay snappy.

**Why per-finger hysteresis?**
A single shared threshold (e.g. 150°) causes a finger to flip back and forth
between "extended" and "curled" every frame when its actual angle hovers right
at that boundary — a very common real-world scenario. Schmitt-trigger hysteresis
(different thresholds for entering vs exiting the "extended" state) eliminates
this flicker entirely.

## Roadmap

### Done
- [x] Hysteresis-based binary gesture detection (palm / point)
- [x] Charge-hold firing with LOW/MED/HIGH tiers
- [x] 9 fissionable isotope clusters with isotope-specific probabilities
- [x] Cluster auto-reset on selection
- [x] Per-isotope neutron trail coloring
- [x] Two-layer neutron core shader (hot white + soft halo)
- [x] Absorb spark VFX (every hit gets a visual, not just fissions)
- [x] Ease-out neutron approach + size growth before impact
- [x] Impact speed lines
- [x] Bloom post-processing
- [x] Ambient color grading tied to reactor activity
- [x] Charge orb VFX at fingertip
- [x] Audio confirmation (synthesized tones, no audio files)
- [x] Loading / permission / retry UI states
- [x] Terminal gesture logging

### Next
- [ ] Camera shake scaled by cascade energy
- [ ] Cascade lineage lines (visible branching tree between generations)
- [ ] Time-dilation during dense cascades (slow-mo ramp instead of stacked hit-stops)
- [ ] Chromatic aberration on large bursts
- [ ] Ambient reactor hum + richer sound design
- [ ] InstancedMesh for atom nuclei/rings (perf headroom for larger clusters)
- [ ] First-run tutorial overlay
- [ ] Deploy to Vercel or HF Spaces

## Contributing

This is a solo project. If you want to fork and extend it, go for it — the
[MIT license](./LICENSE) covers that.

## License

[MIT](./LICENSE) — Samratth Singh, 2026.

---

<div align="center">
<sub>Solo build — Samratth · DYPIU Pune</sub>
</div>