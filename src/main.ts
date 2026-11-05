// Session Clock entry point
import { bootSessionClock, readiness } from "./app/bootstrap";

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

try {
  const bootPromise = bootSessionClock();
  if (bootPromise && typeof bootPromise.catch === "function") {
    bootPromise.catch(handleBootFailure);
  }
} catch (err) {
  handleBootFailure(err);
}
