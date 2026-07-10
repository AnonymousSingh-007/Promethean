import { SceneManager } from './core/SceneManager.js';
import { HandTracker } from './core/HandTracker.js';
import { GestureController, GESTURES } from './core/GestureController.js';
import { GestureLogger } from './core/GestureLogger.js';
import { ChainReaction } from './physics/ChainReaction.js';
import { ISOTOPES, FINGER_COUNT_TO_ISOTOPE } from './physics/IsotopeData.js';
import { ParticleSystem } from './vfx/ParticleSystem.js';
import { HitStop } from './vfx/HitStop.js';
import { HUD } from './ui/HUD.js';

// --- DOM refs ---
const canvas = document.getElementById('scene-canvas');
const video = document.getElementById('webcam-video');
const debugCanvas = document.getElementById('debug-canvas');
const hudEl = document.getElementById('hud');
const gestureDebugEl = document.getElementById('gesture-debug');
const flashEl = document.getElementById('flash-overlay');

// --- Core systems ---
const sceneManager = new SceneManager(canvas);
const chainReaction = new ChainReaction({ neighborRadius: 3.5, maxNeighbors: 6 });
const particles = new ParticleSystem(sceneManager.scene);
const hitStop = new HitStop(flashEl);
const hud = new HUD(hudEl);
const gestures = new GestureController();
const logger = new GestureLogger();

particles.attachTo(chainReaction, hitStop);
chainReaction.on('atom_fissioned', ({ atomId }) => sceneManager.killAtomVisual(atomId));

// --- Build all four isotope clusters ---
for (const isotopeId of Object.keys(ISOTOPES)) {
  sceneManager.buildAtomCluster(chainReaction, isotopeId, 35, { radius: 3.2, color: ISOTOPES[isotopeId].color });
}
chainReaction.buildNeighborGraph();

// --- State ---
let selectedIsotopeId = 'U235'; // default before any finger-count gesture is seen
let lastHandsMeta = { handCount: 0 };

// --- Gesture wiring ---
gestures.on(GESTURES.ISOTOPE_SELECTED, ({ fingerCount }) => {
  const isotopeId = FINGER_COUNT_TO_ISOTOPE[fingerCount];
  if (!isotopeId) return;
  selectedIsotopeId = isotopeId;
  logger.log('isotope_selected', { fingerCount, isotopeId });
});

gestures.on(GESTURES.CLAP, ({ position }) => {
  const worldOrigin = sceneManager.screenToWorldPoint(position.x, position.y, 20);
  const hitCount = chainReaction.bombardIsotope(selectedIsotopeId, 6, worldOrigin);
  logger.log('clap', { isotopeId: selectedIsotopeId, neutronsFired: hitCount });
});

gestures.on(GESTURES.HAND_FOUND, () => logger.log('hand_found', {}));
gestures.on(GESTURES.HAND_LOST, () => logger.log('hand_lost', {}));

gestures.on(GESTURES.HANDS_UPDATE, (meta) => {
  lastHandsMeta = meta;
  if (!meta.handCount) {
    gestureDebugEl.textContent = 'NO HANDS VISIBLE';
    return;
  }
  gestureDebugEl.innerHTML = `
    hands: ${meta.handCount}<br/>
    finger counts: ${meta.counts.join(', ')}<br/>
    clap distance: ${meta.clapDistance ?? '—'} (fires < 2.20)<br/>
    hold 1-4 fingers to select isotope
  `;
});

// --- Hand tracking bootstrap ---
const handTracker = new HandTracker(video, debugCanvas);
handTracker.onResults((results) => gestures.update(results.landmarks));

async function initTracking() {
  try {
    await handTracker.init();
    await handTracker.startWebcam();
    gestureDebugEl.textContent = 'tracker ready — hold up fingers, then clap';
  } catch (err) {
    console.error('[Promethean] Webcam/hand tracking unavailable, falling back to keyboard.', err);
    gestureDebugEl.textContent = `tracker failed: ${err.message} — using keyboard fallback`;
    initFallbackControls();
  }
}

// Keyboard fallback so you can test without a webcam:
//   1-4       -> select isotope (matches finger count mapping)
//   spacebar  -> clap (bombard the currently selected isotope)
function initFallbackControls() {
  window.addEventListener('keydown', (e) => {
    if (['1', '2', '3', '4'].includes(e.key)) {
      const isotopeId = FINGER_COUNT_TO_ISOTOPE[Number(e.key)];
      selectedIsotopeId = isotopeId;
      logger.log('isotope_selected', { fingerCount: Number(e.key), isotopeId, source: 'keyboard' });
    }
    if (e.code === 'Space') {
      e.preventDefault();
      const hitCount = chainReaction.bombardIsotope(selectedIsotopeId, 6, { x: 0, y: 0, z: 20 });
      logger.log('clap', { isotopeId: selectedIsotopeId, neutronsFired: hitCount, source: 'keyboard' });
    }
  });
}

initTracking();

// --- Render loop ---
let lastTime = performance.now();
let elapsed = 0;
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;
  elapsed += dt;

  handTracker.tick();
  hitStop.update(dt);

  if (!hitStop.isFrozen()) {
    chainReaction.step(dt);
  }
  particles.update(dt);
  sceneManager.updateAtoms(dt, elapsed);
  hud.update(chainReaction.stats, {
    selectedIsotopeLabel: ISOTOPES[selectedIsotopeId].label,
    handCount: lastHandsMeta.handCount,
  });

  sceneManager.render();
}
animate();