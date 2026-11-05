// Info strip — intelligence-powered rotating stats
import * as Intel from "../../intelligence";

const BASE_INFO_ITEMS = [
  () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const weekNum = Math.ceil(dayOfYear / 7);
    return `Week ${weekNum} · Day ${dayOfYear} of ${now.getFullYear()}`;
  },
  () => {
    const now = new Date();
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    const daysLeft = Math.ceil(
      (endOfYear.getTime() - now.getTime()) / 86400000,
    );
    return `${daysLeft} days left in ${now.getFullYear()}`;
  },
  () => {
    const now = new Date();
    const pct = (
      ((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) /
        86400) *
      100
    ).toFixed(1);
    return `${pct}% of today complete`;
  },
];

export function getAllInfoItems(): Array<() => string> {
  return [...Intel.getIntelligenceInsights(), ...BASE_INFO_ITEMS];
}

let infoIdx = 0;
export function rotateInfo() {
  const slide = document.getElementById("infoSlide");
  const label = document.getElementById("infoLabel");
  if (!slide || !label) return;
  slide.classList.add("leaving");
  setTimeout(() => {
    const items = getAllInfoItems();
    infoIdx = (infoIdx + 1) % items.length;
    label.textContent = items[infoIdx]!();
    slide.classList.remove("leaving");
    slide.style.animation = "none";
    void slide.offsetWidth;
    slide.style.animation = "";
  }, 420);
}

export function startInfoStrip() {
  const label = document.getElementById("infoLabel");
  const items0 = getAllInfoItems();
  if (label && items0[0]) label.textContent = items0[0]();
  setInterval(rotateInfo, 6000);
}
