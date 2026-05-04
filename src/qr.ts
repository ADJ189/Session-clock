// ── Minimal QR code generator (Version 2-M, byte mode) ───────────────
// Pure TS, zero deps. Generates 25×25 matrix for URLs up to ~20 chars.

// GF(256) arithmetic using number arrays (avoids Uint8Array<ArrayBuffer> issues)
const GF_EXP: number[] = new Array(512).fill(0);
const GF_LOG:  number[] = new Array(256).fill(0);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x; GF_LOG[x] = i;
    x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]!;
})();

const gfMul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : GF_EXP[(GF_LOG[a]! + GF_LOG[b]!) % 255]!;

function gfPolyMul(p: number[], q: number[]): number[] {
  const r = new Array(p.length + q.length - 1).fill(0) as number[];
  for (let i = 0; i < p.length; i++)
    for (let j = 0; j < q.length; j++)
      r[i + j] ^= gfMul(p[i]!, q[j]!);
  return r;
}

function rsGeneratorPoly(n: number): number[] {
  let g: number[] = [1];
  for (let i = 0; i < n; i++) g = gfPolyMul(g, [1, GF_EXP[i]!]);
  return g;
}

function rsEncode(data: number[], nEC: number): number[] {
  const gen = rsGeneratorPoly(nEC);
  const msg: number[] = [...data, ...new Array(nEC).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i]!;
    if (coef !== 0)
      for (let j = 0; j < gen.length; j++)
        msg[i + j] ^= gfMul(gen[j]!, coef);
  }
  return msg.slice(data.length);
}

function encodeBytes(text: string): number[] {
  const enc = Array.from(new TextEncoder().encode(text));
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  push(0b0100, 4);          // byte mode
  push(enc.length, 8);      // length (version 2: 8 bits)
  enc.forEach(b => push(b, 8));
  for (let i = 0; i < 4 && bits.length < 28 * 8; i++) bits.push(0); // terminator
  while (bits.length % 8) bits.push(0); // byte boundary
  const pads = [0b11101100, 0b00010001];
  let p = 0;
  while (bits.length < 28 * 8) { push(pads[p++ % 2]!, 8); }
  const data: number[] = [];
  for (let i = 0; i < 28; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i * 8 + j] ?? 0);
    data.push(b);
  }
  return data;
}

const SIZE = 25;

export function buildMatrix(text: string): boolean[][] {
  const data = encodeBytes(text.slice(0, 20)); // max ~20 bytes for v2-M
  const ec = rsEncode(data, 16);
  const all = [...data, ...ec];

  const grid: number[][] = Array.from({length: SIZE}, () => new Array(SIZE).fill(-1));
  const fixed: boolean[][] = Array.from({length: SIZE}, () => new Array(SIZE).fill(false));

  const set = (r: number, c: number, dark: boolean, fix = false) => {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    grid[r][c] = dark ? 1 : 0; if (fix) fixed[r][c] = true;
  };

  // Finder patterns
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    const d = i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4);
    set(i, j, d, true); set(i, SIZE-7+j, d, true); set(SIZE-7+i, j, d, true);
  }
  // Separators
  for (let i = 0; i < 8; i++) {
    set(7,i,false,true); set(i,7,false,true);
    set(7,SIZE-1-i,false,true); set(i,SIZE-8,false,true);
    set(SIZE-8,i,false,true); set(SIZE-1-i,7,false,true);
  }
  // Timing
  for (let i = 8; i < SIZE-8; i++) { set(6,i,i%2===0,true); set(i,6,i%2===0,true); }
  // Dark module
  set(13,8,true,true);
  // Alignment (v2 at 18,18)
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++)
    set(18+i, 18+j, Math.abs(i)===2||Math.abs(j)===2||(i===0&&j===0), true);

  // Format (EC=M, mask=2)
  const FMT = 0b000000001011010;
  const fb = Array.from({length:15},(_,i)=>(FMT>>(14-i))&1);
  [[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],[8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0]].forEach(([r,c],i)=>set(r!,c!,fb[i]===1,true));
  [[8,SIZE-1],[8,SIZE-2],[8,SIZE-3],[8,SIZE-4],[8,SIZE-5],[8,SIZE-6],[8,SIZE-7],[SIZE-8,8],[SIZE-7,8],[SIZE-6,8],[SIZE-5,8],[SIZE-4,8],[SIZE-3,8],[SIZE-2,8],[SIZE-1,8]].forEach(([r,c],i)=>set(r!,c!,fb[i]===1,true));

  // Place data in zigzag
  let bi = 0; const tot = all.length * 8;
  let col = SIZE-1, goUp = true;
  while (col >= 0) {
    if (col === 6) col--;
    for (let ii = 0; ii < SIZE; ii++) {
      const r2 = goUp ? SIZE-1-ii : ii;
      for (let dc = 0; dc < 2; dc++) {
        const c2 = col - dc;
        if (c2 < 0 || fixed[r2]![c2]) continue;
        const bit = bi < tot ? (all[bi>>3]!>>(7-(bi&7)))&1 : 0;
        const masked = (r2 + c2) % 3 === 0 ? bit^1 : bit; // mask 2
        set(r2, c2, masked===1); bi++;
      }
    }
    col -= 2; goUp = !goUp;
  }

  return grid.map(row => row.map(v => v === 1));
}

export function drawQR(canvas: HTMLCanvasElement, text: string, fg: string, bg: string): boolean {
  try {
    const matrix = buildMatrix(text);
    const ctx2 = canvas.getContext('2d')!;
    const cell = canvas.width / SIZE;
    ctx2.fillStyle = bg; ctx2.fillRect(0,0,canvas.width,canvas.height);
    ctx2.fillStyle = fg;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (matrix[r]![c]) ctx2.fillRect(c*cell, r*cell, cell, cell);
    return true;
  } catch { return false; }
}
