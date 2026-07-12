import { SceneManager } from './core/SceneManager.js';
import { HandTracker } from './core/HandTracker.js';
import { GestureController, GESTURES } from './core/GestureController.js';
import { GestureLogger } from './core/GestureLogger.js';
import { ChainReaction } from './physics/ChainReaction.js';
import { ISOTOPES, KEY_TO_ISOTOPE } from './physics/IsotopeData.js';
import { ParticleSystem } from './vfx/ParticleSystem.js';
import { HitStop } from './vfx/HitStop.js';
import { ChargeEffect } from './vfx/ChargeEffect.js';
import { HUD } from './ui/HUD.js';
import { IsotopePanel } from './ui/IsotopePanel.js';
import { IsotopeMenu } from './ui/IsotopeMenu.js';
import { StatusOverlay } from './ui/StatusOverlay.js';
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

const sceneManager = new SceneManager(canvas);
const chainReaction = new ChainReaction({ neighborRadius: 3.5, maxNeighbors: 6 });
const particles = new ParticleSystem(sceneManager.scene);
const hitStop = new HitStop(flashEl);
const chargeEffect = new ChargeEffect(sceneManager.scene);
const hud = new HUD(hudEl);
const isotopePanel = new IsotopePanel(isotopePanelEl);
const isotopeMenu = new IsotopeMenu(isotopeMenuEl);
const statusOverlay = new StatusOverlay(statusEl);
const gestures = new GestureController();
const logger = new GestureLogger();

particles.attachTo(chainReaction, hitStop);
chainReaction.on('atom_fissioned', ({ atomId }) => sceneManager.killAtomVisual(atomId));

for (const isotopeId of Object.keys(ISOTOPES)) {
  sceneManager.buildAtomCluster(chainReaction, isotopeId, 30, { radius: 3.2, color: ISOTOPES[isotopeId].color });
}
chainReaction.buildNeighborGraph();

let selectedIsotopeId = 'U235';
sceneManager.setActiveIsotope(selectedIsotopeId);
isotopePanel.show(selectedIsotopeId);
let lastHandVisible = false;

const TIER_NEUTRON_COUNT = { LOW: 5, MED: 20, HIGH: 50 };

function selectIsotope(isotopeId, keyPressed, source = 'keyboard') {
  if (!isotopeId || isotopeId === selectedIsotopeId) return;
  selectedIsotopeId = isotopeId;
  chainReaction.resetIsotope(isotopeId);
  sceneManager.setActiveIsotope(isotopeId);
  isotopePanel.show(isotopeId);
  playSelectTone(keyPressed - 1);
  logger.log('isotope_selected', { key: keyPressed, isotopeId, source });
  isotopeMenu.hide(); // confirm-and-close, even if palm is still up
}

function fireClap(position, tier, holdDuration, source = 'gesture') {
  const count = TIER_NEUTRON_COUNT[tier] ?? 20;
  const worldOrigin = sceneManager.screenToWorldPoint(position.x, position.y, 14);
  const hitCount = chainReaction.bombardIsotope(selectedIsotopeId, count, worldOrigin);
  playClapTone(count);
  logger.log('clap', { isotopeId: selectedIsotopeId, tier, holdDuration: holdDuration?.toFixed(2), requested: count, neutronsFired: hitCount, source });
}

// --- Gesture wiring: palm -> menu, one-finger -> charge/fire ---
gestures.on(GESTURES.PALM_SHOWN, () => isotopeMenu.show());
gestures.on(GESTURES.PALM_HIDDEN, () => isotopeMenu.hide());

gestures.on(GESTURES.CHARGE_START, ({ position }) => {
  const worldPos = sceneManager.screenToWorldPoint(position.x, position.y, 10);
  chargeEffect.setCharging(worldPos, 0);
});

gestures.on(GESTURES.CHARGING, ({ position, progress }) => {
  const worldPos = sceneManager.screenToWorldPoint(position.x, position.y, 10);
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

// --- Hand tracking bootstrap ---
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

// --- Keyboard controls: ALWAYS active, not just a fallback ---
// Number keys are the primary isotope-selection method (see IsotopeMenu.js
// comment for why). Space/-/= are always-available alternates for firing.
window.addEventListener('keydown', (e) => {
  const digit = Number(e.key);
  if (digit >= 1 && digit <= 9 && KEY_TO_ISOTOPE[digit]) {
    selectIsotope(KEY_TO_ISOTOPE[digit], digit, 'keyboard');
  }
  if (e.code === 'Space') { e.preventDefault(); fireClap({ x: 0, y: 0 }, 'MED', 0.4, 'keyboard'); }
  if (e.key === '-') fireClap({ x: 0, y: 0 }, 'LOW', 0.05, 'keyboard');
  if (e.key === '=') fireClap({ x: 0, y: 0 }, 'HIGH', 0.9, 'keyboard');
  if (e.key === 'Tab') { e.preventDefault(); isotopeMenu.el.classList.contains('visible') ? isotopeMenu.hide() : isotopeMenu.show(); }
});

initTracking();

let lastTime = performance.now();
let elapsed = 0;
let heat = 0;
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;
  elapsed += dt;

  handTracker.tick();
  hitStop.update(dt);
  chargeEffect.updateFrame(dt);

  if (!hitStop.isFrozen()) {
    chainReaction.step(dt);
  }
  particles.update(dt);
  sceneManager.updateAtoms(dt, elapsed);

  const targetHeat = Math.min(1, chainReaction.stats.liveNeutrons / 25);
  heat += (targetHeat - heat) * Math.min(1, dt * 2.5);
  sceneManager.setHeat(heat);

  hud.update(chainReaction.stats, { handCount: lastHandVisible ? 1 : 0 });

  sceneManager.render();
}
animate();