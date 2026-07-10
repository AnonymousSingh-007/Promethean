// The single highest-value VFX trick in this whole project.
// Freeze the sim for a few frames on impact + flash the screen white, and it
// reads as "anime hit" regardless of how simple the underlying geometry is.
// Scale duration/intensity by fission energy so big cascade moments hit harder
// than a single absorbed neutron.

export class HitStop {
  constructor(flashOverlayEl) {
    this.flashEl = flashOverlayEl;
    this.freezeUntil = 0;
    this._flashDecay = 0;
  }

  /** Call from ChainReaction's ATOM_FISSIONED listener. */
  trigger({ energy = 100, maxEnergy = 260 } = {}) {
    const intensity = clamp(energy / maxEnergy, 0.15, 1);
    const freezeMs = 40 + intensity * 90;      // 40-130ms freeze, scales with fission energy
    this.freezeUntil = performance.now() + freezeMs;
    this._flashDecay = 1;
    this.flashEl.style.opacity = String(0.15 + intensity * 0.55);
  }

  /** Returns true if the render loop should skip advancing sim time this frame. */
  isFrozen() {
    return performance.now() < this.freezeUntil;
  }

  /** Call every frame regardless of freeze state, to fade the flash overlay back out. */
  update(dt) {
    if (this._flashDecay > 0) {
      this._flashDecay = Math.max(0, this._flashDecay - dt * 4); // ~250ms fade
      const current = parseFloat(this.flashEl.style.opacity || '0');
      this.flashEl.style.opacity = String(Math.max(0, current - dt * 2.5));
    }
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
