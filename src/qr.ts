// ── Minimal QR code generator (byte mode, EC level M, versions 1–10) ───
// Pure TS, zero deps. The version is chosen from the payload size (14–213
// UTF-8 bytes); an oversized payload throws instead of being truncated, so a
// scan never silently opens a URL with parameters missing.

// GF(256) arithmetic using number arrays (avoids Uint8Array<ArrayBuffer> issues)
const GF_EXP: number[] = Array.from<number>({ length: 512 }).fill(0);
const GF_LOG:  number[] = Array.from<number>({ length: 256 }).fill(0);
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
  const r = Array.from<number>({ length: p.length + q.length - 1 }).fill(0);
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
  const msg: number[] = [...data, ...Array.from<number>({ length: nEC }).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i]!;
    if (coef !== 0)
      for (let j = 0; j < gen.length; j++)
        msg[i + j] ^= gfMul(gen[j]!, coef);
  }
  return msg.slice(data.length);
}

// ── Version table (error correction level M) ──────────────────────────
// dataBlocks lists each block's data-codeword count. ecPerBlock is the same
// for every block in a version. Alignment centres come from the QR spec.
interface QrSpec {
  version: number;
  ecPerBlock: number;
  dataBlocks: number[];
  alignment: number[];
}

const QR_SPECS: QrSpec[] = [
  { version: 1,  ecPerBlock: 10, dataBlocks: [16],             alignment: [] },
  { version: 2,  ecPerBlock: 16, dataBlocks: [28],             alignment: [6, 18] },
  { version: 3,  ecPerBlock: 26, dataBlocks: [44],             alignment: [6, 22] },
  { version: 4,  ecPerBlock: 18, dataBlocks: [32, 32],         alignment: [6, 26] },
  { version: 5,  ecPerBlock: 24, dataBlocks: [43, 43],         alignment: [6, 30] },
  { version: 6,  ecPerBlock: 16, dataBlocks: [27, 27, 27, 27], alignment: [6, 34] },
  { version: 7,  ecPerBlock: 18, dataBlocks: [31, 31, 31, 31], alignment: [6, 22, 38] },
  { version: 8,  ecPerBlock: 22, dataBlocks: [38, 38, 39, 39], alignment: [6, 24, 42] },
  { version: 9,  ecPerBlock: 22, dataBlocks: [36, 36, 36, 37, 37], alignment: [6, 26, 46] },
  { version: 10, ecPerBlock: 26, dataBlocks: [43, 43, 43, 43, 44], alignment: [6, 28, 50] },
];

const dataCodewords = (spec: QrSpec): number =>
  spec.dataBlocks.reduce((total, n) => total + n, 0);

/** Byte-mode character-count field width: 8 bits for v1–9, 16 bits for v10+. */
const charCountBits = (version: number): number => (version <= 9 ? 8 : 16);

function byteCapacity(spec: QrSpec): number {
  const bits = dataCodewords(spec) * 8;
  return Math.floor((bits - 4 - charCountBits(spec.version)) / 8);
}

const MAX_SPEC = QR_SPECS[QR_SPECS.length - 1]!;
/** Largest UTF-8 payload this encoder accepts (Version 10-M, byte mode). */
export const QR_MAX_BYTES: number = byteCapacity(MAX_SPEC);

function specForLength(length: number): QrSpec | null {
  return QR_SPECS.find((spec) => length <= byteCapacity(spec)) ?? null;
}

/** Version that will be used for `text`, or 0 when it does not fit. */
export function qrVersionFor(text: string): number {
  const length = new TextEncoder().encode(text).length;
  return specForLength(length)?.version ?? 0;
}

function pushBits(bits: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
}

function encodeCodewords(bytes: number[], spec: QrSpec): number[] {
  const capacity = dataCodewords(spec);
  const capacityBits = capacity * 8;
  const countBits = charCountBits(spec.version);
  const maxBytes = byteCapacity(spec);
  if (bytes.length > maxBytes) {
    throw new RangeError(
      `QR payload is ${bytes.length} bytes; maximum is ${maxBytes}`,
    );
  }

  const bits: number[] = [];
  pushBits(bits, 0b0100, 4); // byte mode
  pushBits(bits, bytes.length, countBits);
  bytes.forEach((b) => pushBits(bits, b, 8));

  // Terminator: up to four zero bits, then pad to a whole byte.
  for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const pads = [0b11101100, 0b00010001];
  let p = 0;
  while (bits.length < capacityBits) pushBits(bits, pads[p++ % 2]!, 8);

  const data: number[] = [];
  for (let i = 0; i < capacity; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i * 8 + j] ?? 0);
    data.push(b);
  }
  return data;
}

/** Split into RS blocks, then interleave data and EC codewords per the spec. */
function interleaveCodewords(data: number[], spec: QrSpec): number[] {
  const blocks: number[][] = [];
  let offset = 0;
  for (const length of spec.dataBlocks) {
    blocks.push(data.slice(offset, offset + length));
    offset += length;
  }
  const ecBlocks = blocks.map((block) => rsEncode(block, spec.ecPerBlock));

  const out: number[] = [];
  const longestData = Math.max(...spec.dataBlocks);
  for (let i = 0; i < longestData; i++)
    for (const block of blocks) if (i < block.length) out.push(block[i]!);
  for (let i = 0; i < spec.ecPerBlock; i++)
    for (const block of ecBlocks) out.push(block[i]!);
  return out;
}

