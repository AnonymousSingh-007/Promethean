<div align="center">

<h1>⚛️ Promethean</h1>

<p><strong>A webcam-controlled nuclear fission chain reaction simulator.</strong><br>
Point one finger. Hold to charge. Release to bombard.<br>
Nine real isotopes, real scattering, a live <code>k_eff</code> — and a switch between an uncontrolled weapon and a feedback-controlled reactor.</p>

<p>
  <a href="https://anonymoussingh-007.github.io/Promethean/"><strong>▶ Live demo</strong></a>
  ·
  <a href="#-quick-start">Quick start</a>
  ·
  <a href="#-the-physics-layer">Physics</a>
  ·
  <a href="#-roadmap">Roadmap</a>
</p>

<!-- Project status -->
<p>
  <a href="https://github.com/AnonymousSingh-007/Promethean"><img alt="status" src="https://img.shields.io/badge/status-active%20development-orange?style=flat-square"></a>
  <a href="https://github.com/AnonymousSingh-007/Promethean/actions/workflows/deploy.yml"><img alt="deploy" src="https://img.shields.io/github/actions/workflow/status/AnonymousSingh-007/Promethean/deploy.yml?style=flat-square&label=pages%20deploy"></a>
  <a href="https://anonymoussingh-007.github.io/Promethean/"><img alt="live demo" src="https://img.shields.io/badge/demo-live-2ea043?style=flat-square&logo=githubpages&logoColor=white"></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/github/license/AnonymousSingh-007/Promethean?style=flat-square&color=blueviolet"></a>
</p>

<!-- Repo signals -->
<p>
  <a href="https://github.com/AnonymousSingh-007/Promethean/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/AnonymousSingh-007/Promethean?style=flat-square&color=f7c948"></a>
  <a href="https://github.com/AnonymousSingh-007/Promethean/issues"><img alt="issues" src="https://img.shields.io/github/issues/AnonymousSingh-007/Promethean?style=flat-square"></a>
  <a href="https://github.com/AnonymousSingh-007/Promethean/commits"><img alt="last commit" src="https://img.shields.io/github/last-commit/AnonymousSingh-007/Promethean?style=flat-square"></a>
  <img alt="code size" src="https://img.shields.io/github/languages/code-size/AnonymousSingh-007/Promethean?style=flat-square">
</p>

<!-- Stack -->
<p>
  <img alt="three.js" src="https://img.shields.io/badge/Three.js-r1xx-000000?style=flat-square&logo=threedotjs&logoColor=white">
  <img alt="mediapipe" src="https://img.shields.io/badge/MediaPipe-Tasks%20Vision-00A3A3?style=flat-square&logo=google&logoColor=white">
  <img alt="webgl2" src="https://img.shields.io/badge/WebGL2-GLSL-990000?style=flat-square&logo=webgl&logoColor=white">
  <img alt="vite" src="https://img.shields.io/badge/Vite-build-646CFF?style=flat-square&logo=vite&logoColor=white">
  <img alt="javascript" src="https://img.shields.io/badge/Vanilla%20JS-no%20framework-F7DF1E?style=flat-square&logo=javascript&logoColor=black">
</p>

<!-- Feature flavour -->
<p>
  <img alt="isotopes" src="https://img.shields.io/badge/isotopes-9-7CFC9C?style=flat-square">
  <img alt="gestures" src="https://img.shields.io/badge/gestures-palm%20%7C%20point%20%7C%20charge-ff6c6c?style=flat-square">
  <img alt="modes" src="https://img.shields.io/badge/modes-weapon%20%7C%20reactor-6cf7ff?style=flat-square">
  <img alt="backend" src="https://img.shields.io/badge/backend-none%20(client--only)-lightgrey?style=flat-square">
</p>

</div>

---

> [!NOTE]
> **Educational simulation, not a research code.** Cross-sections are sourced from published thermal (2200 m/s) data, but transport, thermalization and control-rod feedback are all deliberately simplified. Every simplification is called out inline below and documented in the source.

---

## Table of contents

