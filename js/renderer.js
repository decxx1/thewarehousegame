// ===== RENDERER =====
// Canvas rendering with sprite caching + animated top-down character + smooth movement

export class Renderer {
  constructor(canvas, tileSize = 32) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = tileSize;
    this.sprites = {};
    this.dirty = true;

    // Walk animation state
    this.anim = {
      frame: 0,           // 0..3 walk cycle frame
      tick: 0,            // ms accumulator for frame stepping
      frameDuration: 110, // ms per walk frame (slightly slower, more fluid)
      state: 'idle',      // 'idle' | 'walk' | 'push' | 'push_walk'
      dir: { dx: 0, dy: -1 },
    };

    // Smooth movement tween
    // player/box positions are interpolated pixel coords during a move
    this.tween = {
      active: false,
      duration: 160,       // ms to cross one tile (slower movement)
      elapsed: 0,
      // player
      pFromX: 0, pFromY: 0,
      pToX: 0, pToY: 0,
      // optional box being pushed (null if no push)
      box: null,           // { fromX, fromY, toX, toY }
      // callback fired when tween finishes
      onDone: null,
    };

    // Snapshot of boxes for rendering during tween
    // (engine state already moved boxes; we need the previous positions)
    this._renderBoxes = [];  // [{x, y, ok}] in grid coords, except tweening box
    this._renderTargets = new Set();
    this._renderGrid = null;
    this._renderW = 0;
    this._renderH = 0;

