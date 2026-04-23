// src/hooks/useDerivedMetrics.js
import { useMemo } from "react";
import { toNumber } from "../utils/formatters.jsx";

function safeDivide(numerator, denominator, fallback = null) {
  const n = toNumber(numerator);
  const d = toNumber(denominator);
  if (n == null || d == null || d === 0) return fallback;
  return n / d;
}

function sumWhere(rows, predicate, valueFn) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  return rows.reduce((sum, row) => {
    if (!predicate(row)) return sum;
    return sum + (toNumber(valueFn(row)) || 0);
  }, 0);
}

function countWhere(rows, predicate) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  return rows.reduce((sum, row) => sum + (predicate(row) ? 1 : 0), 0);
}

function getHealthBucketFromReview(text) {
  const s = String(text ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s.includes("healthy")) return "healthy";
  if (s.includes("needs attention")) return "needs_attention";
  if (s.includes("at risk")) return "at_risk";
  return "unknown";
}

function daysUntilDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function getCurrentQuarterDateRange() {
  const now = new Date();
  const month = now.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  const start = new Date(now.getFullYear(), quarterStartMonth, 1);
  const end = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
  return { start, end };
}

function isWithinCurrentQuarter(value) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const { start, end } = getCurrentQuarterDateRange();
  return d >= start && d <= end;
}

function isInLastTwoWeeksOfQuarter(value) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const { end } = getCurrentQuarterDateRange();
  const diff = Math.round((end.getTime() - d.getTime()) / 86400000);
  return diff >= 0 && diff <= 14;
}

