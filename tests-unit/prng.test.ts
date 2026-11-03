import { test } from "node:test";
import { assertEquals, assertNotEquals } from "./assert.ts";
import { createRandom, SeededRandom } from "../src/audio/prng.ts";

test("seeded PRNG is reproducible", () => {
  const a = new SeededRandom(12345);
  const b = new SeededRandom(12345);
  for (let i = 0; i < 50; i++) assertEquals(a.next(), b.next());
});

test("different seeds diverge", () => {
  const a = new SeededRandom(1);
  const b = new SeededRandom(2);
  assertNotEquals([a.next(), a.next()], [b.next(), b.next()]);
});

test("next() stays in [0, 1)", () => {
  const r = createRandom(7);
  for (let i = 0; i < 2000; i++) {
    const v = r.next();
    assertEquals(v >= 0 && v < 1, true, `out of range: ${v}`);
  }
});

test("range() respects its bounds", () => {
  const r = createRandom(99);
  for (let i = 0; i < 1000; i++) {
    const v = r.range(-3, 4);
    assertEquals(v >= -3 && v < 4, true, `out of range: ${v}`);
  }
});

test("int() is inclusive on both ends and handles reversed input", () => {
  const r = createRandom(5);
  for (let i = 0; i < 2000; i++) {
    const v = r.int(3, 7);
    assertEquals(Number.isInteger(v), true);
    assertEquals(v >= 3 && v <= 7, true);
  }
  for (let i = 0; i < 200; i++) {
    const v = r.int(9, 2);
    assertEquals(v >= 2 && v <= 9, true);
  }
});

test("pm() is symmetric around zero", () => {
  const r = createRandom(11);
  for (let i = 0; i < 1000; i++) {
    const v = r.pm(2);
    assertEquals(v >= -2 && v < 2, true);
  }
});

test("chance() honours the probability extremes", () => {
  const r = createRandom(3);
  for (let i = 0; i < 100; i++) {
    assertEquals(r.chance(0), false);
    assertEquals(r.chance(1), true);
  }
});

test("pick() only returns members", () => {
  const r = createRandom(8);
  const items = ["a", "b", "c"] as const;
  for (let i = 0; i < 500; i++) {
    assertEquals(items.includes(r.pick(items)), true);
  }
});

test("gaussian() is finite and roughly centred", () => {
  const r = createRandom(21);
  let sum = 0;
  const n = 5000;
  for (let i = 0; i < n; i++) {
    const v = r.gaussian();
    assertEquals(Number.isFinite(v), true);
    sum += v;
  }
  assertEquals(Math.abs(sum / n) < 0.15, true, `mean=${sum / n}`);
});
