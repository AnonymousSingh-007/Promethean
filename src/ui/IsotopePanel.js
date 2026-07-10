import { ISOTOPES } from '../physics/IsotopeData.js';

// Shows fission probability, neutron yield, and energy for whichever isotope
// is currently selected — this is what makes the physics legible instead of
// just "dots disappearing." Also pulses (via the .confirm-pulse CSS animation
// in index.html) on every new selection as the visual confirmation that the
// gesture actually registered.
export class IsotopePanel {
  constructor(el) {
    this.el = el;
  }

  show(isotopeId) {
    const iso = ISOTOPES[isotopeId];
    const pct = Math.round(iso.fissionProbability * 100);
    const [minN, maxN] = iso.neutronsEmitted;
    const swatch = `#${iso.color.toString(16).padStart(6, '0')}`;

    this.el.innerHTML = `
      <div class="isotope-panel-title" style="color:${swatch}">${iso.label}</div>
      <div class="isotope-panel-row">Fission chance: <strong>${pct}%</strong></div>
      <div class="isotope-panel-row">Neutron yield: <strong>${minN}-${maxN}</strong> per fission</div>
      <div class="isotope-panel-row">Energy per fission: <strong>${iso.energy}</strong> MeV (stylized)</div>
    `;

    // Restart the CSS animation even if it's already mid-pulse from a rapid re-selection.
    this.el.classList.remove('confirm-pulse');
    void this.el.offsetWidth; // force reflow
    this.el.classList.add('confirm-pulse');
  }
}