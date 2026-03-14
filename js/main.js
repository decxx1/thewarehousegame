// ===== MAIN - Game Controller =====
// Orchestrates engine, renderer, input, UI, and password system

import { STAGES, TOTAL_LEVELS } from './levels.js';
import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';

// ===== CONSTANTS =====
const TILE_SIZE = 32;
const STORAGE_KEY_DONE = 'twg_completed';
const STORAGE_KEY_UNLOCKED = 'twg_unlocked';
const WIN_DELAY = 1200;

// ===== GAME CONTROLLER =====
class Game {
  constructor() {
    this.engine = new Engine();
    this.renderer = new Renderer(document.getElementById('c'), TILE_SIZE);
    this.input = new Input();

    // State
    this.currentStage = 0;
    this.currentRoom = 0; // room index within stage
    this.completed = new Set();
    this.unlockedStages = new Set([0]); // stage 0 always unlocked
    this.inGame = false;
    this.winPending = false;
    this._tweening = false;
    this._inputBuffer = null;

    // DOM refs
    this.dom = {
      menu: document.getElementById('menu'),
      hud: document.getElementById('hud'),
      hlvl: document.getElementById('hlvl'),
      hmov: document.getElementById('hmov'),
      hpush: document.getElementById('hpush'),
      hstage: document.getElementById('hstage'),
      toast: document.getElementById('toast'),
      stageList: document.getElementById('stageList'),
      roomList: document.getElementById('roomList'),
      passwordModal: document.getElementById('passwordModal'),
      passwordInput: document.getElementById('passwordInput'),
      passwordError: document.getElementById('passwordError'),
      hpass: document.getElementById('hpass'),
      controls: document.getElementById('controls')
    };

    this._loadProgress();
    this._setupInput();
    this._setupMenuEvents();
    this._buildStageButtons();
    this._gameLoop();
  }

  // ===== PROGRESS PERSISTENCE =====
  _loadProgress() {
    try {
      const done = localStorage.getItem(STORAGE_KEY_DONE);
      if (done) this.completed = new Set(JSON.parse(done));
      const unlocked = localStorage.getItem(STORAGE_KEY_UNLOCKED);
      if (unlocked) this.unlockedStages = new Set(JSON.parse(unlocked));
      this.unlockedStages.add(0); // always ensure stage 0
    } catch (e) { /* ignore */ }
  }

