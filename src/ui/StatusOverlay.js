// Full-screen overlay covering camera/model loading and permission-denied
// states. Hidden once tracking is confirmed running; reappears with a retry
// button if init fails at any stage.
export class StatusOverlay {
  constructor(el) {
    this.el = el;
  }

  showLoading(message) {
    this.el.style.display = 'flex';
    this.el.innerHTML = `
      <div class="status-spinner"></div>
      <div class="status-message">${message}</div>
    `;
  }

  showError(message, onRetry) {
    this.el.style.display = 'flex';
    this.el.innerHTML = `
      <div class="status-message status-error">${message}</div>
      <button id="status-retry-btn" class="status-retry">Retry</button>
    `;
    this.el.querySelector('#status-retry-btn').addEventListener('click', () => onRetry());
  }

  hide() {
    this.el.style.display = 'none';
    this.el.innerHTML = '';
  }
}