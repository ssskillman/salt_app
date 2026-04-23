// src/utils/formatters.jsx

export function toNumber(v) {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  
  const moneyFmt0 = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  
  const moneyCompact = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  
  const pctFmt0 = new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const pctFmt1 = new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const pctFmt2 = new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 2,
  });
  
  export function fmtMoney(v) {
    const n = toNumber(v);
    if (n == null) return "—";
    return moneyFmt0.format(n);
  }
  
  export function fmtMoneyCompact(v) {
    const n = toNumber(v);
    if (n == null) return "—";
    return moneyCompact.format(n);
  }
  
  // Accepts:
  // - decimals (0.87) OR whole percent (87) — heuristics normalize both.
  function normalizePct(v) {
    const n = toNumber(v);
    if (n == null) return null;
    // If someone passes 87, treat as 87% (0.87)
    if (Math.abs(n) > 1.5) return n / 100;
    return n;
  }
  
  export function fmtPct(v) {
    const n = normalizePct(v);
    if (n == null) return "—";
    return pctFmt0.format(n);
  }
  
  export function fmtPct1(v) {
    const n = normalizePct(v);
    if (n == null) return "—";
    return pctFmt1.format(n);
  }
  
  export function fmtPct2(v) {
    const n = normalizePct(v);
    if (n == null) return "—";
    return pctFmt2.format(n);
  }
  
  export function fmtX(v) {
    const n = toNumber(v);
    if (n == null) return "—";
    return `${n.toFixed(1)}x`;
  }
  
  export function fmtInt(v) {
    const n = toNumber(v);
    if (n == null) return "—";
    return Math.round(n).toLocaleString("en-US");
  }

  /**
   * Display label for the CEO business-line toggle (App state: "All" | "New Business" | "Gross Expansion").
   * Use in modals for the filter context pill, not for per-row Sigma values.
   */
  export function ceoBusinessLineDisplayLabel(selectedBl) {
    const s = String(selectedBl ?? "").trim();
    if (!s || s === "All") return "New Business & Gross Expansion";
    if (s === "New Business") return "New Business";
    if (s === "Gross Expansion") return "Gross Expansion";
    return s;
  }
