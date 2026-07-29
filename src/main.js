import { SceneManager } from './core/SceneManager.js';
import { HandTracker } from './core/HandTracker.js';
import { GestureController, GESTURES } from './core/GestureController.js';
import { GestureLogger } from './core/GestureLogger.js';
import { ReactorBridge } from './core/ReactorBridge.js';
import { PlaybackEngine } from './core/PlaybackEngine.js';
import { ISOTOPES, KEY_TO_ISOTOPE } from './physics/IsotopeData.js';
import { EVENTS } from './physics/ChainReaction.js';
import { ParticleSystem } from './vfx/ParticleSystem.js';
import { HitStop } from './vfx/HitStop.js';
import { ChargeEffect } from './vfx/ChargeEffect.js';
import { IsotopePanel } from './ui/IsotopePanel.js';
import { IsotopeMenu } from './ui/IsotopeMenu.js';
import { InstrumentPanel } from './ui/InstrumentPanel.js';
import { StatusOverlay } from './ui/StatusOverlay.js';
import { HelpModal } from './ui/HelpModal.js';
import { playSelectTone, playClapTone } from './utils/Sfx.js';

// --- DOM ---
const canvas = document.getElementById('scene-canvas');
const video = document.getElementById('webcam-video');
const debugCanvas = document.getElementById('debug-canvas');
const isotopePanelEl = document.getElementById('isotope-panel');
const isotopeMenuEl = document.getElementById('isotope-menu');
const instrumentPanelEl = document.getElementById('instrument-panel');
const gestureDebugEl = document.getElementById('gesture-debug');
const flashEl = document.getElementById('flash-overlay');
const statusEl = document.getElementById('status-overlay');
const helpEl = document.getElementById('help-overlay');
const helpReopenBtn = document.getElementById('help-reopen-btn');

// --- Systems ---
const sceneManager = new SceneManager(canvas);
const reactor = new ReactorBridge();
const playback = new PlaybackEngine();
const particles = new ParticleSystem(sceneManager.scene);
const hitStop = new HitStop(flashEl);
const chargeEffect = new ChargeEffect(sceneManager.scene);
const isotopePanel = new IsotopePanel(isotopePanelEl);
const isotopeMenu = new IsotopeMenu(isotopeMenuEl);
const instrumentPanel = new InstrumentPanel(instrumentPanelEl);
const statusOverlay = new StatusOverlay(statusEl);
const helpModal = new HelpModal(helpEl, helpReopenBtn);
const gestures = new GestureController();
const logger = new GestureLogger();

// Build the visual scene (no physics in SceneManager anymore — it's just visual)
for (const isotopeId of Object.keys(ISOTOPES)) {
  sceneManager.buildAtomCluster(null, isotopeId, 80, { radius: 4.2, color: ISOTOPES[isotopeId].color });
}

// --- State ---
let selectedIsotopeId = 'U235';
let containmentActive = false;
let controlRodInsertion = 0; // 0 = fully withdrawn, 1 = fully inserted
let heat = 0;
let fissionTimestamps = [];
let lastStats = { fissioned: 0, absorbed: 0, scattered: 0, escaped: 0, energyReleased: 0, maxCascadeDepth: 0, liveNeutrons: 0, kEff: null };
let lastGenerationCounts = new Map();
let lastHandVisible = false;

// --- Playback → VFX wiring ---
// Playback engine fires events at the right wall-clock moment;
// VFX systems listen and produce visuals. This is the whole pipeline:
// Worker → event log → PlaybackEngine → VFX.

playback.on(EVENTS.NEUTRON_SPAWNED, (p) => {
  particles.spawnTrail(p);
  if (p.depth > 0) particles.spawnLineageLine(p.from, p.to, p.isotopeId);
});

playback.on(EVENTS.ATOM_FISSIONED, (p) => {
  sceneManager.killAtomVisual(p.atomId);
  particles.spawnFissionBurst(p.position, p.energy, p.isotopeId);
  particles.spawnSpeedLines(p.position, p.isotopeId);
  particles.spawnSplitFragments(p.position);
  hitStop.trigger({ energy: p.energy });
  fissionTimestamps.push(performance.now() / 1000);
});

