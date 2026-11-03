// Pure service-worker helpers, kept in a classic script so both the worker
// (`importScripts`) and the Node unit tests can load the exact same logic.
//
// A service worker can be terminated between events; any in-memory global is
// therefore not durable. The cache name must be derivable from the script
// itself on every event. Vite stamps `__SC_BUILD_VERSION__` at build time;
// in dev the placeholder normalises to "dev".

(function (root) {
  "use strict";

  var CACHE_PREFIX = "session-clock-";
  var BUILD_PLACEHOLDER = "__SC_BUILD_VERSION__";

  function normalizeVersion(version) {
    var v = String(version == null ? "" : version).trim().toLowerCase();
    if (!v || v.indexOf("__") === 0) return "dev";
    return v.replace(/[^a-z0-9._-]/g, "").slice(0, 40) || "dev";
  }

  function cacheNameFor(version) {
    return CACHE_PREFIX + normalizeVersion(version);
  }

  function isSessionClockCache(key) {
    return typeof key === "string" && key.indexOf(CACHE_PREFIX) === 0;
  }

  function shouldDeleteCache(key, current) {
    return isSessionClockCache(key) && key !== current;
  }

  /** Extract the Vite build stamp from a service-worker source string. */
  function parseBuildVersion(source) {
    var m = /^\/\/\s*build:([a-z0-9._-]+)/im.exec(String(source || ""));
    return m ? m[1] : "";
  }

  function isCacheableExternal(host, allowlist) {
    if (!host) return false;
    if (typeof allowlist.has === "function") return allowlist.has(host);
    return Array.isArray(allowlist) && allowlist.indexOf(host) !== -1;
  }

  /** Only successful, non-opaque responses are safe to persist. */
  function isCacheableResponse(res) {
    return !!res && res.ok === true && (res.type === "basic" || res.type === "cors");
  }

  /** Cache Storage entries are for GET/HEAD only. */
  function isCacheableRequest(req) {
    if (!req) return false;
    if (req.method !== "GET" && req.method !== "HEAD") return false;
    if (req.headers && typeof req.headers.has === "function") {
      if (req.headers.has("Authorization")) return false;
    }
    return true;
  }

  root.ScSWCore = {
    CACHE_PREFIX: CACHE_PREFIX,
    BUILD_PLACEHOLDER: BUILD_PLACEHOLDER,
    normalizeVersion: normalizeVersion,
    cacheNameFor: cacheNameFor,
    isSessionClockCache: isSessionClockCache,
    shouldDeleteCache: shouldDeleteCache,
    parseBuildVersion: parseBuildVersion,
    isCacheableExternal: isCacheableExternal,
    isCacheableResponse: isCacheableResponse,
    isCacheableRequest: isCacheableRequest,
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
