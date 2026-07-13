// Shown once automatically on load, closeable, and reopenable anytime via the
// small "?" button. Purely informational — never blocks gestures or keyboard
// input from working underneath it.
export class HelpModal {
  constructor(el, reopenButtonEl) {
    this.el = el;
    this._build();
    reopenButtonEl.addEventListener('click', () => this.show());
  }

  _build() {
    this.el.innerHTML = `
      <div class="help-card">
        <button class="help-close" aria-label="Close">×</button>
        <h2>⚛️ Promethean</h2>
        <p class="help-sub">Webcam-controlled nuclear fission chain reaction simulator</p>

        <div class="help-section">
          <h3>🖐️ Select an isotope</h3>
          <p>Show a flat open palm to bring up the isotope menu, then press a number key <strong>1–9</strong> to select. The keyboard always works — camera or not.</p>
        </div>

        <div class="help-section">
          <h3>☝️ Charge and fire</h3>
          <p>Point a single finger at the camera and hold — a glowing orb builds at your fingertip, heating up the longer you hold. Release to fire:</p>
          <ul>
            <li><strong>Quick tap</strong> — small burst</li>
            <li><strong>Brief hold</strong> — medium burst</li>
            <li><strong>Longer hold</strong> — large burst</li>
            <li><strong>Held the longest</strong> — massive burst</li>
          </ul>
        </div>

        <div class="help-section">
          <h3>⌨️ Keyboard controls</h3>
          <p><strong>1–9</strong> select isotope · <strong>Tab</strong> toggle menu · <strong>-</strong> small fire · <strong>Space</strong> medium fire · <strong>=</strong> large fire · <strong>0</strong> massive fire</p>
        </div>

        <button class="help-start">Got it — let's go</button>
      </div>
    `;
    this.el.querySelector('.help-close').addEventListener('click', () => this.hide());
    this.el.querySelector('.help-start').addEventListener('click', () => this.hide());
  }

  show() { this.el.classList.add('visible'); }
  hide() { this.el.classList.remove('visible'); }
}