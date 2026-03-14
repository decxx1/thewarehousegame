// ===== GAME ENGINE =====
// Core game logic: level parsing, movement, undo, win detection

export class Engine {
  constructor() {
    this.state = null;
  }

  parseLevel(str) {
    const rows = str.split('\n');
    const h = rows.length;
    const w = Math.max(...rows.map(r => r.length));

    const grid = [];
    const targets = [];
    const boxes = [];
    let player = null;

    for (let y = 0; y < h; y++) {
      grid[y] = [];
      for (let x = 0; x < w; x++) {
        const ch = (rows[y] || '')[x] || ' ';
        switch (ch) {
          case '#': grid[y][x] = 1; break;
          case '.': grid[y][x] = 0; targets.push({ x, y }); break;
          case '@': grid[y][x] = 0; player = { x, y }; break;
          case '$': grid[y][x] = 0; boxes.push({ x, y }); break;
          case '*': grid[y][x] = 0; boxes.push({ x, y }); targets.push({ x, y }); break;
          case '+': grid[y][x] = 0; player = { x, y }; targets.push({ x, y }); break;
          default:  grid[y][x] = -1; break;
        }
      }
    }

    if (player) this._floodFillFloor(grid, w, h, player.x, player.y, boxes);

    return { grid, w, h, targets, boxes, player, moves: 0, pushes: 0, history: [] };
  }

  _floodFillFloor(grid, w, h, startX, startY, boxes) {
    const visited = new Set();
    const boxSet = new Set(boxes.map(b => b.y * w + b.x));
    const queue = [{ x: startX, y: startY }];
    visited.add(startY * w + startX);
    while (queue.length > 0) {
      const { x, y } = queue.shift();
      if (grid[y][x] === -1) grid[y][x] = 0;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const key = ny * w + nx;
        if (visited.has(key) || grid[ny][nx] === 1) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  loadLevel(levelStr) {
    this.state = this.parseLevel(levelStr);
    return this.state;
  }

  tryMove(dx, dy) {
    const s = this.state;
    if (!s) return false;
    const p = s.player;
    const nx = p.x + dx, ny = p.y + dy;
    if (ny < 0 || ny >= s.h || nx < 0 || nx >= s.w) return false;
    if (s.grid[ny][nx] === 1 || s.grid[ny][nx] === -1) return false;
    const boxIdx = s.boxes.findIndex(b => b.x === nx && b.y === ny);
    if (boxIdx >= 0) {
      const bx2 = nx + dx, by2 = ny + dy;
      if (by2 < 0 || by2 >= s.h || bx2 < 0 || bx2 >= s.w) return false;
      if (s.grid[by2][bx2] === 1 || s.grid[by2][bx2] === -1) return false;
      if (s.boxes.some(b => b.x === bx2 && b.y === by2)) return false;
      s.history.push({ px: p.x, py: p.y, bi: boxIdx, bx: nx, by: ny });
      s.boxes[boxIdx].x = bx2;
      s.boxes[boxIdx].y = by2;
      s.pushes++;
      p.x = nx; p.y = ny;
      s.moves++;
      return 'push';
    } else {
      s.history.push({ px: p.x, py: p.y });
    }
    p.x = nx; p.y = ny;
    s.moves++;
    return 'walk';
  }

  undo() {
    const s = this.state;
    if (!s || !s.history.length) return false;
    const h = s.history.pop();
    s.player.x = h.px; s.player.y = h.py;
    if (h.bi !== undefined) {
      s.boxes[h.bi].x = h.bx; s.boxes[h.bi].y = h.by;
      s.pushes--;
    }
    s.moves--;
    return true;
  }

  checkWin() {
    const s = this.state;
    if (!s) return false;
    return s.targets.every(t => s.boxes.some(b => b.x === t.x && b.y === t.y));
  }
}
