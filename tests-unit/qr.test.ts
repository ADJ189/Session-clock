import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMatrix, qrVersionFor, QR_MAX_BYTES } from "../src/qr.ts";

const payload = (n: number, ch = "a") => ch.repeat(n);

test("QR picks the smallest M-level version for the byte length", () => {
  assert.strictEqual(qrVersionFor(payload(14)), 1);
  assert.strictEqual(qrVersionFor(payload(15)), 2);
  assert.strictEqual(qrVersionFor(payload(26)), 2);
  assert.strictEqual(qrVersionFor(payload(27)), 3);
  assert.strictEqual(qrVersionFor(payload(42)), 3);
  assert.strictEqual(qrVersionFor(payload(43)), 4);
  assert.strictEqual(qrVersionFor(payload(62)), 4);
  assert.strictEqual(qrVersionFor(payload(63)), 5);
  assert.strictEqual(qrVersionFor(payload(84)), 5);
  assert.strictEqual(qrVersionFor(payload(85)), 6);
  assert.strictEqual(qrVersionFor(payload(106)), 6);
  assert.strictEqual(qrVersionFor(payload(107)), 7);
  assert.strictEqual(qrVersionFor(payload(122)), 7);
  assert.strictEqual(qrVersionFor(payload(123)), 8);
  assert.strictEqual(qrVersionFor(payload(152)), 8);
  assert.strictEqual(qrVersionFor(payload(153)), 9);
  assert.strictEqual(qrVersionFor(payload(180)), 9);
  assert.strictEqual(qrVersionFor(payload(181)), 10);
  assert.strictEqual(qrVersionFor(payload(213)), 10);
  assert.strictEqual(qrVersionFor(payload(214)), 0);
});

test("QR counts UTF-8 bytes, not UTF-16 code units", () => {
  // "é" is two UTF-8 bytes: 7 characters is 14 bytes (v1), 8 is 16 (v2).
  assert.strictEqual(qrVersionFor("é".repeat(7)), 1);
  assert.strictEqual(qrVersionFor("é".repeat(8)), 2);
  assert.strictEqual(QR_MAX_BYTES, 213);
});

test("QR matrix sizes match their version", () => {
  assert.strictEqual(buildMatrix(payload(14)).length, 21);
  assert.strictEqual(buildMatrix(payload(84)).length, 37); // v5
  assert.strictEqual(buildMatrix(payload(107)).length, 45); // v7
  assert.strictEqual(buildMatrix(payload(213)).length, 57); // v10
});

test("QR raises instead of truncating an oversized payload", () => {
  assert.throws(() => buildMatrix(payload(214)), RangeError);
});

test("QR long payloads encode all bytes without silent truncation", () => {
  const a = JSON.stringify(buildMatrix(payload(120, "a")));
  const b = JSON.stringify(buildMatrix(payload(120, "b")));
  assert.notStrictEqual(a, b);
});

test("a realistic handoff URL encodes without truncation", () => {
  // A real handoff carries theme, session, Pomodoro phase/progress and a task
  // name — far above the old fixed 26-byte V2 payload, so a fixed-size encoder
  // silently dropped every query parameter after the host.
  const url =
    "https://sessionclock.app/?theme=midnight&ses=1&start=1&pom=1&pw=25&pb=5&pp=work&pe=45000&task=Finish%20the%20quarterly%20report";
  const bytes = new TextEncoder().encode(url).length;
  assert.ok(bytes > 26, `expected payload above the old 26-byte cap, got ${bytes}`);
  assert.ok(bytes <= QR_MAX_BYTES, `payload must fit the encoder, got ${bytes}`);

  const version = qrVersionFor(url);
  assert.ok(version >= 5 && version <= 10, `expected v5-v10, got v${version}`);
  const matrix = buildMatrix(url);
  assert.strictEqual(matrix.length, 17 + 4 * version);

  // Two URLs that share the first 26 bytes still produce different matrices,
  // proving the tail (task name) is encoded rather than truncated.
  const other = url.replace("quarterly", "annual");
  assert.notStrictEqual(JSON.stringify(matrix), JSON.stringify(buildMatrix(other)));
});

test("QR finder patterns, timing, and format info are well formed", () => {
  const matrix = buildMatrix("hello");
  const size = matrix.length;

  // Top-left finder: solid outer ring, light inner ring, dark 3x3 centre.
  assert.strictEqual(matrix[0]![0], true);
  assert.strictEqual(matrix[0]![6], true);
  assert.strictEqual(matrix[1]![1], false);
  assert.strictEqual(matrix[3]![3], true);

  // Timing row/column alternate starting dark at index 8.
  assert.strictEqual(matrix[6]![8], true);
  assert.strictEqual(matrix[6]![9], false);

  // EC level M + mask 2 format string (LSB-first in the matrix).
  let format = 0;
  for (let i = 0; i < 15; i++) {
    let r: number;
    let c: number;
    if (i < 6) {
      r = i;
      c = 8;
    } else if (i < 8) {
      r = i + 1;
      c = 8;
    } else {
      r = size - 15 + i;
      c = 8;
    }
    if (matrix[r]![c]) format |= 1 << i;
  }
  assert.strictEqual(format, 0b101111001111100);
});

