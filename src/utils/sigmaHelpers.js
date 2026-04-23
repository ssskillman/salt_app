// src/utils/sigmaHelpers.js

// --- Config / column key helpers ---
export function colKey(sel) {
    if (!sel) return null;
    if (typeof sel === "string") return sel;
    return sel.id || sel.columnId || sel.name || null;
  }
  
  // --- Element data normalization (Sigma -> rows[]) ---
  // Sigma sometimes returns:
  // - rows[] (already)
  // - columnar object { colA: [..], colB: [..] }
  // We normalize to rows[].
  export function rowsFromElementData(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "object") return [];
  
    const keys = Object.keys(raw);
    if (!keys.length) return [];
  
    const n = Array.isArray(raw[keys[0]]) ? raw[keys[0]].length : 0;
    if (!n) return [];
  
    const rows = [];
    for (let i = 0; i < n; i++) {
      const r = {};
      for (const k of keys) r[k] = raw[k]?.[i] ?? null;
      rows.push(r);
    }
    return rows;
  }
  
  // --- parsing ---
  export function toNumber(v) {
    if (v == null) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
  
    const cleaned = String(v)
      .replace(/[$,%\s]/g, "")
      .replace(/,/g, "")
      .replace(/x$/i, "");
  
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  
  // --- column value extraction patterns ---
  export function values(rows, config, cfgKey) {
    const k = colKey(config?.[cfgKey]);
    if (!k || !rows?.length) return [];
    return rows.map((r) => r?.[k] ?? null);
  }
  
  export function firstString(rows, config, cfgKey) {
    const vals = values(rows, config, cfgKey);
    for (const v of vals) {
      if (v != null && String(v).trim() !== "") return v;
    }
    return null;
  }
  
  export function firstNumber(rows, config, cfgKey) {
    const vals = values(rows, config, cfgKey);
    for (const v of vals) {
      const n = toNumber(v);
      if (n != null) return n;
    }
    return null;
  }
  
  /**
   * smartNumber:
   * - If the column is a single repeated scalar across rows, return that scalar
   * - Otherwise, sum all numeric values (useful for filtered “money” totals)
   */
  export function smartNumber(rows, config, cfgKey) {
    const nums = values(rows, config, cfgKey)
      .map((v) => toNumber(v))
      .filter((n) => n != null);
  
    if (!nums.length) return null;
  
    const uniq = new Set(nums.map((n) => n.toFixed(9)));
    if (uniq.size === 1) return nums[0];
  
    return nums.reduce((a, b) => a + b, 0);
  }
  