export function useDerivedMetrics({
  spineRows = [],
  forecastAmount = 0,
}) {
  return useMemo(() => {
    const rows = Array.isArray(spineRows) ? spineRows : [];

    const openRows = rows.filter(
      (r) => (toNumber(r?.open_pipeline_acv) || 0) > 0
    );

    const wonRows = rows.filter(
      (r) => String(r?.stage_name ?? "").trim().toLowerCase() === "closed won"
    );

    const lostRows = rows.filter(
      (r) => String(r?.stage_name ?? "").trim().toLowerCase() === "closed lost"
    );

    const closedRows = rows.filter((r) =>
      ["closed won", "closed lost"].includes(
        String(r?.stage_name ?? "").trim().toLowerCase()
      )
    );

    const cqRows = openRows.filter((r) =>
      isWithinCurrentQuarter(r?.close_date)
    );

    const lateQuarterRows = openRows.filter((r) =>
      isInLastTwoWeeksOfQuarter(r?.close_date)
    );

    const healthyRows = openRows.filter(
      (r) => getHealthBucketFromReview(r?.deal_review_short) === "healthy"
    );

    const needsRows = openRows.filter(
      (r) => getHealthBucketFromReview(r?.deal_review_short) === "needs_attention"
    );

    const riskRows = openRows.filter(
      (r) => getHealthBucketFromReview(r?.deal_review_short) === "at_risk"
    );

    const largeDealRows = openRows.filter(
      (r) => String(r?.large_deal_bucket ?? "").trim() === "$500K+"
    );

    const largeAtRiskRows = largeDealRows.filter(
      (r) => getHealthBucketFromReview(r?.deal_review_short) === "at_risk"
    );

    const earlyStageRows = openRows.filter((r) =>
      ["stage 0", "stage 1", "stage 2", "stage 3"].includes(
        String(r?.stage_name ?? "").trim().toLowerCase()
      )
    );

    const lateStageRows = openRows.filter((r) =>
      ["stage 4", "stage 5", "stage 6"].includes(
        String(r?.stage_name ?? "").trim().toLowerCase()
      )
    );

    const openPipeAmount = sumWhere(openRows, () => true, (r) => r?.open_pipeline_acv);
    const closedWonAmount = sumWhere(wonRows, () => true, (r) => r?.closed_acv);
    const closedLostCount = countWhere(lostRows, () => true);
    const cqOpenAmount = sumWhere(cqRows, () => true, (r) => r?.open_pipeline_acv);

    const healthyAmount = sumWhere(healthyRows, () => true, (r) => r?.open_pipeline_acv);
    const needsAmount = sumWhere(needsRows, () => true, (r) => r?.open_pipeline_acv);
    const riskAmount = sumWhere(riskRows, () => true, (r) => r?.open_pipeline_acv);

    const largeDealAmount = sumWhere(largeDealRows, () => true, (r) => r?.open_pipeline_acv);
    const largeAtRiskAmount = sumWhere(largeAtRiskRows, () => true, (r) => r?.open_pipeline_acv);

    const earlyStageAmount = sumWhere(earlyStageRows, () => true, (r) => r?.open_pipeline_acv);
    const lateStageAmount = sumWhere(lateStageRows, () => true, (r) => r?.open_pipeline_acv);
    const lateQuarterAmount = sumWhere(lateQuarterRows, () => true, (r) => r?.open_pipeline_acv);

    const businessLineAmounts = openRows.reduce((acc, r) => {
      const bl = String(r?.business_line ?? "Unknown").trim() || "Unknown";
      acc[bl] = (acc[bl] || 0) + (toNumber(r?.open_pipeline_acv) || 0);
      return acc;
    }, {});

    const topBusinessLine =
      Object.entries(businessLineAmounts).sort((a, b) => b[1] - a[1])[0] || null;

    const medianTimeToCloseDays = (() => {
      const vals = cqRows
        .map((r) => daysUntilDate(r?.close_date))
        .filter((v) => typeof v === "number" && v >= 0)
        .sort((a, b) => a - b);

      if (!vals.length) return null;
      const mid = Math.floor(vals.length / 2);
      return vals.length % 2 ? vals[mid] : Math.round((vals[mid - 1] + vals[mid]) / 2);
    })();

    const totalClosedCount = closedRows.length;
    const wonCount = wonRows.length;

    const forecastAmountNum = toNumber(forecastAmount) || 0;

    const attainment = safeDivide(closedWonAmount, forecastAmountNum, null);
    const pacing = attainment;

    const gapToForecast = Math.max(0, forecastAmountNum - closedWonAmount);
    const gapToForecastPct = safeDivide(
      forecastAmountNum - closedWonAmount,
      forecastAmountNum,
      null
    );

    const openPipePlusClosedAmount = openPipeAmount + closedWonAmount;
    const totalPipelineCoverageRatio = safeDivide(
      openPipePlusClosedAmount,
      forecastAmountNum,
      null
    );

    const closedLostAmount = 0; // Placeholder unless a lost ACV field is added later

    const coverageRatio = safeDivide(openPipeAmount, forecastAmountNum);
    const conversionNeeded = safeDivide(gapToForecast, openPipeAmount);

    const healthyPct = safeDivide(healthyAmount, openPipeAmount, 0);
    const needsPct = safeDivide(needsAmount, openPipeAmount, 0);
    const riskPct = safeDivide(riskAmount, openPipeAmount, 0);
    const largeDealPct = safeDivide(largeDealAmount, openPipeAmount, 0);
    const largeAtRiskPct = safeDivide(largeAtRiskAmount, openPipeAmount, 0);
    const earlyStagePct = safeDivide(earlyStageAmount, openPipeAmount, 0);
    const lateStagePct = safeDivide(lateStageAmount, openPipeAmount, 0);
    const lateQuarterPct = safeDivide(lateQuarterAmount, openPipeAmount, 0);
    const winRate = safeDivide(wonCount, totalClosedCount, null);

    return {
      counts: {
        openRows: openRows.length,
        cqRows: cqRows.length,
        healthyRows: healthyRows.length,
        needsRows: needsRows.length,
        riskRows: riskRows.length,
        largeDealRows: largeDealRows.length,
        largeAtRiskRows: largeAtRiskRows.length,
        wonCount,
        lostCount: closedLostCount,
        totalClosedCount,
      },

      amounts: {
        forecastAmount: forecastAmountNum,
        openPipeAmount,
        closedWonAmount,
        closedLostAmount,
        openPipePlusClosedAmount,
        cqOpenAmount,
        healthyAmount,
        needsAmount,
        riskAmount,
        largeDealAmount,
        largeAtRiskAmount,
        earlyStageAmount,
        lateStageAmount,
        lateQuarterAmount,
        gapToForecast,
      },

      ratios: {
        coverageRatio,
        totalPipelineCoverageRatio,
        conversionNeeded,
        attainment,
        pacing,
        gapToForecastPct,
        healthyPct,
        needsPct,
        riskPct,
        largeDealPct,
        largeAtRiskPct,
        earlyStagePct,
        lateStagePct,
        lateQuarterPct,
        winRate,
      },

      rollups: {
        topBusinessLine,
        businessLineAmounts,
        medianTimeToCloseDays,
      },

      rows: {
        all: rows,
        openRows,
        cqRows,
        healthyRows,
        needsRows,
        riskRows,
        largeDealRows,
        largeAtRiskRows,
        earlyStageRows,
        lateStageRows,
        lateQuarterRows,
        wonRows,
        lostRows,
        closedRows,
      },
    };
  }, [spineRows, forecastAmount]);
}

export default useDerivedMetrics;