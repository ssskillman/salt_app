// src/utils/debug.js

const MAX_LOGS = 400;
const STORAGE_KEY = "salt_debug_enabled";

const store = {
  enabled: (() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  })(),
  logs: [],
  listeners: new Set(),
};

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

function safeSerialize(value, depth = 0) {
  if (depth > 2) return "[MaxDepth]";
  if (value == null) return value;

  const t = typeof value;

  if (t === "string" || t === "number" || t === "boolean") return value;
  if (t === "function") return `[Function ${value.name || "anonymous"}]`;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => safeSerialize(v, depth + 1));
  }

  if (t === "object") {
    const out = {};
    const keys = Object.keys(value).slice(0, 30);
    for (const k of keys) {
      try {
        out[k] = safeSerialize(value[k], depth + 1);
      } catch {
        out[k] = "[Unserializable]";
      }
    }
    return out;
  }

  return String(value);
}

function emit() {
  for (const listener of store.listeners) {
    try {
      listener([...store.logs]);
    } catch {
      // no-op
    }
  }
}

function pushLog(level, args) {
  if (!store.enabled) return;

  const entry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: nowIso(),
    level,
    message: args
      .map((a) => {
        if (typeof a === "string") return a;
        try {
          return JSON.stringify(safeSerialize(a));
        } catch {
          return String(a);
        }
      })
      .join(" "),
    data: args.map((a) => safeSerialize(a)),
  };

  store.logs.push(entry);

  if (store.logs.length > MAX_LOGS) {
    store.logs.splice(0, store.logs.length - MAX_LOGS);
  }

  emit();
}

export function debugLog(...args) {
  pushLog("info", args);
}

export function debugWarn(...args) {
  pushLog("warn", args);
}

export function debugError(...args) {
  pushLog("error", args);
}

export function debugPerf(label, startMs, extra = {}) {
  const durationMs = Math.round((performance.now() - startMs) * 10) / 10;
  pushLog("perf", [{ label, durationMs, ...extra }]);
  return durationMs;
}

export function getDebugLogs() {
  return [...store.logs];
}

export function clearDebugLogs() {
  store.logs = [];
  emit();
}

export function subscribeDebugLogs(listener) {
  store.listeners.add(listener);
  listener([...store.logs]);

  return () => {
    store.listeners.delete(listener);
  };
}

export function isDebugEnabled() {
  return store.enabled;
}

export function setDebugEnabled(next) {
  store.enabled = Boolean(next);

  try {
    localStorage.setItem(STORAGE_KEY, String(store.enabled));
  } catch {
    // no-op
  }

  emit();
}