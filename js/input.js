// ===== INPUT HANDLER =====
// Keyboard and touch input management

const KEY_MAP = {
  'ArrowUp': [0, -1], 'ArrowDown': [0, 1], 'ArrowLeft': [-1, 0], 'ArrowRight': [1, 0],
  'w': [0, -1], 's': [0, 1], 'a': [-1, 0], 'd': [1, 0],
  'W': [0, -1], 'S': [0, 1], 'A': [-1, 0], 'D': [1, 0]
};

const SWIPE_THRESHOLD = 20;

export class Input {
  constructor() {
    this._callbacks = {
      move: null,
      undo: null,
      restart: null,
      escape: null
    };
    this._touchStart = null;
    this._enabled = true;
  }

  /** Register callback functions */
  on(event, callback) {
    this._callbacks[event] = callback;
  }

  /** Enable/disable input processing */
  setEnabled(enabled) {
    this._enabled = enabled;
  }

  /** Bind keyboard events to document */
  bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!this._enabled) return;

      const dir = KEY_MAP[e.key];
      if (dir) {
        e.preventDefault();
        this._callbacks.move?.(dir[0], dir[1]);
        return;
      }

      if (e.key === 'z' || e.key === 'Z' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        this._callbacks.undo?.();
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        this._callbacks.restart?.();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        this._callbacks.escape?.();
        return;
      }
    });
  }

  /** Bind touch/swipe events to a canvas element */
  bindTouch(canvas) {
    canvas.addEventListener('touchstart', (e) => {
      if (!this._enabled) return;
      e.preventDefault();
      const t = e.touches[0];
      this._touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      if (!this._enabled) return;
      e.preventDefault();
      if (!this._touchStart) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - this._touchStart.x;
      const dy = t.clientY - this._touchStart.y;
      const adx = Math.abs(dx), ady = Math.abs(dy);

      if (Math.max(adx, ady) >= SWIPE_THRESHOLD) {
        if (adx > ady) {
          this._callbacks.move?.(dx > 0 ? 1 : -1, 0);
        } else {
          this._callbacks.move?.(0, dy > 0 ? 1 : -1);
        }
      }

      this._touchStart = null;
    }, { passive: false });
  }
}