/** 15-bit format information (EC level M, given mask) with its BCH check. */
function formatBits(mask: number): number[] {
  const data = mask & 0b111; // EC level M is 00, so the top two bits stay zero
  let rem = data << 10;
  for (let i = 14; i >= 10; i--)
    if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  const value = ((data << 10) | rem) ^ 0x5412;
  // Placement is bit 0 first.
  return Array.from({ length: 15 }, (_, i) => (value >> i) & 1);
}

/** 18-bit version information for versions 7+ (no mask is applied). */
function versionBits(version: number): number {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--)
    if ((rem >> i) & 1) rem ^= 0x1f25 << (i - 12);
  return (version << 12) | rem;
}

function drawMatrix(bytes: number[], spec: QrSpec): boolean[][] {
  const SIZE = 17 + spec.version * 4;
  const data = encodeCodewords(bytes, spec);
  const all = interleaveCodewords(data, spec);

  const grid: number[][] = Array.from({ length: SIZE }, () =>
    Array.from<number>({ length: SIZE }).fill(-1),
  );
  const fixed: boolean[][] = Array.from({ length: SIZE }, () =>
    Array.from<boolean>({ length: SIZE }).fill(false),
  );

  const set = (r: number, c: number, dark: boolean, fix = false): void => {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    grid[r]![c] = dark ? 1 : 0;
    if (fix) fixed[r]![c] = true;
  };

  // Finder patterns + separators.
  const placeFinder = (top: number, left: number): void => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const inFinder = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark =
          inFinder &&
          (r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(top + r, left + c, dark, true);
      }
  };
  placeFinder(0, 0);
  placeFinder(0, SIZE - 7);
  placeFinder(SIZE - 7, 0);

  // Timing patterns.
  for (let i = 8; i < SIZE - 8; i++) {
    set(6, i, i % 2 === 0, true);
    set(i, 6, i % 2 === 0, true);
  }

  // Alignment patterns (all centre combinations except the finder corners).
  for (const row of spec.alignment)
    for (const col of spec.alignment) {
      if (
        (row === 6 && col === 6) ||
        (row === 6 && col === SIZE - 7) ||
        (row === SIZE - 7 && col === 6)
      )
        continue;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++)
          set(
            row + dr,
            col + dc,
            Math.abs(dr) === 2 ||
              Math.abs(dc) === 2 ||
              (dr === 0 && dc === 0),
            true,
          );
    }

  // Dark module.
  set(SIZE - 8, 8, true, true);

  // Format information, mask 2: (row + column) % 3 === 0.
  const fmt = formatBits(2);
  for (let i = 0; i < 15; i++) {
    const bit = fmt[i] === 1;
    if (i < 6) set(i, 8, bit, true);
    else if (i < 8) set(i + 1, 8, bit, true);
    else set(SIZE - 15 + i, 8, bit, true);

    if (i < 8) set(8, SIZE - 1 - i, bit, true);
    else if (i < 9) set(8, 15 - i - 1 + 1, bit, true);
    else set(8, 15 - i - 1, bit, true);
  }

  // Version information (v7+).
  if (spec.version >= 7) {
    const vbits = versionBits(spec.version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vbits >> i) & 1) === 1;
      set(Math.floor(i / 3), SIZE - 11 + (i % 3), bit, true);
      set(SIZE - 11 + (i % 3), Math.floor(i / 3), bit, true);
    }
  }

  // Place data in zigzag, skipping the timing column and fixed modules.
  let bi = 0;
  const totalBits = all.length * 8;
  let col = SIZE - 1;
  let goUp = true;
  while (col >= 0) {
    if (col === 6) col--;
    for (let ii = 0; ii < SIZE; ii++) {
      const r = goUp ? SIZE - 1 - ii : ii;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (c < 0 || fixed[r]![c]) continue;
        const bit =
          bi < totalBits ? (all[bi >> 3]! >> (7 - (bi & 7))) & 1 : 0;
        const masked = (r + c) % 3 === 0 ? bit ^ 1 : bit;
        set(r, c, masked === 1);
        bi++;
      }
    }
    col -= 2;
    goUp = !goUp;
  }

  return grid.map((row) => row.map((v) => v === 1));
}

/** Smallest version that fits, building the matrix. Throws when too long. */
export function buildMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const spec = specForLength(bytes.length);
  if (!spec) {
    throw new RangeError(
      `QR payload is ${bytes.length} bytes; maximum is ${QR_MAX_BYTES}`,
    );
  }
  return drawMatrix(bytes, spec);
}

export function drawQR(
  canvas: HTMLCanvasElement,
  text: string,
  fg: string,
  bg: string,
): boolean {
  try {
    const matrix = buildMatrix(text);
    const ctx2 = canvas.getContext("2d");
    if (!ctx2) return false;
    const size = matrix.length;
    const cell = canvas.width / size;
    ctx2.fillStyle = bg;
    ctx2.fillRect(0, 0, canvas.width, canvas.height);
    ctx2.fillStyle = fg;
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (matrix[r]![c]) ctx2.fillRect(c * cell, r * cell, cell, cell);
    return true;
  } catch {
    return false;
  }
}
