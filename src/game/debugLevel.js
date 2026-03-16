// Debug level: huge map with long corridors and turns for mobility testing
// 50x50 grid — the largest practical size for testing movement

function generateDebugLevel() {
  const W = 50;
  const H = 50;
  // Initialize all as walls
  const grid = [];
  for (let y = 0; y < H; y++) {
    grid[y] = [];
    for (let x = 0; x < W; x++) {
      grid[y][x] = '#';
    }
  }

  // Carve floor helper
  const carve = (x, y) => {
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = ' ';
  };

  // Carve horizontal corridor
  const hCorridor = (x1, x2, y, width = 1) => {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    for (let x = minX; x <= maxX; x++) {
      for (let w = 0; w < width; w++) {
        carve(x, y + w);
      }
    }
  };

  // Carve vertical corridor
  const vCorridor = (y1, y2, x, width = 1) => {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) {
      for (let w = 0; w < width; w++) {
        carve(x + w, y);
      }
    }
  };

  // Carve a room (open area)
  const room = (rx, ry, rw, rh) => {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        carve(x, y);
      }
    }
  };

  // === LAYOUT ===

  // Outer perimeter corridor (ring around the map)
  hCorridor(1, 48, 1, 2);   // top
  hCorridor(1, 48, 47, 2);  // bottom
  vCorridor(1, 48, 1, 2);   // left
  vCorridor(1, 48, 47, 2);  // right

  // Long horizontal corridors at various heights
  hCorridor(1, 48, 8, 2);
  hCorridor(1, 48, 15, 2);
  hCorridor(1, 48, 22, 2);
  hCorridor(1, 48, 29, 2);
  hCorridor(1, 48, 36, 2);
  hCorridor(1, 48, 43, 2);

  // Long vertical corridors at various positions
  vCorridor(1, 48, 8, 2);
  vCorridor(1, 48, 15, 2);
  vCorridor(1, 48, 22, 2);
  vCorridor(1, 48, 29, 2);
  vCorridor(1, 48, 36, 2);
  vCorridor(1, 48, 43, 2);

  // Diagonal-ish zigzag corridors (staircase pattern)
  // Zigzag from top-left to bottom-right
  for (let i = 0; i < 12; i++) {
    const baseX = 4 + i * 3;
    const baseY = 4 + i * 3;
    if (baseX < 48 && baseY < 48) {
      hCorridor(baseX, Math.min(baseX + 3, 48), baseY);
      vCorridor(baseY, Math.min(baseY + 3, 48), Math.min(baseX + 3, 48));
    }
  }

  // Zigzag from top-right to bottom-left
  for (let i = 0; i < 12; i++) {
    const baseX = 45 - i * 3;
    const baseY = 4 + i * 3;
    if (baseX > 0 && baseY < 48) {
      hCorridor(Math.max(baseX - 3, 1), baseX, baseY);
      vCorridor(baseY, Math.min(baseY + 3, 48), Math.max(baseX - 3, 1));
    }
  }

  // Open rooms at intersections for turning space
  room(4, 4, 4, 4);
  room(20, 4, 4, 4);
  room(42, 4, 4, 4);
  room(4, 20, 4, 4);
  room(23, 21, 5, 5);  // center room
  room(42, 20, 4, 4);
  room(4, 42, 4, 4);
  room(20, 42, 4, 4);
  room(42, 42, 4, 4);

  // Spiral in center area
  hCorridor(18, 32, 18);
  vCorridor(18, 28, 32);
  hCorridor(20, 32, 28);
  vCorridor(18, 28, 20);

  // L-shaped corridors
  hCorridor(5, 14, 12);
  vCorridor(12, 20, 14);

  hCorridor(35, 46, 12);
  vCorridor(12, 20, 35);

  hCorridor(5, 14, 38);
  vCorridor(30, 38, 14);

  hCorridor(35, 46, 38);
  vCorridor(30, 38, 35);

  // Extra cross corridors for more connectivity
  vCorridor(3, 46, 25);
  hCorridor(3, 46, 25);

  // T-junctions
  hCorridor(10, 20, 33);
  hCorridor(30, 40, 33);
  vCorridor(33, 40, 10);
  vCorridor(33, 40, 40);

  // Player start position (center of center room)
  grid[24][25] = '@';

  // One box and one target tucked away (required by engine)
  grid[2][3] = '$';
  grid[2][4] = '.';

  // Convert to string
  const lines = grid.map(row => row.join(''));
  return lines.join('\n');
}

export const DEBUG_LEVEL = generateDebugLevel();
