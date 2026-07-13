// Full-screen overlay for camera/model loading + permission states.
// Uses textContent (not innerHTML) for any string that isn't a hardcoded
// literal — this guarantees error messages (which include browser-supplied
// text like err.message) can never be interpreted as markup, regardless of
// what they happen to contain.
export class StatusOverlay {
  constructor(el) {
    this.el = el;
  }

  showLoading(message) {
    this.el.style.display = 'flex';
    this.el.innerHTML = '';

    const spinner = document.createElement('div');
    spinner.className = 'status-spinner';

    const msg = document.createElement('div');
    msg.className = 'status-message';
    msg.textContent = message;

    this.el.append(spinner, msg);
  }

  showError(message, onRetry) {
    this.el.style.display = 'flex';
    this.el.innerHTML = '';

    const msg = document.createElement('div');
    msg.className = 'status-message status-error';
    msg.textContent = message;

    const btn = document.createElement('button');
    btn.className = 'status-retry';
    btn.textContent = 'Retry';
    btn.addEventListener('click', () => onRetry());

    this.el.append(msg, btn);
  }

  hide() {
    this.el.style.display = 'none';
    this.el.innerHTML = '';
  }
}