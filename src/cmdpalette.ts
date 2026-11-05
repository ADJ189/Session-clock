// ── Command Palette ───────────────────────────────────────────────────
// Ctrl+K / Cmd+K opens a VS Code-style search palette.
// Commands are grouped: Themes · Easter Eggs · Actions · Settings
// Headless controller logic lives in src/app/controllers/command-controller.ts.
// UI rendering is owned by src/app/modals/CommandPalette.svelte.

import {
  commandController,
  type CmdItem,
} from "./app/controllers/command-controller";

export type { CmdItem };

// ── Register commands ─────────────────────────────────────────────────
export function registerItems(items: CmdItem[]) {
  commandController.registerItems(items);
}

// ── Open / close ──────────────────────────────────────────────────────
export function open(prefill = "") {
  commandController.open(prefill);
}

export function close() {
  commandController.close();
}

export function isOpen(): boolean {
  return commandController.getIsOpen();
}

// ── Keyboard navigation & initialization ──────────────────────────────
export function initPalette() {
  // Retained for contract compatibility with existing bootstrap.
  // Reactive lifecycle and DOM listeners are handled by CommandPalette.svelte.
}
