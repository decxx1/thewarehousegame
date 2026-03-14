import { useState, useRef, useCallback } from 'preact/hooks';
import { STAGES } from './game/levels.js';
import GameCanvas from './components/GameCanvas.jsx';
import HUD from './components/HUD.jsx';
import MainMenu from './components/MainMenu.jsx';
import PasswordModal from './components/PasswordModal.jsx';
import Toast from './components/Toast.jsx';

const STORAGE_DONE = 'twg_completed';
const STORAGE_UNLOCKED = 'twg_unlocked';
const WIN_DELAY = 1200;

function globalIndex(stage, room) {
  let idx = 0;
  for (let s = 0; s < stage; s++) idx += STAGES[s].levels.length;
  return idx + room;
}

function loadProgress() {
  try {
    const done = localStorage.getItem(STORAGE_DONE);
    const unlocked = localStorage.getItem(STORAGE_UNLOCKED);
    return {
      completed: done ? new Set(JSON.parse(done)) : new Set(),
      unlocked: unlocked ? new Set([0, ...JSON.parse(unlocked)]) : new Set([0]),
    };
  } catch { return { completed: new Set(), unlocked: new Set([0]) }; }
}

function saveProgress(completed, unlocked) {
  try {
    localStorage.setItem(STORAGE_DONE, JSON.stringify([...completed]));
    localStorage.setItem(STORAGE_UNLOCKED, JSON.stringify([...unlocked]));
  } catch {}
}

export default function App() {
  const init = loadProgress();
  const [screen, setScreen] = useState('menu');
  const [currentStage, setCurrentStage] = useState(0);
  const [currentRoom, setCurrentRoom] = useState(0);
  const [completed, setCompleted] = useState(init.completed);
  const [unlockedStages, setUnlockedStages] = useState(init.unlocked);
  const [toast, setToast] = useState({ msg: '', key: 0 });
  const [hud, setHud] = useState({ room: 1, moves: 0, pushes: 0, stageName: '', password: '' });
  const [passwordModal, setPasswordModal] = useState(null);

  // Stable refs to avoid stale closures in setTimeout callbacks
  const completedRef = useRef(completed);
  const unlockedRef = useRef(unlockedStages);
  completedRef.current = completed;
  unlockedRef.current = unlockedStages;

  const showToast = useCallback((msg) => {
    setToast(prev => ({ msg, key: prev.key + 1 }));
  }, []);

  const startGame = useCallback((stage, room) => {
    setCurrentStage(stage);
    setCurrentRoom(room);
    setScreen('game');
  }, []);

  const handleRoomComplete = useCallback((stage, room) => {
    const globalIdx = globalIndex(stage, room);
    const newCompleted = new Set(completedRef.current);
    newCompleted.add(globalIdx);
    setCompleted(newCompleted);
    completedRef.current = newCompleted;
    saveProgress(newCompleted, unlockedRef.current);
    showToast('ROOM COMPLETE!');

    setTimeout(() => {
      const stageData = STAGES[stage];
      if (room < stageData.levels.length - 1) {
        startGame(stage, room + 1);
      } else if (stage < STAGES.length - 1) {
        const newUnlocked = new Set(unlockedRef.current);
        newUnlocked.add(stage + 1);
        setUnlockedStages(newUnlocked);
        unlockedRef.current = newUnlocked;
        saveProgress(newCompleted, newUnlocked);
        startGame(stage + 1, 0);
      } else {
        showToast('ALL 160 ROOMS COMPLETE!');
        setTimeout(() => setScreen('menu'), 2000);
      }
    }, WIN_DELAY);
  }, [showToast, startGame]);

  const handleUnlockStage = useCallback((stageIdx) => {
    const newUnlocked = new Set(unlockedRef.current);
    newUnlocked.add(stageIdx);
    setUnlockedStages(newUnlocked);
    unlockedRef.current = newUnlocked;
    saveProgress(completedRef.current, newUnlocked);
    showToast(`${STAGES[stageIdx].name} UNLOCKED!`);
    setPasswordModal(null);
  }, [showToast]);

  return (
    <div id="app-root">
      {screen === 'game' && (
        <GameCanvas
          stage={currentStage}
          room={currentRoom}
          onHudUpdate={setHud}
          onRoomComplete={handleRoomComplete}
          onEscape={() => setScreen('menu')}
        />
      )}

      <HUD visible={screen === 'game'} {...hud} />

      {screen === 'menu' && (
        <MainMenu
          completed={completed}
          unlockedStages={unlockedStages}
          currentStage={currentStage}
          currentRoom={currentRoom}
          onPlay={() => startGame(currentStage, currentRoom)}
          onStartRoom={startGame}
          onOpenPasswordModal={setPasswordModal}
        />
      )}

      {passwordModal !== null && (
        <PasswordModal
          stageIdx={passwordModal}
          onSuccess={handleUnlockStage}
          onClose={() => setPasswordModal(null)}
        />
      )}

      {toast.msg && <Toast key={toast.key} message={toast.msg} />}
    </div>
  );
}
