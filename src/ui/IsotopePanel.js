import { ISOTOPES } from '../physics/IsotopeData.js';

export class IsotopePanel {
  constructor(el) {
    this.el = el;
  }

  show(isotopeId) {
    const iso = ISOTOPES[isotopeId];
    const thermalPct = Math.round(iso.fissionProbability.thermal * 100);
    const fastPct = Math.round(iso.fissionProbability.fast * 100);
    const [minN, maxN] = iso.neutronsEmitted;
    const swatch = `#${iso.color.toString(16).padStart(6, '0')}`;

    this.el.innerHTML = `
      <div class="isotope-panel-title" style="color:${swatch}">${iso.label}</div>
      <div class="isotope-panel-row">Fission chance: <strong>${thermalPct}%</strong> thermal · <strong>${fastPct}%</strong> fast</div>
      <div class="isotope-panel-row">Neutron yield: <strong>${minN}-${maxN}</strong> per fission</div>
      <div class="isotope-panel-row">Energy per fission: <strong>${iso.energy}</strong> MeV (stylized)</div>
    `;

    this.el.classList.remove('confirm-pulse');
    void this.el.offsetWidth;
    this.el.classList.add('confirm-pulse');
  }
}