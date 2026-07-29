import { SceneManager } from './core/SceneManager.js';
import { HandTracker } from './core/HandTracker.js';
import { GestureController, GESTURES } from './core/GestureController.js';
import { GestureLogger } from './core/GestureLogger.js';
import { ChainReaction, EVENTS } from './physics/ChainReaction.js';
import { ISOTOPES, KEY_TO_ISOTOPE } from './physics/IsotopeData.js';
import { ParticleSystem } from './vfx/ParticleSystem.js';
import { HitStop } from './vfx/HitStop.js';
import { ChargeEffect } from './vfx/ChargeEffect.js';
import { HUD } from './ui/HUD.js';
import { IsotopePanel } from './ui/IsotopePanel.js';
import { IsotopeMenu } from './ui/IsotopeMenu.js';
import { StatusOverlay } from './ui/StatusOverlay.js';
import { HelpModal } from './ui/HelpModal.js';
import { playSelectTone, playClapTone } from './utils/Sfx.js';

const canvas = document.getElementById('scene-canvas');
const video = document.getElementById('webcam-video');
const debugCanvas = document.getElementById('debug-canvas');
const hudEl = document.getElementById('hud');
const isotopePanelEl = document.getElementById('isotope-panel');
const isotopeMenuEl = document.getElementById('isotope-menu');
const gestureDebugEl = document.getElementById('gesture-debug');
const flashEl = document.getElementById('flash-overlay');
const statusEl = document.getElementById('status-overlay');
const helpEl = document.getElementById('help-overlay');
const helpReopenBtn = document.getElementById('help-reopen-btn');

const sceneManager = new SceneManager(canvas);
const chainReaction = new ChainReaction({ neighborRadius: 4.6, maxNeighbors: 6 });
const particles = new ParticleSystem(sceneManager.scene);
const hitStop = new HitStop(flashEl);
const chargeEffect = new ChargeEffect(sceneManager.scene);
const hud = new HUD(hudEl);
const isotopePanel = new IsotopePanel(isotopePanelEl);
const isotopeMenu = new IsotopeMenu(isotopeMenuEl);
const statusOverlay = new StatusOverlay(statusEl);
const helpModal = new HelpModal(helpEl, helpReopenBtn);
const gestures = new GestureController();
const logger = new GestureLogger();

particles.attachTo(chainReaction, hitStop);
chainReaction.on('atom_fissioned', ({ atomId }) => sceneManager.killAtomVisual(atomId));

for (const isotopeId of Object.keys(ISOTOPES)) {
  sceneManager.buildAtomCluster(chainReaction, isotopeId, 80, { radius: 4.2, color: ISOTOPES[isotopeId].color });
}
chainReaction.buildNeighborGraph();

let selectedIsotopeId = 'U235';
let lastHandVisible = false;
let containmentActive = false;
let heat = 0;
let manualSlowMo = false;

// --- Fission rate tracking (drives time dilation) ---
// The previous model set heat from raw live-neutron count, which meant
// firing 110 neutrons pinned the sim to minimum speed on frame ONE, before
// any chain reaction had started — so the barrage crawled in and nothing
// read as a cascade. Time dilation should respond to the chain reaction
// ACCELERATING (fissions per second), not to how many neutrons the user
// happened to fire. This tracks fissions in a rolling ~0.5s window.
const FISSION_RATE_WINDOW = 0.5;
const FISSION_RATE_FOR_FULL_HEAT = 25;
let fissionTimestamps = [];

chainReaction.on(EVENTS.ATOM_FISSIONED, () => {
  fissionTimestamps.push(performance.now() / 1000);
});

function currentFissionRate() {
  const now = performance.now() / 1000;
  fissionTimestamps = fissionTimestamps.filter(t => now - t < FISSION_RATE_WINDOW);
  return fissionTimestamps.length / FISSION_RATE_WINDOW;
}

sceneManager.setActiveIsotope(selectedIsotopeId);
isotopePanel.show(selectedIsotopeId);

const TIER_NEUTRON_COUNT = { LOW: 8, MED: 25, HIGH: 55, ULTRA: 110 };

function selectIsotope(isotopeId, keyPressed, source = 'keyboard') {
  if (!isotopeId || isotopeId === selectedIsotopeId) return;
  selectedIsotopeId = isotopeId;

  chainReaction.hardReset(isotopeId);
  sceneManager.setActiveIsotope(isotopeId);
  particles.clearAll();
  hitStop.forceClear();
  chargeEffect.cancel();
  heat = 0;
  fissionTimestamps = [];
  sceneManager.setHeat(0);

  isotopePanel.show(isotopeId);
  playSelectTone(keyPressed - 1);
  logger.log('isotope_selected', { key: keyPressed, isotopeId, source });
  isotopeMenu.hide();
}

function fireClap(position, tier, holdDuration, source = 'gesture') {
  const count = TIER_NEUTRON_COUNT[tier] ?? 25;
  const worldOrigin = sceneManager.getHandOriginPoint(position.x, position.y);
  const hitCount = chainReaction.bombardIsotope(selectedIsotopeId, count, worldOrigin);
  playClapTone(count);
  logger.log('clap', { isotopeId: selectedIsotopeId, tier, holdDuration: holdDuration?.toFixed(2), requested: count, neutronsFired: hitCount, source });
}

gestures.on(GESTURES.PALM_SHOWN, () => isotopeMenu.show());
gestures.on(GESTURES.PALM_HIDDEN, () => isotopeMenu.hide());

