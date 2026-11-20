// Session Clock entry point
import * as Sentry from "@sentry/svelte";
import { bootSessionClock, readiness } from "./app/bootstrap";

const dsn = import.meta.env.VITE_SENTRY_DSN;
const isPrivacyEnabled =
  typeof localStorage !== "undefined" &&
  localStorage.getItem("sc_privacy") === "1";

if (dsn && !isPrivacyEnabled) {
  Sentry.init({
    dsn,
    enabled: import.meta.env.PROD && !!dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      // Retain default masking (maskAllText: true, blockAllMedia: true) to protect user content
      // and explicitly protect sensitive integration regions
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        mask: [".sc-side-stack", ".sc-side-card", ".sentry-mask"],
        block: [".sentry-block"],
      }),
    ],
    beforeSend(event) {
      if (
        typeof localStorage !== "undefined" &&
        localStorage.getItem("sc_privacy") === "1"
      ) {
        return null;
      }
      return event;
    },
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
  });
}

function handleBootFailure(err: unknown) {
  readiness.bootStage = "boot-failed";
  window.__bootStage = "boot-failed";
  console.error("Session Clock failed to start:", err);
  Sentry.captureException(err);
  const reason = err instanceof Error ? err.message : String(err);
  if (window.__scBootFail) {
    window.__scBootFail(reason, true);
  } else {
    window.__bootFailed = true;
  }
}

bootSessionClock().catch(handleBootFailure);
