// The single highest-value VFX trick — freeze the sim for a few frames on
// impact + flash the screen white. But during a DENSE cascade, many fissions
// resolve within the same second, and if each one independently freezes for
// 40-130ms, you get stacked freezes that read as stutter, not slow-motion.
// The fix: individual hit-stop duration shrinks as "heat" (overall cascade
// intensity, set once per frame from main.js) rises — a lone fission still
// gets a full satisfying freeze, but during a busy cascade individual
// freezes fade toward negligible, because the GLOBAL time-dilation system
// (see main.js) is already carrying the "everything is dramatic" feeling
// smoothly, instead of via a strobe of tiny freezes.

export class HitStop {
  constructor(flashOverlayEl) {
    this.flashEl = flashOverlayEl;
    this.freezeUntil = 0;
    this._flashDecay = 0;
    this._heat = 0;
  }

  setHeat(heat) {
    this._heat = heat;
  }

  trigger({ energy = 100, maxEnergy = 260 } = {}) {
    const intensity = clamp(energy / maxEnergy, 0.15, 1);
    const heatSuppression = 1 - this._heat * 0.85;
    const freezeMs = (40 + intensity * 90) * heatSuppression;

    if (freezeMs < 4) {
      // Still worth a tiny flash even when the freeze itself is suppressed away.
      this._flashDecay = 1;
      this.flashEl.style.opacity = String(0.08 + intensity * 0.15);
      return;
    }

    this.freezeUntil = performance.now() + freezeMs;
    this._flashDecay = 1;
    this.flashEl.style.opacity = String((0.15 + intensity * 0.55) * heatSuppression + 0.05);
  }

  isFrozen() {
    return performance.now() < this.freezeUntil;
  }

  update(dt) {
    if (this._flashDecay > 0) {
      this._flashDecay = Math.max(0, this._flashDecay - dt * 4);
      const current = parseFloat(this.flashEl.style.opacity || '0');
      this.flashEl.style.opacity = String(Math.max(0, current - dt * 2.5));
    }
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}