test("QR versions 7+ carry the required version information", () => {
  const matrix = buildMatrix(payload(107)); // v7
  const size = matrix.length;
  let versionInfo = 0;
  for (let i = 0; i < 18; i++) {
    const r = Math.floor(i / 3);
    const c = size - 11 + (i % 3);
    if (matrix[r]![c]) versionInfo |= 1 << i;
  }
  assert.strictEqual(versionInfo, 0b000111110010010100);
});

test("QR mask 2 round-trip decodes v1, v2, v7, and v10 payloads", () => {
  function decodePayload(matrix: boolean[][], version: number): string {
    const size = matrix.length;
    const fixed: boolean[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }).fill(false) as boolean[],
    );
    const setFixed = (r: number, c: number) => {
      if (r >= 0 && r < size && c >= 0 && c < size) fixed[r]![c] = true;
    };
    const placeFinder = (top: number, left: number) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          setFixed(top + r, left + c);
        }
      }
    };
    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    for (let i = 8; i < size - 8; i++) {
      setFixed(6, i);
      setFixed(i, 6);
    }
    setFixed(size - 8, 8);

    // Format info cells
    for (let i = 0; i < 15; i++) {
      if (i < 6) setFixed(i, 8);
      else if (i < 8) setFixed(i + 1, 8);
      else setFixed(size - 15 + i, 8);

      if (i < 8) setFixed(8, size - 1 - i);
      else if (i < 9) setFixed(8, 15 - i - 1 + 1);
      else setFixed(8, 15 - i - 1);
    }

    const alignCoords: Record<number, number[]> = {
      1: [],
      2: [6, 18],
      7: [6, 22, 38],
      10: [6, 28, 50],
    };
    const coords = alignCoords[version] ?? [];
    for (const r of coords) {
      for (const c of coords) {
        if (
          (r === 6 && c === 6) ||
          (r === 6 && c === size - 7) ||
          (r === size - 7 && c === 6)
        )
          continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            fixed[r + dr]![c + dc] = true;
          }
        }
      }
    }

    if (version >= 7) {
      for (let i = 0; i < 18; i++) {
        fixed[Math.floor(i / 3)]![size - 11 + (i % 3)] = true;
        fixed[size - 11 + (i % 3)]![Math.floor(i / 3)] = true;
      }
    }

    const bits: number[] = [];
    let col = size - 1;
    let goUp = true;
    while (col >= 0) {
      if (col === 6) col--;
      for (let ii = 0; ii < size; ii++) {
        const r = goUp ? size - 1 - ii : ii;
        for (let dc = 0; dc < 2; dc++) {
          const c = col - dc;
          if (c < 0 || fixed[r]![c]) continue;
          const bit = matrix[r]![c] ? 1 : 0;
          const unmasked = c % 3 === 0 ? bit ^ 1 : bit;
          bits.push(unmasked);
        }
      }
      col -= 2;
      goUp = !goUp;
    }

    const dataBlockSpecs: Record<number, number[]> = {
      1: [16],
      2: [28],
      7: [31, 31, 31, 31],
      10: [43, 43, 43, 43, 44],
    };
    const blocks = dataBlockSpecs[version] ?? [16];
    const totalDataCodewords = blocks.reduce((a, b) => a + b, 0);

    // Read all codewords from data area (8 bits per codeword)
    let bi = 0;
    const allCodewords: number[] = [];
    for (let i = 0; i < totalDataCodewords; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bits[bi++]!;
      }
      allCodewords.push(b);
    }

    // De-interleave blocks
    const deinterleaved: number[][] = blocks.map(() => []);
    let ci = 0;
    const maxLen = Math.max(...blocks);
    for (let i = 0; i < maxLen; i++) {
      for (let b = 0; b < blocks.length; b++) {
        if (i < blocks[b]!) {
          deinterleaved[b]!.push(allCodewords[ci++]!);
        }
      }
    }
    const dataStream = deinterleaved.flat();

    // Now parse mode and char count from dataStream bits
    let bitIdx = 0;
    const readStreamBits = (len: number) => {
      let val = 0;
      for (let i = 0; i < len; i++) {
        const byte = dataStream[bitIdx >> 3]!;
        const bit = (byte >> (7 - (bitIdx & 7))) & 1;
        val = (val << 1) | bit;
        bitIdx++;
      }
      return val;
    };

    assert.strictEqual(readStreamBits(4), 0b0100, "byte mode expected");
    const count = readStreamBits(version <= 9 ? 8 : 16);
    const bytes: number[] = [];
    for (let i = 0; i < count; i++) {
      bytes.push(readStreamBits(8));
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  const v1Text = "hello world!";
  assert.strictEqual(decodePayload(buildMatrix(v1Text), 1), v1Text);

  const v2Text = "v2 payload test 123456";
  assert.strictEqual(decodePayload(buildMatrix(v2Text), 2), v2Text);

  const v7Text = payload(107, "v");
  assert.strictEqual(decodePayload(buildMatrix(v7Text), 7), v7Text);

  const v10Text = payload(210, "x");
  assert.strictEqual(decodePayload(buildMatrix(v10Text), 10), v10Text);
});
