// ── Ambient types for experimental Web APIs ─────────────────────────────
// TypeScript's bundled DOM lib doesn't yet include these (Battery Status,
// Document Picture-in-Picture, and iOS's gated DeviceMotionEvent
// permission prompt). Kept intentionally minimal — only the members this
// app actually touches in src/apis.ts — so we can use real types there
// instead of `as any`.

interface BatteryManager extends EventTarget {
  readonly level: number;
  readonly charging: boolean;
}

interface Navigator {
  /** Battery Status API — not implemented in Firefox/Safari, hence optional. */
  getBattery?: () => Promise<BatteryManager>;
}

interface DocumentPictureInPictureWindow extends Window {}

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<DocumentPictureInPictureWindow>;
}

interface Window {
  /** Document Picture-in-Picture API — Chrome 116+ only. */
  documentPictureInPicture?: DocumentPictureInPicture;
}

interface DeviceMotionEventConstructor {
  /** iOS 13+ gates motion events behind an explicit user-gesture permission prompt. */
  requestPermission?: () => Promise<'granted' | 'denied'>;
}
