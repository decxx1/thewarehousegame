import { useRef, useEffect } from 'preact/hooks';
import { Engine } from '../game/engine.js';
import { Renderer } from '../game/renderer.js';
import { Input } from '../game/input.js';
import { STAGES } from '../game/levels.js';

const TILE_SIZE = 32;

function calcGlobalIndex(stage, room) {
  let idx = 0;
  for (let s = 0; s < stage; s++) idx += STAGES[s].levels.length;
  return idx + room;
}

export default function GameCanvas({ stage, room, onHudUpdate, onRoomComplete, onEscape }) {
  const canvasRef = useRef(null);
  // Keep callback refs fresh without re-running the main effect
  const cbRefs = useRef({ onHudUpdate, onRoomComplete, onEscape });
  useEffect(() => { cbRefs.current = { onHudUpdate, onRoomComplete, onEscape }; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine();
    const renderer = new Renderer(canvas, TILE_SIZE);
    const input = new Input();

    const stageData = STAGES[stage];
    const levelStr = stageData.levels[room];
    renderer.setStage(stage);
    const state = engine.loadLevel(levelStr);
    renderer.resizeForLevel(state.w, state.h);
    renderer.snapToState(state);

    const globalIdx = calcGlobalIndex(stage, room);

    const updateHud = () => {
      cbRefs.current.onHudUpdate({
        room: globalIdx + 1,
        moves: engine.state.moves,
        pushes: engine.state.pushes,
        stageName: stageData.name,
        password: stageData.password || '',
      });
    };
    updateHud();

    let tweening = false;
    let winPending = false;

    const executeMove = (dx, dy) => {
      if (tweening || winPending) return;
      const prev = {
        player: { x: engine.state.player.x, y: engine.state.player.y },
        boxes: engine.state.boxes.map(b => ({ x: b.x, y: b.y })),
      };
      const moved = engine.tryMove(dx, dy);
      if (!moved) return;
      updateHud();
      tweening = true;
      renderer.startMoveTween(dx, dy, moved === 'push', prev, engine.state, () => {
        tweening = false;
        if (engine.checkWin()) {
          winPending = true;
          cbRefs.current.onRoomComplete(stage, room);
          return;
        }
        const a = renderer.anim;
        const nx = engine.state.player.x + a.dir.dx;
        const ny = engine.state.player.y + a.dir.dy;
        renderer.notifyIdle(engine.state.boxes.some(b => b.x === nx && b.y === ny));
      });
    };

    input.on('move', (dx, dy) => {
      if (winPending) return;
      executeMove(dx, dy);
    });

    input.on('undo', () => {
      if (tweening || winPending) return;
      if (engine.undo()) { renderer.snapToState(engine.state); updateHud(); }
    });

    input.on('restart', () => {
      if (winPending) return;
      tweening = false;
      winPending = false;
      const newState = engine.loadLevel(levelStr);
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
    const gameLoop = () => {
      if (!tweening && !winPending) input.pollHeld();
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
  }, [stage, room]);

  return (
    <div class="canvas-wrap">
      <canvas ref={canvasRef} id="c" />
      <div class="controls-hint">
        WASD / ↑↓←→ &nbsp;·&nbsp; Z / E = Undo &nbsp;·&nbsp; R=Restart &nbsp;·&nbsp; ESC=Menu
      </div>
    </div>
  );
}
