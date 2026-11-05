export const THEME_CODE_PREFIX = "SCTHEME1:";
export const VALID_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.\s,%]+\))$/;

export const ON_ACCENT_DARK = "#06110c";
export const ON_ACCENT_LIGHT = "#ffffff";

/** Expand a single hex nibble (`f`) to its two-digit form (`ff`). */
export function expandHexPair(ch: string): number {
  return Number.parseInt(ch + ch, 16);
}

/** sRGB 8-bit channel → linear-light value, per WCAG 2.x. */
export function channelToLinear(channel: number): number {
  const c = Math.min(255, Math.max(0, channel)) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG relative luminance for a CSS hex (`#rgb`, `#rrggbb`, `#rrggbbaa`) or
 * `rgb()`/`rgba()` colour. Used only to pick readable ink for solid accent
 * fills, so alpha is ignored.
 */
export function relativeLuminance(color: string): number {
  let r = 0;
  let g = 0;
  let b = 0;
  const value = color.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      r = expandHexPair(hex.charAt(0));
      g = expandHexPair(hex.charAt(1));
      b = expandHexPair(hex.charAt(2));
    } else if (hex.length >= 6) {
      r = Number.parseInt(hex.slice(0, 2), 16);
      g = Number.parseInt(hex.slice(2, 4), 16);
      b = Number.parseInt(hex.slice(4, 6), 16);
    }
  } else {
    const parts = value.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      r = Number(parts[0]);
      g = Number(parts[1]);
      b = Number(parts[2]);
    }
  }
  if ([r, g, b].some((channel) => !Number.isFinite(channel))) return 0;
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

export function onAccentInk(color: string): string {
  const background = relativeLuminance(color);
  const contrast = (ink: string) => {
    const lum = relativeLuminance(ink);
    return (
      (Math.max(background, lum) + 0.05) / (Math.min(background, lum) + 0.05)
    );
  };
  return contrast(ON_ACCENT_DARK) >= contrast(ON_ACCENT_LIGHT)
    ? ON_ACCENT_DARK
    : ON_ACCENT_LIGHT;
}

export const rgbaToHex = (s: string): string => {
  const m = s.match(/[\d.]+/g);
  return m
    ? "#" +
        [m[0], m[1], m[2]]
          .map((v) => Number.parseInt(v).toString(16).padStart(2, "0"))
          .join("")
    : "#ffffff";
};

export const hexToRgb = (h: string): [number, number, number] => {
  const v = Number.parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

export const hexToHsl = (h: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(h).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return [Math.round(hue * 360), Math.round(s * 100), Math.round(l * 100)];
};

export const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
};
