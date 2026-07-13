<div align="center">

# ⚛️ Promethean

**Webcam-controlled nuclear fission chain reaction simulator**

Point one finger, hold to charge, release to bombard. Nine real isotopes. Watch the cascade.

[![status](https://img.shields.io/badge/status-active%20development-orange)](https://github.com/AnonymousSingh-007/Promethean)
![stack](https://img.shields.io/badge/stack-Three.js%20%7C%20MediaPipe%20%7C%20WebGL%20%7C%20Vite-6cf7ff)
[![license](https://img.shields.io/badge/license-MIT-blueviolet)](./LICENSE)
![isotopes](https://img.shields.io/badge/isotopes-9%20fissionable%20elements-7CFC9C)
![gestures](https://img.shields.io/badge/gestures-palm%20%7C%20point%20%7C%20charge-ff6c6c)
![made by](https://img.shields.io/badge/made%20by-Samratth-ff6c6c)

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

Every neutron fired triggers a visible chain: fissions explode in
isotope-colored particle bursts with two bright white fragments flying apart
(one atom becoming two) plus radial speed lines, while absorptions produce a
smaller dim spark so even "failed" hits read as physical events. Each
fissioned atom that spawns child neutrons draws a glowing **lineage line**
from parent to child that flashes bright then slowly fades — as a cascade
unfolds you watch a branching web of light grow across the cluster, which is
the actual visual record of the chain reaction forming.

The scene's ambient color shifts from cool blue-black toward warm orange-red
as live neutron count climbs, and anime-style hit-stop (freeze-frame + white
flash) fires on every fission, scaled by energy.

## Controls

### Gestures

| Gesture | Action |
|---|---|
| 🖐️ Flat palm (all 5 digits extended) | Opens the isotope selection menu (informational — press a number to actually select) |
| ☝️ Single pointed finger (index only) | **Hold to charge**, release to fire |

Hold duration -> tier:

| Hold | Tier | Neutrons fired |
|---|---|---|
| Quick tap (< 0.2s) | LOW | 8 |
| Brief hold (0.2–0.8s) | MED | 25 |
| Longer hold (0.8–1.8s) | HIGH | 55 |
| Held the longest (1.8s+) | ULTRA | 110 |

### Keyboard (always active — not a fallback, the primary way to select isotopes)

| Key | Action |
|---|---|
| **1–9** | Select isotope |
| **Tab** | Toggle isotope menu |
| **-** | Fire LOW |
| **Space** | Fire MED |
| **=** | Fire HIGH |
| **0** | Fire ULTRA |

A **help overlay** explaining all of this shows automatically on first load,
and can be reopened anytime via the **?** button (top of screen).

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

Selecting an isotope always gives you a **fresh, full 80-atom cluster**.
High-fission isotopes can fully consume their cluster in a single burst —
accurate to how supercritical material behaves, not a bug.

## Why gestures work the way they do

**Selection is keyboard-driven, not finger-counted.** Five-way finger
counting on a consumer webcam is a genuinely unreliable computer vision task
— adjacent counts can't be consistently distinguished when the ring finger
can't fully curl independently of the pinky, a real biomechanical
limitation, not user error. Routing selection through the keyboard removes
the hardest, most error-prone part of the system entirely. Gestures are
reduced to two **binary** poses — flat palm, single point — which are far
more reliable than counting.

**Per-finger detection uses joint-angle measurement with hysteresis**, not
distance-from-wrist ratios. Each finger's PIP knuckle angle determines
extended/curled state, with separate "enter" (155°) and "exit" (130°)
thresholds (Schmitt-trigger style) — this eliminates the flicker that a
single shared threshold causes when a finger's angle hovers right at the
boundary.

**Neutrons travel at constant speed, not constant time**, so a long incoming
shot and a short cascade hop take proportionally different amounts of time —
the "hero shot" streaking in from your hand stays visibly dramatic instead
of blurring past in the same instant as a routine internal hop.

## The physics (simplified, not simulated)

The chain reaction is a **probability-weighted branching graph**, not a
physics engine. Each atom has a `fissionProbability` and neutron yield
specific to its isotope. A neutron hit rolls against that probability;
success releases energy and emits new neutrons toward random alive neighbors
**within the same cluster** — clusters sit far enough apart in 3D space that
the neighbor graph never lets a cascade jump between isotopes. Exponential
cascades from a few lines of logic, no numerical transport solver required.

## Rendering architecture

Atoms are **instanced**, not individual meshes — one `InstancedMesh` per
isotope for all nuclei, one for all electron rings (2 per atom), rather than
hundreds of separate `THREE.Mesh`/`Group` objects. Atom positions never
change, so instance matrices are set once at construction; per-frame cost is
just a uniform update per isotope (9 total), not per atom. Pulsing,
scale-breathing, and ring spin all happen inside the vertex shader driven by
`uTime` + a per-instance phase/spin attribute, so animation is free
regardless of cluster size. This is what makes 80-atom clusters (up from an
original ceiling of ~30 with individual meshes) affordable.

## Visual effects pipeline

| Effect | Implementation |
|--------|----------------|
| Bloom | `UnrealBloomPass`, strength scales with live reactor "heat" |
| Hit-stop | 40–130ms freeze-frame + white flash, scaled by fission energy |
| Lineage web | Persistent fading `LineSegments` from parent atom to each spawned child neutron — the visible cascade tree |
| Split fragments | Two bright white particles flying apart on every fission — "one atom becomes two" |
| Speed lines | Radial streak burst on fission impact |
| Neutron trails | Two-layer point sprites (hot white core + soft isotope-colored halo) + `LineSegments` streak, curl-noise advected, ease-out final approach, grows before impact |
| Absorb sparks | Smaller dim isotope-tinted burst — every hit gets a visual, not just fissions |
| Charge orb | Additive sphere at fingertip, grows and heats from blue to orange with hold duration |
| Ambient grading | Background/fog color lerp toward warm orange as live neutron count rises |

## Terminal gesture logging

Every meaningful gesture event prints into the terminal running `npm run dev`: