import { SceneManager } from './core/SceneManager.js';
import { HandTracker } from './core/HandTracker.js';
import { GestureController, GESTURES } from './core/GestureController.js';
import { GestureLogger } from './core/GestureLogger.js';
import { ChainReaction } from './physics/ChainReaction.js';
import { ISOTOPES, FINGER_COUNT_TO_ISOTOPE } from './physics/IsotopeData.js';
import { ParticleSystem } from './vfx/ParticleSystem.js';
import { HitStop } from './vfx/HitStop.js';
import { HUD } from './ui/HUD.js';
import { IsotopePanel } from './ui/IsotopePanel.js';
import { playSelectTone, playClapTone } from './utils/Sfx.js';

// --- DOM refs ---
const canvas = document.getElementById('scene-canvas');
const video = document.getElementById('webcam-video');
const debugCanvas = document.getElementById('debug-canvas');
const hudEl = document.getElementById('hud');
const isotopePanelEl = document.getElementById('isotope-panel');
const gestureDebugEl = document.getElementById('gesture-debug');
const flashEl = document.getElementById('flash-overlay');

// --- Core systems ---
const sceneManager = new SceneManager(canvas);
const chainReaction = new ChainReaction({ neighborRadius: 3.5, maxNeighbors: 6 });
const particles = new ParticleSystem(sceneManager.scene);
const hitStop = new HitStop(flashEl);
const hud = new HUD(hudEl);
const isotopePanel = new IsotopePanel(isotopePanelEl);
const gestures = new GestureController();
const logger = new GestureLogger();

particles.attachTo(chainReaction, hitStop);
chainReaction.on('atom_fissioned', ({ atomId }) => sceneManager.killAtomVisual(atomId));

// --- Build all four isotope clusters (only the active one renders at a time) ---
for (const isotopeId of Object.keys(ISOTOPES)) {
  sceneManager.buildAtomCluster(chainReaction, isotopeId, 35, { radius: 3.2, color: ISOTOPES[isotopeId].color });
}
chainReaction.buildNeighborGraph();

// --- Default state: U-235 selected and visible from the start ---
let selectedIsotopeId = 'U235';
sceneManager.setActiveIsotope(selectedIsotopeId);
isotopePanel.show(selectedIsotopeId);

let lastHandsMeta = { handCount: 0 };

// --- Gesture wiring ---
gestures.on(GESTURES.ISOTOPE_SELECTED, ({ fingerCount }) => {
  const isotopeId = FINGER_COUNT_TO_ISOTOPE[fingerCount];
  if (!isotopeId || isotopeId === selectedIsotopeId) return;
  selectedIsotopeId = isotopeId;
  sceneManager.setActiveIsotope(isotopeId);
  isotopePanel.show(isotopeId);
  playSelectTone(fingerCount - 1);
  logger.log('isotope_selected', { fingerCount, isotopeId });
});

gestures.on(GESTURES.CLAP, ({ position }) => {
  const worldOrigin = sceneManager.screenToWorldPoint(position.x, position.y, 14);
  const hitCount = chainReaction.bombardIsotope(selectedIsotopeId, 6, worldOrigin);
  playClapTone();
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
  const streakBar = '█'.repeat(meta.pendingStreak ?? 0) + '░'.repeat(Math.max(0, 5 - (meta.pendingStreak ?? 0)));
  gestureDebugEl.innerHTML = `
    hands: ${meta.handCount} · counts: ${meta.counts.join(', ')}<br/>
    locking in: ${meta.pendingCount ?? '—'}  [${streakBar}]<br/>
    clap distance: ${meta.clapDistance ?? '—'} (fires < 2.20)
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

function initFallbackControls() {
  window.addEventListener('keydown', (e) => {
    if (['1', '2', '3', '4'].includes(e.key)) {
      const fingerCount = Number(e.key);
      const isotopeId = FINGER_COUNT_TO_ISOTOPE[fingerCount];
      if (isotopeId !== selectedIsotopeId) {
        selectedIsotopeId = isotopeId;
        sceneManager.setActiveIsotope(isotopeId);
        isotopePanel.show(isotopeId);
        playSelectTone(fingerCount - 1);
        logger.log('isotope_selected', { fingerCount, isotopeId, source: 'keyboard' });
      }
    }
    if (e.code === 'Space') {
      e.preventDefault();
      const hitCount = chainReaction.bombardIsotope(selectedIsotopeId, 6, { x: 0, y: 0, z: 14 });
      playClapTone();
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
  hud.update(chainReaction.stats, { handCount: lastHandsMeta.handCount });

  sceneManager.render();
}
animate();