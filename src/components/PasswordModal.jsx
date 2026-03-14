import { useState, useEffect, useRef } from 'preact/hooks';
import { STAGES } from '../game/levels.js';

export default function PasswordModal({ stageIdx, onSuccess, onClose }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);
  const stage = STAGES[stageIdx];

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => {
    if (value.trim().toUpperCase() === (stage.password || '').toUpperCase()) {
      onSuccess(stageIdx);
    } else {
      setError('Wrong password!');
      setValue('');
      setShake(true);
      setTimeout(() => setShake(false), 400);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal-box">
        <div class="modal-title">{stage.name}</div>
        <div class="modal-subtitle">Enter password to unlock</div>
        <input
          ref={inputRef}
          class={`password-input${shake ? ' shake' : ''}`}
          type="text"
          value={value}
          maxLength={10}
          placeholder="_ _ _ _ _ _ _ _"
          onInput={(e) => { setValue(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          autocomplete="off"
          spellcheck={false}
        />
        <div class="password-error">{error}</div>
        <div class="modal-buttons">
          <button class="btn btn-primary btn-sm" onClick={handleSubmit}>SUBMIT</button>
          <button class="btn btn-secondary btn-sm" onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}
