import { ISOTOPES } from '../physics/IsotopeData.js';

// Simple DOM-based radial menu (not WebGL) — appears near the tracked hand's
// screen position on PINCH_START, disappears on PINCH_END with a selection.
// Kept as plain DOM because it's faster to build/iterate on over a weekend
// than doing menu hit-testing in Three.js, and it sits happily on top of the canvas.

export class RadialMenu {
  constructor(container) {
    this.container = container;
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: fixed; pointer-events: none; z-index: 5;
      display: none; transform: translate(-50%, -50%);
    `;
    container.appendChild(this.el);
    this.selected = 'U235'; // default isotope if user throws without pinch-selecting
    this._items = Object.values(ISOTOPES);
    this._build();
  }

  _build() {
    const radius = 80;
    this._items.forEach((iso, i) => {
      const angle = (i / this._items.length) * Math.PI * 2 - Math.PI / 2;
      const btn = document.createElement('div');
      btn.dataset.isotopeId = iso.id;
      btn.textContent = iso.label.split('-')[0];
      btn.style.cssText = `
        position: absolute; width: 56px; height: 56px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-family: monospace; font-size: 10px; color: white; text-align: center;
        background: #${iso.color.toString(16).padStart(6, '0')}33;
        border: 2px solid #${iso.color.toString(16).padStart(6, '0')};
        left: ${Math.cos(angle) * radius}px; top: ${Math.sin(angle) * radius}px;
      `;
      this.el.appendChild(btn);
    });
  }

  showAt(screenX, screenY) {
    this.el.style.left = `${screenX}px`;
    this.el.style.top = `${screenY}px`;
    this.el.style.display = 'block';
  }

  hide() {
    this.el.style.display = 'none';
  }

  /** Naive nearest-item selection by angle from center — good enough for a pinch-drag gesture. */
  selectNearest(screenX, screenY) {
    const rect = this.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(screenY - cy, screenX - cx);
    const normalized = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    const index = Math.round(normalized / (Math.PI * 2 / this._items.length)) % this._items.length;
    this.selected = this._items[index].id;
    return this.selected;
  }
}
