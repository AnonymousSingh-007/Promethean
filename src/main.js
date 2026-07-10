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
import { StatusOverlay } from './ui/StatusOverlay.js';
import { playSelectTone, playClapTone } from './utils/Sfx.js';

// --- DOM refs ---
const canvas = document.getElementById('scene-canvas');
const video = document.getElementById('webcam-video');
const debugCanvas = document.getElementById('debug-canvas');
const hudEl = document.getElementById('hud');
const isotopePanelEl = document.getElementById('isotope-panel');
const gestureDebugEl = document.getElementById('gesture-debug');
const flashEl = document.getElementById('flash-overlay');
const statusEl = document.getElementById('status-overlay');

// --- Core systems ---
const sceneManager = new SceneManager(canvas);
const chainReaction = new ChainReaction({ neighborRadius: 3.5, maxNeighbors: 6 });
const particles = new ParticleSystem(sceneManager.scene);
const hitStop = new HitStop(flashEl);
const hud = new HUD(hudEl);
const isotopePanel = new IsotopePanel(isotopePanelEl);
const statusOverlay = new StatusOverlay(statusEl);
const gestures = new GestureController();
const logger = new GestureLogger();

particles.attachTo(chainReaction, hitStop);
chainReaction.on('atom_fissioned', ({ atomId }) => sceneManager.killAtomVisual(atomId));

// --- Build all five isotope clusters (only the active one renders at a time) ---
for (const isotopeId of Object.keys(ISOTOPES)) {
  sceneManager.buildAtomCluster(chainReaction, isotopeId, 35, { radius: 3.2, color: ISOTOPES[isotopeId].color });
}
chainReaction.buildNeighborGraph();

// --- Default state ---
let selectedIsotopeId = 'U235';
sceneManager.setActiveIsotope(selectedIsotopeId);
isotopePanel.show(selectedIsotopeId);
let lastHandsMeta = { handCount: 0 };

// --- Clap intensity: determined by clap HEIGHT on screen (top=HIGH, bottom=LOW) ---
const CLAP_TIERS = [
  { name: 'LOW', count: 5, yMax: -0.33 },
  { name: 'MED', count: 20, yMax: 0.33 },
  { name: 'HIGH', count: 50, yMax: Infinity },
];
function getClapTier(ndcY) {
  return CLAP_TIERS.find(tier => ndcY <= tier.yMax) ?? CLAP_TIERS[CLAP_TIERS.length - 1];
}

function selectIsotope(isotopeId, fingerCount, source = 'gesture') {
  if (isotopeId === selectedIsotopeId) return;
  selectedIsotopeId = isotopeId;
  chainReaction.resetIsotope(isotopeId); // fresh cluster every time — fixes high-fission isotopes vanishing permanently
  sceneManager.setActiveIsotope(isotopeId);
  isotopePanel.show(isotopeId);
  playSelectTone(fingerCount - 1);
  logger.log('isotope_selected', { fingerCount, isotopeId, source });
}

function fireClap(position, source = 'gesture') {
  const tier = getClapTier(position.y);
  const worldOrigin = sceneManager.screenToWorldPoint(position.x, position.y, 14);
  const hitCount = chainReaction.bombardIsotope(selectedIsotopeId, tier.count, worldOrigin);
  playClapTone(tier.count);
  logger.log('clap', { isotopeId: selectedIsotopeId, tier: tier.name, requested: tier.count, neutronsFired: hitCount, source });
}

// --- Gesture wiring ---
gestures.on(GESTURES.ISOTOPE_SELECTED, ({ fingerCount }) => {
  const isotopeId = FINGER_COUNT_TO_ISOTOPE[fingerCount];
  if (isotopeId) selectIsotope(isotopeId, fingerCount);
});

gestures.on(GESTURES.CLAP, ({ position }) => fireClap(position));

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

let fallbackBound = false;

async function initTracking() {
  statusOverlay.showLoading('Loading hand-tracking model…');
  try {
    await handTracker.init();
    statusOverlay.showLoading('Requesting camera access…');
    await handTracker.startWebcam();
    statusOverlay.hide();
    gestureDebugEl.textContent = 'tracker ready — hold up fingers, then clap';
  } catch (err) {
    console.error('[Promethean] Tracking init failed:', err);
    statusOverlay.showError(describeTrackingError(err), () => initTracking());
    gestureDebugEl.textContent = 'tracker unavailable — using keyboard fallback';
    initFallbackControls();
  }
}

function describeTrackingError(err) {
  if (err.name === 'NotAllowedError') return 'Camera access was denied. Allow camera permission for this site, then retry.';
  if (err.name === 'NotFoundError') return 'No camera was found on this device. You can still play using the keyboard (see bottom-left legend).';
  if (err.message?.includes('timed out')) return 'Camera did not respond in time — check that no other app is using it, then retry.';
  return `Hand tracking failed to start (${err.message}). You can still play using the keyboard.`;
}

function initFallbackControls() {
  if (fallbackBound) return;
  fallbackBound = true;
  window.addEventListener('keydown', (e) => {
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
      const fingerCount = Number(e.key);
      selectIsotope(FINGER_COUNT_TO_ISOTOPE[fingerCount], fingerCount, 'keyboard');
    }
    if (e.code === 'Space') { e.preventDefault(); fireClap({ x: 0, y: 0 }, 'keyboard'); }       // MED
    if (e.key === '-') fireClap({ x: 0, y: -0.6 }, 'keyboard');                                  // LOW
    if (e.key === '=') fireClap({ x: 0, y: 0.6 }, 'keyboard');                                   // HIGH
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