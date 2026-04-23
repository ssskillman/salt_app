// src/hooks/useSigmaData.js

import { useMemo, useEffect, useRef } from "react";
import { client, useConfig, useElementData, useElementColumns } from "@sigmacomputing/plugin";
import { debugLog, debugWarn, debugError, isDebugEnabled } from "../utils/debug";

import { zipColumnarToRows, aePerformanceRowSaltTrueZeroAcv } from "../utils/data.jsx";
import { toNumber } from "../utils/formatters.jsx";
import { editorConfig } from "../app/editorConfig";

/**
 * Some Sigma elements can return "columnar" objects instead of row arrays.
 * This normalizes to rows (only used for calendar right now).
 */
function columnarToRows(columnar) {
  if (!columnar || typeof columnar !== "object") return [];
  if (Array.isArray(columnar)) return columnar;

  const colIds = Object.keys(columnar);
  if (colIds.length === 0) return [];

  const rowCount = Math.max(0, ...colIds.map((k) => (Array.isArray(columnar[k]) ? columnar[k].length : 0)));

  const rows = new Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    const r = {};
    for (const k of colIds) {
      r[k] = Array.isArray(columnar[k]) ? columnar[k][i] : undefined;
    }
    rows[i] = r;
  }
  return rows;
}

/**
 * IMPORTANT:
 * Sigma hooks should receive either a real element id string or `undefined`.
 * DO NOT pass "" (empty string) — it can be treated as a real id and throw.
 */
function asElementId(x) {
  return typeof x === "string" && x.trim().length ? x : undefined;
}

/**
 * Editor panel safety:
 * Sigma throws if any config entry is null/undefined or missing a `name`.
 */
function sanitizeEditorConfig(cfg) {
  if (!Array.isArray(cfg)) return [];
  const cleaned = cfg.filter((item) => item && typeof item.name === "string" && item.name.trim().length);

  if (cleaned.length !== cfg.length) {
    // eslint-disable-next-line no-console
    debugWarn(
      "[editorConfig] Dropped invalid entries:",
      cfg
        .map((x, i) => ({ i, x }))
        .filter(({ x }) => !(x && typeof x.name === "string" && x.name.trim().length))
    );
  }

  return cleaned;
}

function safeLen(arr) {
  return Array.isArray(arr) ? arr.length : 0;
}

function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function safeDivide(numerator, denominator, fallback = null) {
  const n = toNumber(numerator);
  const d = toNumber(denominator);
  if (n == null || d == null || d === 0) return fallback;
  return n / d;
}

function safeSubtract(a, b, fallback = null) {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na == null || nb == null) return fallback;
  return na - nb;
}

function sumWhere(rowsArr, predicate, valueFn) {
  if (!Array.isArray(rowsArr) || rowsArr.length === 0) return 0;
  return rowsArr.reduce((sum, row) => {
    if (!predicate(row)) return sum;
    const val = toNumber(valueFn(row));
    return sum + (val ?? 0);
  }, 0);
}

/**
 * Sigma plugin versions can return columns as:
 * - array: [{id, name, ...}, ...]
 * - object wrapper: { columns: [...] }
 * - sometimes other object shapes
 */
function normalizeCols(colsMeta) {
  if (Array.isArray(colsMeta)) return colsMeta;
  if (colsMeta && Array.isArray(colsMeta.columns)) return colsMeta.columns;
  if (colsMeta && Array.isArray(colsMeta.data)) return colsMeta.data;

  if (colsMeta && typeof colsMeta === "object") {
    const vals = Object.values(colsMeta);
    const maybeCols = vals.filter((v) => v && typeof v === "object" && ("id" in v || "name" in v));
    return maybeCols.length ? maybeCols : [];
  }

  return [];
}

/**
 * Resolve a config value (often an ID) into the actual key present in the row object.
 * Strategy:
 * 1) try config value directly (and "/suffix")
 * 2) if columns metadata is available, map id -> name and try both
 * 3) if row keys are "inode/.../COL", try endsWith matches
 */
function resolveRowKey(cfgVal, rowsArr, colsMeta) {
  if (cfgVal == null) return null;

  const row0 = Array.isArray(rowsArr) && rowsArr.length ? rowsArr[0] : null;
  const rowKeys = row0 ? Object.keys(row0) : [];
  const colsArr = normalizeCols(colsMeta);

  const candidates = [];
  const add = (v) => {
    if (v == null) return;
    const s = String(v).trim();
    if (!s) return;
    candidates.push(s);

    const parts = s.split("/");
    if (parts.length > 1) {
      const suffix = parts[parts.length - 1];
      if (suffix && suffix !== s) candidates.push(suffix);
    }
  };

  if (typeof cfgVal === "object") {
    add(cfgVal.name);
    add(cfgVal.field);
    add(cfgVal.columnKey);
    add(cfgVal.key);
    add(cfgVal.value);
    add(cfgVal.id);
  } else {
    add(cfgVal);
  }

  const rawToken =
    typeof cfgVal === "string" ? cfgVal : cfgVal?.id ?? cfgVal?.value ?? cfgVal?.key ?? cfgVal?.name ?? null;

  if (rawToken && colsArr.length) {
    const tok = String(rawToken);
    const tokSuffix = tok.split("/").pop();

    const hit =
      colsArr.find((c) => String(c?.id ?? "") === tok) ||
      colsArr.find((c) => String(c?.id ?? "") === tokSuffix) ||
      colsArr.find((c) => String(c?.name ?? "") === tok) ||
      colsArr.find((c) => String(c?.name ?? "") === tokSuffix);

    if (hit) {
      add(hit.name);
      add(hit.id);
      add(hit.columnKey);
      add(hit.key);
    }
  }

  if (!row0) return candidates.find(Boolean) ?? null;

  for (const c of candidates) {
    if (hasOwn(row0, c)) return c;
  }

  for (const c of candidates) {
    const hit = rowKeys.find((k) => k === c || k.endsWith(`/${c}`));
    if (hit) return hit;
  }

  return candidates.find(Boolean) ?? null;
}

/** Stable key per calendar month (NB / GE / combined rows share the same month). */
function closedTrendMonthKey(r) {
  const s = toNumber(r?.sort);
  if (Number.isFinite(s)) return `s:${s}`;
  const n = r?.name != null ? String(r.name).trim() : "";
  return `n:${n}`;
}