playback.on(EVENTS.ATOM_ABSORBED, (p) => {
  particles.spawnAbsorbSpark(p.position, p.isotopeId);
});

playback.on(EVENTS.NEUTRON_SCATTERED, (p) => {
  particles.spawnScatterSpark(p.position, p.isotopeId);
});

playback.on('playback_complete', () => {
  // Cascade has fully played out — nothing more to do
});

// --- Worker → UI wiring ---
reactor.on('CASCADE_READY', ({ eventLog, stats, isotopeId }) => {
  lastStats = stats;
  playback.load(eventLog);
  logger.log('cascade_ready', { events: eventLog.length, fissioned: stats.fissioned, kEff: stats.kEff });
});

reactor.on('RESET_COMPLETE', ({ isotopeId }) => {
  if (isotopeId) {
    sceneManager.setActiveIsotope(isotopeId);
    particles.clearAll();
    hitStop.forceClear();
    chargeEffect.cancel();
    heat = 0;
    fissionTimestamps = [];
    lastStats = { fissioned: 0, absorbed: 0, scattered: 0, escaped: 0, energyReleased: 0, maxCascadeDepth: 0, liveNeutrons: 0, kEff: null };
    lastGenerationCounts = new Map();
    sceneManager.setHeat(0);
  }
});

// --- Fission rate (drives ambient heat) ---
const FISSION_RATE_WINDOW = 0.5;
const FISSION_RATE_FOR_FULL_HEAT = 25;
function currentFissionRate() {
  const now = performance.now() / 1000;
  fissionTimestamps = fissionTimestamps.filter(t => now - t < FISSION_RATE_WINDOW);
  return fissionTimestamps.length / FISSION_RATE_WINDOW;
}

// --- Isotope selection ---
function selectIsotope(isotopeId, keyPressed, source = 'keyboard') {
  if (!isotopeId || isotopeId === selectedIsotopeId) return;
  selectedIsotopeId = isotopeId;
  playback.cancel();
  reactor.setIsotope(isotopeId); // worker resets physics + sends RESET_COMPLETE back
  isotopePanel.show(isotopeId);
  playSelectTone(keyPressed - 1);
  logger.log('isotope_selected', { key: keyPressed, isotopeId, source });
  isotopeMenu.hide();
}

// --- Firing ---
const TIER_NEUTRON_COUNT = { LOW: 8, MED: 25, HIGH: 55, ULTRA: 110 };

function fireClap(position, tier, holdDuration, source = 'gesture') {
  if (playback.isPlaying) playback.cancel(); // cancel any in-progress playback so new cascade plays cleanly
  const count = TIER_NEUTRON_COUNT[tier] ?? 25;
  const worldOrigin = sceneManager.getHandOriginPoint(position.x, position.y);
  reactor.fire(selectedIsotopeId, count, worldOrigin); // worker runs physics, sends CASCADE_READY
  playClapTone(count);
  logger.log('clap', { isotopeId: selectedIsotopeId, tier, holdDuration: holdDuration?.toFixed(2), requested: count, source });
}

// --- Gesture wiring ---
gestures.on(GESTURES.PALM_SHOWN, () => isotopeMenu.show());
gestures.on(GESTURES.PALM_HIDDEN, () => isotopeMenu.hide());
gestures.on(GESTURES.CHARGE_START, ({ position }) => {
  chargeEffect.setCharging(sceneManager.getHandOriginPoint(position.x, position.y), 0);
});
gestures.on(GESTURES.CHARGING, ({ position, progress }) => {
  chargeEffect.setCharging(sceneManager.getHandOriginPoint(position.x, position.y), progress);
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
  if (!meta.handVisible) { gestureDebugEl.textContent = 'NO HAND VISIBLE'; return; }
  const pose = meta.isFlatPalm ? 'PALM (menu open)' : meta.isOnePoint ? 'POINT' : 'neutral';
  const chargeBar = meta.charging
    ? '█'.repeat(Math.round(meta.chargeProgress * 10)) + '░'.repeat(10 - Math.round(meta.chargeProgress * 10))
    : null;
  gestureDebugEl.innerHTML = `pose: ${pose}<br/>${chargeBar ? `CHARGING [${chargeBar}]` : 'hold 1 finger · flat palm for menu'}`;
});

