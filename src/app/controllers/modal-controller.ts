// Modal lifecycle controller: open, close, focus trap, and lazy dialog mounting
import { soundMixerController } from "./sound-mixer-controller";
import { themeBuilderController } from "./theme-builder-controller";
import { settingsController } from "./settings-controller";
import * as Integrations from "../../integrations";
import * as Cmd from "../../cmdpalette";
import { showToast } from "../ui/toast";
import { THEMES } from "../../themes";
import type { Theme } from "../../types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const modalReturnFocus = new Map<HTMLElement, HTMLElement | null>();
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function modalPanel(overlay: HTMLElement): HTMLElement {
  return overlay.querySelector<HTMLElement>(".sc-modal") ?? overlay;
}

function onModalOpened(overlay: HTMLElement) {
  const panel = modalPanel(overlay);
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  if (
    !panel.hasAttribute("aria-label") &&
    !panel.hasAttribute("aria-labelledby")
  ) {
    const heading = panel.querySelector<HTMLElement>("h1, h2, h3");
    if (heading) {
      if (!heading.id) heading.id = `${overlay.id}-title`;
      panel.setAttribute("aria-labelledby", heading.id);
    }
  }
  if (!modalReturnFocus.has(overlay)) {
    const prev = document.activeElement as HTMLElement | null;
    modalReturnFocus.set(overlay, prev && prev !== document.body ? prev : null);
  }
  if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
  if (!panel.contains(document.activeElement))
    panel.focus({ preventScroll: true });

  if (overlay.id === "soundOverlay") {
    soundMixerController.startMeter();
    soundMixerController.applyNightMode();
  }
}

export function syncModalOpen() {
  const covering = document.querySelector(".sc-overlay.open:not(.minimized)");
  document.body.classList.toggle("modal-open", !!covering);
}

function onModalClosed(overlay: HTMLElement) {
  if (overlay.id === "soundOverlay") soundMixerController.stopMeter();
  const ret = modalReturnFocus.get(overlay);
  modalReturnFocus.delete(overlay);
  const active = document.activeElement;
  const focusLost =
    !active || active === document.body || overlay.contains(active);
  if (ret && ret.isConnected && focusLost) ret.focus({ preventScroll: true });
}

function trapModalTab(e: KeyboardEvent, overlay: HTMLElement) {
  if (e.key !== "Tab") return;
  if (!overlay.classList.contains("open")) return;
  const panel = modalPanel(overlay);
  const items = Array.from(
    panel.querySelectorAll<HTMLElement>(FOCUSABLE),
  ).filter((el) => el.offsetParent !== null);
  if (!items.length) {
    e.preventDefault();
    panel.focus();
    return;
  }
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

export function initModals(): void {
  const modalObserver = new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target as HTMLElement;
      const wasOpen = (r.oldValue ?? "").split(/\s+/).includes("open");
      const isOpen = el.classList.contains("open");
      if (isOpen && !wasOpen) {
        el.removeAttribute("aria-hidden");
        onModalOpened(el);
      } else if (!isOpen && wasOpen) {
        onModalClosed(el);
        if (!el.contains(document.activeElement))
          el.setAttribute("aria-hidden", "true");
      }
    }
    syncModalOpen();
  });

  const lateOverlayObserver = new MutationObserver(() => syncModalOpen());
  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement && n.classList.contains("sc-overlay")) {
          lateOverlayObserver.observe(n, {
            attributes: true,
            attributeFilter: ["class"],
          });
        }
      });
      if (r.removedNodes.length) syncModalOpen();
    }
    syncModalOpen();
  }).observe(document.body, { childList: true });

  document.querySelectorAll<HTMLElement>(".sc-overlay").forEach((el) => {
    modalObserver.observe(el, {
      attributes: true,
      attributeFilter: ["class"],
      attributeOldValue: true,
    });
    if (!el.classList.contains("open")) el.setAttribute("aria-hidden", "true");
    el.addEventListener("keydown", (e) => trapModalTab(e, el));
    el.addEventListener("click", (e) => {
      if (e.target === el) closeModal(el.id);
    });
  });

  window.SC = {
    ...window.SC,
    modals: { open: openModal, close: closeModal },
  };
}

let kbApp: any = null;
export const ensureKbModal = async () => {
  const container = document.getElementById("kbOverlay");
  if (!container || kbApp) return;
  const { mount } = await import("svelte");
  const KeyboardShortcutsDialog = (
    await import("../modals/KeyboardShortcutsDialog.svelte")
  ).default;
  kbApp = mount(KeyboardShortcutsDialog, {
    target: container,
    props: {
      onClose: () => closeModal("kbOverlay"),
    },
  });
};

let pomApp: any = null;
let pomPending: Promise<void> | null = null;
export const ensurePomModal = async (): Promise<void> => {
  const container = document.getElementById("pomOverlay");
  if (!container) return;
  if (pomApp) {
    if (typeof pomApp.refresh === "function") {
      pomApp.refresh();
    }
    return;
  }
  if (pomPending) {
    await pomPending;
    if (pomApp && typeof pomApp.refresh === "function") {
      pomApp.refresh();
    }
    return;
  }
  pomPending = (async () => {
    try {
      const { mount } = await import("svelte");
      const PomodoroDialog = (await import("../modals/PomodoroDialog.svelte")).default;
      container.innerHTML = "";
      pomApp = mount(PomodoroDialog, {
        target: container,
        props: {
          onClose: () => closeModal("pomOverlay"),
        },
      });
    } finally {
      pomPending = null;
    }
  })();
  await pomPending;
};

