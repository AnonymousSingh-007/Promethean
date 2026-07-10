export class HUD {
  constructor(el) {
    this.el = el;
  }

  update(stats, meta = {}) {
    this.el.innerHTML = `
      <div>HANDS VISIBLE: ${meta.handCount ?? 0}</div>
      <div>NEUTRONS LIVE: ${stats.liveNeutrons}</div>
      <div>ATOMS FISSIONED: ${stats.fissioned}</div>
      <div>ATOMS ABSORBED: ${stats.absorbed}</div>
      <div>ENERGY RELEASED: ${stats.energyReleased}</div>
      <div>CASCADE DEPTH: ${stats.maxCascadeDepth}</div>
    `;
  }
}