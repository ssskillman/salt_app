// src/utils/data.jsx

import { toNumber } from "./formatters.jsx";

// Sigma element data can arrive as:
// 1) array of row objects, or
// 2) columnar object: { colA: [...], colB: [...], ... }
export function zipColumnarToRows(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const keys = Object.keys(data);
  if (!keys.length) return [];

  const len = Math.max(...keys.map((k) => (Array.isArray(data[k]) ? data[k].length : 0)));

  const rows = [];
  for (let i = 0; i < len; i++) {
    const r = {};
    for (const k of keys) {
      const col = data[k];
      r[k] = Array.isArray(col) ? col[i] : null;
    }
    rows.push(r);
  }
  return rows;
}

// Sigma columns often look like:
// "inode-xxxxx/COLUMN_NAME" or similar.
// We just want the actual column key the row object uses.
//
// Make robust so cfgValue can be a string OR an object option/config.
export function resolveColumnKey(cfgValue, fallback = null) {
  if (!cfgValue) return fallback;

  // If the config value is already a string key
  if (typeof cfgValue === "string") {
    const parts = cfgValue.split("/");
    return parts[parts.length - 1] || cfgValue;
  }

  // If the config value is an object (Dropdown option, editorConfig item, etc.)
  if (typeof cfgValue === "object") {
    const raw =
      cfgValue.key ??
      cfgValue.columnKey ??
      cfgValue.value ?? // common for dropdowns {label, value}
      cfgValue.id ??
      cfgValue.name ??
      cfgValue.field ??
      fallback;

    if (!raw) return fallback;

    const s = String(raw);
    const parts = s.split("/");
    return parts[parts.length - 1] || s;
  }

  // Anything else (number/boolean/etc) -> treat like string
  const s = String(cfgValue);
  const parts = s.split("/");
  return parts[parts.length - 1] || s;
}

// normalize outcome to won/lost/open
export function normalizeOutcome(v) {
  const s = String(v ?? "").toLowerCase();

  if (s.includes("won")) return "won";
  if (s.includes("lost")) return "lost";

  // treat everything else as "open" (includes pipeline, open, commit, etc.)
  return "open";
}

/**
 * AE Performance: use for CEO counts/drills. Requires warehouse flag 1, but ignores the flag
 * when booked ACV or closed-won count on the same row contradicts it (common when dbt
 * `bookings_by_ae` misses deals due to `business_line` grain mismatch vs `sales_funnel`).
 */
export function aePerformanceRowSaltTrueZeroAcv(
  row,
  { zeroKey, bookedAcvKey = null, closedWonCountKey = null } = {}
) {
  if (!zeroKey || toNumber(row?.[zeroKey]) !== 1) return false;
  if (bookedAcvKey) {
    const b = toNumber(row?.[bookedAcvKey]);
    if (b != null && b > 0) return false;
  }
  if (closedWonCountKey) {
    const c = toNumber(row?.[closedWonCountKey]);
    if (c != null && c > 0) return false;
  }
  return true;
}
