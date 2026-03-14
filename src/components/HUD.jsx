export default function HUD({ visible, room, moves, pushes, stageName, password }) {
  if (!visible) return null;
  return (
    <div class="hud">
      <div class="hud-left">
        <span class="hud-stage">{stageName}</span>
        {password && <span class="hud-pass">PASS: {password}</span>}
      </div>
      <div class="hud-center">
        <span class="hud-room">ROOM {room}</span>
        <span class="hud-sep">·</span>
        <span class="hud-stat">MOVES <b>{moves}</b></span>
        <span class="hud-sep">·</span>
        <span class="hud-stat">PUSHES <b>{pushes}</b></span>
      </div>
      <div class="hud-right" />
    </div>
  );
}
