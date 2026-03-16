// ===== INPUT HANDLER =====
// Professional input system with DAS and multi-key tracking.
// Buffering is intentionally NOT here — GameCanvas owns the tween state
// and is the only place that can reliably decide what to execute and when.

const KEY_MAP = {
  'ArrowUp': [0, -1], 'ArrowDown': [0, 1], 'ArrowLeft': [-1, 0], 'ArrowRight': [1, 0],
  'w': [0, -1], 's': [0, 1], 'a': [-1, 0], 'd': [1, 0],
  'W': [0, -1], 'S': [0, 1], 'A': [-1, 0], 'D': [1, 0],
};
const SWIPE_THRESHOLD = 20;

// DAS (Delayed Auto Shift) — standard in puzzle/action games
const DAS_DELAY = 200;  // ms before auto-repeat kicks in
const DAS_RATE  = 80;   // ms between repeated moves

export class Input {
  constructor() {
    this._callbacks = { move: null, undo: null, restart: null, escape: null };
    this._touchStart = null;
    this._enabled = true;
    this._keyHandler = null;
    this._keyUpHandler = null;
    this._touchCanvas = null;
    this._touchStartHandler = null;
    this._touchEndHandler = null;

    // Direction stack: all held direction keys in press order.
    // Top of stack (last element) = active direction (most recent intent wins).
    this._dirStack = [];

    // DAS timing state
    this._dasTimer = 0;      // performance.now() timestamp when current dir started
    this._dasActive = false; // true once the initial DAS delay has elapsed
    this._dasLast = 0;       // timestamp of last auto-repeat fire
  }

  on(event, callback) { this._callbacks[event] = callback; }

  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) {
      this._dirStack.length = 0;
      this._resetDas();
    }
  }

  _resetDas() {
    this._dasTimer = 0;
    this._dasActive = false;
    this._dasLast = 0;
  }

  // Returns the currently active direction or null
  activeDir() {
    return this._dirStack.length > 0 ? this._dirStack[this._dirStack.length - 1] : null;
  }

  _sameDir(a, b) { return a[0] === b[0] && a[1] === b[1]; }

  _removeDirFromStack(dir) {
    for (let i = this._dirStack.length - 1; i >= 0; i--) {
      if (this._sameDir(this._dirStack[i], dir)) { this._dirStack.splice(i, 1); return; }
    }
  }

  // Called each game frame when NOT tweening.
  // Returns the direction that should move this frame, or null.
  // GameCanvas calls this and decides whether to act on it.
  pollHeld(now) {
    if (!this._enabled) return null;

    const dir = this.activeDir();
    if (!dir) { this._resetDas(); return null; }

    if (!now) now = performance.now();

    if (this._dasTimer === 0) {
      // Fresh direction — initial move already fired on keydown
      this._dasTimer = now;
      return null;
    }

    const elapsed = now - this._dasTimer;

    if (!this._dasActive) {
      if (elapsed >= DAS_DELAY) {
        this._dasActive = true;
        this._dasLast = now;
        return dir;
      }
      return null;
    }

    // DAS active — fire at repeat rate
    if (now - this._dasLast >= DAS_RATE) {
      this._dasLast = now;
      return dir;
    }
    return null;
  }

  bindKeyboard() {
    this._keyHandler = (e) => {
      if (!this._enabled) return;
      const dir = KEY_MAP[e.key];
      if (dir) {
        e.preventDefault();
        if (!e.repeat) {
          this._removeDirFromStack(dir);
          this._dirStack.push(dir);
          this._resetDas();
          // Initial move fires via callback immediately — GameCanvas will buffer if tweening
          this._callbacks.move?.(dir[0], dir[1]);
          this._dasTimer = performance.now();
        }
        return;
      }
      if (e.key === 'z' || e.key === 'Z' || e.key === 'e' || e.key === 'E') { e.preventDefault(); if (!e.repeat) this._callbacks.undo?.(); return; }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); if (!e.repeat) this._callbacks.restart?.(); return; }
      if (e.key === 'Escape') { e.preventDefault(); if (!e.repeat) this._callbacks.escape?.(); return; }
    };
    this._keyUpHandler = (e) => {
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      const wasPrimary = this.activeDir() && this._sameDir(this.activeDir(), dir);
      this._removeDirFromStack(dir);
      if (wasPrimary) this._resetDas();
    };
    document.addEventListener('keydown', this._keyHandler);
    document.addEventListener('keyup', this._keyUpHandler);
  }

  bindTouch(canvas) {
    this._touchCanvas = canvas;
    this._touchStartHandler = (e) => {
      if (!this._enabled) return;
      e.preventDefault();
      const t = e.touches[0];
      this._touchStart = { x: t.clientX, y: t.clientY };
    };
    this._touchEndHandler = (e) => {
      if (!this._enabled || !this._touchStart) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      const dx = t.clientX - this._touchStart.x;
      const dy = t.clientY - this._touchStart.y;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) >= SWIPE_THRESHOLD) {
        if (adx > ady) this._callbacks.move?.(dx > 0 ? 1 : -1, 0);
        else this._callbacks.move?.(0, dy > 0 ? 1 : -1);
      }
      this._touchStart = null;
    };
    canvas.addEventListener('touchstart', this._touchStartHandler, { passive: false });
    canvas.addEventListener('touchend', this._touchEndHandler, { passive: false });
  }

  destroy() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this._keyUpHandler) document.removeEventListener('keyup', this._keyUpHandler);
    if (this._touchCanvas && this._touchStartHandler) {
      this._touchCanvas.removeEventListener('touchstart', this._touchStartHandler);
      this._touchCanvas.removeEventListener('touchend', this._touchEndHandler);
    }
  }
}
