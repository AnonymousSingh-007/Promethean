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

  /** Instantly cancels any active freeze/flash — used on isotope switch so leftover drama from the previous isotope doesn't bleed into the new one. */
  forceClear() {
    this.freezeUntil = 0;
    this._flashDecay = 0;
    this.flashEl.style.opacity = '0';
  }
}