gestures.on(GESTURES.CHARGE_START, ({ position }) => {
  const worldPos = sceneManager.getHandOriginPoint(position.x, position.y);
  chargeEffect.setCharging(worldPos, 0);
});

gestures.on(GESTURES.CHARGING, ({ position, progress }) => {
  const worldPos = sceneManager.getHandOriginPoint(position.x, position.y);
  chargeEffect.setCharging(worldPos, progress);
});

gestures.on(GESTURES.CHARGE_CANCEL, () => chargeEffect.cancel());

gestures.on(GESTURES.CLAP, ({ position, tier, holdDuration }) => {
  chargeEffect.release(tier);
  fireClap(position, tier, holdDuration);
});

gestures.on(GESTURES.HAND_FOUND, () => logger.log('hand_found', {}));
gestures.on(GESTURES.HAND_LOST, () => logger.log('hand_lost', {}));

gestures.on(GESTURES.HANDS_UPDATE, (meta) => {
  lastHandVisible = !!meta.handVisible;
  if (!meta.handVisible) {
    gestureDebugEl.textContent = 'NO HAND VISIBLE';
    return;
  }
  const pose = meta.isFlatPalm ? 'PALM (menu open)' : meta.isOnePoint ? 'POINT' : 'neutral';
  const chargeBar = meta.charging
    ? '█'.repeat(Math.round(meta.chargeProgress * 10)) + '░'.repeat(10 - Math.round(meta.chargeProgress * 10))
    : null;
  gestureDebugEl.innerHTML = `
    pose: ${pose}<br/>
    ${chargeBar ? `CHARGING [${chargeBar}]` : 'hold 1 finger to charge · flat palm for menu'}
  `;
});

const handTracker = new HandTracker(video, debugCanvas);
handTracker.onResults((results) => gestures.update(results.landmarks));

async function initTracking() {
  statusOverlay.showLoading('Loading hand-tracking model…');
  try {
    await handTracker.init();
    statusOverlay.showLoading('Requesting camera access…');
    await handTracker.startWebcam();
    statusOverlay.hide();
    gestureDebugEl.textContent = 'tracker ready — press 1-9 to select, hold 1 finger to charge';
  } catch (err) {
    console.error('[Promethean] Tracking init failed:', err);
    statusOverlay.showError(describeTrackingError(err), () => initTracking());
    gestureDebugEl.textContent = 'tracker unavailable — keyboard still works fully';
  }
}

function describeTrackingError(err) {
  if (err.name === 'NotAllowedError') return 'Camera access was denied. Allow camera permission for this site, then retry.';
  if (err.name === 'NotFoundError') return 'No camera was found on this device. The keyboard controls work fully without it.';
  if (err.message?.includes('timed out')) return 'Camera did not respond in time — check that no other app is using it, then retry.';
  return `Hand tracking failed to start (${err.message}). The keyboard controls work fully without it.`;
}

window.addEventListener('keydown', (e) => {
  const digit = Number(e.key);
  if (digit >= 1 && digit <= 9 && KEY_TO_ISOTOPE[digit]) {
    selectIsotope(KEY_TO_ISOTOPE[digit], digit, 'keyboard');
  }
  if (e.key === '-') fireClap({ x: 0, y: 0 }, 'LOW', 0.1, 'keyboard');
  if (e.code === 'Space') { e.preventDefault(); fireClap({ x: 0, y: 0 }, 'MED', 0.5, 'keyboard'); }
  if (e.key === '=') fireClap({ x: 0, y: 0 }, 'HIGH', 1.2, 'keyboard');
  if (e.key === '0') fireClap({ x: 0, y: 0 }, 'ULTRA', 2.2, 'keyboard');
  if (e.key === 'Tab') { e.preventDefault(); isotopeMenuEl.classList.contains('visible') ? isotopeMenu.hide() : isotopeMenu.show(); }
  if (e.key === 'c' || e.key === 'C') {
    containmentActive = !containmentActive;
    chainReaction.setContainment(containmentActive);
    logger.log('containment_toggled', { active: containmentActive });
  }
  // Manual observation slow-motion — hold Shift to force the sim down to 15%
  // speed at any moment, so you can deliberately inspect a cascade rather
  // than only seeing dilation when the automatic system decides to apply it.
  if (e.key === 'Shift') manualSlowMo = true;
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') manualSlowMo = false;
});

helpModal.show();
initTracking();

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
  chargeEffect.updateFrame(dt);

  // Heat now tracks how fast the chain reaction is ACTUALLY fissioning, so
  // an incoming barrage flies in at full speed and time only slows as the
  // cascade genuinely blooms.
  const targetHeat = Math.min(1, currentFissionRate() / FISSION_RATE_FOR_FULL_HEAT);
  heat += (targetHeat - heat) * Math.min(1, dt * 3.5);
  sceneManager.setHeat(heat);
  hitStop.setHeat(heat);

  const autoScale = 1 - heat * 0.65;   // floor 0.35 instead of 0.25 — less compounding with thermal speed
  const timeScale = manualSlowMo ? Math.min(autoScale, 0.15) : autoScale;
  const simDt = dt * timeScale;

  if (!hitStop.isFrozen()) {
    chainReaction.step(simDt);
  }
  particles.update(simDt);

  sceneManager.updateAtoms(dt, elapsed);

  hud.update(chainReaction.stats, {
    handCount: lastHandVisible ? 1 : 0,
    generationCounts: chainReaction.generationCounts,
    containmentActive,
    timeScale,
    fissionRate: currentFissionRate(),
    manualSlowMo,
  });

  sceneManager.render();
}
animate();