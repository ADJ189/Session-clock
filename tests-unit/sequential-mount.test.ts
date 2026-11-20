import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSerializedMounter,
  type SequencedMountTask,
} from "../src/app/services/sequential-mount.ts";

const target = {} as HTMLElement;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function task(
  load: () => Promise<string>,
  mounted: string[],
  unmounted: string[],
  onError?: (error: unknown, hasActive: boolean) => void,
): SequencedMountTask<string> {
  return {
    load,
    mount: (component) => {
      mounted.push(component);
      return component;
    },
    unmount: (instance) => {
      unmounted.push(instance as string);
    },
    onError,
  };
}

test("overlapping builds mount only the newest component", async () => {
  const mounter = createSerializedMounter();
  const first = deferred<string>();
  const second = deferred<string>();
  const mounted: string[] = [];
  const unmounted: string[] = [];

  const firstRun = mounter.run(
    task(() => first.promise, mounted, unmounted),
    target,
  );
  const secondRun = mounter.run(
    task(() => second.promise, mounted, unmounted),
    target,
  );

  // The first import resolves while the second is still pending: it must not
  // mount, because a newer build now owns the host.
  first.resolve("first");
  await firstRun;
  assert.deepStrictEqual(mounted, []);
  assert.strictEqual(mounter.hasActive(), false);

  second.resolve("second");
  await secondRun;
  assert.deepStrictEqual(mounted, ["second"]);
  assert.strictEqual(mounter.hasActive(), true);

  // A later build replaces the tracked instance instead of stacking another.
  const third = deferred<string>();
  const thirdRun = mounter.run(
    task(() => third.promise, mounted, unmounted),
    target,
  );
  third.resolve("third");
  await thirdRun;
  assert.deepStrictEqual(mounted, ["second", "third"]);
  assert.deepStrictEqual(unmounted, ["second"]);
});

test("a failed load keeps a working panel and reports it as still active", async () => {
  const mounter = createSerializedMounter();
  const mounted: string[] = [];
  const unmounted: string[] = [];

  await mounter.run(
    task(() => Promise.resolve("working"), mounted, unmounted),
    target,
  );
  assert.deepStrictEqual(mounted, ["working"]);

  const failures: boolean[] = [];
  await mounter.run(
    task(
      () => Promise.reject(new Error("chunk failed")),
      mounted,
      unmounted,
      (_error, hasActive) => failures.push(hasActive),
    ),
    target,
  );

  assert.deepStrictEqual(failures, [true]);
  assert.deepStrictEqual(mounted, ["working"]);
  assert.deepStrictEqual(unmounted, []);
  assert.strictEqual(mounter.hasActive(), true);
});

test("a failed first load reports no active panel and can be retried", async () => {
  const mounter = createSerializedMounter();
  const mounted: string[] = [];
  const unmounted: string[] = [];
  const failures: boolean[] = [];

  await mounter.run(
    task(
      () => Promise.reject(new Error("chunk failed")),
      mounted,
      unmounted,
      (_error, hasActive) => failures.push(hasActive),
    ),
    target,
  );
  assert.deepStrictEqual(failures, [false]);
  assert.strictEqual(mounter.hasActive(), false);

  await mounter.run(
    task(() => Promise.resolve("retried"), mounted, unmounted),
    target,
  );
  assert.deepStrictEqual(mounted, ["retried"]);
  assert.strictEqual(mounter.hasActive(), true);
});
