// ===== RENDERER =====
// Canvas rendering with sprite caching + animated character + smooth movement

export class Renderer {
  constructor(canvas, tileSize = 32) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = tileSize;
    this.sprites = {};
    this.dirty = true;
    this._loopRafId = null;

    this.anim = {
      frame: 0, tick: 0, frameDuration: 110,
      state: 'idle', dir: { dx: 0, dy: -1 },
    };

    this.tween = {
      active: false, duration: 160, elapsed: 0,
      pFromX: 0, pFromY: 0, pToX: 0, pToY: 0,
      box: null, onDone: null,
    };

    this._renderBoxes = [];
    this._renderTargets = new Set();
    this._renderGrid = null;
    this._renderW = 0;
    this._renderH = 0;

    this._initSprites();
    this._startLoop();
  }

  // ===== PUBLIC API =====
  markDirty() { this.dirty = true; }

  stop() {
    if (this._loopRafId) cancelAnimationFrame(this._loopRafId);
    this._loopRafId = null;
  }

  startMoveTween(dx, dy, pushed, prevState, nextState, onDone) {
    const T = this.tileSize;
    const a = this.anim;
    a.dir = { dx, dy };
    a.state = pushed ? 'push_walk' : 'walk';
    a.tick = 0;
    const tw = this.tween;
    tw.active = true; tw.elapsed = 0;
    tw.pFromX = prevState.player.x * T; tw.pFromY = prevState.player.y * T;
    tw.pToX = nextState.player.x * T;   tw.pToY = nextState.player.y * T;
    tw.onDone = onDone;
    if (pushed) {
      const nx = prevState.player.x + dx, ny = prevState.player.y + dy;
      tw.box = { fromX: nx * T, fromY: ny * T, toX: (nx+dx)*T, toY: (ny+dy)*T, gridToX: nx+dx, gridToY: ny+dy };
    } else {
      tw.box = null;
    }
    this._buildRenderSnapshot(nextState);
    this.dirty = true;
  }

  snapToState(state) {
    this.tween.active = false;
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

  resizeForLevel(w, h) {
    const T = this.tileSize;
    this.canvas.width = w * T;
    this.canvas.height = h * T;
    const maxW = Math.min(window.innerWidth - 16, w * T * 2);
    const maxH = Math.min(window.innerHeight - 100, h * T * 2);
    const scale = Math.min(maxW / (w * T), maxH / (h * T));
    this.canvas.style.width  = ((w * T * scale) | 0) + 'px';
    this.canvas.style.height = ((h * T * scale) | 0) + 'px';
    this.dirty = true;
  }

  // ===== INTERNAL =====
  _buildRenderSnapshot(state) {
    const T = this.tileSize;
    this._renderGrid = state.grid;
    this._renderW = state.w;
    this._renderH = state.h;
    this._renderTargets = new Set(state.targets.map(t => t.y * state.w + t.x));
    this._renderBoxes = state.boxes.map(b => ({ x: b.x, y: b.y, px: b.x * T, py: b.y * T }));
  }

  _startLoop() {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(now - last, 50);
      last = now;
      const tw = this.tween, a = this.anim;
      if (tw.active) {
        tw.elapsed += dt;
        if (tw.elapsed >= tw.duration) {
          tw.active = false;
          if (tw.onDone) { const done = tw.onDone; tw.onDone = null; done(); }
        }
        this.dirty = true;
      }
      if (a.state === 'walk' || a.state === 'push_walk') {
        a.tick += dt;
        if (a.tick >= a.frameDuration) { a.tick -= a.frameDuration; a.frame = (a.frame + 1) % 4; this.dirty = true; }
      } else {
        if (a.frame !== 0) { a.frame = 0; this.dirty = true; }
      }
      this._loopRafId = requestAnimationFrame(tick);
    };
    this._loopRafId = requestAnimationFrame(tick);
  }

  // ===== SPRITES =====
  _createSprite(key, drawFn) {
    const s = this.tileSize;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    drawFn(c.getContext('2d'), s);
    this.sprites[key] = c;
  }

  // Stage themes: each defines wall and floor color palettes + floor style
  // Rule: wall and floor must contrast clearly. Dark depot aesthetic.
  static STAGE_THEMES = [
    {
      // Stage 0 — Red brick walls / dark mossy concrete floor
      wall:  { mortar:'#1a0808', brickA:'#7a2010', brickB:'#8e2a18', brickLight:'#b83820', brickDark:'#3a0e08' },
      floor: { style:'tile', tileA:'#2a3820', tileB:'#222e18', grout:'#141e0c', grain:'#303e24' },
    },
    {
      // Stage 1 — Dark blue-grey stone / warm dark wood planks (original)
      wall:  { mortar:'#1e1e2e', brickA:'#4a4a6a', brickB:'#525275', brickLight:'#6a6a8f', brickDark:'#35354f' },
      floor: { style:'plank', base:'#3a2e1e', plankA:'#3d3122', plankB:'#352b1c', grout:'#2a2018', grain:'#2e2518' },
    },
    {
      // Stage 2 — Rust/brown brick / dark teal concrete floor
      wall:  { mortar:'#1e1008', brickA:'#7a3a10', brickB:'#6a3008', brickLight:'#a85020', brickDark:'#2e1404' },
      floor: { style:'tile', tileA:'#0e2a2a', tileB:'#0a2020', grout:'#061414', grain:'#123030' },
    },
    {
      // Stage 3 — Dark steel panels / bright-ish yellow ochre floor (strong contrast)
      wall:  { mortar:'#080c10', brickA:'#1a2028', brickB:'#141820', brickLight:'#303844', brickDark:'#080a0e' },
      floor: { style:'tile', tileA:'#6a5010', tileB:'#5a4208', grout:'#3a2c04', grain:'#7a6018' },
    },
    {
      // Stage 4 — Deep purple stone / dark amber floor (clear contrast)
      wall:  { mortar:'#100818', brickA:'#3a1a58', brickB:'#2e1448', brickLight:'#6a2a90', brickDark:'#1a0830' },
      floor: { style:'tile', tileA:'#3a2808', tileB:'#2e2004', grout:'#1c1402', grain:'#483010' },
    },
    {
      // Stage 5 — Dark teal/green concrete / dark orange brick floor
      wall:  { mortar:'#081410', brickA:'#0e3028', brickB:'#0a2820', brickLight:'#1a5040', brickDark:'#061008' },
      floor: { style:'tile', tileA:'#502808', tileB:'#3c1e04', grout:'#281202', grain:'#5e3010' },
    },
    {
      // Stage 6 — Charcoal brick / dark navy floor
      wall:  { mortar:'#0a0a0a', brickA:'#2e2e2e', brickB:'#262626', brickLight:'#484848', brickDark:'#141414' },
      floor: { style:'tile', tileA:'#0a1428', tileB:'#080e1e', grout:'#04080e', grain:'#101828' },
    },
    {
      // Stage 7 — Dark olive/army green walls / dark red floor
      wall:  { mortar:'#0c1008', brickA:'#283010', brickB:'#1e2808', brickLight:'#404e18', brickDark:'#0e1406' },
      floor: { style:'tile', tileA:'#3e0c08', tileB:'#300804', grout:'#1e0402', grain:'#4a1008' },
    },
    {
      // Stage 8 — Dark maroon brick / dark cyan floor
      wall:  { mortar:'#100404', brickA:'#4a1010', brickB:'#3a0c0c', brickLight:'#701818', brickDark:'#200606' },
      floor: { style:'tile', tileA:'#082828', tileB:'#061e1e', grout:'#041212', grain:'#0e3838' },
    },
    {
      // Stage 9 — Dark indigo / burnt sienna floor
      wall:  { mortar:'#0c0c1e', brickA:'#1e1e4a', brickB:'#18183c', brickLight:'#30307a', brickDark:'#0c0c20' },
      floor: { style:'tile', tileA:'#482010', tileB:'#38180c', grout:'#200e06', grain:'#582818' },
    },
    {
      // Stage 10 — Dark copper/brown brick / dark slate blue floor
      wall:  { mortar:'#0e0a06', brickA:'#3c2010', brickB:'#301808', brickLight:'#5e3218', brickDark:'#1c0e04' },
      floor: { style:'tile', tileA:'#101828', tileB:'#0c1020', grout:'#080c14', grain:'#181e30' },
    },
    {
      // Stage 11 — Dark mossy stone / dark orange floor
      wall:  { mortar:'#080e04', brickA:'#182010', brickB:'#101808', brickLight:'#283818', brickDark:'#080e04' },
      floor: { style:'tile', tileA:'#4a2404', tileB:'#3a1c02', grout:'#200e00', grain:'#582c06' },
    },
    {
      // Stage 12 — Dark graphite / dark green floor
      wall:  { mortar:'#0c0c0e', brickA:'#222228', brickB:'#1a1a20', brickLight:'#383840', brickDark:'#101012' },
      floor: { style:'tile', tileA:'#0a2010', tileB:'#06180a', grout:'#040c06', grain:'#102818' },
    },
    {
      // Stage 13 — Dark wine red / dark gold floor
      wall:  { mortar:'#0e0408', brickA:'#3c0e18', brickB:'#2e0a12', brickLight:'#581424', brickDark:'#180408' },
      floor: { style:'tile', tileA:'#3a2c04', tileB:'#2c2002', grout:'#181200', grain:'#483808' },
    },
    {
      // Stage 14 — Dark slate / dark rose floor
      wall:  { mortar:'#0a0e12', brickA:'#1e2830', brickB:'#182028', brickLight:'#2e3e4a', brickDark:'#0c1018' },
      floor: { style:'tile', tileA:'#3a1020', tileB:'#2a0c18', grout:'#18060c', grain:'#441828' },
    },
    {
      // Stage 15 — Near-black brick with blue mortar / dark warm brown floor
      wall:  { mortar:'#0a1020', brickA:'#181820', brickB:'#101018', brickLight:'#282838', brickDark:'#080810' },
      floor: { style:'tile', tileA:'#382410', tileB:'#2c1c0c', grout:'#181006', grain:'#442c14' },
    },
    {
      // Stage 16 — Dark green-black / dark purple floor
      wall:  { mortar:'#060c08', brickA:'#101e10', brickB:'#0c180c', brickLight:'#1c301c', brickDark:'#060c06' },
      floor: { style:'tile', tileA:'#1e0c2e', tileB:'#160820', grout:'#0c0418', grain:'#260e38' },
    },
  ];

  _initSprites() {
    this._buildFloor(); this._buildVoid(); this._buildWall();
    this._buildTarget(); this._buildBox(); this._buildBoxOk();
  }

  setStage(stageIndex) {
    const themes = Renderer.STAGE_THEMES;
    this._stageTheme = themes[stageIndex % themes.length];
    this._buildFloor();
    this._buildVoid();
    this._buildWall();
    this._buildTarget();
    this.markDirty();
  }

  _buildFloor() {
    const theme = this._stageTheme;
    this._createSprite('floor', (ctx, s) => {
      if (theme && theme.floor.style === 'tile') {
        // Stone/tile floor
        const { tileA, tileB, grout, grain } = theme.floor;
        ctx.fillStyle=grout; ctx.fillRect(0,0,s,s);
        const hw=s/2;
        // 4 tiles in a 2x2 grid with grout gap
        const tiles=[{x:1,y:1,c:tileA},{x:hw+0.5,y:1,c:tileB},{x:1,y:hw+0.5,c:tileB},{x:hw+0.5,y:hw+0.5,c:tileA}];
        for (const t of tiles) {
          ctx.fillStyle=t.c; ctx.fillRect(t.x,t.y,hw-1.5,hw-1.5);
          // tile highlight
          ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.fillRect(t.x,t.y,hw-1.5,1); ctx.fillRect(t.x,t.y,1,hw-1.5);
          // tile shadow
          ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(t.x,t.y+hw-2.5,hw-1.5,1); ctx.fillRect(t.x+hw-2.5,t.y,1,hw-1.5);
        }
        // subtle grain
        ctx.strokeStyle=grain; ctx.lineWidth=0.5; ctx.globalAlpha=0.35;
        ctx.beginPath(); ctx.moveTo(s*0.3,2); ctx.lineTo(s*0.32,hw-2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hw+s*0.2,hw+2); ctx.lineTo(hw+s*0.18,s-2); ctx.stroke();
        ctx.globalAlpha=1;
      } else {
        // Wood plank floor (original style)
        const dark = (theme && theme.floor.grout) || '#2a2018';
        const base = (theme && theme.floor.base)  || '#3a2e1e';
        const plank1 = (theme && theme.floor.plankA) || '#3d3122';
        const plank2 = (theme && theme.floor.plankB) || '#352b1c';
        const grain  = (theme && theme.floor.grain)  || '#2e2518';
        ctx.fillStyle=base; ctx.fillRect(0,0,s,s);
        const ph=s/2;
        ctx.fillStyle=plank1; ctx.fillRect(1,1,s-2,ph-1.5);
        ctx.fillStyle=plank2; ctx.fillRect(1,ph+0.5,s-2,ph-1.5);
        ctx.strokeStyle=dark; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(0,ph); ctx.lineTo(s,ph); ctx.stroke();
        ctx.strokeStyle=grain; ctx.lineWidth=0.5; ctx.globalAlpha=0.6;
        for (const gx of [s*0.25,s*0.6]) { ctx.beginPath(); ctx.moveTo(gx,2); ctx.lineTo(gx+2,ph-2); ctx.stroke(); }
        for (const gx of [s*0.4,s*0.75]) { ctx.beginPath(); ctx.moveTo(gx,ph+2); ctx.lineTo(gx-2,s-2); ctx.stroke(); }
        ctx.globalAlpha=1; ctx.strokeStyle=dark; ctx.lineWidth=1; ctx.strokeRect(0.5,0.5,s-1,s-1);
      }
    });
  }

  _buildVoid() { this._createSprite('void', (ctx,s) => { ctx.fillStyle='#0d0d1a'; ctx.fillRect(0,0,s,s); }); }

  _buildWall() {
    const theme = this._stageTheme;
    this._createSprite('wall', (ctx,s) => {
      const mortar     = (theme && theme.wall.mortar)     || '#1e1e2e';
      const brickA     = (theme && theme.wall.brickA)     || '#4a4a6a';
      const brickB     = (theme && theme.wall.brickB)     || '#525275';
      const brickLight = (theme && theme.wall.brickLight) || '#6a6a8f';
      const brickDark  = (theme && theme.wall.brickDark)  || '#35354f';
      ctx.fillStyle=mortar; ctx.fillRect(0,0,s,s);
      const bricks=[{x:1,y:1,w:s-2,h:s/2-1.5},{x:1,y:s/2+0.5,w:s/2-2,h:s/2-1.5},{x:s/2,y:s/2+0.5,w:s/2-1,h:s/2-1.5}];
      for (const [i,b] of bricks.entries()) {
        ctx.fillStyle=i%2===0?brickA:brickB; ctx.fillRect(b.x,b.y,b.w,b.h);
        ctx.fillStyle=brickLight; ctx.fillRect(b.x,b.y,b.w,1.5); ctx.fillRect(b.x,b.y,1.5,b.h);
        ctx.fillStyle=brickDark; ctx.fillRect(b.x,b.y+b.h-1.5,b.w,1.5); ctx.fillRect(b.x+b.w-1.5,b.y,1.5,b.h);
      }
    });
  }

  _buildTarget() {
    this._createSprite('target', (ctx,s) => {
      ctx.drawImage(this.sprites.floor,0,0);
      const c=s/2, r=s*0.28;
      ctx.save();
      ctx.shadowColor='#e94560'; ctx.shadowBlur=6;
      ctx.globalAlpha=0.35; ctx.fillStyle='#e94560';
      ctx.beginPath(); ctx.moveTo(c,c-r); ctx.lineTo(c+r,c); ctx.lineTo(c,c+r); ctx.lineTo(c-r,c); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1; ctx.shadowBlur=0; ctx.strokeStyle='#e94560'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(c,c-r); ctx.lineTo(c+r,c); ctx.lineTo(c,c+r); ctx.lineTo(c-r,c); ctx.closePath(); ctx.stroke();
      ctx.fillStyle='#e94560'; ctx.globalAlpha=0.7; ctx.beginPath(); ctx.arc(c,c,2,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1; ctx.restore();
    });
  }

  _buildBox() {
    this._createSprite('box', (ctx,s) => {
      const m=1, bx=m, by=m, bw=s-m*2, bh=s-m*2;
      const fw=4; // frame width

      // --- Drop shadow ---
      ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(bx+3,by+3,bw,bh);

      // --- Background planks (vertical stripes, darker wood) ---
      const bgGrad=ctx.createLinearGradient(bx,by,bx+bw,by);
      bgGrad.addColorStop(0,   '#b8782a');
      bgGrad.addColorStop(0.15,'#cc8c38');
      bgGrad.addColorStop(0.3, '#b07020');
      bgGrad.addColorStop(0.5, '#c88430');
      bgGrad.addColorStop(0.7, '#b07020');
      bgGrad.addColorStop(0.85,'#cc8c38');
      bgGrad.addColorStop(1,   '#b07828');
      ctx.fillStyle=bgGrad; ctx.fillRect(bx,by,bw,bh);

      // Subtle vertical wood grain
      ctx.globalAlpha=0.2; ctx.strokeStyle='#6a3a08'; ctx.lineWidth=0.7;
      for (const t of [0.12,0.22,0.38,0.48,0.62,0.72,0.88]) {
        ctx.beginPath(); ctx.moveTo(bx+bw*t, by); ctx.lineTo(bx+bw*t+1, by+bh); ctx.stroke();
      }
      ctx.globalAlpha=1;

      // Plank separation lines
      ctx.strokeStyle='#7a4810'; ctx.lineWidth=1; ctx.globalAlpha=0.55;
      for (const t of [0.33, 0.66]) {
        ctx.beginPath(); ctx.moveTo(bx+bw*t, by); ctx.lineTo(bx+bw*t, by+bh); ctx.stroke();
      }
      ctx.globalAlpha=1;

      // --- Diagonal X braces BEFORE frame so frame covers the ends ---
      const drawWoodenBrace = (x1,y1,x2,y2) => {
        const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy);
        const nx=-dy/len, ny=dx/len;
        const hw=2;
        ctx.beginPath();
        ctx.moveTo(x1+nx*hw, y1+ny*hw);
        ctx.lineTo(x2+nx*hw, y2+ny*hw);
        ctx.lineTo(x2-nx*hw, y2-ny*hw);
        ctx.lineTo(x1-nx*hw, y1-ny*hw);
        ctx.closePath();
        const bg=ctx.createLinearGradient(x1+nx*hw,y1+ny*hw, x1-nx*hw,y1-ny*hw);
        bg.addColorStop(0,'#dda040');
        bg.addColorStop(0.35,'#b87828');
        bg.addColorStop(0.65,'#a06418');
        bg.addColorStop(1,'#cc9030');
        ctx.fillStyle=bg; ctx.fill();
        ctx.strokeStyle='#6a3808'; ctx.lineWidth=0.8; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x1+nx*(hw-1), y1+ny*(hw-1));
        ctx.lineTo(x2+nx*(hw-1), y2+ny*(hw-1));
        ctx.strokeStyle='rgba(220,180,100,0.35)'; ctx.lineWidth=0.8; ctx.stroke();
      };
      // X between inner corners of the frame so the frame covers the ends cleanly
      const ix=bx+fw, iy=by+fw, ix2=bx+bw-fw, iy2=by+bh-fw;
      drawWoodenBrace(ix, iy, ix2, iy2);
      drawWoodenBrace(ix2, iy, ix, iy2);

      // --- Wooden frame border drawn ON TOP of X ---
      const frameGrad = ctx.createLinearGradient(bx,by,bx,by+bh);
      frameGrad.addColorStop(0, '#c07828');
      frameGrad.addColorStop(0.5,'#a86018');
      frameGrad.addColorStop(1, '#8c4c10');
      ctx.fillStyle=frameGrad;
      ctx.fillRect(bx, by, bw, fw);
      ctx.fillRect(bx, by+bh-fw, bw, fw);
      ctx.fillRect(bx, by, fw, bh);
      ctx.fillRect(bx+bw-fw, by, fw, bh);
      // Inner highlight on frame edges
      ctx.strokeStyle='rgba(220,170,90,0.6)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(bx+fw,by+1); ctx.lineTo(bx+bw-fw,by+1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx+1,by+fw); ctx.lineTo(bx+1,by+bh-fw); ctx.stroke();
      // Inner shadow on frame inner edges
      ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(bx+fw,by+fw-1); ctx.lineTo(bx+bw-fw,by+fw-1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx+fw-1,by+fw); ctx.lineTo(bx+fw-1,by+bh-fw); ctx.stroke();

      // --- Outer border ---
      ctx.strokeStyle='#5a3008'; ctx.lineWidth=1.5; ctx.strokeRect(bx+0.5,by+0.5,bw-1,bh-1);
      ctx.strokeStyle='rgba(220,180,90,0.5)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(bx+1,by+bh-1); ctx.lineTo(bx+1,by+1); ctx.lineTo(bx+bw-1,by+1); ctx.stroke();
      ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(bx+bw-1,by+2); ctx.lineTo(bx+bw-1,by+bh-1); ctx.lineTo(bx+2,by+bh-1); ctx.stroke();
    });
  }

  _buildBoxOk() {
    this._createSprite('box_ok', (ctx,s) => {
      const m=1, bx=m, by=m, bw=s-m*2, bh=s-m*2;

      // --- Drop shadow ---
      ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(bx+3,by+3,bw,bh);

      // --- Background planks (vertical, green-tinted wood) ---
      const bgGrad=ctx.createLinearGradient(bx,by,bx+bw,by);
      bgGrad.addColorStop(0,   '#5ab840');
      bgGrad.addColorStop(0.15,'#68cc4c');
      bgGrad.addColorStop(0.3, '#50aa38');
      bgGrad.addColorStop(0.5, '#68cc4c');
      bgGrad.addColorStop(0.7, '#50aa38');
      bgGrad.addColorStop(0.85,'#68cc4c');
      bgGrad.addColorStop(1,   '#50a030');
      ctx.fillStyle=bgGrad; ctx.fillRect(bx,by,bw,bh);

      // Subtle vertical grain on background
      ctx.globalAlpha=0.18; ctx.strokeStyle='#1a5010'; ctx.lineWidth=0.7;
      for (const t of [0.12,0.22,0.38,0.48,0.62,0.72,0.88]) {
        ctx.beginPath(); ctx.moveTo(bx+bw*t, by); ctx.lineTo(bx+bw*t+1, by+bh); ctx.stroke();
      }
      ctx.globalAlpha=1;

      // Plank separation lines
      ctx.strokeStyle='#2a7018'; ctx.lineWidth=1; ctx.globalAlpha=0.5;
      for (const t of [0.33, 0.66]) {
        ctx.beginPath(); ctx.moveTo(bx+bw*t, by); ctx.lineTo(bx+bw*t, by+bh); ctx.stroke();
      }
      ctx.globalAlpha=1;

      // --- Define frame gradient (drawn AFTER X) ---
      const fw = 4;
      const frameGrad = ctx.createLinearGradient(bx,by,bx,by+bh);
      frameGrad.addColorStop(0, '#3a9828');
      frameGrad.addColorStop(0.5,'#2a7818');
      frameGrad.addColorStop(1, '#1c5810');

      // --- Diagonal X braces BEFORE frame so frame covers the ends ---
      const drawWoodenBrace = (x1,y1,x2,y2) => {
        const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy);
        const nx=-dy/len, ny=dx/len;
        const hw=2;
        ctx.beginPath();
        ctx.moveTo(x1+nx*hw, y1+ny*hw);
        ctx.lineTo(x2+nx*hw, y2+ny*hw);
        ctx.lineTo(x2-nx*hw, y2-ny*hw);
        ctx.lineTo(x1-nx*hw, y1-ny*hw);
        ctx.closePath();
        const bg=ctx.createLinearGradient(x1+nx*hw,y1+ny*hw, x1-nx*hw,y1-ny*hw);
        bg.addColorStop(0,'#6acc50');
        bg.addColorStop(0.35,'#3ea828');
        bg.addColorStop(0.65,'#2a8018');
        bg.addColorStop(1,'#58b840');
        ctx.fillStyle=bg; ctx.fill();
        ctx.strokeStyle='#1a5010'; ctx.lineWidth=0.8; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x1+nx*(hw-1), y1+ny*(hw-1));
        ctx.lineTo(x2+nx*(hw-1), y2+ny*(hw-1));
        ctx.strokeStyle='rgba(160,255,140,0.3)'; ctx.lineWidth=0.8; ctx.stroke();
      };
      // X between inner corners of the frame so the frame covers the ends cleanly
      const ix=bx+fw, iy=by+fw, ix2=bx+bw-fw, iy2=by+bh-fw;
      drawWoodenBrace(ix, iy, ix2, iy2);
      drawWoodenBrace(ix2, iy, ix, iy2);

      // --- Wooden frame drawn ON TOP of X ---
      ctx.fillStyle=frameGrad;
      ctx.fillRect(bx, by, bw, fw);
      ctx.fillRect(bx, by+bh-fw, bw, fw);
      ctx.fillRect(bx, by, fw, bh);
      ctx.fillRect(bx+bw-fw, by, fw, bh);
      ctx.strokeStyle='rgba(150,255,130,0.5)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(bx+fw,by+1); ctx.lineTo(bx+bw-fw,by+1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx+1,by+fw); ctx.lineTo(bx+1,by+bh-fw); ctx.stroke();
      ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(bx+fw,by+fw-1); ctx.lineTo(bx+bw-fw,by+fw-1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx+fw-1,by+fw); ctx.lineTo(bx+fw-1,by+bh-fw); ctx.stroke();

      // --- Outer border ---
      ctx.strokeStyle='#154010'; ctx.lineWidth=1.5; ctx.strokeRect(bx+0.5,by+0.5,bw-1,bh-1);
      ctx.strokeStyle='rgba(160,255,130,0.45)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(bx+1,by+bh-1); ctx.lineTo(bx+1,by+1); ctx.lineTo(bx+bw-1,by+1); ctx.stroke();
      ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(bx+bw-1,by+2); ctx.lineTo(bx+bw-1,by+bh-1); ctx.lineTo(bx+2,by+bh-1); ctx.stroke();
    });
  }

  // ===== PLAYER =====
  _drawPlayer(ctx, pixelX, pixelY) {
    const s = this.tileSize, a = this.anim;
    const isMoving = a.state === 'walk' || a.state === 'push_walk';
    const bob = isMoving ? [0,-1,0,1][a.frame] : 0;
    const isPushing = a.state === 'push' || a.state === 'push_walk';
    ctx.save();
    ctx.translate(pixelX + s/2, pixelY + s/2 + bob);
    ctx.rotate(Math.atan2(a.dir.dy, a.dir.dx) + Math.PI/2);
    this._drawPlayerBody(ctx, a.frame, isPushing, isMoving);
    ctx.restore();
  }

  _drawPlayerBody(ctx, frame, isPushing, isMoving) {
    const skin='#f0c880', shirt='#2255cc', shirtDark='#1a3a99', hatColor='#f2b01e', beltColor='#2a2a2a', buckleColor='#e0e0e0';
    ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0,2,10,8,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=shirt;
    ctx.beginPath(); ctx.moveTo(-7,-1); ctx.lineTo(7,-1); ctx.lineTo(5.5,9); ctx.lineTo(-5.5,9); ctx.closePath(); ctx.fill();
    const grad=ctx.createLinearGradient(-7,0,7,0);
    grad.addColorStop(0,'rgba(0,0,0,0.15)'); grad.addColorStop(0.5,'transparent'); grad.addColorStop(1,'rgba(0,0,0,0.15)');
    ctx.fillStyle=grad; ctx.fill();
    ctx.fillStyle=beltColor; ctx.fillRect(-6,6,12,2.5);
    ctx.fillStyle=buckleColor; ctx.fillRect(-1.2,6,2.4,2.5);
    ctx.fillStyle=shirtDark; ctx.fillRect(2,1,3,3);
    this._drawArms(ctx, frame, isPushing, isMoving, skin, shirt);
    ctx.fillStyle=skin; ctx.beginPath(); ctx.arc(0,-1,3.5,0,Math.PI*2); ctx.fill();
    const headY=-3.5;
    ctx.fillStyle='#b08010'; ctx.beginPath(); ctx.ellipse(0,headY,7.5,8.5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=hatColor; ctx.beginPath(); ctx.ellipse(0,headY-1,6,7,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.globalAlpha=0.4; ctx.beginPath(); ctx.arc(-2,headY-3,1.5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(0,headY-6.5); ctx.lineTo(0,headY+5); ctx.stroke();
  }

  _drawArms(ctx, frame, isPushing, isMoving, skin, shirt) {
    const glove=skin, shoulderX=6.4, shoulderY=1.0;
    const swingAmt=isMoving?5:0;
    const leftSwing=[0,-swingAmt,0,swingAmt][frame];
    const rightSwing=[0,swingAmt,0,-swingAmt][frame];
    this._drawOneArm(ctx,-shoulderX,shoulderY,leftSwing,shirt,glove,isPushing,isMoving);
    this._drawOneArm(ctx,shoulderX,shoulderY,rightSwing,shirt,glove,isPushing,isMoving);
  }

  _drawOneArm(ctx, x, y, swing, shirt, glove, isPushing, isMoving) {
    ctx.save();
    if (isPushing) {
      ctx.translate(x,y); ctx.fillStyle=shirt; this._drawRoundRect(ctx,-2.5,-11,5,12,2.5); ctx.fill();
      ctx.fillStyle=glove; ctx.beginPath(); ctx.arc(0,-11,3.2,0,Math.PI*2); ctx.fill();
    } else {
      ctx.translate(x, y + (isMoving ? swing*0.4 : 0));
      ctx.fillStyle=shirt; ctx.beginPath(); ctx.arc(0,0,3.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(-1,-1,1.5,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  _drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }

  // ===== RENDER =====
  render(state) {
    if (!this.dirty) return;
    this.dirty = false;
    const grid = this._renderGrid || (state && state.grid);
    const w = this._renderW || (state && state.w);
    const h = this._renderH || (state && state.h);
    const targets = this._renderTargets || new Set();
    const boxes = this._renderBoxes || (state ? state.boxes.map(b => ({ x:b.x, y:b.y, px:b.x*this.tileSize, py:b.y*this.tileSize })) : []);
    if (!grid || !state) return;

    const T=this.tileSize, ctx=this.ctx, tw=this.tween;
    let t=1;
    if (tw.active) { t=tw.elapsed/tw.duration; t=t<0.5?2*t*t:-1+(4-2*t)*t; }

    const playerPX = tw.active ? tw.pFromX+(tw.pToX-tw.pFromX)*t : state.player.x*T;
    const playerPY = tw.active ? tw.pFromY+(tw.pToY-tw.pFromY)*t : state.player.y*T;

    let tweenBoxPX=null, tweenBoxPY=null, tweenBoxGridX=-1, tweenBoxGridY=-1;
    if (tw.active && tw.box) {
      tweenBoxPX = tw.box.fromX+(tw.box.toX-tw.box.fromX)*t;
      tweenBoxPY = tw.box.fromY+(tw.box.toY-tw.box.fromY)*t;
      tweenBoxGridX = tw.box.gridToX; tweenBoxGridY = tw.box.gridToY;
    }

    for (let y=0; y<h; y++) {
      for (let x=0; x<w; x++) {
        const cell=grid[y][x], px=x*T, py=y*T, key=y*w+x;
        if (cell===-1) ctx.drawImage(this.sprites.void,px,py);
        else if (cell===1) ctx.drawImage(this.sprites.wall,px,py);
        else ctx.drawImage(targets.has(key)?this.sprites.target:this.sprites.floor,px,py);
      }
    }
    for (const b of boxes) {
      if (tw.active && tw.box && b.x===tweenBoxGridX && b.y===tweenBoxGridY) continue;
      ctx.drawImage(targets.has(b.y*w+b.x)?this.sprites.box_ok:this.sprites.box, b.px, b.py);
    }
    if (tw.active && tw.box && tweenBoxPX!==null) {
      ctx.drawImage(targets.has(tweenBoxGridY*w+tweenBoxGridX)?this.sprites.box_ok:this.sprites.box, tweenBoxPX, tweenBoxPY);
    }
    this._drawPlayer(ctx, playerPX, playerPY);
  }
}
