// Scientific instrument panel — k_eff gauge, neutron population history,
// power output meter, generation breakdown. Positioned bottom-center so
// it doesn't fight with the 3D scene.

export class InstrumentPanel {
  constructor(el) {
    this.el = el;
    this._history = []; // rolling neutron count history for sparkline
    this._maxHistory = 60;
    this._build();
  }

  _build() {
    this.el.innerHTML = `
      <div class="panel-row">
        <div class="panel-block" id="panel-mode">
          <div class="panel-label">MODE</div>
          <div class="panel-value" id="pv-mode">WEAPON</div>
        </div>
        <div class="panel-block" id="panel-keff">
          <div class="panel-label">k<sub>eff</sub></div>
          <div class="panel-value" id="pv-keff">—</div>
          <div class="panel-sublabel" id="pv-criticality">—</div>
        </div>
        <div class="panel-block">
          <div class="panel-label">FISSION RATE</div>
          <div class="panel-value" id="pv-rate">0/s</div>
        </div>
        <div class="panel-block">
          <div class="panel-label">ENERGY (MeV)</div>
          <div class="panel-value" id="pv-energy">0</div>
        </div>
        <div class="panel-block">
          <div class="panel-label">CONTROL RODS</div>
          <div class="panel-value" id="pv-rods">0%</div>
          <div class="panel-sublabel">↑/↓ to adjust</div>
        </div>
      </div>
      <div class="panel-row">
        <div class="panel-block wide">
          <div class="panel-label">GENERATIONS (neutrons born per depth)</div>
          <div class="panel-value mono" id="pv-gens">—</div>
        </div>
        <div class="panel-block wide">
          <div class="panel-label">INTERACTIONS</div>
          <div class="panel-value mono" id="pv-interactions">—</div>
        </div>
      </div>
      <div class="panel-row">
        <div class="panel-block fullwidth">
          <div class="panel-label">NEUTRON POPULATION HISTORY</div>
          <canvas id="panel-sparkline" width="400" height="36"></canvas>
        </div>
      </div>
    `;
    this._sparkCanvas = this.el.querySelector('#panel-sparkline');
    this._sparkCtx = this._sparkCanvas.getContext('2d');
  }

  update(stats, meta = {}) {
    const kEff = stats.kEff;
    const crit = kEff === null ? { text: '—', color: '#9fa8da' }
      : kEff < 0.97 ? { text: 'SUBCRITICAL', color: '#6cf7ff' }
      : kEff <= 1.03 ? { text: 'CRITICAL', color: '#ffd76c' }
      : { text: 'SUPERCRITICAL', color: '#ff6c6c' };

    const modeText = meta.containmentActive ? 'REACTOR' : 'WEAPON';
    const modeColor = meta.containmentActive ? '#6cf7ff' : '#ff6c6c';

    setText('pv-mode', modeText, modeColor);
    setText('pv-keff', kEff?.toFixed(3) ?? '—', crit.color);
    setText('pv-criticality', crit.text, crit.color);
    setText('pv-rate', `${(meta.fissionRate ?? 0).toFixed(1)}/s`);
    setText('pv-energy', stats.energyReleased.toFixed(0));
    setText('pv-rods', `${Math.round((meta.controlRodInsertion ?? 0) * 100)}%`);

    const genStr = meta.generationCounts && meta.generationCounts.size
      ? [...meta.generationCounts.entries()].sort((a, b) => a[0] - b[0]).map(([d, c]) => `gen${d}:${c}`).join('  ')
      : '—';
    setText('pv-gens', genStr);

    setText('pv-interactions',
      `fissioned: ${stats.fissioned}  absorbed: ${stats.absorbed}  scattered: ${stats.scattered}  escaped: ${stats.escaped}`
    );

    this._history.push(stats.liveNeutrons);
    if (this._history.length > this._maxHistory) this._history.shift();
    this._drawSparkline();
  }

  _drawSparkline() {
    const ctx = this._sparkCtx;
    const w = this._sparkCanvas.width;
    const h = this._sparkCanvas.height;
    ctx.clearRect(0, 0, w, h);

    if (this._history.length < 2) return;

    const max = Math.max(...this._history, 1);
    ctx.beginPath();
    ctx.strokeStyle = '#6cf7ff';
    ctx.lineWidth = 1.5;

    this._history.forEach((v, i) => {
      const x = (i / (this._maxHistory - 1)) * w;
      const y = h - (v / max) * h * 0.9;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under the line
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(108,247,255,0.08)';
    ctx.fill();
  }
}

function setText(id, text, color) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (color) el.style.color = color;
}