import { STAGES } from '../game/levels.js';

function calcGlobalIndex(stage, room) {
  let idx = 0;
  for (let s = 0; s < stage; s++) idx += STAGES[s].levels.length;
  return idx + room;
}

function isStageComplete(stageIdx, completed) {
  const stage = STAGES[stageIdx];
  return stage.levels.every((_, r) => completed.has(calcGlobalIndex(stageIdx, r)));
}

export default function StageSelect({ completed, unlockedStages, onSelectStage, onBack }) {
  return (
    <div class="screen-view slide-in">
      <div class="screen-header">
        <button class="back-btn" onClick={onBack}>← BACK</button>
        <span class="screen-title">SELECT STAGE</span>
        <span />
      </div>
      <div class="stage-grid">
        {STAGES.map((stage, i) => {
          const unlocked = unlockedStages.has(i);
          const done = isStageComplete(i, completed);
          return (
            <button
              key={i}
              class={`stage-card${done ? ' done' : ''}${!unlocked ? ' locked' : ''}`}
              onClick={() => onSelectStage(i)}
            >
              <span class="stage-num">{i + 1}</span>
              <span class="stage-name">{stage.name.replace('STAGE ', '')}</span>
              <span class="stage-status">
                {done ? '✓' : unlocked ? '—' : '🔒'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
