# Promethean

Hand-tracked isotope selection → neutrino strike → simulated fission chain reaction, rendered with anime-style hit VFX and fake fluid (curl-noise) particle trails.

Built by Samratth & Lakshit.

## Stack
- **Vite** — dev server / bundler
- **Three.js** — 3D scene, particles, custom shader materials
- **MediaPipe Tasks Vision (HandLandmarker)** — webcam hand tracking, runs client-side
- **Vanilla JS**, no framework — keeps it light and fast to iterate on over a weekend

## Folder structure

```
promethean/
├── index.html                 # entry point, canvas + video element
├── package.json
├── vite.config.js
├── public/
│   └── models/                # MediaPipe .task model file goes here (downloaded on first run)
└── src/
    ├── main.js                 # bootstraps everything, owns the render loop
    ├── core/
    │   ├── HandTracker.js       # wraps MediaPipe, emits landmark + gesture events
    │   ├── GestureController.js # turns raw landmarks into semantic gestures (pinch, throw, open-palm)
    │   └── SceneManager.js      # Three.js scene/camera/renderer setup, atom cluster layout
    ├── physics/
    │   ├── IsotopeData.js       # isotope definitions: fission probability, neutrons emitted, energy, color
    │   └── ChainReaction.js     # the actual reaction graph/sim — no real physics engine needed
    ├── vfx/
    │   ├── ParticleSystem.js    # GPU instanced particles for neutrinos + fission bursts
    │   ├── CurlNoiseField.js    # fake fluid motion for trails/smoke
    │   ├── HitStop.js           # anime-style freeze-frame + flash on impact
    │   └── shaders/
    │       ├── fission.vert.glsl
    │       ├── fission.frag.glsl
    │       ├── trail.vert.glsl
    │       └── trail.frag.glsl
    ├── ui/
    │   ├── RadialMenu.js        # isotope picker that appears near the tracked hand
    │   └── HUD.js               # reaction stats: neutrons live, energy released, cascade depth
    └── utils/
        └── MathUtils.js
```

## Getting started

```bash
npm create vite@latest . -- --template vanilla
npm install three @mediapipe/tasks-vision
npm run dev
```

Then drop the files from this scaffold into place (they're written to match the structure above — `main.js` is the one file you MUST wire up first since everything else is a module it imports).

## Build order (suggested, matches the weekend plan)

1. `SceneManager.js` + `main.js` — get a Three.js scene rendering atoms in a lattice, camera orbit, sanity check.
2. `HandTracker.js` + `GestureController.js` — webcam feed in, pinch/throw gestures out as events.
3. `RadialMenu.js` — pick an isotope near the hand.
4. `ChainReaction.js` + `IsotopeData.js` — the sim core, headless, testable without any rendering.
5. `ParticleSystem.js` + shaders — visualize neutrinos flying + fission bursts.
6. `HitStop.js` + `CurlNoiseField.js` — polish pass, this is what makes it feel "anime."
7. `HUD.js` — cascade depth / energy counter, ties it together.
8. Deploy (Vercel or HF Spaces static build — webcam access needs HTTPS, both give you that for free).

## Design notes

- **Chain reaction is a branching graph, not a physics engine.** Each atom has a `fissionProbability`. When a neutron hits it, roll against that probability; on success it "fissions," releases energy, and emits N new neutrons (isotope-dependent) toward random nearby atoms. This gives you exponential/cascading visuals with almost no math.
- **Fluid look is curl noise, not Navier-Stokes.** `CurlNoiseField.js` gives you a divergence-free vector field cheaply — advect particles through it for smoke/energy-trail motion that never looks like it's flying in straight lines.
- **Anime feel comes from timing, not geometry.** `HitStop.js` (freeze 2-3 frames + white flash on impact) buys more perceived impact than any amount of shader complexity. Don't skip it, don't over-invest elsewhere before it's in.
