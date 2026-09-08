/** Click-to-compare: Board Forecast (anchor) vs Budget | Sales Forecast. */

export const BOARD_COMPARE = {
  board: "board",
  budget: "budget",
  sales: "sales",
};

/** Board Forecast currency basis on the CEO tile (click-to-toggle pill). */
export const BOARD_FORECAST_BASIS = {
  acv: "ACV",
  arr: "ARR",
};

/** Align CEO toggle values: All | New Business | Gross Expansion */
export function normalizeBoardForecastBusinessLine(businessLine) {
  const s = String(businessLine ?? "All").trim().toLowerCase();
  if (!s || s === "all") return "All";
  if (s.includes("new")) return "New Business";
  if (s.includes("exp")) return "Gross Expansion";
  return "All";
}

export function normalizeBoardForecastBasis(basis) {
  const s = String(basis ?? BOARD_FORECAST_BASIS.acv).trim().toUpperCase();
  return s === BOARD_FORECAST_BASIS.arr ? BOARD_FORECAST_BASIS.arr : BOARD_FORECAST_BASIS.acv;
}

/** Click cycles ACV ↔ ARR (default ACV). */
export function toggleBoardForecastBasis(basis) {
  return normalizeBoardForecastBasis(basis) === BOARD_FORECAST_BASIS.acv
    ? BOARD_FORECAST_BASIS.arr
    : BOARD_FORECAST_BASIS.acv;
}

/** Normalize "2027-Q3" and "FY27 Q3" to the same dataset key. */
function normalizeBoardForecastQuarter(fyqLabel) {
  const s = String(fyqLabel ?? "").trim().toUpperCase();
  if (!s || s === "—") return null;

  const match = s.match(/(?:FY)?\s*(\d{2,4})\D*Q([1-4])/);
  if (!match) return null;
  const year = match[1].length === 2 ? `20${match[1]}` : match[1];
  return `${year}-Q${match[2]}`;
}

function isAccessibleBoardForecastRow(row) {
  const value = row?.user_access;
  if (value == null || value === "") return true;
  return value === true || value === 1 || String(value).trim().toLowerCase() === "true";
}

function datasetBusinessLine(businessLine) {
  const s = String(businessLine ?? "").trim().toLowerCase();
  if (s === "new business") return "New Business";
  if (s === "gross expansion") return "Gross Expansion";
  return null;
}

export function parseBoardForecastJson(value) {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function mergeBoardForecastJsonRow(row, payloadKey) {
  if (!row || typeof row !== "object") return row;
  const payload = parseBoardForecastJson(payloadKey ? row[payloadKey] : null);
  return payload ? { ...payload, ...row } : row;
}

function boardForecastRowAmount(row, basis) {
  const suffix = basis === BOARD_FORECAST_BASIS.arr ? "arr" : "acv";
  const secured = row?.[`secured_board_forecast_${suffix}`];
  const fallback = row?.[`board_forecast_${suffix}`];
  const raw = secured == null || secured === "" ? fallback : secured;
  if (raw == null || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

/**
 * Resolve Board Forecast amount from normalized Sigma rows.
 * "All" is intentionally New Business + Gross Expansion, excluding churn.
 */
export function resolveBoardForecastAmount(
  rows,
  fyqLabel,
  businessLine = "All",
  basis = BOARD_FORECAST_BASIS.acv
) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const bl = normalizeBoardForecastBusinessLine(businessLine);
  const mode = normalizeBoardForecastBasis(basis);
  const quarter = normalizeBoardForecastQuarter(fyqLabel);
  if (!quarter) return null;

  const quarterRows = rows.filter(
    (row) =>
      isAccessibleBoardForecastRow(row) &&
      normalizeBoardForecastQuarter(row?.fiscal_yearquarter) === quarter
  );
  const wantedLines =
    bl === "All" ? ["New Business", "Gross Expansion"] : [bl];
  const amounts = wantedLines.map((line) => {
    const row = quarterRows.find(
      (candidate) => datasetBusinessLine(candidate?.business_line) === line
    );
    return row ? boardForecastRowAmount(row, mode) : null;
  });

  return amounts.every((value) => value != null)
    ? amounts.reduce((sum, value) => sum + value, 0)
    : null;
}

/** @deprecated Prefer resolveBoardForecastAmount(..., "ARR"). */
export function resolveBoardForecastArr(rows, fyqLabel, businessLine = "All") {
  return resolveBoardForecastAmount(rows, fyqLabel, businessLine, BOARD_FORECAST_BASIS.arr);
}

/**
 * Board Forecast display — compact $X.XM like sibling cards.
 * One-decimal millions (rounded): $6.057M → $6.1M · $14M → $14.0M · $6,873K → $6.9M.
 */
export function fmtBoardForecastArr(v) {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return "—";
  const millions = n / 1_000_000;
  const rounded =
    Math.sign(millions) * (Math.round(Math.abs(millions) * 10) / 10);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toFixed(1)}M`;
}

/**
 * @param {null | "board"} pick1
 * @param {"board" | "budget" | "sales"} clickedKey
 * @returns {{ pick1: null | "board", openModal: null | { anchor: "board", target: "budget" | "sales" } }}
 */
export function reduceBoardComparePick(pick1, clickedKey) {
  if (clickedKey === BOARD_COMPARE.board) {
    if (pick1 === BOARD_COMPARE.board) {
      return { pick1: null, openModal: null };
    }
    return { pick1: BOARD_COMPARE.board, openModal: null };
  }

  if (
    pick1 === BOARD_COMPARE.board &&
    (clickedKey === BOARD_COMPARE.budget || clickedKey === BOARD_COMPARE.sales)
  ) {
    return {
      pick1: null,
      openModal: { anchor: BOARD_COMPARE.board, target: clickedKey },
    };
  }

  return { pick1, openModal: null };
}

export function boardCompareTargetLabel(target) {
  if (target === BOARD_COMPARE.budget) return "Budget";
  if (target === BOARD_COMPARE.sales) return "Sales Forecast";
  return "—";
}

/**
 * Gap = board − target (null if either side missing).
 */
export function boardCompareGap(boardAmount, targetAmount) {
  if (boardAmount == null || targetAmount == null) return null;
  const b = Number(boardAmount);
  const t = Number(targetAmount);
  if (!Number.isFinite(b) || !Number.isFinite(t)) return null;
  return b - t;
}
