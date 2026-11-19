// Session Clock entry point
import * as Sentry from "@sentry/svelte";
import { bootSessionClock, readiness } from "./app/bootstrap";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "https://6521adb3a3809a6355223763098c154d@o4512456407515136.ingest.us.sentry.io/4512456762195968",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
  replaysSessionSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
});

function handleBootFailure(err: unknown) {
  readiness.bootStage = "boot-failed";
  window.__bootStage = "boot-failed";
  console.error("Session Clock failed to start:", err);
  const reason = err instanceof Error ? err.message : String(err);
  if (window.__scBootFail) {
    window.__scBootFail(reason, true);
  } else {
    window.__bootFailed = true;
  }
}

bootSessionClock().catch(handleBootFailure);
