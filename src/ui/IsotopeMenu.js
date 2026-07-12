import { ISOTOPES, KEY_TO_ISOTOPE } from '../physics/IsotopeData.js';

// Shown when a flat palm is detected (or can be left open — closing is driven
// by main.js on PALM_HIDDEN or immediately after a valid keyboard selection).
// This panel is purely informational: it never selects anything itself,
// selection always happens via the keyboard, so a flaky palm-detection frame
// can only cost you a missing reminder, never a wrong isotope.
export class IsotopeMenu {
  constructor(el) {
    this.el = el;
    this._build();
  }

  _build() {
    const rows = Object.entries(KEY_TO_ISOTOPE).map(([key, isotopeId]) => {
      const iso = ISOTOPES[isotopeId];
      const swatch = `#${iso.color.toString(16).padStart(6, '0')}`;
      const pct = Math.round(iso.fissionProbability * 100);
      return `
        <div class="menu-row">
          <span class="menu-key">${key}</span>
          <span class="menu-dot" style="background:${swatch}"></span>
          <span class="menu-name">${iso.label}</span>
          <span class="menu-pct">${pct}%</span>
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