export function buildPomUI(): void {
  void ensurePomModal();
}

let dataPanelApp: any = null;
export async function openDataPanel(): Promise<void> {
  const target = document.getElementById("dataOverlay");
  if (target) {
    if (!dataPanelApp) {
      target.innerHTML = "";
      const { mount } = await import("svelte");
      const { default: DataManagementDialog } = await import(
        "../modals/DataManagementDialog.svelte"
      );
      dataPanelApp = mount(DataManagementDialog, { target });
    } else if (typeof dataPanelApp.refresh === "function") {
      dataPanelApp.refresh();
    }
  }
  openModal("dataOverlay");
}

let legalApp: any = null;
export async function openLegalPanel(doc: "privacy" | "terms"): Promise<void> {
  const container = document.getElementById("legalOverlay");
  if (!container) return;
  if (!legalApp) {
    try {
      const { mount } = await import("svelte");
      const LegalDialog = (await import("../modals/LegalDialog.svelte")).default;
      legalApp = mount(LegalDialog, {
        target: container,
        props: {
          initialDoc: doc,
          onClose: () => closeModal("legalOverlay"),
        },
      });
    } catch {
      showToast("Couldn't load this page. Please try again.");
      return;
    }
  } else {
    legalApp.setDoc?.(doc);
  }
  openModal("legalOverlay");
}

let languageApp: any = null;
export async function openLanguageModal(): Promise<void> {
  const container = document.getElementById("languageOverlay");
  if (!container) return;
  if (!languageApp) {
    const { mount } = await import("svelte");
    const LanguageDialog = (await import("../modals/LanguageDialog.svelte")).default;
    languageApp = mount(LanguageDialog, {
      target: container,
      props: {
        onClose: () => closeModal("languageOverlay"),
      },
    });
  }
  openModal("languageOverlay");
}

export function openThemeBuilder(): void {
  themeBuilderController.notify();
  openModal("themeBuilderOverlay");
}

let lastSettingsTab = "general";
export function openSettings(tab = lastSettingsTab): void {
  lastSettingsTab = tab;
  settingsController.openSettings(tab);
}

export function openIntegrations(): void {
  const el = document.getElementById("integrationsContent");
  if (el) Integrations.buildIntegrationsPanel(el, { showToast });
  document.getElementById("integrationsOverlay")?.classList.remove("minimized");
  openModal("integrationsOverlay");
}

export const openModal = (id: string): void => {
  if (id === "kbOverlay") void ensureKbModal();
  if (id === "pomOverlay") void ensurePomModal();
  const el = $(id);
  if (el) el.classList.add("open");
};

export const closeModal = (id: string): void => {
  const el = $(id);
  if (el) el.classList.remove("open");
};

export interface KeyboardShortcutsContext {
  onStartClick: () => void;
  onResetClick: () => void;
  getCurrentTheme: () => Theme;
  applyTheme: (theme: Theme) => void;
  toggleKiosk: () => void;
  togglePomodoro: () => void;
  toggleThemePanel: () => void;
  toggleZen: () => void;
  isZenOn: () => boolean;
}

export function setupKeyboardShortcuts(ctx: KeyboardShortcutsContext) {
  const SHORTCUTS: [string, string, () => void][] = [
    ["Space", "Start / Pause session timer", ctx.onStartClick],
    ["R", "Reset timer", ctx.onResetClick],
    [
      "T",
      "Cycle to next theme",
      () => {
        const current = ctx.getCurrentTheme();
        const idx = THEMES.indexOf(current);
        ctx.applyTheme(THEMES[(idx + 1) % THEMES.length]!);
      },
    ],
    ["Ctrl+K", "Command palette", () => Cmd.open()],
    ["/", "Easter egg search", () => Cmd.open("/")],
    ["F", "Toggle fullscreen / kiosk", ctx.toggleKiosk],
    ["P", "Toggle Pomodoro mode", ctx.togglePomodoro],
    [
      "M",
      "Open ambient sound mixer",
      () => {
        soundMixerController.notify();
        openModal("soundOverlay");
      },
    ],
    ["K", "Open the theme library", ctx.toggleThemePanel],
    ["Z", "Zen Mode — distraction-free study", ctx.toggleZen],
    ["G", "Open custom theme builder", openThemeBuilder],
    ["?", "Show shortcuts", () => openModal("kbOverlay")],
    [
      "Escape",
      "Close any open panel",
      () => {
        if (ctx.isZenOn()) {
          ctx.toggleZen();
          return;
        }
        document
          .querySelectorAll<HTMLElement>(".sc-overlay.open")
          .forEach((el) => closeModal(el.id));
      },
    ],
  ];

  document.addEventListener("keydown", (e) => {
    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      if (e.key === "Escape") (document.activeElement as HTMLElement).blur();
      return;
    }
    const hasOpen = document.querySelector(".sc-overlay.open");
    if (hasOpen && e.key !== "Escape") return;
    for (const [key, , action] of SHORTCUTS) {
      const ek = e.key.toLowerCase();
      const match =
        (key === "Space" && e.code === "Space") ||
        (key === "?" && (e.key === "?" || (e.code === "Slash" && e.shiftKey))) ||
        (key === "Escape" && e.key === "Escape") ||
        (key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          key.toLowerCase() === ek &&
          key !== "?");
      if (match) {
        e.preventDefault();
        action();
        return;
      }
    }
  });
}
