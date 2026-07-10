import { SceneManager } from './core/SceneManager.js';
import { HandTracker } from './core/HandTracker.js';
import { GestureController, GESTURES } from './core/GestureController.js';
import { ChainReaction } from './physics/ChainReaction.js';
import { ISOTOPES } from './physics/IsotopeData.js';
import { ParticleSystem } from './vfx/ParticleSystem.js';
import { HitStop } from './vfx/HitStop.js';
import { RadialMenu } from './ui/RadialMenu.js';
import { HUD } from './ui/HUD.js';

// --- DOM refs ---
const canvas = document.getElementById('scene-canvas');
const video = document.getElementById('webcam-video');
const hudEl = document.getElementById('hud');
const flashEl = document.getElementById('flash-overlay');

// --- Core systems ---
const sceneManager = new SceneManager(canvas);
const chainReaction = new ChainReaction({ neighborRadius: 3.5, maxNeighbors: 6 });
const particles = new ParticleSystem(sceneManager.scene);
const hitStop = new HitStop(flashEl);
const radialMenu = new RadialMenu(document.body);
const hud = new HUD(hudEl);
const gestures = new GestureController();

particles.attachTo(chainReaction, hitStop);

// Keep the scene mesh in sync with the sim when an atom fissions (hide it, since
// the ParticleSystem's burst is what visually "replaces" it).
chainReaction.on('atom_fissioned', ({ atomId }) => sceneManager.killAtomVisual(atomId));

// --- Build the initial cluster ---
// Two isotope pockets so cascades can visually cross between "reactive" and "inert" zones.
sceneManager.buildAtomCluster(chainReaction, 'U235', 60, { radius: 5, color: ISOTOPES.U235.color });
sceneManager.buildAtomCluster(chainReaction, 'U238', 40, { radius: 8, color: ISOTOPES.U238.color });
chainReaction.buildNeighborGraph();

// --- Gesture wiring ---
// PINCH_START opens the radial menu at the hand position; while pinched, dragging
// the hand selects the nearest isotope; PINCH_END confirms the selection.
// THROW (a fast hand motion) raycasts from the hand's screen position and strikes
// whatever atom it lands on, using whatever isotope was last selected as context
// (isotope selection determines which cluster you're "aiming with" — see note below).
let pinching = false;

gestures.on(GESTURES.PINCH_START, ({ position }) => {
  pinching = true;
  const screenX = (position.x * 0.5 + 0.5) * window.innerWidth;
  const screenY = (-position.y * 0.5 + 0.5) * window.innerHeight;
  radialMenu.showAt(screenX, screenY);
});

gestures.on(GESTURES.PINCH_END, ({ position }) => {
  if (pinching) {
    const screenX = (position.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-position.y * 0.5 + 0.5) * window.innerHeight;
    radialMenu.selectNearest(screenX, screenY);
  }
  pinching = false;
  radialMenu.hide();
});

gestures.on(GESTURES.THROW, ({ origin }) => {
  // origin is already in NDC space via GestureController's normToScreen()
  const atomId = sceneManager.raycastAtom(origin.x, origin.y);
  if (atomId !== null) {
    chainReaction.strikeAtom(atomId);
  }
});

// --- Hand tracking bootstrap ---
const handTracker = new HandTracker(video);
handTracker.onResults((results) => gestures.update(results));

async function initTracking() {
  try {
    await handTracker.init();
    await handTracker.startWebcam();
  } catch (err) {
    console.warn('[Promethean] Webcam/hand tracking unavailable, falling back to mouse control.', err);
    initMouseFallback();
  }
}

// Mouse fallback so you can test the sim/VFX loop without a webcam handy —
// click an atom to strike it directly. Useful for the Day 1 "does the cascade
// even work" sanity check before hand tracking is wired in.
function initMouseFallback() {
  window.addEventListener('click', (e) => {
    const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    const atomId = sceneManager.raycastAtom(ndcX, ndcY);
    if (atomId !== null) chainReaction.strikeAtom(atomId);
  });
}

initTracking();

// --- Render loop ---
let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 1 / 30); // clamp dt to avoid huge steps on tab-switch
  lastTime = now;

  handTracker.tick();
  hitStop.update(dt);

  if (!hitStop.isFrozen()) {
    chainReaction.step(dt);
  }
  particles.update(dt);
  hud.update(chainReaction.stats);

  sceneManager.scene.rotation.y += dt * 0.05; // slow ambient rotation, remove once camera orbit controls are added
  sceneManager.render();
}
animate();
