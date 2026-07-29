function criticalityLabel(kEff) {
  if (kEff === null || kEff === undefined) return { text: '—', color: '#9fa8da' };
  if (kEff < 0.97) return { text: 'SUBCRITICAL', color: '#6cf7ff' };
  if (kEff <= 1.03) return { text: 'CRITICAL', color: '#ffd76c' };
  return { text: 'SUPERCRITICAL', color: '#ff6c6c' };
}

export class HUD {
  constructor(el) {
    this.el = el;
  }

  update(stats, meta = {}) {
    const crit = criticalityLabel(stats.kEff);
    const genStr = meta.generationCounts && meta.generationCounts.size
      ? [...meta.generationCounts.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c).join(' → ')
      : '—';
    const modeText = meta.containmentActive ? 'REACTOR (containment ON)' : 'WEAPON (uncontained)';
    const modeColor = meta.containmentActive ? '#6cf7ff' : '#ff6c6c';
    const timeScalePct = meta.timeScale != null ? Math.round(meta.timeScale * 100) : 100;
    const slowMoTag = meta.manualSlowMo ? ' <span style="color:#ffd76c">[SHIFT SLOW-MO]</span>' : '';

    this.el.innerHTML = `
      <div>HANDS VISIBLE: ${meta.handCount ?? 0}</div>
      <div>MODE: <strong style="color:${modeColor}">${modeText}</strong> <span style="opacity:0.6">(C)</span></div>
      <div>NEUTRONS LIVE: ${stats.liveNeutrons}</div>
      <div>FISSIONED: ${stats.fissioned} · ABSORBED: ${stats.absorbed}</div>
      <div>SCATTERED: ${stats.scattered} · ESCAPED: ${stats.escaped}</div>
      <div>FISSION RATE: ${(meta.fissionRate ?? 0).toFixed(1)}/s</div>
      <div>ENERGY RELEASED: ${stats.energyReleased}</div>
      <div>CASCADE DEPTH: ${stats.maxCascadeDepth}</div>
      <div>GENERATIONS: ${genStr}</div>
      <div>TIME SCALE: ${timeScalePct}%${slowMoTag}</div>
      <div style="margin-top:4px;">k_eff: <strong>${stats.kEff ?? '—'}</strong>
        <span style="color:${crit.color}; font-weight:bold;">${crit.text}</span>
      </div>
    `;
  }
}