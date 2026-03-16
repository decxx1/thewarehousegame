import { useRef, useEffect } from 'preact/hooks';
import { Engine } from '../game/engine.js';
import { Renderer } from '../game/renderer.js';
import { Input } from '../game/input.js';
import { DEBUG_LEVEL } from '../game/debugLevel.js';

const TILE_SIZE = 32;

export default function DebugCanvas({ onHudUpdate, onEscape }) {
  const canvasRef = useRef(null);
  const cbRefs = useRef({ onHudUpdate, onEscape });
  useEffect(() => { cbRefs.current = { onHudUpdate, onEscape }; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine();
    const renderer = new Renderer(canvas, TILE_SIZE);
    const input = new Input();

    renderer.setStage(0);
    const state = engine.loadLevel(DEBUG_LEVEL);
    renderer.resizeForLevel(state.w, state.h);
    renderer.snapToState(state);

    const updateHud = () => {
      cbRefs.current.onHudUpdate({
        room: 'DBG',
        moves: engine.state.moves,
        pushes: engine.state.pushes,
        stageName: 'DEBUG MAP',
        password: '',
      });
    };
    updateHud();

    let tweening = false;
    let bufferedDir = null;

    const onTweenDone = () => {
      tweening = false;
      const a = renderer.anim;
      const nx = engine.state.player.x + a.dir.dx;
      const ny = engine.state.player.y + a.dir.dy;
      renderer.notifyIdle(engine.state.boxes.some(b => b.x === nx && b.y === ny));
      if (bufferedDir) {
        const [bdx, bdy] = bufferedDir;
        bufferedDir = null;
        startMove(bdx, bdy);
      }
    };

    const startMove = (dx, dy) => {
      const prev = {
        player: { x: engine.state.player.x, y: engine.state.player.y },
        boxes: engine.state.boxes.map(b => ({ x: b.x, y: b.y })),
      };
      const moved = engine.tryMove(dx, dy);
      if (!moved) return;
      updateHud();
      tweening = true;
      renderer.startMoveTween(dx, dy, moved === 'push', prev, engine.state, onTweenDone);
    };

    input.on('move', (dx, dy) => {
      if (tweening) { bufferedDir = [dx, dy]; }
      else { bufferedDir = null; startMove(dx, dy); }
    });

    input.on('undo', () => {
      if (tweening) return;
      bufferedDir = null;
      if (engine.undo()) { renderer.snapToState(engine.state); updateHud(); }
    });

    input.on('restart', () => {
      tweening = false;
      bufferedDir = null;
      const newState = engine.loadLevel(DEBUG_LEVEL);
      renderer.resizeForLevel(newState.w, newState.h);
      renderer.snapToState(newState);
      updateHud();
    });

    input.on('escape', () => cbRefs.current.onEscape());

    input.bindKeyboard();
    input.bindTouch(canvas);

    const handleResize = () => {
      renderer.resizeForLevel(engine.state.w, engine.state.h);
      renderer.markDirty();
    };
    window.addEventListener('resize', handleResize);

    let rafId;
    const gameLoop = (now) => {
      if (!tweening) {
        const dir = input.pollHeld(now);
        if (dir) startMove(dir[0], dir[1]);
      }
      renderer.render(engine.state);
      rafId = requestAnimationFrame(gameLoop);
    };
    rafId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(rafId);
      renderer.stop();
      input.destroy();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div class="canvas-wrap">
      <canvas ref={canvasRef} id="c" />
      <div class="controls-hint">
        DEBUG MAP — WASD / ↑↓←→ · Z/E=Undo · R=Restart · ESC=Menu
      </div>
    </div>
  );
}