/** Last N calendar months by distinct month keys, keeping every business_line row in those months. */
function closedTrendRowsForLastNDistinctMonths(rows, n) {
  if (!Array.isArray(rows) || !rows.length || n <= 0) return [];
  const sorted = [...rows].sort((a, b) => {
    const as = a.sort ?? 999999;
    const bs = b.sort ?? 999999;
    if (as !== bs) return as - bs;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
  const pickedKeys = [];
  const seen = new Set();
  for (let i = sorted.length - 1; i >= 0 && pickedKeys.length < n; i--) {
    const k = closedTrendMonthKey(sorted[i]);
    if (seen.has(k)) continue;
    seen.add(k);
    pickedKeys.push(k);
  }
  const want = new Set(pickedKeys);
  return sorted.filter((r) => want.has(closedTrendMonthKey(r)));
}

/**
 * Sigma date values can arrive as:
 * - epoch millis
 * - epoch seconds
 * - ISO-ish strings
 * - JS Date objects
 *
 * We normalize to "YYYY-MM-DD" by default.
 */
function normalizeSigmaDateToISODate(value) {
  if (value == null) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isNaN(n) && Number.isFinite(n)) {
    const ms = n > 100_000_000_000 ? n : n > 10_000_000_000 ? n : n * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const s = String(value).trim();
  if (!s) return null;

  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];

  const d2 = new Date(s);
  if (!Number.isNaN(d2.getTime())) return d2.toISOString().slice(0, 10);

  return s;
}

// ----------------------------------------------------------------------------
// helpers to support CPO client-side mapping of selected account
// ----------------------------------------------------------------------------
function normStr(x) {
  return String(x ?? "").trim();
}

function normName(x) {
  return String(x ?? "").trim().toLowerCase();
}

function pick(row, keys) {
  if (!row || !keys?.length) return null;
  for (const k of keys) {
    const v = row?.[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}

function toBool(v) {
  if (typeof v === "boolean") return v;
  if (v == null) return false;

  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

function normKey(x) {
  return String(x ?? "").trim().toLowerCase();
}

function findRowKeyByCandidates(rowsArr, candidates = []) {
  if (!Array.isArray(rowsArr) || rowsArr.length === 0 || !Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const row0 = rowsArr[0] || {};
  const rowKeys = Object.keys(row0);

  for (const candidate of candidates) {
    const target = normKey(candidate);

    const exact = rowKeys.find((k) => normKey(k) === target);
    if (exact) return exact;

    const suffix = rowKeys.find((k) => normKey(k).endsWith(`/${target}`));
    if (suffix) return suffix;
  }

  return null;
}

function findResolvedKeyByCandidates(rowsArr, colsMeta, candidates = []) {
  if (!Array.isArray(rowsArr) || rowsArr.length === 0 || !Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const row0 = rowsArr[0] || {};
  const rowKeys = Object.keys(row0);
  const colsArr = normalizeCols(colsMeta);

  for (const candidate of candidates) {
    const target = normKey(candidate);

    const exactRowKey = rowKeys.find((k) => normKey(k) === target);
    if (exactRowKey) return exactRowKey;

    const suffixRowKey = rowKeys.find((k) => normKey(k).endsWith(`/${target}`));
    if (suffixRowKey) return suffixRowKey;

    const colHit =
      colsArr.find((c) => normKey(c?.name) === target) ||
      colsArr.find((c) => normKey(c?.label) === target) ||
      colsArr.find((c) => normKey(c?.title) === target) ||
      colsArr.find((c) => normKey(c?.id) === target) ||
      colsArr.find((c) => normKey(c?.columnKey) === target) ||
      colsArr.find((c) => normKey(c?.key) === target);

    if (colHit) {
      const possibleKeys = [colHit.id, colHit.name, colHit.columnKey, colHit.key]
        .filter(Boolean)
        .map((v) => String(v));

      for (const pk of possibleKeys) {
        const exact = rowKeys.find((k) => k === pk);
        if (exact) return exact;

        const suffix = rowKeys.find((k) => k.endsWith(`/${pk}`));
        if (suffix) return suffix;
      }
    }
  }

  return null;
}

/** When row keys are opaque UUIDs, match column metadata text to resolve the physical key. */
function findRowKeyByColumnLabelHints(rowsArr, colsMeta, hints) {
  if (!Array.isArray(rowsArr) || !rowsArr.length || !hints?.length) return null;
  const row0 = rowsArr[0] || {};
  const rowKeys = Object.keys(row0);
  const colsArr = normalizeCols(colsMeta);
  if (!colsArr.length) return null;

  for (const c of colsArr) {
    const blob = normKey([c?.name, c?.label, c?.title, c?.description].filter(Boolean).join(" "));
    if (!blob) continue;
    const ok = hints.every((h) => blob.includes(normKey(h)));
    if (!ok) continue;

    const possibleKeys = [c.id, c.name, c.columnKey, c.key].filter(Boolean).map((v) => String(v));
    for (const pk of possibleKeys) {
      const exact = rowKeys.find((k) => k === pk);
      if (exact) return exact;
      const suffix = rowKeys.find((k) => k.endsWith(`/${pk}`));
      if (suffix) return suffix;
    }
  }
  return null;
}

function getFirstNonEmptyStringForKey(rowsArr, key) {
  if (!key || !Array.isArray(rowsArr)) return null;
  for (const r of rowsArr) {
    const v = r?.[key];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function normalizeForecastCategory(value) {
  const s = normKey(value);

  if (!s) return null;
  if (s.includes("most likely")) return "forecast";
  if (s.includes("forecast")) return "forecast";
  if (s.includes("commit")) return "commit";
  if (s.includes("best")) return "best_case";
  if (s.includes("open")) return "open_pipeline";

  return null;
}

function buildForecastMetricRows(rowsArr) {
  const empty = {
    forecast: null,
    commit: null,
    best_case: null,
    open_pipeline: null,
    debug: {
      sourceShapeDetected: false,
      rowCount: safeLen(rowsArr),
      matchedRowCount: 0,
      categoryKey: null,
      amountKey: null,
      territoryKey: null,
      forecastingTypeKey: null,
      fiscalYearquarterKey: null,
      userNameKey: null,
      usedGlobalFilter: false,
      usedSalesForecastFilter: false,
      categoriesSeen: [],
      territoriesSeen: [],
      matchedRowsPreview: [],
      chosenValues: {
        forecast: null,
        commit: null,
        best_case: null,
        open_pipeline: null,
      },
    },
  };

  if (!Array.isArray(rowsArr) || rowsArr.length === 0) return empty;

  const categoryKey = findRowKeyByCandidates(rowsArr, [
    "forecast_category",
    "Forecast Category",
    "forecasting_item_category",
    "Forecasting Item Category",
    "category",
    "Category",
  ]);

  const amountKey = findRowKeyByCandidates(rowsArr, [
    "forecast_amount",
    "Forecast Amount",
    "amount",
    "Amount",
    "value",
    "Value",
  ]);

  const territoryKey = findRowKeyByCandidates(rowsArr, [
    "territory_name",
    "Territory Name",
    "territory",
    "Territory",
  ]);

  const forecastingTypeKey = findRowKeyByCandidates(rowsArr, [
    "forecasting_type",
    "Forecasting Type",
    "forecasting_type_name",
    "Forecasting Type Name",
    "type",
    "Type",
  ]);

  const fiscalYearquarterKey = findRowKeyByCandidates(rowsArr, [
    "fiscal_yearquarter",
    "Fiscal Yearquarter",
    "fyq",
    "FYQ",
    "quarter",
    "Quarter",
  ]);

  const userNameKey = findRowKeyByCandidates(rowsArr, [
    "user_name",
    "User Name",
    "owner_name",
    "Owner Name",
    "name",
    "Name",
  ]);

  if (!categoryKey || !amountKey) {
    return {
      ...empty,
      debug: {
        ...empty.debug,
        categoryKey,
        amountKey,
        territoryKey,
        forecastingTypeKey,
        fiscalYearquarterKey,
        userNameKey,
      },
    };
  }

  const matchedByCategory = {
    forecast: [],
    commit: [],
    best_case: [],
    open_pipeline: [],
  };

  let usedGlobalFilter = false;
  let usedSalesForecastFilter = false;
  let matchedRowCount = 0;
  const categoriesSeen = new Set();
  const territoriesSeen = new Set();
  const matchedRowsPreview = [];

  for (const r of rowsArr) {
    const territory = territoryKey ? normKey(r?.[territoryKey]) : "";
    const forecastingType = forecastingTypeKey ? normKey(r?.[forecastingTypeKey]).replace(/\s+/g, " ") : "";
    const categoryRaw = r?.[categoryKey];
    const category = normalizeForecastCategory(categoryRaw);
    const amount = toNumber(r?.[amountKey]);

    if (categoryRaw != null && String(categoryRaw).trim() !== "") {
      categoriesSeen.add(String(categoryRaw).trim());
    }

    if (territoryKey && r?.[territoryKey] != null && String(r?.[territoryKey]).trim() !== "") {
      territoriesSeen.add(String(r?.[territoryKey]).trim());
    }

    if (!category || amount == null) continue;

    if (territoryKey) {
      usedGlobalFilter = true;
      if (territory !== "global") continue;
    }

    if (forecastingTypeKey) {
      usedSalesForecastFilter = true;
      const isSalesForecast = forecastingType === "sales forecast" || forecastingType === "salesforecast";
      if (!isSalesForecast) continue;
    }

    matchedRowCount += 1;
    matchedByCategory[category].push(amount);

    if (matchedRowsPreview.length < 12) {
      matchedRowsPreview.push({
        category: String(categoryRaw ?? ""),
        amount,
        territory: territoryKey ? String(r?.[territoryKey] ?? "") : "",
        forecastingType: forecastingTypeKey ? String(r?.[forecastingTypeKey] ?? "") : "",
        fyq: fiscalYearquarterKey ? String(r?.[fiscalYearquarterKey] ?? "") : "",
        userName: userNameKey ? String(r?.[userNameKey] ?? "") : "",
      });
    }
  }

  const pickMetric = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return Math.max(...arr);
  };

  const result = {
    forecast: pickMetric(matchedByCategory.forecast),
    commit: pickMetric(matchedByCategory.commit),
    best_case: pickMetric(matchedByCategory.best_case),
    open_pipeline: pickMetric(matchedByCategory.open_pipeline),
    debug: {
      sourceShapeDetected: true,
      rowCount: safeLen(rowsArr),
      matchedRowCount,
      categoryKey,
      amountKey,
      territoryKey,
      forecastingTypeKey,
      fiscalYearquarterKey,
      userNameKey,
      usedGlobalFilter,
      usedSalesForecastFilter,
      categoriesSeen: Array.from(categoriesSeen),
      territoriesSeen: Array.from(territoriesSeen),
      matchedRowsPreview,
      chosenValues: {
        forecast: pickMetric(matchedByCategory.forecast),
        commit: pickMetric(matchedByCategory.commit),
        best_case: pickMetric(matchedByCategory.best_case),
        open_pipeline: pickMetric(matchedByCategory.open_pipeline),
      },
    },
  };

  // eslint-disable-next-line no-console
  debugLog("[SALT] buildForecastMetricRows result:", result);

  return result;
}

export function useSigmaData(params = {}) {
  const { cpoAccountId, cpoIterableOrgId, cpoAccountName } = params;
  const config = useConfig();

  useEffect(() => {
    try {
      if (!client?.config?.configureEditorPanel) return;
      const cleaned = sanitizeEditorConfig(editorConfig);
      client.config.configureEditorPanel(cleaned);
    } catch (e) {
      // eslint-disable-next-line no-console
      debugError("[Sigma] configureEditorPanel failed:", e);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Sources (element IDs)
  // ---------------------------------------------------------------------------
  const sources = {
    detail: config?.source_detail,
    company: config?.source_company,
    budget: config?.source_budget,
    horseman: config?.source_horseman,
    horsemanDetail: config?.source_horseman_detail,
    rollup: config?.rollup_source,
    drillCagr: config?.source_drill_cagr,

    drillVelocity: config?.source_drill_velocity,
    drillFunded: config?.source_drill_funded,
    largeDealsDetail: config?.source_large_deals_detail,

    cfoGm: config?.source_cfo_gm,
    pgPacing: config?.source_pg_pacing,

    cfoTreemap: config?.source_cfo_treemap,
    cfoTreemapDetail: config?.source_cfo_treemap_detail,

    waterfall: config?.source_waterfall,
    calendar: config?.calendar_source,

    aePerformance: config?.source_ae_performance,

    revintelTree: config?.source_revintel_tree,

    commitCard: config?.source_commit_card,
    createCloseCard: config?.source_create_close_card,
    createCloseDetail: config?.source_create_close_detail,

    closedTrend: config?.source_closed_trend,

    cpoAccounts: config?.cpo_accounts_source,

    accountNameParam: config?.source_account_name_param,

    employeeScopeOpportunitySpine: config?.source_employee_scope_opportunity_spine,

    largeDealsPyPayload: config?.source_large_deals_py_payload,

    productMixPayload: config?.source_product_mix_payload,

    drillForecastAttainmentPayload: config?.source_drill_forecast_attainment_payload,
  };

  // ---------------------------------------------------------------------------
  // Read element data
  // ---------------------------------------------------------------------------
  const raw = {
    detail: useElementData(asElementId(sources.detail)),
    company: useElementData(asElementId(sources.company)),
    budget: useElementData(asElementId(sources.budget)),
    horseman: useElementData(asElementId(sources.horseman)),
    horsemanDetail: useElementData(asElementId(sources.horsemanDetail)),
    rollup: useElementData(asElementId(sources.rollup)),
    drillCagr: useElementData(asElementId(sources.drillCagr)),

    drillVelocity: useElementData(asElementId(sources.drillVelocity)),
    drillForecastAttainment: useElementData(asElementId(sources.drillForecastAttainment)),
    drillFunded: useElementData(asElementId(sources.drillFunded)),
    largeDealsDetail: useElementData(asElementId(sources.largeDealsDetail)),

    cfoGm: useElementData(asElementId(sources.cfoGm)),
    pgPacing: useElementData(asElementId(sources.pgPacing)),

    cfoTreemap: useElementData(asElementId(sources.cfoTreemap)),
    cfoTreemapDetail: useElementData(asElementId(sources.cfoTreemapDetail)),

    waterfall: useElementData(asElementId(sources.waterfall)),
    calendar: useElementData(asElementId(sources.calendar)),

    aePerformance: useElementData(asElementId(sources.aePerformance)),

    revintelTree: useElementData(asElementId(sources.revintelTree)),

    commitCard: useElementData(asElementId(sources.commitCard)),
    createCloseCard: useElementData(asElementId(sources.createCloseCard)),
    createCloseDetail: useElementData(asElementId(sources.createCloseDetail)),

    closedTrend: useElementData(asElementId(sources.closedTrend)),

    cpoAccounts: useElementData(asElementId(sources.cpoAccounts)),

    accountNameParam: useElementData(asElementId(sources.accountNameParam)),

    employeeScopeOpportunitySpine: useElementData(asElementId(sources.employeeScopeOpportunitySpine)),

    largeDealsPyPayload: useElementData(asElementId(sources.largeDealsPyPayload)),

    productMixPayload: useElementData(asElementId(sources.productMixPayload)),

  };

  /**
   * Fixed-order hook calls (no loops).
   */
  const colsDetail = useElementColumns(asElementId(sources.detail));
  const colsCompany = useElementColumns(asElementId(sources.company));
  const colsBudget = useElementColumns(asElementId(sources.budget));
  const colsHorseman = useElementColumns(asElementId(sources.horseman));
  const colsHorsemanDetail = useElementColumns(asElementId(sources.horsemanDetail));
  const colsRollup = useElementColumns(asElementId(sources.rollup));
  const colsDrillCagr = useElementColumns(asElementId(sources.drillCagr));

  const colsDrillVelocity = useElementColumns(asElementId(sources.drillVelocity));
  const colsDrillForecastAttainment = useElementColumns(asElementId(sources.drillForecastAttainment));
  const colsDrillFunded = useElementColumns(asElementId(sources.drillFunded));
  const colsLargeDealsDetail = useElementColumns(asElementId(sources.largeDealsDetail));

  const colsCfoGm = useElementColumns(asElementId(sources.cfoGm));
  const colsPgPacing = useElementColumns(asElementId(sources.pgPacing));

  const colsCfoTreemap = useElementColumns(asElementId(sources.cfoTreemap));
  const colsCfoTreemapDetail = useElementColumns(asElementId(sources.cfoTreemapDetail));

  const colsWaterfall = useElementColumns(asElementId(sources.waterfall));
  const colsCalendar = useElementColumns(asElementId(sources.calendar));
  const colsAePerformance = useElementColumns(asElementId(sources.aePerformance));

  const colsRevintelTree = useElementColumns(asElementId(sources.revintelTree));
  const colsCommitCard = useElementColumns(asElementId(sources.commitCard));
  const colsCreateCloseCard = useElementColumns(asElementId(sources.createCloseCard));
  const colsCreateCloseDetail = useElementColumns(asElementId(sources.createCloseDetail));

  const colsClosedTrend = useElementColumns(asElementId(sources.closedTrend));

  const colsCpoAccounts = useElementColumns(asElementId(sources.cpoAccounts));
  const colsAccountNameParam = useElementColumns(asElementId(sources.accountNameParam));

  const colsEmployeeScopeOpportunitySpine = useElementColumns(asElementId(sources.employeeScopeOpportunitySpine));

  const colsLargeDealsPyPayload = useElementColumns(asElementId(sources.largeDealsPyPayload));

  const colsProductMixPayload = useElementColumns(asElementId(sources.productMixPayload));

  const rawDrillForecastAttainmentPayload = useElementData(asElementId(sources.drillForecastAttainmentPayload));
  const colsDrillForecastAttainmentPayload = useElementColumns(asElementId(sources.drillForecastAttainmentPayload));

  const columns = useMemo(
    () => ({
      detail: colsDetail,
      company: colsCompany,
      budget: colsBudget,
      horseman: colsHorseman,
      horsemanDetail: colsHorsemanDetail,
      rollup: colsRollup,
      drillCagr: colsDrillCagr,

      drillVelocity: colsDrillVelocity,
      drillForecastAttainment: colsDrillForecastAttainment,
      drillFunded: colsDrillFunded,
      largeDealsDetail: colsLargeDealsDetail,

      cfoGm: colsCfoGm,
      pgPacing: colsPgPacing,

      cfoTreemap: colsCfoTreemap,
      cfoTreemapDetail: colsCfoTreemapDetail,

      waterfall: colsWaterfall,
      calendar: colsCalendar,
      aePerformance: colsAePerformance,

      revintelTree: colsRevintelTree,
      commitCard: colsCommitCard,
      createCloseCard: colsCreateCloseCard,
      createCloseDetail: colsCreateCloseDetail,

      closedTrend: colsClosedTrend,

      cpoAccounts: colsCpoAccounts,
      accountNameParam: colsAccountNameParam,

      employeeScopeOpportunitySpine: colsEmployeeScopeOpportunitySpine,

      largeDealsPyPayload: colsLargeDealsPyPayload,

      productMixPayload: colsProductMixPayload,

      drillForecastAttainmentPayload: colsDrillForecastAttainmentPayload,
    }),
    [
      colsDetail,
      colsCompany,
      colsBudget,
      colsHorseman,
      colsHorsemanDetail,
      colsRollup,
      colsDrillCagr,
      colsDrillVelocity,
      colsDrillForecastAttainment,
      colsDrillFunded,
      colsLargeDealsDetail,
      colsCfoGm,
      colsPgPacing,
      colsCfoTreemap,
      colsCfoTreemapDetail,
      colsWaterfall,
      colsCalendar,
      colsAePerformance,
      colsRevintelTree,
      colsCommitCard,
      colsCreateCloseCard,
      colsCreateCloseDetail,
      colsClosedTrend,
      colsCpoAccounts,
      colsAccountNameParam,
      colsEmployeeScopeOpportunitySpine,
      colsLargeDealsPyPayload,
      colsProductMixPayload,
      colsDrillForecastAttainmentPayload,
    ]
  );

  const processRows = (source, rawData) => {
    if (!source || rawData == null) return [];

    if (Array.isArray(rawData)) return rawData;

    // Common Sigma wrapper shapes
    if (Array.isArray(rawData?.rows)) return rawData.rows;
    if (Array.isArray(rawData?.data)) return rawData.data;

    // If payload is columnar/object-shaped, normalize it
    const viaColumnar = columnarToRows(rawData);
    if (Array.isArray(viaColumnar) && viaColumnar.length) return viaColumnar;

    const viaZip = zipColumnarToRows(rawData);
    if (Array.isArray(viaZip) && viaZip.length) return viaZip;

    return [];
  };

  const rows = useMemo(
    () => ({
      detail: processRows(sources.detail, raw.detail),
      company: processRows(sources.company, raw.company),
      budget: processRows(sources.budget, raw.budget),
      horseman: processRows(sources.horseman, raw.horseman),
      horsemanDetail: processRows(sources.horsemanDetail, raw.horsemanDetail),
      rollup: processRows(sources.rollup, raw.rollup),
      drillCagr: processRows(sources.drillCagr, raw.drillCagr),

      drillVelocity: processRows(sources.drillVelocity, raw.drillVelocity),
      drillForecastAttainment: processRows(sources.drillForecastAttainment, raw.drillForecastAttainment),
      drillFunded: processRows(sources.drillFunded, raw.drillFunded),
      largeDealsDetail: processRows(sources.largeDealsDetail, raw.largeDealsDetail),

      cfoGm: processRows(sources.cfoGm, raw.cfoGm),
      pgPacing: processRows(sources.pgPacing, raw.pgPacing),

      cfoTreemap: processRows(sources.cfoTreemap, raw.cfoTreemap),
      cfoTreemapDetail: processRows(sources.cfoTreemapDetail, raw.cfoTreemapDetail),

      waterfall: processRows(sources.waterfall, raw.waterfall),

      calendar: columnarToRows(raw.calendar),

      aePerformance: processRows(sources.aePerformance, raw.aePerformance),

      revintelTree: processRows(sources.revintelTree, raw.revintelTree),

      commitCard: processRows(sources.commitCard, raw.commitCard),
      createCloseCard: processRows(sources.createCloseCard, raw.createCloseCard),
      createCloseDetail: processRows(sources.createCloseDetail, raw.createCloseDetail),

      closedTrend: processRows(sources.closedTrend, raw.closedTrend),

      cpoAccounts: processRows(sources.cpoAccounts, raw.cpoAccounts),

      accountNameParam: processRows(sources.accountNameParam, raw.accountNameParam),

      employeeScopeOpportunitySpine: processRows(sources.employeeScopeOpportunitySpine,raw.employeeScopeOpportunitySpine),

      largeDealsPyPayload: processRows(sources.largeDealsPyPayload, raw.largeDealsPyPayload),

      productMixPayload: processRows(sources.productMixPayload, raw.productMixPayload),

      drillForecastAttainmentPayload: processRows(sources.drillForecastAttainmentPayload,rawDrillForecastAttainmentPayload),
    }),
    [raw, sources]
  );

  debugLog("PY rows length:", rows.largeDealsPyPayload?.length);
  debugLog("PY source id:", sources.largeDealsPyPayload);
  debugLog("PY raw type:", typeof raw.largeDealsPyPayload);
  debugLog("PY raw keys:", raw.largeDealsPyPayload ? Object.keys(raw.largeDealsPyPayload) : []);
  debugLog("PY raw payload sample:", raw.largeDealsPyPayload);
  debugLog("PY rows length:", rows.largeDealsPyPayload?.length);
  debugLog("PY rows sample:", rows.largeDealsPyPayload?.slice?.(0, 3));

  const companyEffective = useMemo(() => {
    return rows.company.length
      ? { rows: rows.company, cols: columns.company }
      : { rows: rows.detail, cols: columns.detail };
  }, [rows.company, rows.detail, columns.company, columns.detail]);

  const rollupEffective = useMemo(() => {
    return rows.rollup.length ? { rows: rows.rollup, cols: columns.rollup } : companyEffective;
  }, [rows.rollup, columns.rollup, companyEffective]);

  const commitCardEffective = useMemo(() => {
    return rows.commitCard.length ? { rows: rows.commitCard, cols: columns.commitCard } : companyEffective;
  }, [rows.commitCard, columns.commitCard, companyEffective]);

  const createCloseCardEffective = useMemo(() => {
    return rows.createCloseCard.length
      ? { rows: rows.createCloseCard, cols: columns.createCloseCard }
      : companyEffective;
  }, [rows.createCloseCard, columns.createCloseCard, companyEffective]);

  const getColumnValues = (rowsArr, colsMeta, cfgKey) => {
    const cfgVal = config?.[cfgKey];
    const key = resolveRowKey(cfgVal, rowsArr, colsMeta);
    if (!key || !Array.isArray(rowsArr) || rowsArr.length === 0) return [];
    return rowsArr.map((r) => r?.[key] ?? null);
  };

  const getFirstString = (rowsArr, colsMeta, cfgKey) => {
    const vals = getColumnValues(rowsArr, colsMeta, cfgKey);
    return vals.find((v) => v != null && String(v).trim() !== "") || null;
  };

  const getFirstDateString = (rowsArr, colsMeta, cfgKey) => {
    const vals = getColumnValues(rowsArr, colsMeta, cfgKey);
    for (const v of vals) {
      const norm = normalizeSigmaDateToISODate(v);
      if (norm != null && String(norm).trim() !== "") return norm;
    }
    return null;
  };

  const getFirstNumber = (rowsArr, colsMeta, cfgKey) => {
    const vals = getColumnValues(rowsArr, colsMeta, cfgKey);
    for (const v of vals) {
      const n = toNumber(v);
      if (n != null) return n;
    }
    return null;
  };

  const getSmartMoney = (rowsArr, colsMeta, cfgKey) => {
    const vals = getColumnValues(rowsArr, colsMeta, cfgKey)
      .map(toNumber)
      .filter((n) => n != null);

    if (!vals.length) return null;

    const uniq = new Set(vals.map((n) => n.toFixed(9)));
    return uniq.size === 1 ? vals[0] : vals.reduce((a, b) => a + b, 0);
  };

  const getFirstStringByCandidates = (rowsArr, colsMeta, cfgKey, candidates = []) => {
    const mapped = getFirstString(rowsArr, colsMeta, cfgKey);
    if (mapped != null && String(mapped).trim() !== "") return mapped;

    if (!Array.isArray(rowsArr) || rowsArr.length === 0) return null;

    const row0 = rowsArr[0];
    const rowKeys = Object.keys(row0 || {});

    for (const candidate of candidates) {
      const exact = rowKeys.find((k) => String(k).trim().toLowerCase() === String(candidate).trim().toLowerCase());
      const suffix = rowKeys.find((k) => String(k).toLowerCase().endsWith(`/${String(candidate).toLowerCase()}`));
      const hit = exact || suffix;
      if (!hit) continue;

      for (const r of rowsArr) {
        const v = r?.[hit];
        if (v != null && String(v).trim() !== "") return v;
      }
    }

    return null;
  };

  const getFirstNumberByCandidates = (rowsArr, colsMeta, cfgKey, candidates = []) => {
    const mapped = getFirstNumber(rowsArr, colsMeta, cfgKey);
    if (mapped != null) return mapped;

    if (!Array.isArray(rowsArr) || rowsArr.length === 0) return null;

    const row0 = rowsArr[0];
    const rowKeys = Object.keys(row0 || {});

    for (const candidate of candidates) {
      const exact = rowKeys.find((k) => String(k).trim().toLowerCase() === String(candidate).trim().toLowerCase());
      const suffix = rowKeys.find((k) => String(k).toLowerCase().endsWith(`/${String(candidate).toLowerCase()}`));
      const hit = exact || suffix;
      if (!hit) continue;

      for (const r of rowsArr) {
        const n = toNumber(r?.[hit]);
        if (n != null) return n;
      }
    }

    return null;
  };

  const calendarKeys = useMemo(() => {
    return {
      dateKey: resolveRowKey(config?.calendar_date, rows.calendar, columns.calendar),
      valueKey: resolveRowKey(config?.calendar_value, rows.calendar, columns.calendar),
    };
  }, [config?.calendar_date, config?.calendar_value, rows.calendar, columns.calendar]);

  const cfoTreemapKeys = useMemo(() => {
    return {
      tm_bucket: resolveRowKey(config?.tm_bucket, rows.cfoTreemap, columns.cfoTreemap),
      tm_leaf: resolveRowKey(config?.tm_leaf_label, rows.cfoTreemap, columns.cfoTreemap),
      tm_fyq: resolveRowKey(config?.tm_fiscal_yearquarter, rows.cfoTreemap, columns.cfoTreemap),
      tm_level1: resolveRowKey(config?.tm_level1, rows.cfoTreemap, columns.cfoTreemap),
      tm_level2: resolveRowKey(config?.tm_level2, rows.cfoTreemap, columns.cfoTreemap),
      tm_level3: resolveRowKey(config?.tm_level3, rows.cfoTreemap, columns.cfoTreemap),
      tm_value: resolveRowKey(config?.tm_value, rows.cfoTreemap, columns.cfoTreemap),
      tm_color_value: resolveRowKey(config?.tm_color_value, rows.cfoTreemap, columns.cfoTreemap),
      tm_label: resolveRowKey(config?.tm_label, rows.cfoTreemap, columns.cfoTreemap),
    };
  }, [
    config?.tm_bucket,
    config?.tm_leaf_label,
    config?.tm_fiscal_yearquarter,
    config?.tm_level1,
    config?.tm_level2,
    config?.tm_level3,
    config?.tm_value,
    config?.tm_color_value,
    config?.tm_label,
    rows.cfoTreemap,
    columns.cfoTreemap,
  ]);

  const aePerformanceKeys = useMemo(() => {
    const aeUserIdKey =
      resolveRowKey(config?.ae_user_id, rows.aePerformance, columns.aePerformance) ||
      findResolvedKeyByCandidates(rows.aePerformance, columns.aePerformance, [
        "AE_USER_ID",
        "ae_user_id",
        "forecast_user_id",
        "Forecast User Id",
      ]);

    const aeNameKey =
      resolveRowKey(config?.ae_name, rows.aePerformance, columns.aePerformance) ||
      findResolvedKeyByCandidates(rows.aePerformance, columns.aePerformance, [
        "AE_NAME",
        "ae_name",
        "forecast_owner_name",
        "Forecast Owner Name",
      ]);

    return {
      aeUserIdKey,
      aeNameKey,
      aeIdKeyForGrouping: aeUserIdKey || aeNameKey,
      aeAt0AcvKey:
        resolveRowKey(config?.ae_is_at_0_acv, rows.aePerformance, columns.aePerformance) ||
        findResolvedKeyByCandidates(rows.aePerformance, columns.aePerformance, [
          "IS_AE_AT_0_ACV",
          "is_ae_at_0_acv",
        ]),
      aeOverThresholdKey:
        resolveRowKey(config?.ae_is_over_stage4_cov_threshold_3x, rows.aePerformance, columns.aePerformance) ||
        findResolvedKeyByCandidates(rows.aePerformance, columns.aePerformance, [
          "IS_AE_OVER_STAGE4_COV_THRESHOLD_3X",
          "is_ae_over_stage4_cov_threshold_3x",
        ]),
      dealsClosedKey:
        resolveRowKey(config?.ae_deals_closed, rows.aePerformance, columns.aePerformance) ||
        findResolvedKeyByCandidates(rows.aePerformance, columns.aePerformance, [
          "Deals Closed",
          "deals_closed",
          "CLOSED_WON_OPP_COUNT",
          "closed_won_opp_count",
        ]),
      aeBookedAcvKey:
        resolveRowKey(config?.ae_booked_acv, rows.aePerformance, columns.aePerformance) ||
        findResolvedKeyByCandidates(rows.aePerformance, columns.aePerformance, [
          "BOOKED_ACV",
          "booked_acv",
          "Booked Acv",
        ]),
      oldAboveThresholdKey:
        resolveRowKey(config?.ae_above_threshold, rows.aePerformance, columns.aePerformance) ||
        findResolvedKeyByCandidates(rows.aePerformance, columns.aePerformance, [
          "Above Threshold",
          "above_threshold",
        ]),
    };
  }, [
    config?.ae_user_id,
    config?.ae_name,
    config?.ae_is_at_0_acv,
    config?.ae_is_over_stage4_cov_threshold_3x,
    config?.ae_deals_closed,
    config?.ae_booked_acv,
    config?.ae_above_threshold,
    rows.aePerformance,
    columns.aePerformance,
  ]);

  const faKeys = useMemo(() => {
    return {
      fiscalYearKey:
        resolveRowKey(config?.fa_fiscal_year, rows.drillForecastAttainment, columns.drillForecastAttainment),
      fyqKey:
        resolveRowKey(config?.fa_fiscal_yearquarter, rows.drillForecastAttainment, columns.drillForecastAttainment),
      businessLineKey:
        resolveRowKey(config?.fa_business_line, rows.drillForecastAttainment, columns.drillForecastAttainment),
      promptedRowKey:
        resolveRowKey(config?.fa_prompted_row, rows.drillForecastAttainment, columns.drillForecastAttainment),
      qtdForecastKey:
        resolveRowKey(config?.fa_qtd_forecast, rows.drillForecastAttainment, columns.drillForecastAttainment),
      qtdClosedKey:
        resolveRowKey(config?.fa_qtd_closed, rows.drillForecastAttainment, columns.drillForecastAttainment),
      qtdAttainmentKey:
        resolveRowKey(config?.fa_qtd_attainment, rows.drillForecastAttainment, columns.drillForecastAttainment),
      ytdForecastKey:
        resolveRowKey(config?.fa_ytd_forecast, rows.drillForecastAttainment, columns.drillForecastAttainment),
      ytdClosedKey:
        resolveRowKey(config?.fa_ytd_closed, rows.drillForecastAttainment, columns.drillForecastAttainment),
      ytdAttainmentKey:
        resolveRowKey(config?.fa_ytd_attainment, rows.drillForecastAttainment, columns.drillForecastAttainment),
      quotaKey:
        resolveRowKey(config?.fa_quota, rows.drillForecastAttainment, columns.drillForecastAttainment),
      commitKey:
        resolveRowKey(config?.fa_commit, rows.drillForecastAttainment, columns.drillForecastAttainment),
      bestCaseKey:
        resolveRowKey(config?.fa_best_case, rows.drillForecastAttainment, columns.drillForecastAttainment),
      openPipelineKey:
        resolveRowKey(config?.fa_open_pipeline, rows.drillForecastAttainment, columns.drillForecastAttainment),
      qtdClosedVsForecastKey:
        resolveRowKey(
          config?.fa_qtd_closed_vs_forecast,
          rows.drillForecastAttainment,
          columns.drillForecastAttainment
        ),
    };
  }, [
    config?.fa_fiscal_year,
    config?.fa_fiscal_yearquarter,
    config?.fa_business_line,
    config?.fa_prompted_row,
    config?.fa_qtd_forecast,
    config?.fa_qtd_closed,
    config?.fa_qtd_attainment,
    config?.fa_ytd_forecast,
    config?.fa_ytd_closed,
    config?.fa_ytd_attainment,
    config?.fa_quota,
    config?.fa_commit,
    config?.fa_best_case,
    config?.fa_open_pipeline,
    config?.fa_qtd_closed_vs_forecast,
    rows.drillForecastAttainment,
    columns.drillForecastAttainment,
  ]);


  const dfKeys = useMemo(() => {
    return {
      dfOppIdKey:
        resolveRowKey(config?.df_opp_id, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "opp_id",
          "opportunity_id",
          "id",
        ]),

      dfOppNameKey:
        resolveRowKey(config?.df_opp_name, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "opp_name",
          "opportunity_name",
          "name",
        ]),

      dfOwnerNameKey:
        resolveRowKey(config?.df_owner_name, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "owner_name",
          "opp_owner_name",
          "opportunity_owner",
          "user_name",
        ]),

      dfCloseDateKey:
        resolveRowKey(config?.df_close_date, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "close_date",
          "opportunity_close_date",
        ]),

      dfOppStatusKey:
        resolveRowKey(config?.df_stage_name, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "opp_status",
          "stage_name",
          "opportunity_stage",
          "status",
        ]),

      dfManagerJudgmentKey:
        resolveRowKey(config?.df_manager_judgment, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "manager_judgment",
          "judgment",
        ]),

      dfAcvChangeKey:
        resolveRowKey(config?.df_acv_change, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "acv_change",
          "base_arr_growth",
        ]),

      dfIsClosedWonKey:
        resolveRowKey(config?.df_is_closed_won, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "is_closed_won",
        ]),

      dfIsInCategoryOpenKey:
        resolveRowKey(config?.df_is_in_category_open, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "is_in_category_open",
        ]),

      dfClosedWonAcvKey:
        resolveRowKey(config?.df_closed_won_acv, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "closed_won_acv",
        ]),

      dfInCategoryOpenAcvKey:
        resolveRowKey(config?.df_in_category_open_acv, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "in_category_open_acv",
        ]),

      dfFundedCommitAcvKey:
        resolveRowKey(config?.df_funded_commit_acv, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "funded_commit_acv",
        ]),

      dfFundedBucketKey:
        resolveRowKey(config?.df_funded_bucket, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "funded_bucket",
          "bucket",
        ]),

      dfFormulaRoleKey:
        resolveRowKey(config?.df_formula_role, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "formula_role",
          "role",
        ]),

      dfContributesToNumeratorKey:
        resolveRowKey(config?.df_contributes_to_numerator, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "contributes_to_numerator",
        ]),

      dfContributesToDenominatorKey:
        resolveRowKey(config?.df_contributes_to_denominator, rows.drillFunded, columns.drillFunded) ||
        findResolvedKeyByCandidates(rows.drillFunded, columns.drillFunded, [
          "contributes_to_denominator",
        ]),
    };
  }, [
    config?.df_opp_id,
    config?.df_opp_name,
    config?.df_owner_name,
    config?.df_close_date,
    config?.df_stage_name,
    config?.df_manager_judgment,
    config?.df_acv_change,
    config?.df_is_closed_won,
    config?.df_is_in_category_open,
    config?.df_closed_won_acv,
    config?.df_in_category_open_acv,
    config?.df_funded_commit_acv,
    config?.df_funded_bucket,
    config?.df_formula_role,
    config?.df_contributes_to_numerator,
    config?.df_contributes_to_denominator,
    rows.drillFunded,
    columns.drillFunded,
  ]);

  const faPayloadKey = useMemo(() => {
    return (
      resolveRowKey(config?.fa_payload, rows.drillForecastAttainmentPayload, columns.drillForecastAttainmentPayload) ||
      findRowKeyByCandidates(rows?.drillForecastAttainmentPayload || [], [
        "fa_payload",
        "Fa Payload",
        "FA_PAYLOAD",
        "payload",
        "Payload",
      ])
    );
  }, [config?.fa_payload, rows?.drillForecastAttainmentPayload, columns?.drillForecastAttainmentPayload]);

  const faPayloadRows = useMemo(() => {
    const src = Array.isArray(rows?.drillForecastAttainmentPayload)
        ? rows.drillForecastAttainmentPayload
        : [];

      if (!src.length || !faPayloadKey) return [];

      return src
        .map((r) => {
          const rawPayload = r?.[faPayloadKey];
          if (rawPayload == null || String(rawPayload).trim() === "") return null;

          try {
            if (typeof rawPayload === "string") {
              const parsed = JSON.parse(rawPayload);
              return Array.isArray(parsed) ? parsed[0] : parsed;
            }

            if (typeof rawPayload === "object") {
              return Array.isArray(rawPayload) ? rawPayload[0] : rawPayload;
            }

            return null;
          } catch (err) {
            debugWarn("Failed to parse Forecast Attainment payload row:", {
              rawPayload,
              err: String(err),
            });
            return null;
          }
        })
        .filter(Boolean);
    }, [rows?.drillForecastAttainmentPayload, faPayloadKey]);

  const data = useMemo(() => {
    // -----------------------------------------------------------------------
    // CALENDAR
    // -----------------------------------------------------------------------
    const { dateKey, valueKey } = calendarKeys;

    const orgKeys = ["iterable_org_id", "ITERABLE_ORG_ID", "iterable_org_id_c", "ITERABLE_ORG_ID_C", "org_id", "ORG_ID"];
    const acctKeys = ["account_id", "ACCOUNT_ID", "sf_account_id", "SF_ACCOUNT_ID"];

    const calendarProcessed = rows.calendar
      .map((r) => {
        if (!dateKey) return null;

        const rawDate = r?.[dateKey];
        const cleanDate = normalizeSigmaDateToISODate(rawDate);
        if (!cleanDate) return null;

        const val = valueKey ? toNumber(r?.[valueKey]) || 0 : 0;

        const out = {
          ...r,
          date: cleanDate,
          value: val,
        };

        const rOrg = normStr(pick(r, orgKeys));
        const rAcct = normStr(pick(r, acctKeys));
        if (rOrg) out._iterable_org_id = rOrg;
        if (rAcct) out._account_id = rAcct;

        return out;
      })
      .filter(Boolean);

    const selOrg = normStr(cpoIterableOrgId);
    const selAcct = normStr(cpoAccountId);

    const calendarFiltered =
      selOrg || selAcct
        ? calendarProcessed.filter((r) => {
            const rOrg = normStr(r?._iterable_org_id);
            const rAcct = normStr(r?._account_id);

            if (selOrg && rOrg && rOrg !== selOrg) return false;
            if (selAcct && rAcct && rAcct !== selAcct) return false;
            return true;
          })
        : calendarProcessed;

    // -----------------------------------------------------------------------
    // CFO Treemap config
    // -----------------------------------------------------------------------
    const {
      tm_bucket,
      tm_leaf,
      tm_fyq,
      tm_level1,
      tm_level2,
      tm_level3,
      tm_value,
      tm_color_value,
      tm_label,
    } = cfoTreemapKeys;

    const treemapMode = tm_bucket && tm_leaf ? "bucket_leaf" : "levels";

    const cfoTreemapConfig = {
      mode: treemapMode,
      bucketKey: tm_bucket || null,
      leafKey: tm_leaf || null,
      fyqKey: tm_fyq || null,
      level1Key: tm_level1 || null,
      level2Key: tm_level2 || null,
      level3Key: tm_level3 || null,
      valueKey: tm_value || null,
      colorKey: tm_color_value || null,
      labelKey: tm_label || null,
    };

    // -----------------------------------------------------------------------
    // AE counts (unique AEs)
    // -----------------------------------------------------------------------
    const {
      aeIdKeyForGrouping,
      aeAt0AcvKey,
      aeOverThresholdKey,
      dealsClosedKey,
      aeBookedAcvKey,
      oldAboveThresholdKey,
    } = aePerformanceKeys;

    let zeroDealsUnique = 0;
    let zeroAcvUnique = 0;
    let overThresholdUnique = 0;

    if (rows.aePerformance?.length && aeIdKeyForGrouping) {
      const zeroAcvIds = new Set();
      const overThresholdIds = new Set();
      const dealsTotals = new Map();

      for (const r of rows.aePerformance) {
        const id = r?.[aeIdKeyForGrouping];
        if (!id) continue;

        if (
          aeAt0AcvKey &&
          aePerformanceRowSaltTrueZeroAcv(r, {
            zeroKey: aeAt0AcvKey,
            bookedAcvKey: aeBookedAcvKey,
            closedWonCountKey: dealsClosedKey,
          })
        ) {
          zeroAcvIds.add(id);
        }

        if (aeOverThresholdKey && toNumber(r?.[aeOverThresholdKey]) === 1) {
          overThresholdIds.add(id);
        } else if (oldAboveThresholdKey && toNumber(r?.[oldAboveThresholdKey]) === 1) {
          overThresholdIds.add(id);
        }

        if (dealsClosedKey) {
          const deals = toNumber(r?.[dealsClosedKey]) || 0;
          dealsTotals.set(id, (dealsTotals.get(id) || 0) + deals);
        }
      }

      zeroAcvUnique = zeroAcvIds.size;
      zeroDealsUnique = Array.from(dealsTotals.values()).filter((v) => v === 0).length;
      overThresholdUnique = overThresholdIds.size;
    }

    // ------------------------------------------------------------
    // Velocity Drill build (dv)
    // ------------------------------------------------------------
    const dvNumerator = getFirstNumber(rows.drillVelocity, columns.drillVelocity, "dv_numerator");
    const dvDenominator = getFirstNumber(rows.drillVelocity, columns.drillVelocity, "dv_denominator");

    const dvClosed = getFirstNumber(rows.drillVelocity, columns.drillVelocity, "dv_closed_won");
    const dvCommit = getFirstNumber(rows.drillVelocity, columns.drillVelocity, "dv_commit_amt");

    const dvDaysElapsed = getFirstNumber(rows.drillVelocity, columns.drillVelocity, "dv_days_elapsed");
    const dvDaysTotal = getFirstNumber(rows.drillVelocity, columns.drillVelocity, "dv_days_total");
    const dvTimeElapsedPctProvided = getFirstNumber(rows.drillVelocity, columns.drillVelocity, "dv_time_elapsed_pct");

    const dvTimeElapsedPct =
      dvTimeElapsedPctProvided != null
        ? dvTimeElapsedPctProvided
        : dvDaysElapsed != null && dvDaysTotal != null && dvDaysTotal !== 0
          ? dvDaysElapsed / dvDaysTotal
          : null;

    const dvComputedFromND =
      dvNumerator != null && dvDenominator != null && dvDenominator !== 0 ? dvNumerator / dvDenominator : null;

    const dvComputedFromComponents =
      dvClosed != null && dvCommit != null && dvCommit !== 0 && dvTimeElapsedPct != null && dvTimeElapsedPct !== 0
        ? (dvClosed / dvCommit) / dvTimeElapsedPct
        : null;

    const dvComputed = dvComputedFromND ?? dvComputedFromComponents;

    const companyVelocity =
      getFirstNumber(companyEffective.rows, companyEffective.cols, "velocity_pct") ??
      getFirstNumber(rows.drillVelocity, columns.drillVelocity, "dv_velocity_pct") ??
      dvComputed;

    // ------------------------------------------------------------
    // Forecast Attainment Drill build (fa) — payload version
    // ------------------------------------------------------------
    const faHistoryRows = Array.isArray(faPayloadRows)
      ? [...faPayloadRows]
          .filter((r) => r?.fyq || r?.fiscalYear != null)
          .sort((a, b) => {
            if (a?.prompted && !b?.prompted) return -1;
            if (!a?.prompted && b?.prompted) return 1;
            return String(b?.fyq ?? "").localeCompare(String(a?.fyq ?? ""));
          })
      : [];

    const faCurrentRow =
      faHistoryRows.find((r) => !!r?.prompted) ||
      faHistoryRows[0] ||
      null;

    const fa = {
      fiscalYear: faCurrentRow?.fiscalYear ?? null,
      fyq: faCurrentRow?.fyq ?? null,
      bl: faCurrentRow?.businessLine ?? null,

      qtdForecast: toNumber(faCurrentRow?.qtdForecast),
      qtdClosed: toNumber(faCurrentRow?.qtdClosed),
      qtdClosedVsForecast: toNumber(faCurrentRow?.qtdClosedVsForecast),
      qtdAttainment: toNumber(faCurrentRow?.qtdAttainment),

      ytdForecast: toNumber(faCurrentRow?.ytdForecast),
      ytdClosed: toNumber(faCurrentRow?.ytdClosed),
      ytdAttainment: toNumber(faCurrentRow?.ytdAttainment),

      quota: toNumber(faCurrentRow?.quota),
      commit: toNumber(faCurrentRow?.commit),
      bestCase: toNumber(faCurrentRow?.bestCase),
      openPipeline: toNumber(faCurrentRow?.openPipeline),

      historyRows: faHistoryRows,
    };

    // ------------------------------------------------------------
    // Funded Drill build (df) — row-level funded_commit_detail source
    // ------------------------------------------------------------
    const dfFyq = getFirstStringByCandidates(rows.drillFunded, columns.drillFunded, "df_fiscal_yearquarter", [
      "fiscal_yearquarter",
      "fyq",
    ]);

    const dfFiscalYear = getFirstNumberByCandidates(rows.drillFunded, columns.drillFunded, "df_fiscal_year", [
      "fiscal_year",
    ]);

    const dfBusinessLine = getFirstStringByCandidates(rows.drillFunded, columns.drillFunded, "df_business_line", [
      "business_line",
      "businessline",
      "bl",
      "segment",
    ]);

    const dfSource = getFirstStringByCandidates(rows.drillFunded, columns.drillFunded, "df_source", [
      "source",
    ]);

const {
  dfOppIdKey,
  dfOppNameKey,
  dfOwnerNameKey,
  dfCloseDateKey,
  dfOppStatusKey,
  dfManagerJudgmentKey,
  dfAcvChangeKey,
  dfIsClosedWonKey,
  dfIsInCategoryOpenKey,
  dfClosedWonAcvKey,
  dfInCategoryOpenAcvKey,
  dfFundedCommitAcvKey,
  dfFundedBucketKey,
  dfFormulaRoleKey,
  dfContributesToNumeratorKey,
  dfContributesToDenominatorKey,
} = dfKeys;

    // eslint-disable-next-line no-console
    debugLog("[SALT] Funded detail resolved keys:", {
      dfOppIdKey,
      dfOppNameKey,
      dfOwnerNameKey,
      dfCloseDateKey,
      dfOppStatusKey,
      dfManagerJudgmentKey,
      dfAcvChangeKey,
      dfIsClosedWonKey,
      dfIsInCategoryOpenKey,
      dfClosedWonAcvKey,
      dfInCategoryOpenAcvKey,
      dfFundedCommitAcvKey,
      dfFundedBucketKey,
      dfFormulaRoleKey,
      dfContributesToNumeratorKey,
      dfContributesToDenominatorKey,
    });

    const dfDetailRows = Array.isArray(rows.drillFunded)
      ? rows.drillFunded.map((r, idx) => ({
          _row_id: `${idx}-${String(dfOppIdKey ? r?.[dfOppIdKey] ?? "" : "")}`,
          fiscalYearquarter: dfFyq ?? null,
          fiscalYear: dfFiscalYear ?? null,
          businessLine: dfBusinessLine ?? null,

          oppId: dfOppIdKey ? r?.[dfOppIdKey] ?? null : null,
          oppName: dfOppNameKey ? r?.[dfOppNameKey] ?? null : null,
          ownerName: dfOwnerNameKey ? r?.[dfOwnerNameKey] ?? null : null,
          closeDate: dfCloseDateKey ? normalizeSigmaDateToISODate(r?.[dfCloseDateKey]) : null,

          oppStatus: dfOppStatusKey ? r?.[dfOppStatusKey] ?? null : null,
          managerJudgment: dfManagerJudgmentKey ? r?.[dfManagerJudgmentKey] ?? null : null,

          acvChange: dfAcvChangeKey ? toNumber(r?.[dfAcvChangeKey]) : null,
          isClosedWon: dfIsClosedWonKey ? toNumber(r?.[dfIsClosedWonKey]) : null,
          isInCategoryOpen: dfIsInCategoryOpenKey ? toNumber(r?.[dfIsInCategoryOpenKey]) : null,

          closedWonAcv: dfClosedWonAcvKey ? toNumber(r?.[dfClosedWonAcvKey]) : null,
          inCategoryOpenAcv: dfInCategoryOpenAcvKey ? toNumber(r?.[dfInCategoryOpenAcvKey]) : null,
          fundedCommitAcv: dfFundedCommitAcvKey ? toNumber(r?.[dfFundedCommitAcvKey]) : null,
          fundedBucket: dfFundedBucketKey ? r?.[dfFundedBucketKey] ?? null : null,

          formulaRole: dfFormulaRoleKey ? r?.[dfFormulaRoleKey] ?? null : null,
          contributesToNumerator: dfContributesToNumeratorKey ? toNumber(r?.[dfContributesToNumeratorKey]) : 0,
          contributesToDenominator: dfContributesToDenominatorKey ? toNumber(r?.[dfContributesToDenominatorKey]) : 0,

          source: dfSource ?? null,
          __raw: r,
        }))
      : [];

    const dfNumerator = sumWhere(
      dfDetailRows,
      (r) => toNumber(r.contributesToNumerator) === 1,
      (r) => r.fundedCommitAcv
    );

    const dfDenominator = sumWhere(
      dfDetailRows,
      (r) => toNumber(r.contributesToDenominator) === 1,
      (r) => r.fundedCommitAcv
    );

    const dfComputed =
      dfDenominator != null && dfDenominator !== 0 ? dfNumerator / dfDenominator : null;

    const dfProvidedFundedPct = getFirstNumberByCandidates(rows.drillFunded, columns.drillFunded, "df_funded_pct", [
      "funded_pct",
      "pct_funded",
      "percent_funded",
    ]);

    const dfNumeratorLabel = "Closed Won";
    const dfDenominatorLabel = "Funded Commit";
    const dfTargetFundedPct = null;

    const dfNumeratorAndDenominatorRowCount = dfDetailRows.filter(
      (r) => toNumber(r.contributesToNumerator) === 1 && toNumber(r.contributesToDenominator) === 1
    ).length;

    const dfDenominatorOnlyRowCount = dfDetailRows.filter(
      (r) => toNumber(r.contributesToNumerator) !== 1 && toNumber(r.contributesToDenominator) === 1
    ).length;

    const dfNumeratorOnlyRowCount = dfDetailRows.filter(
      (r) => toNumber(r.contributesToNumerator) === 1 && toNumber(r.contributesToDenominator) !== 1
    ).length;

    const dfNeitherRowCount = dfDetailRows.filter(
      (r) => toNumber(r.contributesToNumerator) !== 1 && toNumber(r.contributesToDenominator) !== 1
    ).length;

    // ------------------------------------------------------------
    // CRO Revintel Tree
    // ------------------------------------------------------------
    const rt_fyq = resolveRowKey(config?.rt_fyq, rows.revintelTree, columns.revintelTree);

    const rt_lvl0 = resolveRowKey(config?.rt_lvl0, rows.revintelTree, columns.revintelTree);
    const rt_lvl1 = resolveRowKey(config?.rt_lvl1, rows.revintelTree, columns.revintelTree);
    const rt_lvl2 = resolveRowKey(config?.rt_lvl2, rows.revintelTree, columns.revintelTree);
    const rt_lvl3 = resolveRowKey(config?.rt_lvl3, rows.revintelTree, columns.revintelTree);
    const rt_lvl4 = resolveRowKey(config?.rt_lvl4, rows.revintelTree, columns.revintelTree);

    const rt_rollup = resolveRowKey(config?.rt_rollup_level, rows.revintelTree, columns.revintelTree);

    const rt_node_label = resolveRowKey(config?.rt_node_label, rows.revintelTree, columns.revintelTree);
    const rt_parent_label = resolveRowKey(config?.rt_parent_label, rows.revintelTree, columns.revintelTree);
    const rt_user_name = resolveRowKey(config?.rt_user_name, rows.revintelTree, columns.revintelTree);
    const rt_territory_name = resolveRowKey(config?.rt_territory_name, rows.revintelTree, columns.revintelTree);

    const rt_quota = resolveRowKey(config?.rt_quota, rows.revintelTree, columns.revintelTree);
    const rt_commit = resolveRowKey(config?.rt_commit, rows.revintelTree, columns.revintelTree);
    const rt_forecast = resolveRowKey(config?.rt_forecast, rows.revintelTree, columns.revintelTree);
    const rt_best = resolveRowKey(config?.rt_best_case, rows.revintelTree, columns.revintelTree);
    const rt_open = resolveRowKey(config?.rt_open_pipeline, rows.revintelTree, columns.revintelTree);

    const revintelTreeRows = (rows.revintelTree || []).map((r) => ({
      fyq: rt_fyq ? (r?.[rt_fyq] ?? null) : null,

      lvl0: rt_lvl0 ? (r?.[rt_lvl0] ?? null) : null,
      lvl1: rt_lvl1 ? (r?.[rt_lvl1] ?? null) : null,
      lvl2: rt_lvl2 ? (r?.[rt_lvl2] ?? null) : null,
      lvl3: rt_lvl3 ? (r?.[rt_lvl3] ?? null) : null,
      lvl4: rt_lvl4 ? (r?.[rt_lvl4] ?? null) : null,

      rollup_level: rt_rollup ? (toNumber(r?.[rt_rollup]) ?? null) : null,

      node_label: rt_node_label ? (r?.[rt_node_label] ?? null) : null,
      parent_label: rt_parent_label ? (r?.[rt_parent_label] ?? null) : null,
      user_name: rt_user_name ? (r?.[rt_user_name] ?? null) : null,
      territory_name: rt_territory_name ? (r?.[rt_territory_name] ?? null) : null,

      quota: rt_quota ? (toNumber(r?.[rt_quota]) ?? null) : null,
      commit: rt_commit ? (toNumber(r?.[rt_commit]) ?? null) : null,
      forecast: rt_forecast ? (toNumber(r?.[rt_forecast]) ?? null) : null,
      best_case: rt_best ? (toNumber(r?.[rt_best]) ?? null) : null,
      open_pipeline: rt_open ? (toNumber(r?.[rt_open]) ?? null) : null,
    }));

    // ------------------------------------------------------------
    // Budget (new dedicated source)
    // ------------------------------------------------------------
    const budgetManagerKey = resolveRowKey(config?.budget_manager, rows.budget, columns.budget);
    const budgetFyqKey = resolveRowKey(config?.budget_fiscal_yearquarter, rows.budget, columns.budget);
    const budgetMonthNameKey = resolveRowKey(config?.budget_month_name, rows.budget, columns.budget);
    const budgetAmountKey = resolveRowKey(config?.budget_amount, rows.budget, columns.budget);
    const budgetPromptedRowKey = resolveRowKey(config?.budget_prompted_row, rows.budget, columns.budget);

    const budgetDetailRows = Array.isArray(rows.budget)
      ? rows.budget.map((r, idx) => {
          const manager = budgetManagerKey ? r?.[budgetManagerKey] ?? null : null;
          const fiscalYearquarter = budgetFyqKey ? r?.[budgetFyqKey] ?? null : null;
          const monthName = budgetMonthNameKey ? r?.[budgetMonthNameKey] ?? null : null;
          const budgetAmount = budgetAmountKey ? toNumber(r?.[budgetAmountKey]) : null;
          const promptedRaw = budgetPromptedRowKey ? r?.[budgetPromptedRowKey] : null;

          const prompted =
            promptedRaw === true ||
            promptedRaw === "true" ||
            promptedRaw === "TRUE" ||
            promptedRaw === 1 ||
            promptedRaw === "1";

          return {
            _row_id: `${idx}-${String(manager ?? "")}-${String(monthName ?? "")}`,
            manager,
            fiscalYearquarter,
            monthName,
            budgetAmount,
            prompted,
            __raw: r,
          };
        })
      : [];

    const derivedBudget =
      budgetDetailRows.length > 0
        ? budgetDetailRows.reduce((sum, r) => {
            if (String(r?.manager ?? "").trim() !== "Total Company Target") return sum;
            if (!r?.prompted) return sum;
            return sum + (toNumber(r?.budgetAmount) || 0);
          }, 0)
        : null;

    // ------------------------------------------------------------
    // Commit card source
    // ------------------------------------------------------------
    const commitCardTerritoryKey =
      resolveRowKey(config?.cc_territory_name, commitCardEffective.rows, commitCardEffective.cols) ||
      findResolvedKeyByCandidates(commitCardEffective.rows, commitCardEffective.cols, [
        "territory_name",
        "Territory Name",
        "territory",
        "Territory",
      ]);

    const commitCardGlobalRows =
      commitCardTerritoryKey && Array.isArray(commitCardEffective.rows)
        ? commitCardEffective.rows.filter((r) => normKey(r?.[commitCardTerritoryKey]) === "global")
        : commitCardEffective.rows;

    // ------------------------------------------------------------
    // Commit card / company totals
    // ------------------------------------------------------------
    const commitCardForecastMetrics = buildForecastMetricRows(commitCardGlobalRows);
    const commitCardSourceDetected = !!commitCardForecastMetrics?.debug?.sourceShapeDetected;

    const companyCommitFallback = getSmartMoney(commitCardGlobalRows, commitCardEffective.cols, "cc_commit");
    const companyQuotaFallback = getSmartMoney(commitCardGlobalRows, commitCardEffective.cols, "cc_quota");
    const companyForecastFallback = getSmartMoney(commitCardGlobalRows, commitCardEffective.cols, "cc_forecast");
    const companyBestCaseFallback = getSmartMoney(commitCardGlobalRows, commitCardEffective.cols, "cc_best_case");
    const companyOpenPipelineFallback = getSmartMoney(commitCardGlobalRows, commitCardEffective.cols, "cc_open_pipeline");
    const companyClosedQTDFallback = getSmartMoney(companyEffective.rows, companyEffective.cols, "co_closed");

    const derivedCommit = commitCardSourceDetected ? commitCardForecastMetrics.commit : companyCommitFallback;
    const derivedQuota = companyQuotaFallback;
    const derivedForecast = commitCardSourceDetected ? commitCardForecastMetrics.forecast : companyForecastFallback;
    const derivedBestCase = commitCardSourceDetected ? commitCardForecastMetrics.best_case : companyBestCaseFallback;
    const derivedOpenPipeline = commitCardSourceDetected
      ? commitCardForecastMetrics.open_pipeline
      : companyOpenPipelineFallback;
    const derivedClosedQTD = fa?.qtdClosed ?? companyClosedQTDFallback;

//    const derivedGap =
//      getSmartMoney(companyEffective.rows, companyEffective.cols, "gap_to_commit") ??
//      safeSubtract(derivedCommit, derivedClosedQTD, null);

    const derivedGap = fa?.qtdClosedVsForecast ?? safeSubtract(derivedClosedQTD, derivedForecast, null);

    const derivedFinPlanQTD =
      fa?.qtdAttainment ??
      safeDivide(fa?.qtdClosed, fa?.qtdForecast, null) ??
      safeDivide(derivedClosedQTD, derivedForecast, null);

    const derivedFinPlanYR =
      fa?.ytdAttainment ??
      safeDivide(fa?.ytdClosed, fa?.ytdForecast, null) ??
      null;

    // ------------------------------------------------------------
    // Create & Close card
    // ------------------------------------------------------------
    const createCloseWonQtd = getSmartMoney(
      createCloseCardEffective.rows,
      createCloseCardEffective.cols,
      "ccc_closed_won_qtd_amt"
    );

    const createCloseOpenPipeQtd = getSmartMoney(
      createCloseCardEffective.rows,
      createCloseCardEffective.cols,
      "ccc_open_pipe_qtd_amt"
    );

    const createCloseWonQtdYoy = getFirstNumber(
      createCloseCardEffective.rows,
      createCloseCardEffective.cols,
      "ccc_closed_won_qtd_yoy_pct"
    );

    const createCloseOpenPipeQtdYoy = getFirstNumber(
      createCloseCardEffective.rows,
      createCloseCardEffective.cols,
      "ccc_open_pipe_qtd_yoy_pct"
    );

    // ------------------------------------------------------------
    // Closed Trend
    // ------------------------------------------------------------
    const ctBusinessLineKey = resolveRowKey(config?.ct_business_line, rows.closedTrend, columns.closedTrend);
    const ctMonthNameKey = resolveRowKey(config?.ct_month_name, rows.closedTrend, columns.closedTrend);
    const ctMonthSortKey = resolveRowKey(config?.ct_month_sort, rows.closedTrend, columns.closedTrend);
    const ctMonthlyAcvChangeKey = resolveRowKey(
      config?.ct_monthly_acv_change,
      rows.closedTrend,
      columns.closedTrend
    );
    const ctFiscalYearquarterKey = resolveRowKey(
      config?.ct_fiscal_yearquarter,
      rows.closedTrend,
      columns.closedTrend
    );

    const closedTrendAllRows = Array.isArray(rows.closedTrend)
      ? rows.closedTrend
          .map((r) => ({
            businessLine: ctBusinessLineKey ? r?.[ctBusinessLineKey] ?? null : null,
            name: ctMonthNameKey ? r?.[ctMonthNameKey] ?? null : null,
            sort: ctMonthSortKey ? toNumber(r?.[ctMonthSortKey]) : null,
            value: ctMonthlyAcvChangeKey ? toNumber(r?.[ctMonthlyAcvChangeKey]) : null,
            fiscalYearquarter: ctFiscalYearquarterKey ? r?.[ctFiscalYearquarterKey] ?? null : null,
          }))
          .filter((r) => r.name != null && String(r.name).trim() !== "" && r.value != null)
          .sort((a, b) => {
            const as = a.sort ?? 999999;
            const bs = b.sort ?? 999999;
            if (as !== bs) return as - bs;
            return String(a.name).localeCompare(String(b.name));
          })
      : [];

    const closedTrendCurrentFyq =
      getFirstString(rows.drillCagr, columns.drillCagr, "dr_fiscal_yearquarter") ??
      getFirstString(rows.drillVelocity, columns.drillVelocity, "dv_fiscal_yearquarter") ??
      getFirstString(rows.drillForecastAttainment, columns.drillForecastAttainment, "fa_fiscal_yearquarter") ??
    null;

    // QTD: prefer rows in the current FYQ when the slice is trustworthy.
    // With NB + GE + combined, `slice(-3)` is the last three *rows*, often the same month × 3 BL
    // → one bar. Use last 3 distinct *calendar months* and keep all BL rows for those months.
    const closedTrendQuarterRows = (() => {
      if (!closedTrendAllRows.length) return [];

      const sortClosedTrendRows = (arr) =>
        [...arr].sort((a, b) => {
          const as = a.sort ?? 999999;
          const bs = b.sort ?? 999999;
          if (as !== bs) return as - bs;
          return String(a.name ?? "").localeCompare(String(b.name ?? ""));
        });

      const trailing = sortClosedTrendRows(closedTrendRowsForLastNDistinctMonths(closedTrendAllRows, 3));

      if (!closedTrendCurrentFyq) return trailing;

      const fyqStr = String(closedTrendCurrentFyq);
      const byFyq = closedTrendAllRows.filter((r) => String(r.fiscalYearquarter ?? "") === fyqStr);
      const distinctMonths = new Set(byFyq.map(closedTrendMonthKey)).size;

      const bogusMatchedWholeHistory =
        !byFyq.length ||
        distinctMonths > 6 ||
        byFyq.length === closedTrendAllRows.length;

      if (bogusMatchedWholeHistory) return trailing;

      if (distinctMonths >= 3 && distinctMonths <= 4 && byFyq.length < closedTrendAllRows.length) {
        return sortClosedTrendRows(byFyq);
      }

      return trailing;
    })();

    // ------------------------------------------------------------
    // CPO: Account Name readback
    // ------------------------------------------------------------
    const sigmaAccountName = getFirstString(rows.accountNameParam, columns.accountNameParam, "account_name_param");

    const accountsRows = rows.cpoAccounts || [];
    const matched =
      sigmaAccountName && accountsRows.length
        ? accountsRows.find((a) => normName(a?.account_name) === normName(sigmaAccountName))
        : null;

    const selectedAccount = matched || (sigmaAccountName ? { account_name: sigmaAccountName } : null);

    /**
     * Resolve logged-in user email from Sigma rows (keys are often inode/.../Current_User_Email,
     * or opaque UUIDs with an email-shaped value in the cell).
     */
    const pickUserEmailFromRows = (rowsArr) => {
      if (!Array.isArray(rowsArr) || rowsArr.length === 0) return null;
      const row0 = rowsArr[0] || {};
      const keys = Object.keys(row0);
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

      const tail = (k) => (String(k).includes("/") ? String(k).split("/").pop() : String(k)) || "";
      const keyByExactTail = keys.find((k) => {
        const t = tail(k).replace(/\s+/g, "_");
        return (
          t === "Current_User_Email" ||
          t === "CURRENT_USER_EMAIL" ||
          t.toLowerCase() === "current_user_email"
        );
      });
      if (keyByExactTail) {
        for (const r of rowsArr) {
          const v = r?.[keyByExactTail];
          if (v != null && String(v).trim() !== "") return String(v).trim();
        }
      }

      const mailKeys = keys.filter((k) => {
        const t = tail(k).toLowerCase();
        return t.includes("email") || t.includes("e_mail");
      });
      for (const k of mailKeys) {
        for (const r of rowsArr) {
          const v = r?.[k];
          if (v != null && emailRx.test(String(v).trim())) return String(v).trim();
        }
      }

      const scored = [];
      for (const k of keys) {
        for (const r of rowsArr) {
          const v = r?.[k];
          if (v == null || !emailRx.test(String(v).trim())) continue;
          const t = tail(k).toLowerCase();
          let score = 0;
          if (t.includes("current") && t.includes("user")) score += 50;
          if (t.includes("sigma") && t.includes("user")) score += 40;
          if (t.includes("user") && t.includes("email")) score += 30;
          if (t.includes("email")) score += 10;
          scored.push({ k, score, val: String(v).trim() });
          break;
        }
      }
      if (!scored.length) return null;
      scored.sort((a, b) => b.score - a.score);
      return scored[0].val;
    };

    const currentUserEmailCandidates = [
      "Current_User_Email",
      "CURRENT_USER_EMAIL",
      "current_user_email",
      "Current User Email",
      "core · current user email",
      "Core · Current User Email",
      "sigma_user_email",
      "user_email",
    ];

    const resolveUserEmailString = (rowsArr, colsMeta) => {
      const byConfig = getFirstStringByCandidates(
        rowsArr,
        colsMeta,
        "current_user_email",
        currentUserEmailCandidates
      );
      if (byConfig) return byConfig;

      const byMetaKey =
        findResolvedKeyByCandidates(rowsArr, colsMeta, currentUserEmailCandidates) ||
        findRowKeyByColumnLabelHints(rowsArr, colsMeta, ["current", "user", "email"]) ||
        findRowKeyByColumnLabelHints(rowsArr, colsMeta, ["current_user", "email"]);
      const fromKey = getFirstNonEmptyStringForKey(rowsArr, byMetaKey);
      if (fromKey) return fromKey;

      return pickUserEmailFromRows(rowsArr);
    };

    return {
      currentUserFullName: getFirstStringByCandidates(
        rows.detail,
        columns.detail,
        "sigma_username",
        ["Current_User_Name", "current_user_full_name", "Current User Full Name", "sigma_username"]
      ),
      currentUserEmail:
        resolveUserEmailString(rows.detail, columns.detail) ??
        resolveUserEmailString(rows.commitCard, columns.commitCard) ??
        resolveUserEmailString(companyEffective.rows, companyEffective.cols),
      businessLine: getFirstString(rows.detail, columns.detail, "business_line"),
      calendarData: calendarFiltered,

      cfo: {
        treemapRows: rows.cfoTreemap || [],
        treemapConfig: cfoTreemapConfig,
      },

      cro: {
        revintelTreeRows,
      },

      cpo: {
        accountsRows,
        sigmaAccountName: sigmaAccountName ?? null,
        selectedAccount,
      },

      ae: {
        overThreshold: overThresholdUnique,
        zeroAtAcv: zeroAcvUnique,
        zeroDealsClosed: zeroDealsUnique,
      },

      co: {
        commit: derivedCommit,
        quota: derivedQuota,
        forecast: derivedForecast,
        best_case: derivedBestCase,
        open_pipeline: derivedOpenPipeline,

        finPlanQTD: derivedFinPlanQTD,
        finPlanYR: derivedFinPlanYR,
        closedQTD: derivedClosedQTD,
        budget: derivedBudget,

        r1: getSmartMoney(rollupEffective.rows, rollupEffective.cols, "rollup_plus_1_commit_amt"),
        r2: getSmartMoney(rollupEffective.rows, rollupEffective.cols, "rollup_plus_2_commit_amt"),

        cagr: null,
        stage4: getFirstNumber(companyEffective.rows, companyEffective.cols, "stage4_cvg"),
        velocity: companyVelocity,
//        funded: dfComputed ?? getFirstNumber(companyEffective.rows, companyEffective.cols, "funded_pct"),
        funded: dfComputed ?? dfProvidedFundedPct,
        gap: derivedGap,

        pipeGenAttainment: getFirstNumber(companyEffective.rows, companyEffective.cols, "pipeline_gen_attainment"),

        deals500k_won_qtd: getSmartMoney(companyEffective.rows, companyEffective.cols, "deals_500k_acv_qtd_n"),
        deals500k_won_qtd_yoy: getFirstNumber(companyEffective.rows, companyEffective.cols, "deals_500k_acv_qtd_yoy_pct"),
        deals500k_open_pipe_qtd: getSmartMoney(companyEffective.rows, companyEffective.cols, "deals_500k_open_pipe_n"),
        deals500k_open_pipe_yoy: getFirstNumber(companyEffective.rows, companyEffective.cols, "deals_500k_open_pipe_yoy_pct"),
        deals500k_py: getSmartMoney(companyEffective.rows, companyEffective.cols, "deals_500k_py_acv_n"),

        cc_won_qtd: createCloseWonQtd,
        cc_open_pipe_qtd: createCloseOpenPipeQtd,
        cc_won_qtd_yoy: createCloseWonQtdYoy,
        cc_open_pipe_qtd_yoy: createCloseOpenPipeQtdYoy,

        debug: {
          forecastSource: commitCardForecastMetrics.debug,
          commitCardSourceDetected,
          commitCardTerritoryKey,
          commitCardGlobalRowCount: safeLen(commitCardGlobalRows),
          createCloseSourceDetected: safeLen(rows.createCloseCard) > 0,
          createCloseDetailSourceDetected: safeLen(rows.createCloseDetail) > 0,
          finalChosenValues: {
            commit: derivedCommit,
            quota: derivedQuota,
            forecast: derivedForecast,
            best_case: derivedBestCase,
            open_pipeline: derivedOpenPipeline,
            closedQTD: derivedClosedQTD,
            budget: derivedBudget,
            gap: derivedGap,
            velocity: companyVelocity,
            funded: dfComputed ?? dfProvidedFundedPct,
            finPlanQTD: derivedFinPlanQTD,
            finPlanYR: derivedFinPlanYR,
            cc_won_qtd: createCloseWonQtd,
            cc_open_pipe_qtd: createCloseOpenPipeQtd,
            cc_won_qtd_yoy: createCloseWonQtdYoy,
            cc_open_pipe_qtd_yoy: createCloseOpenPipeQtdYoy,
          },
        },
      },

      d: {
        forecast: getSmartMoney(rows.detail, columns.detail, "forecast_amount"),
        bestCase: getSmartMoney(rows.detail, columns.detail, "best_case_amount"),
        pipe: getSmartMoney(rows.detail, columns.detail, "open_pipe"),
        closedFiltered: getSmartMoney(rows.detail, columns.detail, "closed_filtered"),
      },

      closedTrend: {
        currentFyq: closedTrendCurrentFyq,
        allRows: closedTrendAllRows,
        quarterRows: closedTrendQuarterRows,
      },

      dr: {
        fyq: getFirstString(rows.drillCagr, columns.drillCagr, "dr_fiscal_yearquarter"),
        bl: getFirstString(rows.drillCagr, columns.drillCagr, "dr_business_line"),
        cagrNotes: getFirstString(rows.drillCagr, columns.drillCagr, "dr_cagr_notes"),
        revenueSource: getFirstString(rows.drillCagr, columns.drillCagr, "dr_revenue_source"),
        acvChangeQtr: getFirstNumber(rows.drillCagr, columns.drillCagr, "dr_acv_change_qtr"),
        sameQtrAcvChangeCagr2yRate: getFirstNumber(
          rows.drillCagr,
          columns.drillCagr,
          "dr_same_qtr_acv_change_cagr_2y_rate"
        ),
        years: 2,

        closedQtr: {
          cagrRate: getFirstNumber(rows.drillCagr, columns.drillCagr, "dr_closed_qtr_total_acv_cagr_2y_rate"),
          endingTtm: getFirstNumber(rows.drillCagr, columns.drillCagr, "dr_closed_qtr_total_acv_cagr_ending_ttm"),
          beginningTtm2y: getFirstNumber(
            rows.drillCagr,
            columns.drillCagr,
            "dr_closed_qtr_total_acv_cagr_beginning_ttm_2y"
          ),
          beginFyq: getFirstString(
            rows.drillCagr,
            columns.drillCagr,
            "dr_closed_qtr_cagr_beginning_fiscal_yearquarter_2y"
          ),
          endFyq: getFirstString(
            rows.drillCagr,
            columns.drillCagr,
            "dr_closed_qtr_cagr_ending_fiscal_yearquarter"
          ),
        },

        rolling: {
          cagrRate: getFirstNumber(rows.drillCagr, columns.drillCagr, "dr_rolling_total_acv_cagr_2y_rate"),
          endingTtm: getFirstNumber(rows.drillCagr, columns.drillCagr, "dr_rolling_total_acv_cagr_ending_ttm"),
          beginningTtm2y: getFirstNumber(
            rows.drillCagr,
            columns.drillCagr,
            "dr_rolling_total_acv_cagr_beginning_ttm_2y"
          ),
          beginFyq: getFirstString(
            rows.drillCagr,
            columns.drillCagr,
            "dr_rolling_cagr_beginning_fiscal_yearquarter_2y"
          ),
          endFyq: getFirstString(
            rows.drillCagr,
            columns.drillCagr,
            "dr_rolling_cagr_ending_fiscal_yearquarter"
          ),
        },
      },

      dv: {
        fyq: getFirstString(rows.drillVelocity, columns.drillVelocity, "dv_fiscal_yearquarter"),
        bl: getFirstString(rows.drillVelocity, columns.drillVelocity, "dv_business_line"),
        providedVelocity: getFirstNumber(rows.drillVelocity, columns.drillVelocity, "dv_velocity_pct"),
        computedVelocity: dvComputed,

        numerator: dvNumerator,
        denominator: dvDenominator,

        closedWon: dvClosed,
        commit: dvCommit,
        daysElapsed: dvDaysElapsed,
        daysTotal: dvDaysTotal,
        timeElapsedPct: dvTimeElapsedPct,

        asOfDate: getFirstDateString(rows.drillVelocity, columns.drillVelocity, "dv_as_of_date"),

        closedAmount: dvClosed,
        commitAmount: dvCommit,
        quarterElapsedDays: dvDaysElapsed,
        quarterTotalDays: dvDaysTotal,
        pctDaysElapsed: dvTimeElapsedPct,
        pctCommitAchieved: safeDivide(dvClosed, dvCommit, null),
        velocityRatio: dvComputed,

        isEligible: getFirstNumber(rows.drillVelocity, columns.drillVelocity, "dv_is_eligible"),
        ineligibleReason: getFirstString(rows.drillVelocity, columns.drillVelocity, "dv_ineligible_reason"),

        numeratorLabel: getFirstString(rows.drillVelocity, columns.drillVelocity, "dv_numerator_label"),
        denominatorLabel: getFirstString(rows.drillVelocity, columns.drillVelocity, "dv_denominator_label"),
        targetVelocity: getFirstNumber(rows.drillVelocity, columns.drillVelocity, "dv_target_pct"),
        period: getFirstString(rows.drillVelocity, columns.drillVelocity, "dv_period"),
        periodSort: getFirstNumber(rows.drillVelocity, columns.drillVelocity, "dv_period_sort"),
      },

      fa: {
        fiscalYear: fa.fiscalYear,
        fyq: fa.fyq,
        bl: fa.bl,

        qtdForecast: fa.qtdForecast,
        qtdClosed: fa.qtdClosed,
        qtdAttainment: fa.qtdAttainment,

        ytdForecast: fa.ytdForecast,
        ytdClosed: fa.ytdClosed,
        ytdAttainment: fa.ytdAttainment,

        quota: fa.quota,
        commit: fa.commit,
        bestCase: fa.bestCase,
        openPipeline: fa.openPipeline,

        historyRows: fa.historyRows,

        debug: {
          rowCount: safeLen(rows.drillForecastAttainmentPayload),
          firstRowKeys:
            Array.isArray(rows.drillForecastAttainmentPayload) && rows.drillForecastAttainmentPayload[0]
              ? Object.keys(rows.drillForecastAttainmentPayload[0])
              : [],
          payloadKey: faPayloadKey ?? null,
          config: {
            source: sources.drillForecastAttainmentPayload ?? null,
            payload: config?.fa_payload ?? null,
          },
        },
      },

      df: {
        fyq: dfFyq,
        fiscalYear: dfFiscalYear,
        bl: dfBusinessLine,
        source: dfSource,

//        providedFundedPct:
//          dfProvidedFundedPct ??
//          getFirstNumber(companyEffective.rows, companyEffective.cols, "funded_pct"),
        
        providedFundedPct: dfProvidedFundedPct,

        computedFundedPct: dfComputed,

        numerator: dfNumerator,
        denominator: dfDenominator,

        numeratorLabel: dfNumeratorLabel,
        denominatorLabel: dfDenominatorLabel,
        targetFundedPct: dfTargetFundedPct,

        detailRows: dfDetailRows,

        numeratorAndDenominatorRowCount: dfNumeratorAndDenominatorRowCount,
        denominatorOnlyRowCount: dfDenominatorOnlyRowCount,
        numeratorOnlyRowCount: dfNumeratorOnlyRowCount,
        neitherRowCount: dfNeitherRowCount,

        debug: {
          rowCount: safeLen(rows.drillFunded),
          firstRowKeys:
            Array.isArray(rows.drillFunded) && rows.drillFunded[0]
              ? Object.keys(rows.drillFunded[0])
              : [],
          config: {
            source: sources.drillFunded ?? null,
            fyq: config?.df_fiscal_yearquarter ?? null,
            fiscalYear: config?.df_fiscal_year ?? null,
            businessLine: config?.df_business_line ?? null,
            oppId: config?.df_opp_id ?? null,
            oppName: config?.df_opp_name ?? null,
            ownerName: config?.df_owner_name ?? null,
            closeDate: config?.df_close_date ?? null,
            stageName: config?.df_stage_name ?? null,
            managerJudgment: config?.df_manager_judgment ?? null,
            acvChange: config?.df_acv_change ?? null,
            isClosedWon: config?.df_is_closed_won ?? null,
            isInCategoryOpen: config?.df_is_in_category_open ?? null,
            closedWonAcv: config?.df_closed_won_acv ?? null,
            inCategoryOpenAcv: config?.df_in_category_open_acv ?? null,
            fundedCommitAcv: config?.df_funded_commit_acv ?? null,
            fundedBucket: config?.df_funded_bucket ?? null,
            formulaRole: config?.df_formula_role ?? null,
            contributesToNumerator: config?.df_contributes_to_numerator ?? null,
            contributesToDenominator: config?.df_contributes_to_denominator ?? null,
            sourcePill: config?.df_source ?? null,
          },
        },
      },
    };
  }, [
      rows,
      columns,
      config,
      companyEffective,
      rollupEffective,
      commitCardEffective,
      createCloseCardEffective,
      cpoIterableOrgId,
      cpoAccountId,
      cpoAccountName,
      calendarKeys,
      cfoTreemapKeys,
      aePerformanceKeys,
      faKeys,
      dfKeys,
      faPayloadRows,
      faPayloadKey,
    ]);

  const debugInfoOut = useMemo(() => {
    const sourcesByDataset = {
      detail: sources.detail ?? null,
      company: sources.company ?? null,
      horseman: sources.horseman ?? null,
      horsemanDetail: sources.horsemanDetail ?? null,
      rollup: sources.rollup ?? null,
      drillCagr: sources.drillCagr ?? null,
      drillVelocity: sources.drillVelocity ?? null,
      drillPlanAttainment: sources.drillPlanAttainment ?? null,
      drillFunded: sources.drillFunded ?? null,
      largeDealsDetail: sources.largeDealsDetail ?? null,
      cfoGm: sources.cfoGm ?? null,
      pgPacing: sources.pgPacing ?? null,
      cfoTreemap: sources.cfoTreemap ?? null,
      cfoTreemapDetail: sources.cfoTreemapDetail ?? null,
      waterfall: sources.waterfall ?? null,
      calendar: sources.calendar ?? null,
      aePerformance: sources.aePerformance ?? null,
      revintelTree: sources.revintelTree ?? null,
      commitCard: sources.commitCard ?? null,
      createCloseCard: sources.createCloseCard ?? null,
      createCloseDetail: sources.createCloseDetail ?? null,
      closedTrend: sources.closedTrend ?? null,
      cpoAccounts: sources.cpoAccounts ?? null,
    };

    const rowCounts = {
      detail: safeLen(rows.detail),
      company: safeLen(rows.company),
      horseman: safeLen(rows.horseman),
      horsemanDetail: safeLen(rows.horsemanDetail),
      rollup: safeLen(rows.rollup),
      drillCagr: safeLen(rows.drillCagr),
      drillVelocity: safeLen(rows.drillVelocity),
      drillFunded: safeLen(rows.drillFunded),
      largeDealsDetail: safeLen(rows.largeDealsDetail),
      cfoGm: safeLen(rows.cfoGm),
      pgPacing: safeLen(rows.pgPacing),
      cfoTreemap: safeLen(rows.cfoTreemap),
      cfoTreemapDetail: safeLen(rows.cfoTreemapDetail),
      waterfall: safeLen(rows.waterfall),
      calendar: safeLen(rows.calendar),
      aePerformance: safeLen(rows.aePerformance),
      revintelTree: safeLen(rows.revintelTree),
      commitCard: safeLen(rows.commitCard),
      createCloseCard: safeLen(rows.createCloseCard),
      createCloseDetail: safeLen(rows.createCloseDetail),
      closedTrend: safeLen(rows.closedTrend),
      cpoAccounts: safeLen(rows.cpoAccounts),
    };

    const firstKeys = (r) => (Array.isArray(r) && r[0] ? Object.keys(r[0]).slice(0, 40) : null);

    return {
      sources: sourcesByDataset,
      rowCounts,
      firstRowKeys: {
        detail: firstKeys(rows.detail),
        company: firstKeys(rows.company),
        drillVelocity: firstKeys(rows.drillVelocity),
        drillFunded: firstKeys(rows.drillFunded),
        largeDealsDetail: firstKeys(rows.largeDealsDetail),
        revintelTree: firstKeys(rows.revintelTree),
        commitCard: firstKeys(rows.commitCard),
        createCloseCard: firstKeys(rows.createCloseCard),
        createCloseDetail: firstKeys(rows.createCloseDetail),
        closedTrend: firstKeys(rows.closedTrend),
        cpoAccounts: firstKeys(rows.cpoAccounts),
        accountNameParam: firstKeys(rows.accountNameParam),
      },
      configPreview: {
        cpo_accounts_source: config?.cpo_accounts_source ?? null,

        source_large_deals_detail: config?.source_large_deals_detail ?? null,
        ld_metric_name: config?.ld_metric_name ?? null,
        ld_opp_id: config?.ld_opp_id ?? null,
        ld_base_arr_growth: config?.ld_base_arr_growth ?? null,


        source_drill_funded: config?.source_drill_funded ?? null,
        df_fiscal_yearquarter: config?.df_fiscal_yearquarter ?? null,
        df_fiscal_year: config?.df_fiscal_year ?? null,
        df_business_line: config?.df_business_line ?? null,
        df_opp_id: config?.df_opp_id ?? null,
        df_opp_name: config?.df_opp_name ?? null,
        df_owner_name: config?.df_owner_name ?? null,
        df_close_date: config?.df_close_date ?? null,
        df_stage_name: config?.df_stage_name ?? null,
        df_manager_judgment: config?.df_manager_judgment ?? null,
        df_acv_change: config?.df_acv_change ?? null,
        df_is_closed_won: config?.df_is_closed_won ?? null,
        df_is_in_category_open: config?.df_is_in_category_open ?? null,
        df_closed_won_acv: config?.df_closed_won_acv ?? null,
        df_in_category_open_acv: config?.df_in_category_open_acv ?? null,
        df_funded_commit_acv: config?.df_funded_commit_acv ?? null,
        df_funded_bucket: config?.df_funded_bucket ?? null,
        df_formula_role: config?.df_formula_role ?? null,
        df_contributes_to_numerator: config?.df_contributes_to_numerator ?? null,
        df_contributes_to_denominator: config?.df_contributes_to_denominator ?? null,

        source_create_close_card: config?.source_create_close_card ?? null,
        ccc_closed_won_qtd_amt: config?.ccc_closed_won_qtd_amt ?? null,
        ccc_open_pipe_qtd_amt: config?.ccc_open_pipe_qtd_amt ?? null,
        ccc_closed_won_qtd_yoy_pct: config?.ccc_closed_won_qtd_yoy_pct ?? null,
        ccc_open_pipe_qtd_yoy_pct: config?.ccc_open_pipe_qtd_yoy_pct ?? null,

        source_create_close_detail: config?.source_create_close_detail ?? null,
        ccd_fiscal_yearquarter: config?.ccd_fiscal_yearquarter ?? null,
        ccd_day_of_quarter: config?.ccd_day_of_quarter ?? null,
        ccd_as_of_date: config?.ccd_as_of_date ?? null,
        ccd_business_line: config?.ccd_business_line ?? null,
        ccd_opp_owner_name: config?.ccd_opp_owner_name ?? null,
        ccd_closed_won: config?.ccd_closed_won ?? null,
        ccd_open_pipe: config?.ccd_open_pipe ?? null,

        source_closed_trend: config?.source_closed_trend ?? null,
        ct_business_line: config?.ct_business_line ?? null,
        ct_month_name: config?.ct_month_name ?? null,
        ct_month_sort: config?.ct_month_sort ?? null,
        ct_monthly_acv_change: config?.ct_monthly_acv_change ?? null,
        ct_fiscal_yearquarter: config?.ct_fiscal_yearquarter ?? null,
      },
    };
  }, [config, rows, sources]);

  const isLoading =
    !raw.detail ||
    (sources.company && !raw.company) ||
    (sources.budget && !raw.budget) ||
    (sources.pgPacing && !raw.pgPacing) ||
    (sources.cfoTreemap && !raw.cfoTreemap) ||
    (sources.cfoTreemapDetail && !raw.cfoTreemapDetail) ||
    (sources.drillVelocity && !raw.drillVelocity) ||
    (sources.drillForecastAttainmentPayload && !rawDrillForecastAttainmentPayload) ||
    (sources.drillFunded && !raw.drillFunded) ||
    (sources.largeDealsDetail && !raw.largeDealsDetail) ||
    (sources.revintelTree && !raw.revintelTree) ||
    (sources.commitCard && !raw.commitCard) ||
    (sources.createCloseCard && !raw.createCloseCard) ||
    (sources.createCloseDetail && !raw.createCloseDetail) ||
    (sources.closedTrend && !raw.closedTrend) ||
    (sources.cpoAccounts && !raw.cpoAccounts) ||
    (sources.accountNameParam && !raw.accountNameParam);

  const hasLoggedRef = useRef(false);

