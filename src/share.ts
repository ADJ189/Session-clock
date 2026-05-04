// ── Share Focus Card Generator ────────────────────────────────────────
// Renders a beautiful PNG card to canvas, then downloads it.

interface ShareCardOptions {
  themeName: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  glow: string;
  focusMinutes: number;
  taskName: string;
  streakDays: number;
  date: string;
}

export function generateShareCard(opts: ShareCardOptions, download = true): HTMLCanvasElement {
  const W = 1200, H = 630;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;

  // ── Background
  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, opts.bgColor);
  bg.addColorStop(1, darkenHex(opts.bgColor, 0.3));
  c.fillStyle = bg; c.fillRect(0, 0, W, H);

  // ── Glow blob
  const glow = c.createRadialGradient(W * 0.25, H * 0.4, 0, W * 0.25, H * 0.4, W * 0.45);
  glow.addColorStop(0, opts.accentColor + '22');
  glow.addColorStop(1, 'transparent');
  c.fillStyle = glow; c.fillRect(0, 0, W, H);

  // ── Right glow
  const glow2 = c.createRadialGradient(W * 0.8, H * 0.6, 0, W * 0.8, H * 0.6, W * 0.35);
  glow2.addColorStop(0, opts.accentColor + '11');
  glow2.addColorStop(1, 'transparent');
  c.fillStyle = glow2; c.fillRect(0, 0, W, H);

  // ── Noise overlay (thin scanlines)
  c.globalAlpha = 0.025;
  for (let y = 0; y < H; y += 3) {
    c.fillStyle = '#000'; c.fillRect(0, y, W, 1);
  }
  c.globalAlpha = 1;

  // ── App name / logo
  c.font = '600 18px Inter, system-ui, sans-serif';
  c.fillStyle = opts.textColor;
  c.globalAlpha = 0.35;
  c.textAlign = 'left';
  c.fillText('SESSION CLOCK', 72, 72);
  c.globalAlpha = 1;

  // ── Theme pill
  c.font = '500 14px Inter, system-ui, sans-serif';
  c.fillStyle = opts.accentColor + '22';
  roundRect(c, 72, 86, 120, 26, 13);
  c.fill();
  c.fillStyle = opts.accentColor;
  c.globalAlpha = 0.8;
  c.textAlign = 'center';
  c.fillText(opts.themeName.toUpperCase(), 132, 103);
  c.globalAlpha = 1;

  // ── Big focus time
  const hours   = Math.floor(opts.focusMinutes / 60);
  const minutes = opts.focusMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  c.textAlign = 'left';
  c.font = `900 148px Inter, system-ui, sans-serif`;
  c.fillStyle = opts.textColor;
  c.shadowColor = opts.accentColor;
  c.shadowBlur = 40;
  c.fillText(timeStr, 68, 320);
  c.shadowBlur = 0;

  // ── "of deep focus" label
  c.font = `300 36px Inter, system-ui, sans-serif`;
  c.fillStyle = opts.textColor;
  c.globalAlpha = 0.5;
  c.fillText('of deep focus', 72, 370);
  c.globalAlpha = 1;

  // ── Task name
  if (opts.taskName) {
    c.font = `500 24px Inter, system-ui, sans-serif`;
    c.fillStyle = opts.accentColor;
    c.globalAlpha = 0.85;
    c.fillText(`Working on: ${opts.taskName}`, 72, 430);
    c.globalAlpha = 1;
  }

  // ── Streak badge
  if (opts.streakDays > 1) {
    c.font = `700 18px Inter, system-ui, sans-serif`;
    c.fillStyle = opts.accentColor + '22';
    roundRect(c, 72, opts.taskName ? 460 : 440, 160, 36, 18);
    c.fill();
    c.fillStyle = opts.accentColor;
    c.textAlign = 'center';
    c.fillText(`🔥 ${opts.streakDays} day streak`, 152, opts.taskName ? 483 : 463);
    c.textAlign = 'left';
  }

  // ── Date
  c.font = `400 16px Inter, system-ui, sans-serif`;
  c.fillStyle = opts.textColor;
  c.globalAlpha = 0.3;
  c.fillText(opts.date, 72, H - 48);
  c.globalAlpha = 1;

  // ── Right-side decorative clock
  drawCardClock(c, W - 220, H / 2, 160, opts.accentColor, opts.textColor);

  // ── Bottom bar
  c.fillStyle = opts.accentColor;
  c.globalAlpha = 0.15;
  c.fillRect(0, H - 4, W, 4);
  c.globalAlpha = 1;

  // ── Download (optional)
  if (download) {
    const link = document.createElement('a');
    link.download = `session-clock-${Date.now()}.png`;
    link.href = cv.toDataURL('image/png', 0.95);
    link.click();
  }
  return cv;
}

function drawCardClock(
  c: CanvasRenderingContext2D, cx: number, cy: number,
  r: number, accent: string, text: string
) {
  const now = new Date();
  c.globalAlpha = 0.12;
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
  c.strokeStyle = accent; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
  c.strokeStyle = accent; c.lineWidth = 1; c.stroke();
  c.globalAlpha = 1;

  // Ticks
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const inner = i % 3 === 0 ? r * 0.84 : r * 0.9;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    c.lineTo(cx + Math.cos(a) * r,     cy + Math.sin(a) * r);
    c.strokeStyle = accent;
    c.globalAlpha = i % 3 === 0 ? 0.4 : 0.15;
    c.lineWidth = i % 3 === 0 ? 2 : 1;
    c.stroke();
  }
  c.globalAlpha = 1;

  // Hands
  const hr = now.getHours() % 12, mn = now.getMinutes(), sc = now.getSeconds();
  const hrA  = ((hr + mn / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  const mnA  = ((mn + sc / 60) / 60) * Math.PI * 2 - Math.PI / 2;
  const scA  = (sc / 60) * Math.PI * 2 - Math.PI / 2;

  const hand = (angle: number, len: number, w: number, col: string) => {
    c.beginPath();
    c.moveTo(cx - Math.cos(angle) * r * 0.1, cy - Math.sin(angle) * r * 0.1);
    c.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.stroke();
  };
  c.globalAlpha = 0.7;
  hand(hrA, r * 0.5, 3.5, text);
  hand(mnA, r * 0.72, 2.5, text);
  c.globalAlpha = 1;
  hand(scA, r * 0.82, 1.5, accent);

  c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI * 2);
  c.fillStyle = accent; c.fill();
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
  c.closePath();
}

function darkenHex(hex: string, amount: number): string {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8)  & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round(( n        & 0xff) * (1 - amount)));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
