import type { VisualizerData } from '../player/analyser';

export interface AccentColor {
  h: number;
  s: number;
  l: number;
}

/**
 * Session Clock's existing renderer.ts does this same "canvas background
 * reacting to state" job for its 100+ themes on the main thread, so this
 * follows the same pattern rather than introducing OffscreenCanvas/worker
 * rendering here -- per the plan doc's own "start with zero workers, add
 * one only once a specific main-thread cost is measured" guidance, and
 * because this canvas needs to read the same accent-color custom
 * properties the DOM uses, which a worker can't see. What it does add:
 * pausing entirely when the tab is hidden, and honoring
 * prefers-reduced-motion instead of quietly ignoring it.
 */
export class CanvasVisualizer {
  private ctx: CanvasRenderingContext2D;
  private raf: number | null = null;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private particles: { x: number; y: number; r: number; vy: number; phase: number }[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private getFrequencies: () => VisualizerData,
    private getAccent: () => AccentColor
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else this.start();
    });
    window
      .matchMedia('(prefers-reduced-motion: reduce)')
      .addEventListener('change', (e) => (this.reducedMotion = e.matches));
    this.seedParticles();
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.canvas.clientWidth * dpr;
    this.canvas.height = this.canvas.clientHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private seedParticles(): void {
    const count = 28;
    this.particles = Array.from({ length: count }, () => ({
      x: Math.random() * this.canvas.clientWidth,
      y: Math.random() * this.canvas.clientHeight,
      r: 1 + Math.random() * 2.2,
      vy: 6 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2
    }));
  }

  start(): void {
    if (this.raf !== null || document.hidden) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.draw(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  private draw(dt: number): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const { h: hue, s, l } = this.getAccent();
    const { frequencies } = this.getFrequencies();

    this.ctx.clearRect(0, 0, w, h);

    // Soft vertical wash from the accent color, matching the now-playing bar's tint.
    const grad = this.ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `hsl(${hue} ${s}% ${Math.min(30, l)}% / 35%)`);
    grad.addColorStop(1, 'transparent');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    // Frequency bars along the bottom, mirrored for symmetry.
    const barCount = Math.min(48, frequencies.length);
    const barWidth = w / (barCount * 2);
    this.ctx.fillStyle = `hsl(${hue} ${Math.min(70, s + 10)}% 60% / 55%)`;
    for (let i = 0; i < barCount; i++) {
      const v = frequencies[i] / 255;
      const barH = this.reducedMotion ? 4 : v * h * 0.22;
      const x1 = w / 2 + i * barWidth;
      const x2 = w / 2 - (i + 1) * barWidth;
      this.ctx.fillRect(x1, h - barH, barWidth - 1, barH);
      this.ctx.fillRect(x2, h - barH, barWidth - 1, barH);
    }

    // Slow drifting particles -- pure ambience, unaffected by audio data.
    if (!this.reducedMotion) {
      this.ctx.fillStyle = `hsl(${hue} ${s}% 85% / 40%)`;
      for (const p of this.particles) {
        p.y -= p.vy * dt;
        if (p.y < -10) p.y = h + 10;
        const wob = Math.sin(performance.now() / 1000 + p.phase) * 6;
        this.ctx.beginPath();
        this.ctx.arc(p.x + wob, p.y, p.r, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
}
