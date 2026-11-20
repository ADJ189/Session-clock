// Serializes async component mounting for a single host element.
//
// A panel builder usually looks like `await import(...); mount(...)`. Two
// overlapping calls can both get past the import, then each unmount/clear/mount
// — leaving two live instances while only the last one is tracked. Loading the
// component *before* touching the host, plus a generation counter, means only
// the most recently requested build is allowed to replace what is on screen.
export interface SequencedMountTask<C> {
  load: () => Promise<C>;
  mount: (component: C, target: HTMLElement) => unknown;
  unmount: (instance: unknown) => void;
  /** Runs after the load wins and the previous instance is unmounted. */
  prepare?: (target: HTMLElement) => void;
  /** `hasActive` is true when a previously mounted instance is still live. */
  onError?: (error: unknown, hasActive: boolean) => void;
}

export interface SerializedMounter {
  run<C>(task: SequencedMountTask<C>, target: HTMLElement): Promise<void>;
  unmount(): void;
  hasActive(): boolean;
}

export function createSerializedMounter(): SerializedMounter {
  let active: unknown = null;
  let activeUnmount: ((instance: unknown) => void) | null = null;
  let generation = 0;

  const report = <C>(
    task: SequencedMountTask<C>,
    error: unknown,
  ): void => {
    try {
      task.onError?.(error, active !== null);
    } catch {
      // A failure while rendering the error must not reject the caller.
    }
  };

  return {
    async run<C>(task: SequencedMountTask<C>, target: HTMLElement): Promise<void> {
      const current = ++generation;

      let component: C;
      try {
        component = await task.load();
      } catch (error) {
        // A superseded build stays silent: the newer call owns the outcome.
        if (current === generation) report(task, error);
        return;
      }

      // A newer build started while this component was loading. Do not touch
      // the host or the mounted instance; the newer build will decide.
      if (current !== generation) return;

      if (active !== null) {
        try {
          activeUnmount?.(active);
        } catch {
          // Already detached; clearing the reference below is enough.
        }
        active = null;
        activeUnmount = null;
      }

      try {
        task.prepare?.(target);
        active = task.mount(component, target);
        activeUnmount = task.unmount;
      } catch (error) {
        active = null;
        activeUnmount = null;
        report(task, error);
      }
    },

    unmount(): void {
      generation++;
      if (active !== null) {
        try {
          activeUnmount?.(active);
        } catch {
          // Nothing left to unmount.
        }
      }
      active = null;
      activeUnmount = null;
    },

    hasActive(): boolean {
      return active !== null;
    },
  };
}
