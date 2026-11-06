import * as Motion from "../../motion";

const _graphemeSeg =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function leadingEmoji(msg: string): { icon: string; text: string } {
  const cp = msg.codePointAt(0);
  if (cp === undefined || !(cp >= 0x1f000 || (cp >= 0x2190 && cp <= 0x2bff))) {
    return { icon: "", text: msg };
  }
  if (_graphemeSeg) {
    const first = _graphemeSeg.segment(msg)[Symbol.iterator]().next().value;
    if (first) {
      let rest = msg.slice(first.segment.length);
      if (rest.startsWith(" ")) rest = rest.slice(1);
      return { icon: first.segment, text: rest };
    }
  }
  const chars = Array.from(msg);
  let i = 1;
  const cp1 = chars[1]?.codePointAt(0);
  if (
    cp >= 0x1f1e6 &&
    cp <= 0x1f1ff &&
    cp1 !== undefined &&
    cp1 >= 0x1f1e6 &&
    cp1 <= 0x1f1ff
  )
    i = 2; // regional-indicator flag pair
  while (chars[i] === "\uFE0F" || chars[i] === "\u200D") {
    i++;
    if (chars[i - 1] === "\u200D" && chars[i] !== undefined) i++; // swallow the codepoint the ZWJ joins to
  }
  const icon = chars.slice(0, i).join("");
  while (chars[i] === " ") i++;
  return { icon, text: chars.slice(i).join("") };
}

let _toastStack: HTMLElement | null = null;
function toastStack(): HTMLElement {
  if (_toastStack && _toastStack.isConnected) return _toastStack;
  const stack = document.createElement("div");
  stack.id = "scToastStack";
  stack.className = "sc-toast-stack";
  document.body.appendChild(stack);
  _toastStack = stack;
  return stack;
}

export function showToast(msg: string, duration = 3500) {
  if (typeof document === "undefined" || !document.body) return;
  const stack = toastStack();
  if (stack && stack.children) {
    while (stack.children.length >= 3) stack.firstElementChild?.remove(); // cap a burst of toasts
  }

  const { icon, text } = leadingEmoji(msg);
  const isWarn = icon === "⚠️" || icon === "⚠";

  const toast = document.createElement("div");
  toast.className = "sc-toast" + (isWarn ? " sc-toast--warn" : "");
  toast.setAttribute?.("role", "status");
  toast.setAttribute?.("aria-live", "polite");

  if (icon) {
    const tile = document.createElement("span");
    tile.className = "sc-toast-icon";
    tile.textContent = icon;
    toast.appendChild(tile);
  }
  const label = document.createElement("span");
  label.className = "sc-toast-text";
  label.textContent = text;
  toast.appendChild(label);

  stack.appendChild(toast);
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => toast.classList?.add("visible"));
  }
  void Motion.bounceIn(toast);

  const dismiss = () => {
    toast.classList?.remove("visible");
    toast.classList?.add("leaving");
    setTimeout(() => toast.remove?.(), 320);
  };
  const timer = setTimeout(dismiss, duration);
  toast.addEventListener?.(
    "click",
    () => {
      clearTimeout(timer);
      dismiss();
    },
    { once: true },
  );
}
