// Custom Wallpaper Theme drop & dominant color sampling
import { showToast } from "../ui/toast";
import type { Theme } from "../../types";

export function lightenHex(hex: string, amt: number): string {
  if (!hex.startsWith("#")) return hex;
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 0xff) + 255 * amt));
  const g = Math.min(255, Math.round(((n >> 8) & 0xff) + 255 * amt));
  const b = Math.min(255, Math.round((n & 0xff) + 255 * amt));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function darkenHex2(hex: string, amt: number): string {
  if (!hex.startsWith("#")) return hex;
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amt)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amt)));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function initWallpaperDrop(
  getCurrentTheme: () => Theme,
  applyTheme: (theme: Theme, instant?: boolean) => void,
) {
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = cv.height = 16;
        const ctx = cv.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 16, 16);
        const px = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (let i = 0; i < px.length; i += 4) {
          const luma = 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
          if (luma < 20 || luma > 235) continue;
          r += px[i]!;
          g += px[i + 1]!;
          b += px[i + 2]!;
          n++;
        }
        if (n === 0) return;
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        const accent = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

        const current = getCurrentTheme();
        const wallTheme: Theme = {
          ...current,
          id: "wallpaper",
          name: "Wallpaper",
          accent,
          accent2: lightenHex(accent, 0.3),
          btnBg: accent + "22",
          btnFg: "#ffffff",
          glow: `0 0 55px ${accent}44`,
          hdr: true,
          baseBg: [
            darkenHex2(accent, 0.9),
            darkenHex2(accent, 0.85),
            darkenHex2(accent, 0.92),
          ],
        };

        document.body.style.backgroundImage = `url('${ev.target?.result as string}')`;
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.style.background = "rgba(0,0,0,0.55)";

        applyTheme(wallTheme, true);
        showToast("Wallpaper theme applied! Drop a new image to change.");
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
