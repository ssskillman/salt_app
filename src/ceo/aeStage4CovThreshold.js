/**
 * CEO AE Performance — Stage 4+ coverage threshold flags from warehouse / dbt.
 * Slider order: ascending (.5x → 3x) left to right.
 */

import { resolveColumnKey } from "../utils/data.jsx";

export const AE_STAGE4_COV_ORDER = [0.5, 1, 2, 3];

export function aeStage4CovSliderIndex(mult) {
  const i = AE_STAGE4_COV_ORDER.indexOf(mult);
  return i >= 0 ? i : 0;
}

export function formatAeStage4CovMult(mult) {
  if (mult === 0.5) return ".5x";
  if (mult === 1) return "1x";
  if (mult === 2) return "2x";
  if (mult === 3) return "3x";
  return `${mult}x`;
}

export function aeStage4CovMetricTitle(mult) {
  return `AEs > ${formatAeStage4CovMult(mult)} Stage 4+ Cov`;
}

export function isAeStage4CovDrillMetric(metricName) {
  const s = String(metricName ?? "").toLowerCase();
  return (s.includes("stage 4 cov") || s.includes("stage 4+ cov")) && s.includes("aes");
}

const FLAG_CANDIDATES = {
  3: [
    "is_ae_over_stage4_cov_threshold_3x",
    "IS_AE_OVER_STAGE4_COV_THRESHOLD_3X",
    "Is AE Over Stage 4 Coverage Threshold 3x (0/1)",
    "Is Ae Over Stage 4 Cov Threshold 3 X",
  ],
  2: [
    "is_ae_over_stage4_cov_threshold_2x",
    "IS_AE_OVER_STAGE4_COV_THRESHOLD_2X",
    "Is AE Over Stage 4 Coverage Threshold 2x (0/1)",
  ],
  1: [
    "is_ae_over_stage4_cov_threshold_1x",
    "IS_AE_OVER_STAGE4_COV_THRESHOLD_1X",
    "Is AE Over Stage 4 Coverage Threshold 1x (0/1)",
  ],
  0.5: [
    "is_ae_over_stage4_cov_threshold_0_5x",
    "IS_AE_OVER_STAGE4_COV_THRESHOLD_0_5X",
    "Is AE Over Stage 4 Coverage Threshold 0.5x (0/1)",
    "Is AE Over Stage 4 Coverage Threshold 0_5x (0/1)",
  ],
};

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function findColIdByName(cols, name) {
  if (!Array.isArray(cols) || !name) return null;
  const target = norm(name);
  const hit = cols.find((c) => norm(c?.name) === target);
  return hit?.id ?? null;
}

function findRowKeyByCandidates(rowsArr, candidates = []) {
  if (!Array.isArray(rowsArr) || rowsArr.length === 0 || !Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }
  const row0 = rowsArr[0] || {};
  const rowKeys = Object.keys(row0);
  for (const candidate of candidates) {
    const target = String(candidate).trim().toLowerCase();
    const exact = rowKeys.find((k) => String(k).trim().toLowerCase() === target);
    if (exact) return exact;
    const suffix = rowKeys.find((k) => String(k).toLowerCase().endsWith(`/${target}`));
    if (suffix) return suffix;
  }
  return null;
}

const SIGMA_COL_NAMES = {
  3: [
    "Is AE Over Stage 4 Coverage Threshold 3x (0/1)",
    "Is Ae Over Stage 4 Cov Threshold 3 X",
    "IS_AE_OVER_STAGE4_COV_THRESHOLD_3X",
  ],
  2: ["Is AE Over Stage 4 Coverage Threshold 2x (0/1)", "IS_AE_OVER_STAGE4_COV_THRESHOLD_2X"],
  1: ["Is AE Over Stage 4 Coverage Threshold 1x (0/1)", "IS_AE_OVER_STAGE4_COV_THRESHOLD_1X"],
  0.5: [
    "Is AE Over Stage 4 Coverage Threshold 0.5x (0/1)",
    "Is AE Over Stage 4 Coverage Threshold 0_5x (0/1)",
    "IS_AE_OVER_STAGE4_COV_THRESHOLD_0_5X",
  ],
};

/**
 * Resolve row key for the Stage 4 coverage “over threshold” flag at `mult` (3 | 2 | 1 | 0.5).
 */
export function resolveAeStage4CovThresholdColumnKey(mult, config, rows, columns) {
  const rowsArr = rows?.aePerformance || [];
  const aeCols = Array.isArray(columns) ? columns : [];
  if (!rowsArr.length) return null;

  /** Only 3x is wired in editorConfig; other thresholds resolve by column / row key name (no Sigma bloat). */
  const cfgVal = mult === 3 ? config?.ae_is_over_stage4_cov_threshold_3x : null;
  const fromConfig = resolveColumnKey(cfgVal);
  if (fromConfig) {
    const row0 = rowsArr[0] || {};
    if (Object.prototype.hasOwnProperty.call(row0, fromConfig)) return fromConfig;
    const hit = Object.keys(row0).find((rk) => rk === fromConfig || rk.endsWith(`/${fromConfig}`));
    if (hit) return hit;
  }

  const names = SIGMA_COL_NAMES[mult] || [];
  for (const n of names) {
    const id = findColIdByName(aeCols, n);
    if (id) {
      const row0 = rowsArr[0] || {};
      if (Object.prototype.hasOwnProperty.call(row0, id)) return id;
      const rk = Object.keys(row0).find((k) => k === id || k.endsWith(`/${id}`));
      if (rk) return rk;
    }
  }

  const candidates = FLAG_CANDIDATES[mult];
  if (!candidates) return null;
  return findRowKeyByCandidates(rowsArr, candidates);
}
