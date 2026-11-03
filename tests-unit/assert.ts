// Tiny assertion helpers so the unit suite has no extra dependency. These
// tests should run in an offline checkout with only the already-installed npm
// cache and the Node.js runtime.

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

function show(value: unknown): string {
  try {
    return typeof value === "string" ? JSON.stringify(value) : String(value);
  } catch {
    return "<unprintable>";
  }
}

export function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new AssertionError(message);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const ak = Object.keys(a as Record<string, unknown>);
    const bk = Object.keys(b as Record<string, unknown>);
    return (
      ak.length === bk.length &&
      ak.every((k) =>
        deepEqual(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        )
      )
    );
  }
  return false;
}

export function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (deepEqual(actual, expected)) return;
  throw new AssertionError(
    message ?? `expected ${show(expected)}, got ${show(actual)}`,
  );
}

export function assertNotEquals<T>(actual: T, expected: T, message?: string): void {
  if (!Object.is(actual, expected)) return;
  throw new AssertionError(message ?? `did not expect ${show(expected)}`);
}

export function assertDeepEquals<T>(actual: T, expected: T, message?: string): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  throw new AssertionError(
    message ??
      `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

export function assertThrows(
  fn: () => unknown,
  message?: string,
): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new AssertionError(message ?? "expected function to throw");
}

export function assertMatch(value: string, pattern: RegExp, message?: string): void {
  if (pattern.test(value)) return;
  throw new AssertionError(
    message ?? `${show(value)} did not match ${pattern}`,
  );
}

export function assertNotMatch(value: string, pattern: RegExp, message?: string): void {
  if (!pattern.test(value)) return;
  throw new AssertionError(
    message ?? `${show(value)} unexpectedly matched ${pattern}`,
  );
}
