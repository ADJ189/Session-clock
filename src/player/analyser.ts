/**
 * Feeds visual/canvas.ts frequency data to react to. Two sources, chosen
 * automatically by what the current backend can actually offer:
 *
 * - AudioBackend (a real audio-url source): a genuine Web Audio
 *   AnalyserNode reading actual FFT data off the playing <audio> element.
 * - YouTubeIframeBackend: none exists. The IFrame Player's audio plays
 *   inside a separate, cross-origin browsing context, and the Web Audio
 *   API has no way to tap audio it doesn't own -- that's a browser
 *   security boundary, not a missing feature. Faking "reactive" data here
 *   would just be a canned animation pretending to respond to the music,
 *   so this returns a clearly-labeled ambient pulse instead: a slow,
 *   deterministic waveform driven by elapsed time, tuned to *look* alive
 *   without claiming to analyze audio it can't see.
 */

const FFT_SIZE = 256;

export interface VisualizerData {
  /** 0..255 per band, low → high frequency. Real FFT data, or the ambient fallback. */
  frequencies: Uint8Array;
  /** True only when `frequencies` comes from an actual AnalyserNode. */
  isRealAudioData: boolean;
}

export class AudioAnalyser {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private data: Uint8Array<ArrayBuffer>;
  private ambientStart = performance.now();

  constructor() {
    this.data = new Uint8Array(new ArrayBuffer(FFT_SIZE / 2));
  }

  /** Call once per new backend/track. Safe to call with `null` (iframe case) -- just detaches. */
  attach(el: HTMLMediaElement | null): void {
    this.source?.disconnect();
    this.source = null;
    if (!el) return;

    this.ctx ??= new AudioContext();
    this.analyser ??= (() => {
      const a = this.ctx!.createAnalyser();
      a.fftSize = FFT_SIZE;
      a.connect(this.ctx!.destination);
      return a;
    })();

    // A given <audio> element can only ever be wrapped by one
    // MediaElementAudioSourceNode -- each track gets a fresh element from
    // AudioBackend, so this only runs once per element, not once per call.
    this.source = this.ctx.createMediaElementSource(el);
    this.source.connect(this.analyser);
  }

  read(): VisualizerData {
    if (this.source && this.analyser) {
      this.analyser.getByteFrequencyData(this.data);
      return { frequencies: this.data, isRealAudioData: true };
    }
    return { frequencies: ambientPulse(this.data, this.ambientStart), isRealAudioData: false };
  }
}

function ambientPulse(out: Uint8Array, start: number): Uint8Array {
  const t = (performance.now() - start) / 1000;
  for (let i = 0; i < out.length; i++) {
    const band = i / out.length;
    // A few slow sine waves at different phases/frequencies per band --
    // reads as "breathing," not literally random noise, and never claims
    // to be frequency data from the actual track.
    const wave =
      Math.sin(t * 0.6 + band * 6) * 0.5 + Math.sin(t * 1.3 + band * 2) * 0.3 + Math.sin(t * 0.25) * 0.2;
    out[i] = Math.max(0, Math.min(255, Math.round((wave * 0.5 + 0.5) * 140)));
  }
  return out;
}