- [What is this](#-what-is-this)
- [Quick start](#-quick-start)
- [Controls](#-controls)
- [Isotope roster](#-isotope-roster)
- [The physics layer](#-the-physics-layer)
- [Rendering architecture](#-rendering-architecture)
- [Visual effects pipeline](#-visual-effects-pipeline)
- [Project structure](#-project-structure)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Security](#-security)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🔬 What is this

Nine real fissionable and radioactive isotopes — from near-certain **Californium-252** to nearly inert **Americium-241** — rendered as glowing instanced Bohr-model atoms with orbiting electron rings, bloom-lit in 3D space.

Select an isotope with a keyboard press (<kbd>1</kbd>–<kbd>9</kbd>), or show a flat open palm to bring up an on-screen reference menu first. Then point a single finger at your webcam and **hold to charge** — a glowing orb builds at your fingertip, heating up the longer you hold — and release to fire a neutron burst sized by how long you charged.

**What you actually see happen:**

| | |
|---|---|
| 🕸️ **Lineage web** | Every fissioned atom draws a glowing line from parent to child that flashes bright then slowly fades. As a cascade unfolds you watch a branching web of light grow across the cluster. |
| ↩️ **Visible scattering** | Neutrons that hit an atom and scatter instead of reacting *bounce* to a neighbouring atom rather than vanishing. Watch a Th-232 or U-238 cluster and neutrons genuinely bounce several times before settling — exactly like real thermal neutrons off a poor absorber. |
| ⏳ **Global bullet-time** | The busier the cascade, the more the whole simulation smoothly slows down, tied to live neutron count. |
| 🎛️ **Reactor mode** | Toggle with <kbd>C</kbd> to watch a control-rod feedback loop actively hold the reaction near steady-state instead of letting it run away. |
| ♻️ **Hard reset** | Switching isotopes does a *full* reset — no leftover neutrons, stats, lineage lines, or ambient heat carry over. |

---

## 🚀 Quick start

**Requirements**

- Node.js **18+** and npm
- A modern **WebGL2**-capable browser
- A webcam — *optional*; keyboard controls work fully without one

```bash
git clone https://github.com/AnonymousSingh-007/Promethean.git
cd Promethean
npm install
npm run dev
```

Then open the printed localhost URL. A **help overlay** covering every control shows automatically on first load, and is reopenable anytime via the **?** button.

> [!TIP]
> Don't want to install anything? The [live demo](https://anonymoussingh-007.github.io/Promethean/) is the same build, deployed to GitHub Pages.

---

## 🎮 Controls

### Gestures

| Gesture | Action |
|---|---|
| 🖐️ **Flat palm** (all 5 digits extended) | Opens the isotope selection menu (informational — press a number to select) |
| ☝️ **Single pointed finger** (index only) | **Hold to charge**, release to fire |

Hold duration maps to burst size:

| Hold | Tier | Neutrons fired |
|---|:--:|:--:|
| Quick tap (< 0.2 s) | `LOW` | 8 |
| Brief hold (0.2–0.8 s) | `MED` | 25 |
| Longer hold (0.8–1.8 s) | `HIGH` | 55 |
| Held the longest (1.8 s+) | `ULTRA` | 110 |

### Keyboard

Always active — and the **primary** way to select isotopes, not a fallback.

| Key | Action |
|:--:|---|
| <kbd>1</kbd>–<kbd>9</kbd> | Select isotope *(hard resets the simulation)* |
| <kbd>Tab</kbd> | Toggle isotope menu |
| <kbd>C</kbd> | Toggle Reactor (containment) / Weapon mode |
| <kbd>-</kbd> | Fire `LOW` |
| <kbd>Space</kbd> | Fire `MED` |
| <kbd>=</kbd> | Fire `HIGH` |
| <kbd>0</kbd> | Fire `ULTRA` |

---

## ☢️ Isotope roster

| Key | Isotope | Fission (thermal / fast) | Scatter (thermal / fast) | Yield | Behaviour |
|:--:|---|:--:|:--:|:--:|---|
| <kbd>1</kbd> | **Uranium-235** | 85.5% / 60% | 1.7% / 70% | 2–3 | Classic fissile — thermal neutrons absorbed almost on contact |
| <kbd>2</kbd> | **Thorium-232** | 1% / 12% | 61.9% / 70% | 0–1 | Nearly transparent to thermal neutrons — mostly bounces |
| <kbd>3</kbd> | **Plutonium-239** | 73.5% / 65% | 1.2% / 70% | 2–4 | Highly volatile — decisive, fast cascades |
| <kbd>4</kbd> | **Uranium-238** | 2% / 7% | 81.6% / 70% | 0–1 | Real-world near-transparent to thermal neutrons |
| <kbd>5</kbd> | **Californium-252** | 97% / 85% | 0.4% / 70% | 3–5 | Anomalously high thermal cross-section — vaporises clusters |
| <kbd>6</kbd> | **Plutonium-241** | 73.3% / 62% | 0.86% / 70% | 2–4 | Near-Cf volatility with Pu's neutron yield |
| <kbd>7</kbd> | **Uranium-233** | 91.9% / 70% | 2% / 70% | 2–3 | Thorium fuel cycle's fissile product |
| <kbd>8</kbd> | **Neptunium-237** | 2% / 25% | 6.25% / 70% | 1–3 | Threshold fissioner — inert thermal, fissionable fast |
| <kbd>9</kbd> | **Americium-241** | 0.47% / 10% | 1.72% / 70% | 0–1 | Smoke-detector isotope — primarily an alpha emitter |

Selecting an isotope always gives you a fresh, full **80-atom cluster with zero carryover** from whatever was selected before.

---

## 🧪 The physics layer

### Two-stage collision resolution

Every neutron is fast or thermal, and every collision resolves through **two stages** instead of one:

**1 — Does it scatter, or get absorbed?**

```
P(scatter) = σ_scatter / (σ_scatter + σ_absorption)
```

This uses an assumed representative elastic cross-section (~12 barns) against the real sourced absorption cross-sections, and produces genuinely physical behaviour:

- Th-232 / U-238 / Np-237 (tiny thermal absorption) → scatter **62–82%** of the time at thermal energy — near-transparent, matching reality.
- U-235 / Pu-239 / Cf-252 (huge thermal absorption) → scatter **under 2%** of the time, absorbed almost immediately.

**2 — If absorbed, fission or capture?**

The same energy-dependent `fissionProbability`, sourced from published thermal (2200 m/s) cross-sections. Full citations live in [`src/physics/IsotopeData.js`](src/physics/IsotopeData.js).

<details>
<summary><strong>Where scattering is simplified</strong> (click to expand)</summary>

<br>

Scattering **continues the same neutron** — it is not a new fission generation — sending it toward a random living neighbour, with a probability of thermalising it. This is the actual mechanism now producing thermal neutrons, replacing an earlier stand-in that randomly assigned energy state at spawn.

Real elastic scattering off a heavy nucleus barely changes a neutron's energy per collision. Simulating the hundreds of collisions that a real thermalisation takes isn't practical here, so a **per-scatter thermalisation probability stands in** for the true per-collision energy-transfer physics. This is documented plainly as a simplification in `ChainReaction.js`.

The `~12 barn` elastic cross-section is likewise an assumption, not a per-isotope sourced value.

If a scattering neutron has **no living neighbour left** to bounce to, it's tracked as **escaped** — a real reactor-physics concept (leakage), not silently dropped.

</details>

### Live `k_eff`, correctly isolated from scattering

`k_eff` is computed as the ratio of neutron counts between consecutive generations in the branching tree. Crucially, **scatter-continuations of an existing neutron are explicitly not counted as new births**, so they can't inflate the generation counts `k_eff` depends on. Only genuine fission-spawned or initial user-fired neutrons count.

| Range | State | Meaning |
|---|---|---|
| `k_eff < 0.97` | 🔵 **Subcritical** | The chain dies out |
| `0.97 ≤ k_eff ≤ 1.03` | 🟢 **Critical** | Self-sustaining |
| `k_eff > 1.03` | 🔴 **Supercritical** | The chain grows |

### Weapon vs. Reactor mode

Press <kbd>C</kbd> to toggle.

| Mode | Behaviour |
|---|---|
| **Weapon** *(default)* | Uncontrolled — supercritical isotopes run away freely |
| **Reactor** | A simplified **proportional negative-feedback controller** stands in for control-rod insertion: the more `k_eff` overshoots 1.0, the more strongly fission is suppressed, pulling the reaction back toward steady-state |

> [!IMPORTANT]
> The reactor controller is documented in `ChainReaction.js` as a simplification — it is **not** a full PID or rod-worth model.

### Global time dilation

The busier the cascade, the more the entire simulation smoothly slows down. This replaced an earlier failure mode where many individual fission freeze-frames stacked into visible stutter. Idle atom animation (breathing, ring spin) deliberately keeps running at real-time speed, so only the *action* slows.

### Hard reset on isotope switch

Switching isotopes:

- clears every in-flight neutron — **including** ones targeting a different isotope, so nothing resolves invisibly in the background
- zeroes all cascade stats and generation tracking
- wipes every lingering visual (trails, lineage web, still-fading bursts)
- cancels any active freeze-frame
- snaps ambient heat back to baseline instantly

Nothing from a previous isotope carries into the next one.

---

## 🖼️ Rendering architecture

Atoms are **instanced** — one `InstancedMesh` per isotope for all nuclei, and one for all electron rings — rather than individual `THREE.Mesh` objects.

Positions never change, so instance matrices are set **once**. Per-frame cost is a single uniform update per isotope (9 total), not per atom. This is what makes 80-atom clusters affordable at full bloom.

---

## ✨ Visual effects pipeline

| Effect | Implementation |
|---|---|
| **Global time dilation** | Sim speed scales smoothly with live neutron count |
| **Bloom** | `UnrealBloomPass`, strength scales with reactor "heat" |
| **Hit-stop** | Freeze-frame + flash, shrinks toward negligible during dense cascades |
| **Lineage web** | Persistent fading `LineSegments` from parent atom to each spawned child |
| **Scatter sparks** | Small whitish-tinted burst — "survived and kept going", distinct from absorb/fission |
| **Split fragments** | Two bright white particles flying apart on every fission |
| **Speed lines** | Radial streak burst on fission impact |
| **Neutron trails** | Two-layer point sprites, curl-noise advected; thermal neutrons dimmer than fast |
| **Charge orb** | Grows and heats from blue to orange with hold duration |
| **Ambient grading** | Background/fog colour lerps toward warm orange as reactor heat rises |

---

## 📁 Project structure

```text
promethean/
├── index.html
├── package.json
├── vite.config.js
├── LICENSE
├── .github/workflows/deploy.yml
└── src/
    ├── main.js                     # time dilation, containment toggle, hard reset on select
    ├── core/
    │   ├── HandTracker.js
    │   ├── GestureController.js
    │   ├── GestureLogger.js
    │   ├── SceneManager.js
    │   └── AtomField.js
    ├── physics/
    │   ├── constants.js            # speed differs by neutron energy state
    │   ├── IsotopeData.js          # sourced cross-sections, fission + scatter probabilities
    │   └── ChainReaction.js        # two-stage scatter/absorb, k_eff, containment, hardReset
    ├── vfx/
    │   ├── ParticleSystem.js       # scatter sparks, lineage web, clearAll()
    │   ├── ChargeEffect.js
    │   ├── CurlNoiseField.js
    │   ├── HitStop.js              # heat-aware suppression, forceClear()
    │   └── shaders/
    ├── ui/
    │   ├── HUD.js                  # k_eff, criticality, mode, scattered/escaped
    │   ├── IsotopePanel.js
    │   ├── IsotopeMenu.js
    │   ├── StatusOverlay.js
    │   └── HelpModal.js
    └── utils/
        ├── MathUtils.js
        └── Sfx.js
```

---

## 🛠️ Development

### Stack

| Layer | Technology |
|---|---|
| Build | **Vite** |
| 3D | **Three.js** — instanced meshes, custom GLSL shaders, GPU particle systems, `UnrealBloomPass` |
| CV | **MediaPipe Tasks Vision** (`HandLandmarker`) — single-hand, joint-angle gesture detection |
| Audio | **Web Audio API** — dependency-free synthesized tones |
| Language | **Vanilla JS**, no framework |
| Deployment | **GitHub Pages** via GitHub Actions |

### Gesture logging

Every meaningful gesture event prints into the terminal running `npm run dev`. It's temporary, in-memory only, and dev-only. Also mirrored to `window.__gestureLog` for inspection from the browser console:

```js
window.__gestureLog   // → recent gesture events
```

---

## 🩺 Troubleshooting

<details>
<summary><strong>The webcam never activates / no hand is detected</strong></summary>

<br>

Camera access requires a secure context. `localhost` counts as secure; a bare LAN IP over plain HTTP does not. Check that the browser permission prompt wasn't dismissed, and that no other application is holding the camera.

Everything in the simulator is reachable from the keyboard, so the app remains fully usable without a camera.

</details>

<details>
<summary><strong>Nothing renders / black canvas</strong></summary>

<br>

The renderer requires **WebGL2**. Confirm it's available and hardware acceleration is enabled in your browser settings.

</details>

<details>
<summary><strong>Gestures fire unreliably</strong></summary>

<br>

Detection is joint-angle based on a **single** hand. Even, front-on lighting and keeping only one hand in frame gives the most stable read. The pointed-finger gesture expects the index extended and the other digits curled.

</details>

<details>
<summary><strong>I fired a huge burst and nothing much happened</strong></summary>

<br>

That's usually correct physics, not a bug. Th-232, U-238, and Am-241 have tiny thermal fission probabilities — neutrons mostly scatter, and you'll see them bounce and eventually escape. Try Cf-252 or Pu-239 for a runaway cascade.

</details>

---

## 🔒 Security

Static client-only app — **no backend, no database, no data persistence**.

- `innerHTML` usage audited for injection risk; camera-permission error text uses `textContent`
- No `eval()`, no inline handlers, no committed secrets
- A `Content-Security-Policy` meta tag restricts sources to `'self'` plus the CDNs MediaPipe loads from
- Webcam frames are processed **entirely in-browser** and never leave the device

---

## 🗺️ Roadmap

- [ ] Geometric mean-free-path targeting (Monte Carlo transport, replacing "random alive neighbour")
- [ ] Batch experiment mode (N-trial headless runs, statistics, seeded reproducibility)
- [ ] Chromatic aberration on large bursts
- [ ] Ambient reactor hum + richer sound design
- [ ] First-run tutorial overlay refinements

---

## 📄 License

[MIT](./LICENSE) — Samratth Singh, 2026.

---

<div align="center">
<sub>Solo build — <strong>Samratth</strong> · DYPIU Pune</sub>
</div>