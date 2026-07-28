import { ISOTOPES, KEY_TO_ISOTOPE } from '../physics/IsotopeData.js';

export class IsotopeMenu {
  constructor(el) {
    this.el = el;
    this._build();
  }

  _build() {
    const rows = Object.entries(KEY_TO_ISOTOPE).map(([key, isotopeId]) => {
      const iso = ISOTOPES[isotopeId];
      const swatch = `#${iso.color.toString(16).padStart(6, '0')}`;
      const pct = Math.round(iso.fissionProbability.thermal * 100);
      return `
        <div class="menu-row">
          <span class="menu-key">${key}</span>
          <span class="menu-dot" style="background:${swatch}"></span>
          <span class="menu-name">${iso.label}</span>
          <span class="menu-pct">${pct}% th</span>
        </div>`;
    }).join('');

    this.el.innerHTML = `
      <div class="menu-title">SELECT ISOTOPE</div>
      ${rows}
      <div class="menu-hint">press the number key</div>
    `;
  }

  show() { this.el.classList.add('visible'); }
  hide() { this.el.classList.remove('visible'); }
}