// --- Keyboard ---
window.addEventListener('keydown', (e) => {
  const digit = Number(e.key);
  if (digit >= 1 && digit <= 9 && KEY_TO_ISOTOPE[digit]) selectIsotope(KEY_TO_ISOTOPE[digit], digit);
  if (e.key === '-') fireClap({ x: 0, y: 0 }, 'LOW', 0.1, 'keyboard');
  if (e.code === 'Space') { e.preventDefault(); fireClap({ x: 0, y: 0 }, 'MED', 0.5, 'keyboard'); }
  if (e.key === '=') fireClap({ x: 0, y: 0 }, 'HIGH', 1.2, 'keyboard');
  if (e.key === '0') fireClap({ x: 0, y: 0 }, 'ULTRA', 2.2, 'keyboard');
  if (e.key === 'Tab') { e.preventDefault(); isotopeMenuEl.classList.contains('visible') ? isotopeMenu.hide() : isotopeMenu.show(); }
  if (e.key === 'c' || e.key === 'C') {
    containmentActive = !containmentActive;
    reactor.setContainment(containmentActive);
    logger.log('containment_toggled', { active: containmentActive });
  }
  if (e.key === 'ArrowUp') {
    controlRodInsertion = Math.min(1, controlRodInsertion + 0.05);
    reactor.setControlRods(controlRodInsertion);
    logger.log('control_rods', { insertion: controlRodInsertion });
  }
  if (e.key === 'ArrowDown') {
    controlRodInsertion = Math.max(0, controlRodInsertion - 0.05);
    reactor.setControlRods(controlRodInsertion);
    logger.log('control_rods', { insertion: controlRodInsertion });
  }
});

// --- Hand tracking ---
const handTracker = new HandTracker(video, debugCanvas);
handTracker.onResults((results) => gestures.update(results.landmarks));

async function initTracking() {
  statusOverlay.showLoading('Loading hand-tracking model…');
  try {
    await handTracker.init();
    statusOverlay.showLoading('Requesting camera access…');
    await handTracker.startWebcam();
    statusOverlay.hide();
    gestureDebugEl.textContent = 'tracker ready';
  } catch (err) {
    console.error('[Promethean] Tracking init failed:', err);
    statusOverlay.showError(describeError(err), () => initTracking());
    gestureDebugEl.textContent = 'tracker unavailable — keyboard still works';
  }
}

function describeError(err) {
  if (err.name === 'NotAllowedError') return 'Camera access was denied. Allow camera permission, then retry.';
  if (err.name === 'NotFoundError') return 'No camera found. Keyboard controls work fully without one.';
  return `Hand tracking failed (${err.message}). Keyboard controls work fully without it.`;
}

// --- Init ---
sceneManager.setActiveIsotope(selectedIsotopeId);
isotopePanel.show(selectedIsotopeId);
helpModal.show();
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
  chargeEffect.updateFrame(dt);

  // Tick the playback engine — dispatches events whose simTime has been reached
  playback.tick();

  // Animate VFX (trails, lineage web, burst particles)
  particles.update(dt);

  // Heat from actual fission rate, not neutron count — never pins on fire
  const targetHeat = Math.min(1, currentFissionRate() / FISSION_RATE_FOR_FULL_HEAT);
  heat += (targetHeat - heat) * Math.min(1, dt * 3.5);
  sceneManager.setHeat(heat);
  hitStop.setHeat(heat);

  sceneManager.updateAtoms(dt, elapsed);

  instrumentPanel.update(lastStats, {
    containmentActive,
    controlRodInsertion,
    fissionRate: currentFissionRate(),
    generationCounts: lastGenerationCounts,
    handCount: lastHandVisible ? 1 : 0,
  });

  sceneManager.render();
}
animate();