    this._initSprites();
    this._startLoop();
  }

  // ===== PUBLIC API =====

  markDirty() { this.dirty = true; }

  /**
   * Called by main after engine.tryMove succeeds.
   * Captures old/new positions and starts the tween.
   * @param {number} dx
   * @param {number} dy
   * @param {boolean} pushed - whether a box was pushed
   * @param {object} prevState - snapshot BEFORE the move { player, boxes }
   * @param {object} nextState - engine.state AFTER the move
   * @param {function} onDone - called when tween completes
   */
  startMoveTween(dx, dy, pushed, prevState, nextState, onDone) {
    const T = this.tileSize;
    const a = this.anim;
    a.dir = { dx, dy };
    a.state = pushed ? 'push_walk' : 'walk';
    a.tick = 0;

    const tw = this.tween;
    tw.active = true;
    tw.elapsed = 0;
    tw.pFromX = prevState.player.x * T;
    tw.pFromY = prevState.player.y * T;
    tw.pToX = nextState.player.x * T;
    tw.pToY = nextState.player.y * T;
    tw.onDone = onDone;

    if (pushed) {
      // Find which box moved: the one that was at player's destination
      const nx = prevState.player.x + dx;
      const ny = prevState.player.y + dy;
      tw.box = {
        fromX: nx * T,
        fromY: ny * T,
        toX: (nx + dx) * T,
        toY: (ny + dy) * T,
        gridToX: nx + dx,
        gridToY: ny + dy,
      };
    } else {
      tw.box = null;
    }

    // Build render snapshot: all boxes at DESTINATION positions, minus the tweening one
    this._buildRenderSnapshot(nextState);

    this.dirty = true;
  }

  /** Called after undo/restart — snap immediately to new state */
  snapToState(state) {
    const tw = this.tween;
    tw.active = false;
    this.anim.state = 'idle';
    this._buildRenderSnapshot(state);
    this.dirty = true;
  }

  notifyIdle(isPushing) {
    if (!this.tween.active) {
      this.anim.state = isPushing ? 'push' : 'idle';
      this.dirty = true;
    }
  }

  // ===== INTERNAL =====

  _buildRenderSnapshot(state) {
    const T = this.tileSize;
    this._renderGrid = state.grid;
    this._renderW = state.w;
    this._renderH = state.h;
    this._renderTargets = new Set(state.targets.map(t => t.y * state.w + t.x));
    // store boxes as grid coords; tween will override the moving one
    this._renderBoxes = state.boxes.map(b => ({
      x: b.x, y: b.y,
      px: b.x * T, py: b.y * T,
    }));
  }

  // ===== ANIMATION + TWEEN LOOP =====
  _startLoop() {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(now - last, 50); // cap to avoid jump after tab switch
      last = now;

      const tw = this.tween;
      const a = this.anim;

      if (tw.active) {
        tw.elapsed += dt;
        if (tw.elapsed >= tw.duration) {
          // Snap to end
          tw.active = false;
          if (tw.onDone) { tw.onDone(); tw.onDone = null; }
        }
        this.dirty = true;
      }

      // Walk cycle frames
      if (a.state === 'walk' || a.state === 'push_walk') {
        a.tick += dt;
        if (a.tick >= a.frameDuration) {
          a.tick -= a.frameDuration;
          a.frame = (a.frame + 1) % 4;
          this.dirty = true;
        }
      } else {
        if (a.frame !== 0) { a.frame = 0; this.dirty = true; }
      }

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ===== SPRITE INIT =====
  _createSprite(key, drawFn) {
    const s = this.tileSize;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    drawFn(c.getContext('2d'), s);
    this.sprites[key] = c;
  }

  _initSprites() {
    this._buildFloor();
    this._buildVoid();
    this._buildWall();
    this._buildTarget();
    this._buildBox();
    this._buildBoxOk();
  }

  // ===== TILE SPRITES =====

  _buildFloor() {
    this._createSprite('floor', (ctx, s) => {
      const dark = '#2a2018', base = '#3a2e1e';
      const plank1 = '#3d3122', plank2 = '#352b1c', grain = '#2e2518';
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, s, s);
      const ph = s / 2;
      ctx.fillStyle = plank1;
      ctx.fillRect(1, 1, s - 2, ph - 1.5);
      ctx.fillStyle = plank2;
      ctx.fillRect(1, ph + 0.5, s - 2, ph - 1.5);
      ctx.strokeStyle = dark; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, ph); ctx.lineTo(s, ph); ctx.stroke();
      ctx.strokeStyle = grain; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.6;
      for (const gx of [s * 0.25, s * 0.6]) {
        ctx.beginPath(); ctx.moveTo(gx, 2); ctx.lineTo(gx + 2, ph - 2); ctx.stroke();
      }
      for (const gx of [s * 0.4, s * 0.75]) {
        ctx.beginPath(); ctx.moveTo(gx, ph + 2); ctx.lineTo(gx - 2, s - 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = dark; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
    });
  }

  _buildVoid() {
    this._createSprite('void', (ctx, s) => {
      ctx.fillStyle = '#0d0d1a'; ctx.fillRect(0, 0, s, s);
    });
  }

  _buildWall() {
    this._createSprite('wall', (ctx, s) => {
      const mortar = '#1e1e2e', stoneA = '#4a4a6a', stoneB = '#525275';
      const stoneLight = '#6a6a8f', stoneDark = '#35354f';
      ctx.fillStyle = mortar; ctx.fillRect(0, 0, s, s);
      const bricks = [
        { x: 1, y: 1, w: s - 2, h: s / 2 - 1.5 },
        { x: 1, y: s / 2 + 0.5, w: s / 2 - 2, h: s / 2 - 1.5 },
        { x: s / 2, y: s / 2 + 0.5, w: s / 2 - 1, h: s / 2 - 1.5 },
      ];
      for (const [i, b] of bricks.entries()) {
        ctx.fillStyle = i % 2 === 0 ? stoneA : stoneB;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = stoneLight;
        ctx.fillRect(b.x, b.y, b.w, 1.5);
        ctx.fillRect(b.x, b.y, 1.5, b.h);
        ctx.fillStyle = stoneDark;
        ctx.fillRect(b.x, b.y + b.h - 1.5, b.w, 1.5);
        ctx.fillRect(b.x + b.w - 1.5, b.y, 1.5, b.h);
      }
    });
  }

  _buildTarget() {
    this._createSprite('target', (ctx, s) => {
      ctx.drawImage(this.sprites.floor, 0, 0);
      const c = s / 2, r = s * 0.28;
      ctx.save();
      ctx.shadowColor = '#e94560'; ctx.shadowBlur = 6;
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#e94560';
      ctx.beginPath();
      ctx.moveTo(c, c - r); ctx.lineTo(c + r, c); ctx.lineTo(c, c + r); ctx.lineTo(c - r, c);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.strokeStyle = '#e94560'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c, c - r); ctx.lineTo(c + r, c); ctx.lineTo(c, c + r); ctx.lineTo(c - r, c);
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = '#e94560'; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(c, c, 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    });
  }

  _buildBox() {
    this._createSprite('box', (ctx, s) => {
      const m = 2, bx = m, by = m, bw = s - m * 2, bh = s - m * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(bx + 2, by + 2, bw, bh);
      const grad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      grad.addColorStop(0, '#c8a050'); grad.addColorStop(0.4, '#d4b060');
      grad.addColorStop(0.7, '#c09040'); grad.addColorStop(1, '#a87830');
      ctx.fillStyle = grad; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#a87030'; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.5;
      for (const t of [0.25, 0.42, 0.58, 0.75]) {
        ctx.beginPath(); ctx.moveTo(bx + bw * t, by + 1); ctx.lineTo(bx + bw * t + 2, by + bh - 1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#8a6020'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx + 3, by + bh / 2); ctx.lineTo(bx + bw - 3, by + bh / 2); ctx.stroke();
      const brace = 5;
      const corners = [[bx, by], [bx + bw - brace, by], [bx, by + bh - brace], [bx + bw - brace, by + bh - brace]];
      for (const [cx, cy] of corners) {
        ctx.fillStyle = '#888'; ctx.fillRect(cx, cy, brace, brace);
        ctx.fillStyle = '#aaa'; ctx.fillRect(cx + 0.5, cy + 0.5, brace - 2, 1); ctx.fillRect(cx + 0.5, cy + 0.5, 1, brace - 2);
        ctx.fillStyle = '#555'; ctx.fillRect(cx + brace / 2 - 0.5, cy + brace / 2 - 0.5, 1.5, 1.5);
      }
      ctx.strokeStyle = '#7a5820'; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      ctx.strokeStyle = '#e8c070'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx + 1, by + bh - 1); ctx.lineTo(bx + 1, by + 1); ctx.lineTo(bx + bw - 1, by + 1); ctx.stroke();
    });
  }

  _buildBoxOk() {
    this._createSprite('box_ok', (ctx, s) => {
      const m = 2, bx = m, by = m, bw = s - m * 2, bh = s - m * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(bx + 2, by + 2, bw, bh);
      const grad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      grad.addColorStop(0, '#3aaa3a'); grad.addColorStop(0.5, '#2d8a2d'); grad.addColorStop(1, '#1e6020');
      ctx.fillStyle = grad; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#1a5018'; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.5;
      for (const t of [0.28, 0.5, 0.72]) {
        ctx.beginPath(); ctx.moveTo(bx + bw * t, by + 1); ctx.lineTo(bx + bw * t + 1, by + bh - 1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#1a5018'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx + 3, by + bh / 2); ctx.lineTo(bx + bw - 3, by + bh / 2); ctx.stroke();
      const brace = 5;
      const corners = [[bx, by], [bx + bw - brace, by], [bx, by + bh - brace], [bx + bw - brace, by + bh - brace]];
      for (const [cx, cy] of corners) {
        ctx.fillStyle = '#c0a030'; ctx.fillRect(cx, cy, brace, brace);
        ctx.fillStyle = '#e0c040'; ctx.fillRect(cx + 0.5, cy + 0.5, brace - 2, 1);
        ctx.fillStyle = '#a08020'; ctx.fillRect(cx + brace / 2 - 0.5, cy + brace / 2 - 0.5, 1.5, 1.5);
      }
      ctx.strokeStyle = '#1a5018'; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      ctx.strokeStyle = '#60cc60'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx + 1, by + bh - 1); ctx.lineTo(bx + 1, by + 1); ctx.lineTo(bx + bw - 1, by + 1); ctx.stroke();
    });
  }

  // ===== PLAYER DRAWING =====

  _drawPlayer(ctx, pixelX, pixelY) {
    const s = this.tileSize;
    const a = this.anim;
    const isMoving = a.state === 'walk' || a.state === 'push_walk';
    const bob = isMoving ? [0, -1, 0, 1][a.frame] : 0;
    const isPushing = a.state === 'push' || a.state === 'push_walk';

    ctx.save();
    ctx.translate(pixelX + s / 2, pixelY + s / 2 + bob);
    const angle = Math.atan2(a.dir.dy, a.dir.dx) + Math.PI / 2;
    ctx.rotate(angle);
    this._drawPlayerBody(ctx, a.frame, isPushing, isMoving);
    ctx.restore();
  }

  _drawPlayerBody(ctx, frame, isPushing, isMoving) {
    const skin = '#f0c880';
    const shirt = '#2255cc';
    const shirtDark = '#1a3a99';
    const hatColor = '#f2b01e';
    const beltColor = '#2a2a2a';
    const buckleColor = '#e0e0e0';

    // 1. Shadow underneath
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Torso
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(-7, -1);
    ctx.lineTo(7, -1);
    ctx.lineTo(5.5, 9);
    ctx.lineTo(-5.5, 9);
    ctx.closePath();
    ctx.fill();

    // Torso shading
    const grad = ctx.createLinearGradient(-7, 0, 7, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.15)');
    grad.addColorStop(0.5, 'transparent');
    grad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = grad;
    ctx.fill();

    // 3. Details: Belt & Pocket
    ctx.fillStyle = beltColor;
    ctx.fillRect(-6, 6, 12, 2.5);
    ctx.fillStyle = buckleColor;
    ctx.fillRect(-1.2, 6, 2.4, 2.5);

    // Small pocket on right side
    ctx.fillStyle = shirtDark;
    ctx.fillRect(2, 1, 3, 3);

    // 4. Arms
    this._drawArms(ctx, frame, isPushing, isMoving, skin, shirt);

    // 5. Head & Hat
    // Neck area
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, -1, 3.5, 0, Math.PI * 2); ctx.fill();

    const headY = -3.5;
    // Hard hat rim
    ctx.fillStyle = '#b08010';
    ctx.beginPath(); ctx.ellipse(0, headY, 7.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    // Hard hat top
    ctx.fillStyle = hatColor;
    ctx.beginPath(); ctx.ellipse(0, headY - 1, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Hat highlight
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(-2, headY - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Hat ridge
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, headY - 6.5); ctx.lineTo(0, headY + 5); ctx.stroke();
  }

  _drawArms(ctx, frame, isPushing, isMoving, skin, shirt) {
    const glove = skin; // "guantes color piel (crema claro)"
    const shoulderX = 6.4;
    const shoulderY = 1.0;

    // Swing logic
    const swingAmt = isMoving ? 5 : 0;
    const leftSwing = [0, -swingAmt, 0, swingAmt][frame];
    const rightSwing = [0, swingAmt, 0, -swingAmt][frame];

    // Left Arm
    this._drawOneArm(ctx, -shoulderX, shoulderY, leftSwing, shirt, glove, isPushing, isMoving);
    // Right Arm
    this._drawOneArm(ctx, shoulderX, shoulderY, rightSwing, shirt, glove, isPushing, isMoving);
  }

  _drawOneArm(ctx, x, y, swing, shirt, glove, isPushing, isMoving) {
    ctx.save();
    
    if (isPushing) {
      // Extended forward (reaching out) - Hands visible
      ctx.translate(x, y);
      ctx.fillStyle = shirt;
      this._drawRoundRect(ctx, -2.5, -11, 5, 12, 2.5); ctx.fill();
      ctx.fillStyle = glove;
      ctx.beginPath(); ctx.arc(0, -11, 3.2, 0, Math.PI * 2); ctx.fill();
    } else {
      // Only shoulders (No hands / no arms)
      // When moving, the shoulder shifts slightly back and forth (cotoneo)
      const shoulderSwing = isMoving ? swing * 0.4 : 0;
      ctx.translate(x, y + shoulderSwing);
      
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.arc(0, 0, 3.8, 0, Math.PI * 2); ctx.fill();
      // Optional: slight highlight on shoulder
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.arc(-1, -1, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ===== RESIZE =====
  resizeForLevel(w, h) {
    const T = this.tileSize;
    this.canvas.width = w * T;
    this.canvas.height = h * T;
    const maxW = Math.min(window.innerWidth - 16, w * T * 2);
    const maxH = Math.min(window.innerHeight - 100, h * T * 2);
    const scale = Math.min(maxW / (w * T), maxH / (h * T));
    this.canvas.style.width = ((w * T * scale) | 0) + 'px';
    this.canvas.style.height = ((h * T * scale) | 0) + 'px';
    this.dirty = true;
  }

  // ===== RENDER =====
  render(state) {
    if (!this.dirty) return;
    this.dirty = false;

    // Use cached snapshot when tweening; fall back to live state
    const grid = this._renderGrid || (state && state.grid);
    const w = this._renderW || (state && state.w);
    const h = this._renderH || (state && state.h);
    const targets = this._renderTargets || new Set();
    const boxes = this._renderBoxes || (state ? state.boxes.map(b => ({ x: b.x, y: b.y, px: b.x * this.tileSize, py: b.y * this.tileSize })) : []);

    if (!grid || !state) return;

    const T = this.tileSize;
    const ctx = this.ctx;
    const tw = this.tween;

    // Eased interpolation t value
    let t = 1;
    if (tw.active) {
      t = tw.elapsed / tw.duration;
      t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out quad
    }

    // Interpolated player pixel position
    const playerPX = tw.active ? tw.pFromX + (tw.pToX - tw.pFromX) * t : state.player.x * T;
    const playerPY = tw.active ? tw.pFromY + (tw.pToY - tw.pFromY) * t : state.player.y * T;

    // Tweening box pixel position (if any)
    let tweenBoxPX = null, tweenBoxPY = null, tweenBoxGridX = -1, tweenBoxGridY = -1;
    if (tw.active && tw.box) {
      tweenBoxPX = tw.box.fromX + (tw.box.toX - tw.box.fromX) * t;
      tweenBoxPY = tw.box.fromY + (tw.box.toY - tw.box.fromY) * t;
      tweenBoxGridX = tw.box.gridToX;
      tweenBoxGridY = tw.box.gridToY;
    }

    // Draw tiles
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = grid[y][x];
        const px = x * T, py = y * T;
        const key = y * w + x;

        if (cell === -1) {
          ctx.drawImage(this.sprites.void, px, py);
        } else if (cell === 1) {
          ctx.drawImage(this.sprites.wall, px, py);
        } else {
          ctx.drawImage(targets.has(key) ? this.sprites.target : this.sprites.floor, px, py);
        }
      }
    }

    // Draw static boxes (skip the one being tweened, identified by destination grid pos)
    for (const b of boxes) {
      if (tw.active && tw.box && b.x === tweenBoxGridX && b.y === tweenBoxGridY) continue;
      const key = b.y * w + b.x;
      ctx.drawImage(targets.has(key) ? this.sprites.box_ok : this.sprites.box, b.px, b.py);
    }

    // Draw tweening box at interpolated position
    if (tw.active && tw.box && tweenBoxPX !== null) {
      const destKey = tweenBoxGridY * w + tweenBoxGridX;
      ctx.drawImage(targets.has(destKey) ? this.sprites.box_ok : this.sprites.box, tweenBoxPX, tweenBoxPY);
    }

    // Draw player at interpolated position
    this._drawPlayer(ctx, playerPX, playerPY);
  }
}
