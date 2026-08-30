import './style.css';
import { PlayerEngine } from './player/engine';
import { YouTubeProvider } from './music/providers/youtube';
import { mountShell } from './ui/shell';
import { db, loadQueueState } from './storage/db';

async function getStoredYouTubeToken(): Promise<string | null> {
  // Wire this to Session Clock's existing OAuth flow: ensureFreshToken()
  // in integrations.ts already does this token refresh for the
  // 'youtube.readonly' scope used by the current musicdock.ts integration.
  const row = await db.settings.get('youtube-token');
  return (row?.value as string) ?? null;
}

async function bootstrap(): Promise<void> {
  const provider = new YouTubeProvider(getStoredYouTubeToken);
  await provider.connect();

  // A placeholder container at construction time -- mountShell below creates
  // the real #yt-surface node synchronously, and we hand it to the engine
  // right after. The engine never touches this container until the first
  // track actually needs the YouTube backend, so the swap is safe.
  const engine = new PlayerEngine(provider, document.createElement('div'));

  const root = document.getElementById('app')!;
  mountShell(root, engine, provider);

  const realSurface = document.getElementById('yt-surface');
  if (realSurface) engine.setIframeContainer(realSurface);

  const savedQueue = await loadQueueState();
  if (savedQueue && savedQueue.trackIds.length > 0) {
    // Restore the queue's contents/position silently, but don't call play()
    // -- browsers block autoplay without a user gesture anyway, and Session
    // Clock's own "opt-in, not always-on" stance says not to try.
    await engine.restoreQueue(savedQueue);
  }

  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW registration failed', err));
  }
}

void bootstrap();