useEffect(() => {
  if (!isDebugEnabled()) return;
  if (hasLoggedRef.current) return;

  hasLoggedRef.current = true;

  debugLog("[SALT] CPO accounts:", {
    source: sources.cpoAccounts,
    rowCount: rows.cpoAccounts?.length ?? 0,
    firstRowKeys: rows.cpoAccounts?.[0] ? Object.keys(rows.cpoAccounts[0]).slice(0, 20) : [],
  });

  debugLog("[SALT] AccountNameParam:", {
    source: sources.accountNameParam,
    rowCount: rows.accountNameParam?.length ?? 0,
    firstRowKeys: rows.accountNameParam?.[0] ? Object.keys(rows.accountNameParam[0]).slice(0, 20) : [],
  });

  debugLog("[SALT] Commit Card:", {
    source: sources.commitCard,
    rowCount: rows.commitCard?.length ?? 0,
    firstRowKeys: rows.commitCard?.[0] ? Object.keys(rows.commitCard[0]).slice(0, 20) : [],
    sourceDetected: data?.co?.debug?.commitCardSourceDetected ?? false,
    territoryKey: data?.co?.debug?.commitCardTerritoryKey ?? null,
    globalRowCount: data?.co?.debug?.commitCardGlobalRowCount ?? 0,
    matchedRowCount: data?.co?.debug?.forecastSource?.matchedRowCount ?? 0,
    territoriesSeen: data?.co?.debug?.forecastSource?.territoriesSeen ?? [],
    chosenValues: data?.co?.debug?.forecastSource?.chosenValues ?? {},
  });

  debugLog("[SALT] Create & Close card:", {
    source: sources.createCloseCard,
    rowCount: rows.createCloseCard?.length ?? 0,
    firstRowKeys: rows.createCloseCard?.[0] ? Object.keys(rows.createCloseCard[0]).slice(0, 20) : [],
  });

  debugLog("[SALT] Create & Close detail:", {
    source: sources.createCloseDetail,
    rowCount: rows.createCloseDetail?.length ?? 0,
    firstRowKeys: rows.createCloseDetail?.[0] ? Object.keys(rows.createCloseDetail[0]).slice(0, 20) : [],
  });

  debugLog("[SALT] Closed Trend:", {
    source: sources.closedTrend,
    rowCount: rows.closedTrend?.length ?? 0,
    firstRowKeys: rows.closedTrend?.[0] ? Object.keys(rows.closedTrend[0]).slice(0, 20) : [],
    currentFyq: data?.closedTrend?.currentFyq ?? null,
    allRows: data?.closedTrend?.allRows?.length ?? 0,
    quarterRows: data?.closedTrend?.quarterRows?.length ?? 0,
  });

  debugLog("[SALT] Company totals final values:", {
    commit: data?.co?.debug?.finalChosenValues?.commit ?? null,
    quota: data?.co?.debug?.finalChosenValues?.quota ?? null,
    forecast: data?.co?.debug?.finalChosenValues?.forecast ?? null,
    best_case: data?.co?.debug?.finalChosenValues?.best_case ?? null,
    open_pipeline: data?.co?.debug?.finalChosenValues?.open_pipeline ?? null,
    closedQTD: data?.co?.debug?.finalChosenValues?.closedQTD ?? null,
    budget: data?.co?.debug?.finalChosenValues?.budget ?? null,
    gap: data?.co?.debug?.finalChosenValues?.gap ?? null,
    velocity: data?.co?.debug?.finalChosenValues?.velocity ?? null,
    funded: data?.co?.debug?.finalChosenValues?.funded ?? null,
  });

  debugLog("[SALT] Forecast Attainment:", {
    source: sources.drillForecastAttainmentPayload,
    rowCount: rows.drillForecastAttainmentPayload?.length ?? 0,
    firstRowKeys: rows.drillForecastAttainmentPayload?.[0]
      ? Object.keys(rows.drillForecastAttainmentPayload[0]).slice(0, 20)
      : [],
    fyq: data?.fa?.fyq ?? null,
    bl: data?.fa?.bl ?? null,
    qtdForecast: data?.fa?.qtdForecast ?? null,
    qtdClosed: data?.fa?.qtdClosed ?? null,
    qtdAttainment: data?.fa?.qtdAttainment ?? null,
    ytdForecast: data?.fa?.ytdForecast ?? null,
    ytdClosed: data?.fa?.ytdClosed ?? null,
    ytdAttainment: data?.fa?.ytdAttainment ?? null,
  });

  debugLog("[SALT] Funded:", {
    source: sources.drillFunded,
    rowCount: rows.drillFunded?.length ?? 0,
    firstRowKeys: rows.drillFunded?.[0] ? Object.keys(rows.drillFunded[0]).slice(0, 20) : [],
    fyq: data?.df?.fyq ?? null,
    bl: data?.df?.bl ?? null,
    numerator: data?.df?.numerator ?? null,
    denominator: data?.df?.denominator ?? null,
    providedFundedPct: data?.df?.providedFundedPct ?? null,
    computedFundedPct: data?.df?.computedFundedPct ?? null,
    detailRows: data?.df?.detailRows?.length ?? 0,
  });

  debugLog("[SALT] Large Deals Detail:", {
    source: sources.largeDealsDetail,
    rowCount: rows.largeDealsDetail?.length ?? 0,
    firstRowKeys: rows.largeDealsDetail?.[0]
      ? Object.keys(rows.largeDealsDetail[0]).slice(0, 20)
      : [],
  });

  debugLog("[SALT] Calendar:", {
    rowCount: rows.calendar?.length ?? 0,
    firstRowKeys: rows.calendar?.[0] ? Object.keys(rows.calendar[0]).slice(0, 20) : [],
  });

  debugLog("[SALT] AE Performance:", {
    rowCount: rows.aePerformance?.length ?? 0,
    firstRowKeys: rows.aePerformance?.[0] ? Object.keys(rows.aePerformance[0]).slice(0, 20) : [],
    overThreshold: data?.ae?.overThreshold ?? null,
    zeroAtAcv: data?.ae?.zeroAtAcv ?? null,
    zeroDealsClosed: data?.ae?.zeroDealsClosed ?? null,
  });

  debugLog("[SALT] Budget:", {
    source: sources.budget,
    rowCount: rows.budget?.length ?? 0,
    firstRowKeys: rows.budget?.[0] ? Object.keys(rows.budget[0]).slice(0, 20) : [],
    derivedTotal: data?.co?.budget ?? null,
  });
}, [
  sources.cpoAccounts,
  rows.cpoAccounts,
  sources.accountNameParam,
  rows.accountNameParam,
  sources.commitCard,
  rows.commitCard,
  data?.co?.debug?.commitCardSourceDetected,
  data?.co?.debug?.commitCardTerritoryKey,
  data?.co?.debug?.commitCardGlobalRowCount,
  data?.co?.debug?.forecastSource?.matchedRowCount,
  data?.co?.debug?.forecastSource?.territoriesSeen,
  data?.co?.debug?.forecastSource?.chosenValues,
  sources.createCloseCard,
  rows.createCloseCard,
  sources.createCloseDetail,
  rows.createCloseDetail,
  sources.closedTrend,
  rows.closedTrend,
  data?.closedTrend?.currentFyq,
  data?.closedTrend?.allRows?.length,
  data?.closedTrend?.quarterRows?.length,
  data?.co?.debug?.finalChosenValues,
  sources.drillFunded,
  rows.drillFunded,
  data?.df?.fyq,
  data?.df?.bl,
  data?.df?.numerator,
  data?.df?.denominator,
  data?.df?.providedFundedPct,
  data?.df?.computedFundedPct,
  data?.df?.detailRows?.length,
  sources.largeDealsDetail,
  rows.largeDealsDetail,
  rows.calendar,
  rows.aePerformance,
  data?.ae?.overThreshold,
  data?.ae?.zeroAtAcv,
  data?.ae?.zeroDealsClosed,
  sources.budget,
  rows.budget,
  data?.co?.budget,
]);

  return { config, data, rows, columns, isLoading, debugInfo: debugInfoOut };
}
