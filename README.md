<div align="center">

# ⚛️ Promethean

**Hand-tracked neutron bombardment → live simulated fission chain reactions**

Punch to trigger a cascade. Built with computer vision, WebGL shaders, and a physics-flavored simulation core.

![status](https://img.shields.io/badge/status-active%20development-orange)
![stack](https://img.shields.io/badge/stack-Three.js%20%7C%20MediaPipe%20%7C%20Vite-6cf7ff)
![license](https://img.shields.io/badge/license-MIT-blueviolet)
![isotope](https://img.shields.io/badge/isotope-U--235-7CFC9C)
![made by](https://img.shields.io/badge/made%20by-Samratth-ff6c6c)

</div>

---

## What is this

A uranium-235 cluster rendered in 3D, controlled entirely by your webcam-tracked hand.
Make a fist and neutrons launch from your hand toward the cluster — each hit has a
chance to fission the atom, releasing more neutrons that hit neighboring atoms,
cascading into a chain reaction. Every fission triggers an anime-style hit-stop
(freeze-frame + flash) and a GPU particle burst, with neutron trails advected
through a curl-noise field so they drift like something fluid rather than flying
in dead-straight lines.

## Controls

| Gesture                | Action                                                        |
|-------------------------|----------------------------------------------------------------|
| **Fist (closed hand)**   | **Bombard the cluster** — fires a burst of neutrons from your hand's 3D position, punch speed scales burst size |
| Pinch (thumb + index)    | Open radial isotope menu at hand position                      |
| Release pinch            | Confirm isotope selection                                      |
| Fast hand throw           | Fire a single neutron at whatever atom you're pointing at      |

No webcam, or tracking being uncooperative? Fallback controls kick in automatically:
- **Click** an atom to strike it
- **Spacebar** to bombard (same as a fist)

A live debug overlay (bottom-right skeleton view + top-right numeric readout) shows
exactly what the hand tracker sees, so gesture tuning isn't guesswork.

## Stack

- **Vite** — dev server / bundler
- **Three.js** — 3D scene, custom GLSL shader materials, GPU particle systems
- **MediaPipe Tasks Vision (HandLandmarker)** — client-side webcam hand tracking, scale-normalized gesture detection
- Vanilla JS, no framework

## Folder structure

promethean/
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
├── public/
│   └── models/                 # MediaPipe .task model (fetched from CDN at runtime by default)
└── src/
├── main.js                  # bootstraps everything, owns the render loop
├── core/
│   ├── HandTracker.js        # MediaPipe wrapper + debug skeleton overlay
│   ├── GestureController.js  # scale-normalized pinch / open-palm / throw / fist detection
│   └── SceneManager.js       # Three.js scene, Bohr-style atom visuals, raycasting
├── physics/
│   ├── constants.js          # shared sim/VFX timing constants
│   ├── IsotopeData.js        # isotope definitions (U-235 only for v1)
│   └── ChainReaction.js      # the reaction sim — branching graph, no physics engine
├── vfx/
│   ├── ParticleSystem.js     # instanced particles for neutron trails + fission bursts
│   ├── CurlNoiseField.js     # fake fluid motion (divergence-free noise field)
│   ├── HitStop.js            # anime-style freeze-frame + flash on impact
│   └── shaders/
├── ui/
│   ├── RadialMenu.js         # isotope picker (future: multi-isotope selection)
│   └── HUD.js                # live cascade stats
└── utils/
└── MathUtils.js

## Getting started

```bash
npm install
npm run dev
```

Open the printed `localhost` URL, allow webcam access, and make a fist to bombard
the uranium cluster.

## How the sim actually works

The chain reaction is a **probability-weighted branching graph**, not a physics
engine. Each atom has a `fissionProbability`. A neutron hit rolls against it;
success releases energy and emits 2–4 new neutrons toward random alive neighbors.
That's the entire reactor core — exponential cascades from a few lines of logic,
no numerical solvers required.

The "fluid" look on neutron trails is **curl noise**, not Navier-Stokes — a cheap
divergence-free vector field that particles get advected through, so trails drift
like smoke instead of flying in straight lines.

The **anime feel** comes almost entirely from `HitStop.js`: a 40–130ms freeze-frame
plus a white screen flash, scaled by fission energy. It buys more perceived impact
than any amount of shader complexity.

## Roadmap

- [x] Fist-to-bombard with visible neutron flight paths
- [x] Scale-normalized gesture detection (works at any distance from camera)
- [ ] Wire radial menu selection to isotope-swap on cluster rebuild
- [ ] Add Pu-239, Th-232, U-238 as selectable isotope clusters
- [ ] Camera orbit controls (currently fixed slow auto-rotate)
- [ ] Deploy to Vercel or HF Spaces (webcam needs HTTPS — both provide it free)

---

<div align="center">
<sub>Solo build — Samratth</sub>
</div>