import { STAGES } from '../game/levels.js';

function calcGlobalIndex(stage, room) {
  let idx = 0;
  for (let s = 0; s < stage; s++) idx += STAGES[s].levels.length;
  return idx + room;
}

export default function RoomSelect({ stageIdx, completed, onSelectRoom, onBack }) {
  const stage = STAGES[stageIdx];
  const startGlobal = calcGlobalIndex(stageIdx, 0);

  return (
    <div class="screen-view slide-in">
      <div class="screen-header">
        <button class="back-btn" onClick={onBack}>← BACK</button>
        <span class="screen-title">{stage.name}</span>
        <span />
      </div>
      <div class="room-grid">
        {stage.levels.map((_, r) => {
          const globalIdx = startGlobal + r;
          const done = completed.has(globalIdx);
          return (
            <button
              key={r}
              class={`room-btn${done ? ' done' : ''}`}
              onClick={() => onSelectRoom(r)}
            >
              <span class="room-num">{globalIdx + 1}</span>
              {done && <span class="room-check">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
