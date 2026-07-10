# Promethean

Hand-tracked neutron bombardment → simulated fission chain reaction, rendered with
anime-style hit VFX and fake-fluid (curl-noise) particle trails.

Built by Samratth & Lakshit.

## Controls

| Gesture              | Action                                              |
|-----------------------|------------------------------------------------------|
| Pinch (thumb + index)  | Open radial isotope menu at hand position            |
| Release pinch          | Confirm isotope selection                            |
| Fast hand throw         | Fire a single neutron at whatever atom you're pointing at |
| **Fist (closed hand)**  | **Bombard the cluster** — fires a burst of neutrons at once, punch speed scales the burst size |

No webcam? Fallback controls kick in automatically:
- **Click** an atom to strike it
- **Spacebar** to bombard (same as a fist)

## Stack

- **Vite** — dev server / bundler
- **Three.js** — 3D scene, particles, custom shader materials
- **MediaPipe Tasks Vision (HandLandmarker)** — client-side webcam hand tracking
- Vanilla JS, no framework — fast to iterate on over a weekend

## Folder structure

\`\`\`
promethean/
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
├── public/
│   └── models/                # MediaPipe .task model (fetched from CDN at runtime by default)
└── src/
    ├── main.js                 # bootstraps everything, owns the render loop
    ├── core/
    │   ├── HandTracker.js       # MediaPipe wrapper, emits landmark + gesture events
    │   ├── GestureController.js # raw landmarks -> pinch / open-palm / throw / fist
    │   └── SceneManager.js      # Three.js scene/camera/renderer, atom cluster layout
    ├── physics/
    │   ├── IsotopeData.js       # isotope definitions (currently U-235 only for v1)
    │   └── ChainReaction.js     # the reaction sim — branching graph, no physics engine
    ├── vfx/
    │   ├── ParticleSystem.js    # instanced particles for neutrons + fission bursts
    │   ├── CurlNoiseField.js    # fake fluid motion for trails
    │   ├── HitStop.js           # anime-style freeze-frame + flash on impact
    │   └── shaders/
    ├── ui/
    │   ├── RadialMenu.js        # isotope picker (future: multi-isotope selection)
    │   └── HUD.js               # live cascade stats
    └── utils/
        └── MathUtils.js
\`\`\`

## Getting started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open the printed `localhost` URL, allow webcam access, and make a fist to bombard
the uranium cluster.

## Current scope (v1)

Uranium-235 only, single cluster, fist-to-bombard as the core interaction. Isotope
switching (Pu-239, Th-232, U-238) is already stubbed in `IsotopeData.js` and the
radial menu — next step is wiring pinch-selection to actually swap which isotope
gets spawned when you rebuild the cluster.

## Design notes

- **Chain reaction is a branching graph, not a physics engine.** Each atom has a
  `fissionProbability`. A neutron hit rolls against it; success releases energy and
  emits N new neutrons toward random neighbors. Exponential cascades, near-zero math.
- **Fluid look is curl noise, not Navier-Stokes.** Cheap divergence-free vector field,
  advect particles through it for trail motion that never looks like it's flying straight.
- **Anime feel comes from timing.** `HitStop.js` (freeze 2-3 frames + white flash on
  fission) buys more perceived impact than shader complexity ever will.

## Roadmap

- [ ] Wire radial menu selection to isotope-swap on cluster rebuild
- [ ] Add Pu-239, Th-232, U-238 clusters as selectable targets
- [ ] Camera orbit controls (currently fixed slow auto-rotate)
- [ ] Deploy to Vercel or HF Spaces (webcam needs HTTPS — both provide it free)