<div align="center">

# ⚛️ Promethean

**Finger-count isotope selection → two-hand clap → live simulated fission chain reactions**

Hold up fingers to choose an isotope. Clap to bombard it. Watch the cascade.

![status](https://img.shields.io/badge/status-active%20development-orange)
![stack](https://img.shields.io/badge/stack-Three.js%20%7C%20MediaPipe%20%7C%20Vite-6cf7ff)
![license](https://img.shields.io/badge/license-MIT-blueviolet)
![isotopes](https://img.shields.io/badge/isotopes-U--235%20%7C%20Th--232%20%7C%20Pu--239%20%7C%20U--238-7CFC9C)
![made by](https://img.shields.io/badge/made%20by-Samratth-ff6c6c)

</div>

---

## What is this

Four isotope clusters — Uranium-235, Thorium-232, Plutonium-239, Uranium-238 —
rendered as glowing Bohr-model atoms in 3D space, controlled entirely by
webcam-tracked hands. Hold up 1–4 fingers to select which isotope you're
targeting, then clap your hands together to launch a burst of neutrons at it.

Each hit has a chance to fission the atom — probability and neutron yield vary
by isotope — releasing more neutrons that strike neighboring atoms in the same
cluster, cascading into a chain reaction. Every fission triggers an anime-style
hit-stop (freeze-frame + flash) and a GPU particle burst, with neutron trails
advected through a curl-noise field so they drift like something fluid instead
of flying in dead-straight lines.

## Controls

| Gesture | Action |
|---|---|
| ☝️ **1 finger** | Select **Uranium-235** |
| ✌️ **2 fingers** | Select **Thorium-232** |
| 🤟 **3 fingers** | Select **Plutonium-239** |
| 🖖 **4 fingers** | Select **Uranium-238** |
| 👏 **Clap** (bring both hands together) | **Fire a neutron burst** at the currently selected isotope |

Finger counting deliberately ignores the thumb — thumb-extension detection is
unreliable and orientation-dependent, so only index / middle / ring / pinky are
counted. This keeps selection consistent across webcams and lighting.

### Keyboard fallback

No webcam, or tracking being uncooperative? Keyboard fallback kicks in
automatically:

- **1 / 2 / 3 / 4** — select isotope
- **Spacebar** — clap (bombard the selected isotope)

### Debug overlay

A live debug overlay (bottom-right hand skeleton + top-right numeric readout)
shows exactly what the tracker sees — per-hand finger counts, live clap
distance, and hand count — so gesture tuning is never guesswork.

## Terminal gesture logging

Every meaningful gesture event (isotope selection, claps, hands found/lost)
prints directly into the terminal running `npm run dev`:

```text
[gesture] +1042ms  isotope_selected { fingerCount: 2, isotopeId: 'Th232' }
[gesture] +3310ms  clap { isotopeId: 'Th232', neutronsFired: 6 }
```

This is **temporary, in-memory only** — nothing is written to disk, and it
resets when you restart the dev server. It exists purely to let you compare
gesture behavior across takes while tuning thresholds. The same log is mirrored
to `window.__gestureLog` in the browser console if you'd rather inspect it there.

## Stack

- **Vite** — dev server / bundler (also hosts the dev-only terminal logging endpoint)
- **Three.js** — 3D scene, custom GLSL shader materials, GPU particle systems
- **MediaPipe Tasks Vision (`HandLandmarker`)** — client-side, two-hand tracking, scale-normalized gesture detection
- Vanilla JS, no framework

## Requirements

- **Node.js 18+** and npm
- A **webcam** (optional — keyboard fallback works without one)
- A modern WebGL2-capable browser

## Getting started

```bash
npm install
npm run dev
```

Open the printed `localhost` URL, allow webcam access, hold up 1–4 fingers to
pick an isotope, then clap.

> **Note:** MediaPipe's `HandLandmarker` needs its model file present in
> `public/models/`. If hand tracking never activates, confirm that directory is
> populated (it's git-ignored, so a fresh clone may not include it). Webcam
> access requires a secure context — `localhost` counts as secure in dev, so no
> HTTPS setup is needed locally.

## How the sim actually works

The chain reaction is a **probability-weighted branching graph**, not a physics
engine. Each atom has a `fissionProbability` and a neutron-yield range specific
to its isotope. A neutron hit rolls against that probability; success releases
energy and emits new neutrons toward random alive neighbors **within the same
cluster** (clusters are spatially separated so cascades never jump isotopes).
Exponential cascades from a few lines of logic — no numerical solvers required.

The "fluid" look on neutron trails is **curl noise**, not Navier–Stokes — a
cheap divergence-free vector field that particles get advected through.

The anime feel comes almost entirely from `HitStop.js`: a 40–130 ms freeze-frame
plus a white screen flash, scaled by fission energy.

## Folder structure

```text
promethean/
├── index.html
├── package.json
├── vite.config.js                # includes the dev-only terminal gesture logger middleware
├── .gitignore
├── public/
│   └── models/                   # MediaPipe HandLandmarker model file lives here
└── src/
    ├── main.js                   # bootstraps everything, owns the render loop
    ├── core/
    │   ├── HandTracker.js        # MediaPipe wrapper, 2-hand tracking, debug skeleton overlay
    │   ├── GestureController.js  # finger-count isotope selection + clap detection
    │   ├── GestureLogger.js      # temporary in-memory + terminal gesture logging
    │   └── SceneManager.js       # Three.js scene, 4 spatially separated isotope clusters
    ├── physics/
    │   ├── constants.js
    │   ├── IsotopeData.js        # U-235, Th-232, Pu-239, U-238 + finger-count mapping
    │   └── ChainReaction.js      # branching-graph fission sim, per-isotope bombardment
    ├── vfx/
    │   ├── ParticleSystem.js
    │   ├── CurlNoiseField.js
    │   ├── HitStop.js
    │   └── shaders/
    ├── ui/
    │   └── HUD.js                # selected isotope, hand count, live cascade stats
    └── utils/
        └── MathUtils.js
```

## Roadmap

- [x] Finger-count isotope selection (scale-normalized, works at any distance)
- [x] Two-hand clap detection with cooldown
- [x] Four spatially separated isotope clusters with isotope-accurate probabilities
- [x] Temporary terminal gesture logging for take-to-take comparison
- [ ] Visual highlight/label on the currently selected cluster
- [ ] Camera orbit controls (currently fixed viewing angle)
- [ ] Deploy to Vercel or HF Spaces (webcam needs HTTPS — both provide it free)

## License

MIT.

---

<div align="center">
<sub>Solo build — Samratth</sub>
</div>