  _saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY_DONE, JSON.stringify([...this.completed]));
      localStorage.setItem(STORAGE_KEY_UNLOCKED, JSON.stringify([...this.unlockedStages]));
    } catch (e) { /* ignore */ }
  }

  // ===== LEVEL MANAGEMENT =====

  /** Get the global level index (0-159) from stage + room */
  _globalIndex(stage, room) {
    let idx = 0;
    for (let s = 0; s < stage; s++) idx += STAGES[s].levels.length;
    return idx + room;
  }

  /** Get the level string for current stage/room */
  _currentLevelStr() {
    return STAGES[this.currentStage].levels[this.currentRoom];
  }

  /** Load and start a specific room */
  loadRoom(stage, room) {
    this.currentStage = stage;
    this.currentRoom = room;
    this.winPending = false;
    this._tweening = false;

    const levelStr = this._currentLevelStr();
    const state = this.engine.loadLevel(levelStr);
    this.renderer.resizeForLevel(state.w, state.h);
    this.renderer.snapToState(state);

    // Update HUD
    const globalIdx = this._globalIndex(stage, room);
    this.dom.hstage.textContent = STAGES[stage].name;
    this.dom.hpass.textContent = STAGES[stage].password ? `Password: ${STAGES[stage].password}` : '';
    this.dom.hlvl.textContent = `Room ${globalIdx + 1}`;
    this.dom.hmov.textContent = '0';
    this.dom.hpush.textContent = '0';

    this.inGame = true;
    this.input.setEnabled(true);
  }

  /** Restart current room */
  restartRoom() {
    this.loadRoom(this.currentStage, this.currentRoom);
  }

  /** Advance to next room, or next stage, or show completion */
  _advanceRoom() {
    const stage = STAGES[this.currentStage];
    if (this.currentRoom < stage.levels.length - 1) {
      // Next room in same stage
      this.loadRoom(this.currentStage, this.currentRoom + 1);
    } else if (this.currentStage < STAGES.length - 1) {
      // Unlock and move to next stage
      this.unlockedStages.add(this.currentStage + 1);
      this._saveProgress();
      this.loadRoom(this.currentStage + 1, 0);
    } else {
      // All levels complete!
      this._showToast('ALL 160 ROOMS COMPLETE!');
      setTimeout(() => this.showMenu(), 2000);
    }
  }

  // ===== INPUT SETUP =====
  _setupInput() {
    this.input.on('move', (dx, dy) => {
      if (!this.inGame || this.winPending) return;

      // If already tweening, buffer this move and ignore subsequent calls
      if (this._tweening) {
        this._inputBuffer = { dx, dy };
        return;
      }

      this._executeMove(dx, dy);
    });

    this.input.on('undo', () => {
      if (!this.inGame || this.winPending) return;
      this._tweening = false;
      this._inputBuffer = null;
      if (this.engine.undo()) {
        const s = this.engine.state;
        this.renderer.snapToState(s);
        this.dom.hmov.textContent = s.moves;
        this.dom.hpush.textContent = s.pushes;
      }
    });

    this.input.on('restart', () => {
      if (!this.inGame || this.winPending) return;
      this._inputBuffer = null;
      this.restartRoom();
    });

    this.input.on('escape', () => {
      // passwordModal has its own Escape handler on the input element;
      // this branch is only reached when the modal is closed (input is disabled while modal is open)
      this.showMenu();
    });

    this.input.bindKeyboard();
    this.input.bindTouch(document.getElementById('c'));
  }

  _executeMove(dx, dy) {
    if (this._tweening) return; // guard: never start a new move while animating

    // Capture state BEFORE engine mutates it
    const prev = {
      player: { x: this.engine.state.player.x, y: this.engine.state.player.y },
      boxes: this.engine.state.boxes.map(b => ({ x: b.x, y: b.y })),
    };

    const moved = this.engine.tryMove(dx, dy);
    if (!moved) {
      // Move failed (wall / blocked) — clear buffer so we don't re-attempt endlessly
      this._inputBuffer = null;
      return;
    }

    const s = this.engine.state;
    this.dom.hmov.textContent = s.moves;
    this.dom.hpush.textContent = s.pushes;

    this._tweening = true;
    this.renderer.startMoveTween(dx, dy, moved === 'push', prev, s, () => {
      this._tweening = false; // ← always first

      // Check win
      if (this.engine.checkWin()) {
        this._inputBuffer = null;
        this.winPending = true;
        const globalIdx = this._globalIndex(this.currentStage, this.currentRoom);
        this.completed.add(globalIdx);
        this._saveProgress();
        this._showToast('ROOM COMPLETE!');
        setTimeout(() => this._advanceRoom(), WIN_DELAY);
        return;
      }

      // Settle into idle (buffer will be flushed by _gameLoop on the next frame)
      const a = this.renderer.anim;
      const nx = s.player.x + a.dir.dx;
      const ny = s.player.y + a.dir.dy;
      this.renderer.notifyIdle(s.boxes.some(b => b.x === nx && b.y === ny));
    });
  }

  // ===== GAME LOOP =====
  _gameLoop() {
    // Flush buffered input as soon as tween finishes (polled every frame — rock solid)
    if (!this._tweening && this._inputBuffer && this.inGame && !this.winPending) {
      const next = this._inputBuffer;
      this._inputBuffer = null;
      this._executeMove(next.dx, next.dy);
    }

    this.renderer.render(this.engine.state);
    requestAnimationFrame(() => this._gameLoop());
  }

  // ===== MENU & UI =====
  showMenu() {
    this.inGame = false;
    this.input.setEnabled(true); // keep escape working
    this.dom.menu.style.display = 'flex';
    this.dom.roomList.style.display = 'none';
    this._buildStageButtons();
  }

  hideMenu() {
    this.dom.menu.style.display = 'none';
  }

  _setupMenuEvents() {
    document.getElementById('btnPlay').addEventListener('click', () => {
      this.loadRoom(this.currentStage, this.currentRoom);
      this.hideMenu();
    });

    document.getElementById('btnSelect').addEventListener('click', () => {
      const sl = this.dom.stageList;
      sl.style.display = sl.style.display === 'none' ? 'flex' : 'none';
      this.dom.roomList.style.display = 'none';
    });

    // Password modal
    document.getElementById('passwordCancel').addEventListener('click', () => {
      this._closePasswordModal();
    });

    document.getElementById('passwordSubmit').addEventListener('click', () => {
      this._submitPassword();
    });

    this.dom.passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._submitPassword();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this._closePasswordModal();
      }
    });
  }

  _buildStageButtons() {
    const container = this.dom.stageList;
    container.innerHTML = '';
    for (let i = 0; i < STAGES.length; i++) {
      const stage = STAGES[i];
      const btn = document.createElement('button');
      btn.className = 'btn stage-btn';

      // Check if all rooms in this stage are completed
      const allDone = this._isStageComplete(i);
      if (allDone) btn.classList.add('done');

      const isUnlocked = this.unlockedStages.has(i);
      if (!isUnlocked) btn.classList.add('locked');

      btn.innerHTML = `<span class="stage-num">${i + 1}</span><span class="stage-name">${stage.name}</span>`;
      if (!isUnlocked) {
        btn.innerHTML += '<span class="lock-icon">&#128274;</span>';
      }

      btn.addEventListener('click', () => {
        if (isUnlocked) {
          this._showRoomButtons(i);
        } else {
          this._openPasswordModal(i);
        }
      });

      container.appendChild(btn);
    }
  }

  _isStageComplete(stageIdx) {
    const stage = STAGES[stageIdx];
    for (let r = 0; r < stage.levels.length; r++) {
      if (!this.completed.has(this._globalIndex(stageIdx, r))) return false;
    }
    return true;
  }

  _showRoomButtons(stageIdx) {
    const container = this.dom.roomList;
    container.innerHTML = '';
    container.style.display = 'flex';

    const stage = STAGES[stageIdx];
    const label = document.createElement('div');
    label.className = 'room-label';
    label.textContent = stage.name;
    container.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'room-grid';

    for (let r = 0; r < stage.levels.length; r++) {
      const globalIdx = this._globalIndex(stageIdx, r);
      const btn = document.createElement('button');
      btn.className = 'btn room-btn';
      if (this.completed.has(globalIdx)) btn.classList.add('done');
      btn.textContent = globalIdx + 1;
      btn.addEventListener('click', () => {
        this.loadRoom(stageIdx, r);
        this.hideMenu();
      });
      grid.appendChild(btn);
    }

    container.appendChild(grid);
  }

  // ===== PASSWORD SYSTEM =====
  _pendingPasswordStage = -1;

  _openPasswordModal(stageIdx) {
    this._pendingPasswordStage = stageIdx;
    this.dom.passwordInput.value = '';
    this.dom.passwordError.textContent = '';
    this.dom.passwordModal.style.display = 'flex';
    // Disable game input entirely so WASD/arrows/etc don't interfere with typing
    this.input.setEnabled(false);
    this.dom.passwordInput.focus();
  }

  _closePasswordModal() {
    this.dom.passwordModal.style.display = 'none';
    this._pendingPasswordStage = -1;
    // Re-enable game input
    this.input.setEnabled(true);
  }

  _submitPassword() {
    const stageIdx = this._pendingPasswordStage;
    if (stageIdx < 0 || stageIdx >= STAGES.length) return;

    const stage = STAGES[stageIdx];
    const input = this.dom.passwordInput.value.trim();

    if (input.toUpperCase() === (stage.password || '').toUpperCase()) {
      this.unlockedStages.add(stageIdx);
      this._saveProgress();
      this._closePasswordModal();
      this._buildStageButtons();
      this._showRoomButtons(stageIdx);
      this._showToast(`${stage.name} UNLOCKED!`);
    } else {
      this.dom.passwordError.textContent = 'Wrong password!';
      this.dom.passwordInput.value = '';
      this.dom.passwordInput.focus();
    }
  }

  // ===== TOAST =====
  _showToast(msg) {
    const t = this.dom.toast;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1500);
  }
}

// ===== INIT =====
const game = new Game();
