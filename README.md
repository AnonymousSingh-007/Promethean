<div align="center">

```
      ____                       _   _
     |  _ \ _ __ ___  _ __ ___  | |_| |__   ___  __ _ _ __
     | |_) | '__/ _ \| '_ ` _ \ | __| '_ \ / _ \/ _` | '_ \
     |  __/| | | (_) | | | | | || |_| | | |  __/ (_| | | | |
     |_|   |_|  \___/|_| |_| |_(_)__|_| |_|\___|\__,_|_| |_|

              . . .                    ⚛  P R O M E T H E A N  ⚛
           .    o    .              webcam-driven fission reactor
         .   \  |  /   .          point · charge · release · cascade
        .  --- (o) ---  .
         .   /  |  \   .          =[ 9 real isotopes                ]
           .    o    .          + -- --=[ instanced Bohr-model atoms ]
              . . .            + -- --=[ MediaPipe hand gestures     ]
                             + -- --=[ branching-graph chain sim    ]
```

# ⚛️ Promethean

**Point one finger. Hold to charge. Release to bombard.**
Nine real isotopes rendered as glowing Bohr-model atoms — watch the neutron cascade branch across the cluster in real time.

<br>

[![status](https://img.shields.io/badge/status-active%20development-orange?style=for-the-badge)](https://github.com/AnonymousSingh-007/Promethean)
[![license](https://img.shields.io/badge/license-MIT-blueviolet?style=for-the-badge)](./LICENSE)
[![made by](https://img.shields.io/badge/solo%20build-Samratth-ff6c6c?style=for-the-badge)](https://github.com/AnonymousSingh-007)

![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=three.js&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-00A98F?style=flat-square&logo=google&logoColor=white)
![WebGL2](https://img.shields.io/badge/WebGL2-990000?style=flat-square&logo=webgl&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/Vanilla%20JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Web Audio](https://img.shields.io/badge/Web%20Audio-FF3E00?style=flat-square&logo=webaudio&logoColor=white)

![isotopes](https://img.shields.io/badge/isotopes-9%20fissionable-7CFC9C?style=flat-square)
![atoms](https://img.shields.io/badge/cluster-80%20instanced%20atoms-6cf7ff?style=flat-square)
![gestures](https://img.shields.io/badge/gestures-palm%20%7C%20point%20%7C%20charge-ff6c6c?style=flat-square)
![backend](https://img.shields.io/badge/backend-none%20(client--only)-informational?style=flat-square)

</div>

---

## 📡 Contents

- [What is this](#-what-is-this)
- [Controls](#-controls)
  - [Gestures](#gestures)
  - [Charge tiers](#charge-tiers)
  - [Keyboard](#keyboard)
- [Isotope roster](#-isotope-roster)
- [Design rationale](#-why-gestures-work-the-way-they-do)
- [The physics](#-the-physics-simplified-not-simulated)
- [Rendering architecture](#-rendering-architecture)
- [Visual effects pipeline](#-visual-effects-pipeline)
- [Gesture logging](#-terminal-gesture-logging)
- [Security](#-security)
- [Stack](#-stack)
- [Getting started](#-getting-started)
- [Project structure](#-project-structure)
- [Known issues](#-known-issues)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## ⚛ What is this

Nine real fissionable and radioactive isotopes — from near-certain **Californium-252** to nearly inert **Americium-241** — rendered as glowing instanced Bohr-model atoms with orbiting electron rings, bloom-lit in 3D space.

Select an isotope with a keyboard press (`1`–`9`), or show a flat open palm to bring up an on-screen reference menu first. Then point a single finger at your webcam and **hold to charge** — a glowing orb builds at your fingertip, heating up the longer you hold — and release to fire a neutron burst sized by how long you charged.

Every neutron fired triggers a visible chain:

- **Fissions** explode in isotope-colored particle bursts with two bright white fragments flying apart (one atom becoming two), plus radial speed lines.
- **Absorptions** produce a smaller dim spark — so even a "failed" hit reads as a physical event.
- Each fissioned atom that spawns child neutrons draws a glowing **lineage line** from parent to child that flashes bright then slowly fades.

As a cascade unfolds, you watch a branching web of light grow across the cluster — the actual visual record of the chain reaction forming. The scene's ambient color shifts from cool blue-black toward warm orange-red as live neutron count climbs, and anime-style **hit-stop** (freeze-frame + white flash) fires on every fission, scaled by energy.

---

## 🎮 Controls

### Gestures

| Gesture | Action |
|---|---|
| 🖐️ **Flat palm** (all 5 digits extended) | Opens the isotope selection menu (informational — press a number to actually select) |
| ☝️ **Single pointed finger** (index only) | **Hold to charge**, release to fire |

### Charge tiers

Hold duration maps to burst size:

| Hold | Tier | Neutrons fired |
|---|:---:|:---:|
| Quick tap (`< 0.2s`) | 🟦 **LOW** | 8 |
| Brief hold (`0.2–0.8s`) | 🟩 **MED** | 25 |
| Longer hold (`0.8–1.8s`) | 🟧 **HIGH** | 55 |
| Held longest (`1.8s+`) | 🟥 **ULTRA** | 110 |

### Keyboard

> Always active — not a fallback. This is the **primary** way to select isotopes.

| Key | Action |
|:---:|---|
| `1`–`9` | Select isotope |
| `Tab` | Toggle isotope menu |
| `-` | Fire **LOW** |
| `Space` | Fire **MED** |
| `=` | Fire **HIGH** |
| `0` | Fire **ULTRA** |

A **help overlay** explaining all of this shows automatically on first load, and can be reopened anytime via the **?** button at the top of the screen.

---

## ☢ Isotope roster

| Key | Isotope | Fission chance | Neutron yield | Behavior |
|:---:|---------|:--------------:|:-------------:|----------|
| `1` | **Uranium-235** | `85%` | 2–3 | The classic fissile material — reliable cascades |
| `2` | **Thorium-232** | `5%` | 0–1 | Nearly inert — absorbs most hits, rare fissions |
| `3` | **Plutonium-239** | `90%` | 2–4 | Highly volatile — fast, violent chain reactions |
| `4` | **Uranium-238** | `15%` | 0–1 | Fertile but barely fissile — mostly absorbs |
| `5` | **Californium-252** | `97%` | 3–5 | Spontaneous fission monster — vaporizes clusters |
| `6` | **Plutonium-241** | `92%` | 2–4 | Near-Cf volatility with Pu's neutron yield |
| `7` | **Uranium-233** | `88%` | 2–3 | Thorium fuel cycle's fissile product |
| `8` | **Neptunium-237** | `55%` | 1–3 | Mid-range — coin-flip fissions, moderate cascades |
| `9` | **Americium-241** | `3%` | 0–1 | Smoke-detector isotope — barely fissions at all |

> Selecting an isotope always gives you a **fresh, full 80-atom cluster**. High-fission isotopes can fully consume their cluster in a single burst — accurate to how supercritical material behaves, not a bug.

---

## 🧠 Why gestures work the way they do

**Selection is keyboard-driven, not finger-counted.**
Five-way finger counting on a consumer webcam is a genuinely unreliable computer-vision task — adjacent counts can't be consistently distinguished when the ring finger can't fully curl independently of the pinky (a real biomechanical limitation, not user error). Routing selection through the keyboard removes the hardest, most error-prone part of the system entirely. Gestures are reduced to two **binary** poses — flat palm, single point — which are far more reliable than counting.

**Per-finger detection uses joint-angle measurement with hysteresis**, not distance-from-wrist ratios.
Each finger's PIP knuckle angle determines extended/curled state, with separate **enter (155°)** and **exit (130°)** thresholds — a Schmitt-trigger design that eliminates the flicker a single shared threshold causes when a finger's angle hovers right at the boundary.

**Neutrons travel at constant speed, not constant time.**
A long incoming shot and a short cascade hop take proportionally different amounts of time — the "hero shot" streaking in from your hand stays visibly dramatic instead of blurring past in the same instant as a routine internal hop.

---

## 🔬 The physics (simplified, not simulated)

The chain reaction is a **probability-weighted branching graph**, not a physics engine.

Each atom has a `fissionProbability` and neutron yield specific to its isotope. A neutron hit rolls against that probability; success releases energy and emits new neutrons toward random alive neighbors **within the same cluster**. Clusters sit far enough apart in 3D space that the neighbor graph never lets a cascade jump between isotopes.

The result: exponential cascades from a few lines of logic — no numerical transport solver required.

---

## 🖥 Rendering architecture

Atoms are **instanced**, not individual meshes — one `InstancedMesh` per isotope for all nuclei, and one for all electron rings (2 per atom), rather than hundreds of separate `THREE.Mesh` / `Group` objects.

- Atom positions never change, so instance matrices are set **once at construction**.
- Per-frame cost is just a uniform update per isotope (**9 total**), not per atom.
- Pulsing, scale-breathing, and ring spin all run inside the **vertex shader**, driven by `uTime` plus a per-instance phase/spin attribute — so animation is effectively free regardless of cluster size.

This is what makes **80-atom clusters** affordable (up from an original ceiling of ~30 with individual meshes).

---

## ✨ Visual effects pipeline

| Effect | Implementation |
|--------|----------------|
| 🌟 **Bloom** | `UnrealBloomPass`, strength scales with live reactor "heat" |
| ❄️ **Hit-stop** | 40–130 ms freeze-frame + white flash, scaled by fission energy |
| 🕸️ **Lineage web** | Persistent fading `LineSegments` from parent atom to each spawned child neutron — the visible cascade tree |
| 💥 **Split fragments** | Two bright white particles flying apart on every fission — "one atom becomes two" |
| 🌠 **Speed lines** | Radial streak burst on fission impact |
| ☄️ **Neutron trails** | Two-layer point sprites (hot white core + soft isotope-colored halo) + `LineSegments` streak, curl-noise advected, ease-out final approach, grows before impact |
| 🔅 **Absorb sparks** | Smaller dim isotope-tinted burst — every hit gets a visual, not just fissions |
| 🔵 **Charge orb** | Additive sphere at fingertip, grows and heats from blue → orange with hold duration |
| 🌅 **Ambient grading** | Background/fog color lerps toward warm orange as live neutron count rises |

---

## 🪵 Terminal gesture logging

Every meaningful gesture event prints into the terminal running `npm run dev`:

```log
[gesture] +8001ms   clap             { isotopeId: 'U233', tier: 'HIGH', holdDuration: '0.80', requested: 55, neutronsFired: 55 }
[gesture] +13888ms  isotope_selected { key: 9, isotopeId: 'Am241', source: 'keyboard' }
```

Temporary, in-memory only, dev-only — the endpoint doesn't exist in production builds. Also mirrored to `window.__gestureLog` in the browser console.

---

## 🔒 Security

This is a **static, client-only app** — no backend, no database, no user accounts, no data persistence (no `localStorage`, no cookies) — which eliminates most common web vulnerability classes by construction.

A manual review specifically checked for DOM-injection issues (the class of bug that *does* apply to a client-heavy JS app):

- ✅ All dynamic `innerHTML` usage was audited. The one place external-ish content flowed in (`err.message` in the camera-permission error UI) now uses `textContent`, which cannot be interpreted as markup regardless of content.
- ✅ No `eval()`, `Function()`, `document.write()`, or inline event-handler attributes anywhere in the codebase.
- ✅ No API keys, secrets, or credentials committed.
- ✅ A `Content-Security-Policy` meta tag restricts `script` / `connect` / `worker` sources to `'self'` plus the two Google-controlled CDNs MediaPipe loads its model/WASM runtime from.

> See `index.html` for the CSP, and `src/ui/StatusOverlay.js` / `src/core/GestureLogger.js` for the hardened implementations.

---

## 🧱 Stack

| Layer | Technology |
|-------|-----------|
| **Build** | Vite (also hosts the dev-only gesture-logging endpoint) |
| **3D** | Three.js — instanced meshes, custom GLSL shaders, GPU particle systems, `UnrealBloomPass` |
| **CV** | MediaPipe Tasks Vision (`HandLandmarker`) — client-side, single-hand, joint-angle gesture detection |
| **Audio** | Web Audio API — dependency-free synthesized tones |
| **Language** | Vanilla JS, no framework |

---

## 🚀 Getting started

**Requirements**

- Node.js **18+** and npm
- A webcam *(optional — keyboard controls work fully without one)*
- A modern **WebGL2**-capable browser

**Install & run**

```bash
git clone https://github.com/AnonymousSingh-007/Promethean.git
cd Promethean
npm install
npm run dev
```

---

## 📁 Project structure

```text
promethean/
├── index.html                    # includes Content-Security-Policy meta tag
├── package.json
├── vite.config.js                # dev-only terminal gesture logging middleware
├── LICENSE
├── .gitignore
├── public/models/
└── src/
    ├── main.js
    ├── core/
    │   ├── HandTracker.js         # single-hand MediaPipe wrapper + debug skeleton overlay
    │   ├── GestureController.js   # hysteresis palm/point detection, charge-hold state machine
    │   ├── GestureLogger.js
    │   ├── SceneManager.js        # instanced clusters, camera, bloom, ambient grading
    │   └── AtomField.js           # per-isotope InstancedMesh nucleus + ring pair
    ├── physics/
    │   ├── constants.js           # speed-based neutron travel
    │   ├── IsotopeData.js         # 9 isotopes + keyboard mapping
    │   └── ChainReaction.js       # branching-graph fission sim
    ├── vfx/
    │   ├── ParticleSystem.js      # bursts, sparks, trails, speed lines, lineage web
    │   ├── ChargeEffect.js
    │   ├── CurlNoiseField.js
    │   ├── HitStop.js
    │   └── shaders/
    ├── ui/
    │   ├── HUD.js
    │   ├── IsotopePanel.js
    │   ├── IsotopeMenu.js
    │   ├── StatusOverlay.js       # hardened: textContent, not innerHTML
    │   └── HelpModal.js
    └── utils/
        ├── MathUtils.js
        └── Sfx.js
```

---

## 🐛 Known issues

- **Neutron trail visibility** — under investigation. A confirmed origin-point bug (neutrons spawning *behind* the cluster instead of in front of it) was fixed, but visibility issues persist. Next diagnostic step if revisited: screen recording to isolate whether trails are rendering at all vs. rendering but visually lost against bloom/background.

---

## 🗺 Roadmap

- [ ] Resolve remaining neutron trail visibility issue
- [ ] Camera shake scaled by cascade energy
- [ ] Time-dilation during dense cascades instead of stacked hit-stops
- [ ] Chromatic aberration on large bursts
- [ ] Ambient reactor hum + richer sound design
- [ ] First-run tutorial overlay refinements
- [ ] Deploy to GitHub Pages

---

## 📜 License

[MIT](./LICENSE) — © Samratth Singh, 2026.

<div align="center">
<br>
<sub>⚛ Solo build — <b>Samratth</b> · DYPIU Pune ⚛</sub>
</div>