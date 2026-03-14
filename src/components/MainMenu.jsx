import { useState } from 'preact/hooks';
import StageSelect from './StageSelect.jsx';
import RoomSelect from './RoomSelect.jsx';

export default function MainMenu({
  completed, unlockedStages,
  currentStage, currentRoom,
  onPlay, onStartRoom, onOpenPasswordModal,
}) {
  const [view, setView] = useState('main');
  const [selectedStage, setSelectedStage] = useState(null);

  const handleStageClick = (stageIdx) => {
    if (unlockedStages.has(stageIdx)) {
      setSelectedStage(stageIdx);
      setView('rooms');
    } else {
      onOpenPasswordModal(stageIdx);
    }
  };

  if (view === 'rooms' && selectedStage !== null) {
    return (
      <div class="menu-overlay">
        <RoomSelect
          stageIdx={selectedStage}
          completed={completed}
          onSelectRoom={(r) => onStartRoom(selectedStage, r)}
          onBack={() => setView('stages')}
        />
      </div>
    );
  }

  if (view === 'stages') {
    return (
      <div class="menu-overlay">
        <StageSelect
          completed={completed}
          unlockedStages={unlockedStages}
          onSelectStage={handleStageClick}
          onBack={() => setView('main')}
        />
      </div>
    );
  }

  return (
    <div class="menu-overlay">
      <div class="main-menu slide-in">
        <div class="title-block">
          <h1 class="game-title">THE WAREHOUSE GAME</h1>
          <p class="game-subtitle">— Shove It! &nbsp;·&nbsp; 160 Rooms &nbsp;·&nbsp; 16 Stages —</p>
        </div>
        <div class="menu-buttons">
          <button class="btn btn-primary" onClick={onPlay}>▶ PLAY</button>
          <button class="btn btn-secondary" onClick={() => setView('stages')}>SELECT STAGE</button>
        </div>
        <p class="controls-hint">WASD / Arrows &nbsp;·&nbsp; Z=Undo &nbsp;·&nbsp; R=Restart &nbsp;·&nbsp; ESC=Menu</p>
      </div>
    </div>
  );
}
