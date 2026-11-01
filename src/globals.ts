// Ambient augmentations kept in a real module so both `tsc` and `deno check`
// see them without relying on triple-slash references (which the linter
// rejects). `webapi.d.ts` carries the wider experimental-API surface; this
// file only repeats the members needed by modules that Deno type-checks in
// isolation (platform, perf, sound and the synthesis adapter).

export {};

declare global {
  interface AudioNode {
    /** Custom stop hook used by "stop proxy" gain nodes. */
    _customStop?: () => void;
    /** Guards scheduled sources against being started twice. */
    _started?: boolean;
  }

  interface NetworkInformationLike {
    saveData?: boolean;
    effectiveType?: "slow-2g" | "2g" | "3g" | "4g" | (string & {});
  }

  interface Navigator {
    /** iOS Safari home-screen (standalone) flag. */
    readonly standalone?: boolean;
    readonly connection?: NetworkInformationLike;
    readonly deviceMemory?: number;
  }
}
