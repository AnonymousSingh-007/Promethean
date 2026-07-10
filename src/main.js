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
chainReaction.on('atom_fissioned', ({ atomId }) => sceneManager.killAtomVisual(atomId));

// --- Build the initial cluster ---
// Uranium-only for v1: one isotope, one fission probability, easier to tune and read.
// Bump the count once bombardment feels good — 80 gives you a satisfying cascade
// without tanking frame rate.
sceneManager.buildAtomCluster(chainReaction, 'U235', 80, { radius: 6, color: ISOTOPES.U235.color });
chainReaction.buildNeighborGraph();

// --- Gesture wiring ---
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
  const atomId = sceneManager.raycastAtom(origin.x, origin.y);
  if (atomId !== null) chainReaction.strikeAtom(atomId);
});

// FIST = bombard. intensity (0.4–3, from punch speed) scales how many neutrons hit at once.
gestures.on(GESTURES.FIST, ({ intensity }) => {
  const count = Math.round(5 * intensity);
  chainReaction.bombardAtoms(count);
});

// --- Hand tracking bootstrap ---
const handTracker = new HandTracker(video);
handTracker.onResults((results) => gestures.update(results));

async function initTracking() {
  try {
    await handTracker.init();
    await handTracker.startWebcam();
  } catch (err) {
    console.warn('[Promethean] Webcam/hand tracking unavailable, falling back to mouse/keyboard.', err);
    initFallbackControls();
  }
}

// Fallback controls so you can test without a webcam:
//   click an atom  -> strike it
//   spacebar       -> bombard (same as a fist punch)
function initFallbackControls() {
  window.addEventListener('click', (e) => {
    const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    const atomId = sceneManager.raycastAtom(ndcX, ndcY);
    if (atomId !== null) chainReaction.strikeAtom(atomId);
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      chainReaction.bombardAtoms(6);
    }
  });
}

initTracking();

// --- Render loop ---
let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  handTracker.tick();
  hitStop.update(dt);

  if (!hitStop.isFrozen()) {
    chainReaction.step(dt);
  }
  particles.update(dt);
  hud.update(chainReaction.stats);

  sceneManager.scene.rotation.y += dt * 0.05;
  sceneManager.render();
}
animate();