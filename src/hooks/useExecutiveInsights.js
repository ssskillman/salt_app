// src/hooks/useExecutiveInsights.js
import { useMemo } from "react";
import { fmtMoneyCompact, fmtX, toNumber } from "../utils/formatters.jsx";

function formatPct0(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

export function useExecutiveInsights({ derivedMetrics }) {
  return useMemo(() => {
    const openPipeAmount = toNumber(derivedMetrics?.amounts?.openPipeAmount) || 0;
    const forecastAmount = toNumber(derivedMetrics?.amounts?.forecastAmount) || 0;
    const gapToForecast = toNumber(derivedMetrics?.amounts?.gapToForecast) || 0;

    const pacing = toNumber(derivedMetrics?.ratios?.pacing);
    const gapPct = toNumber(derivedMetrics?.ratios?.gapToForecastPct);
    const attainment = toNumber(derivedMetrics?.ratios?.attainment);
    const coverageRatio = toNumber(derivedMetrics?.ratios?.coverageRatio);
    const totalPipelineCoverageRatio = toNumber(
      derivedMetrics?.ratios?.totalPipelineCoverageRatio
    );
    const conversionNeeded = toNumber(derivedMetrics?.ratios?.conversionNeeded);
    const lateQuarterPct = toNumber(derivedMetrics?.ratios?.lateQuarterPct) || 0;

    const cqOpenAmount = toNumber(derivedMetrics?.amounts?.cqOpenAmount) || 0;
    const healthyAmount = toNumber(derivedMetrics?.amounts?.healthyAmount) || 0;
    const needsAmount = toNumber(derivedMetrics?.amounts?.needsAmount) || 0;
    const riskAmount = toNumber(derivedMetrics?.amounts?.riskAmount) || 0;
    const largeAtRiskAmount = toNumber(derivedMetrics?.amounts?.largeAtRiskAmount) || 0;

    const topBusinessLine = derivedMetrics?.rollups?.topBusinessLine || null;
    const medianTimeToCloseDays =
      derivedMetrics?.rollups?.medianTimeToCloseDays ?? null;

    const largeAtRiskRows = derivedMetrics?.rows?.largeAtRiskRows || [];
    const openRows = derivedMetrics?.rows?.openRows || [];

    // -----------------------------
    // COMPANY TOTALS EXECUTIVE INSIGHTS
    // -----------------------------
    const companyItems = [];

    if (pacing != null && gapPct != null && pacing < 0.9 && topBusinessLine) {
      companyItems.push({
        key: "pipeline_gap",
        teaser: "Pipeline risk",
        headline: `Pipeline is ${fmtMoneyCompact(gapToForecast)} (${formatPct0(
          Math.abs(gapPct)
        )}) behind target, driven primarily by ${topBusinessLine[0]} deals.`,
        supporting: [
          cqOpenAmount > 0 && medianTimeToCloseDays != null
            ? `Current-quarter pipeline totals ${fmtMoneyCompact(cqOpenAmount)}, with a median ${medianTimeToCloseDays}-day time to close.`
            : null,
          needsAmount > 0 && openPipeAmount > 0
            ? `${formatPct0(needsAmount / openPipeAmount)} of open ACV is marked Needs Attention and should be monitored closely.`
            : null,
        ].filter(Boolean),
      });
    }

    if (
      coverageRatio != null &&
      conversionNeeded != null &&
      forecastAmount > 0 &&
      openPipeAmount > 0
    ) {
      companyItems.push({
        key: "coverage_conversion",
        teaser: "Coverage",
        headline: `Open pipeline is ${fmtX(coverageRatio)} coverage, and ${formatPct0(
          conversionNeeded
        )} of open ACV must convert to hit forecast.`,
        supporting: [
          totalPipelineCoverageRatio != null
            ? `Open pipeline plus closed won equals ${fmtX(
                totalPipelineCoverageRatio
              )} total coverage against forecast.`
            : null,
          attainment != null
            ? `Closed won attainment is currently ${formatPct0(attainment)} of forecast.`
            : null,
        ].filter(Boolean),
      });
    }

    if (lateQuarterPct >= 0.35) {
      companyItems.push({
        key: "late_quarter",
        teaser: "Close timing risk",
        headline: `${formatPct0(lateQuarterPct)} of open pipeline is scheduled to close in the final 2 weeks of the quarter.`,
        supporting: [
          cqOpenAmount > 0
            ? `Current-quarter pipeline totals ${fmtMoneyCompact(cqOpenAmount)}.`
            : null,
          medianTimeToCloseDays != null
            ? `Median time to close is ${medianTimeToCloseDays} days across current-quarter pipeline.`
            : null,
        ].filter(Boolean),
      });
    }

    if (largeAtRiskAmount > 0) {
      companyItems.push({
        key: "large_deals_risk",
        teaser: "Large deal risk",
        headline: `${largeAtRiskRows.length} large deals (${fmtMoneyCompact(
          largeAtRiskAmount
        )}) are currently flagged At Risk.`,
        supporting: [
          openPipeAmount > 0
            ? `${formatPct0(
                largeAtRiskAmount / openPipeAmount
              )} of open pipeline ACV is tied to these large deals.`
            : null,
          topBusinessLine
            ? `${topBusinessLine[0]} is the largest current business-line concentration in open pipeline.`
            : null,
        ].filter(Boolean),
      });
    }

    if (needsAmount > 0 && openPipeAmount > 0) {
      companyItems.push({
        key: "needs_attention",
        teaser: "Needs Attn...",
        headline: `${formatPct0(
          needsAmount / openPipeAmount
        )} of open ACV is marked Needs Attention and should be monitored closely.`,
        supporting: [
          `Needs Attention deals total ${fmtMoneyCompact(
            needsAmount
          )} in open pipeline ACV.`,
          riskAmount > 0
            ? `At Risk deals add another ${fmtMoneyCompact(riskAmount)} of exposure.`
            : null,
        ].filter(Boolean),
      });
    }

    if (healthyAmount > 0 && openPipeAmount > 0) {
      companyItems.push({
        key: "healthy_mix",
        teaser: "Healthy Pipe",
        headline: `${formatPct0(
          healthyAmount / openPipeAmount
        )} of open ACV is currently marked Healthy.`,
        supporting: [
          `Healthy open pipeline totals ${fmtMoneyCompact(healthyAmount)}.`,
          medianTimeToCloseDays != null
            ? `Median time to close is ${medianTimeToCloseDays} days across current-quarter pipeline.`
            : null,
        ].filter(Boolean),
      });
    }

    if (cqOpenAmount > 0 && medianTimeToCloseDays != null) {
      companyItems.push({
        key: "velocity",
        teaser: "Velocity",
        headline: `Current-quarter pipeline totals ${fmtMoneyCompact(
          cqOpenAmount
        )}, with a median ${medianTimeToCloseDays}-day time to close.`,
        supporting: [
          lateQuarterPct >= 0.35
            ? `${formatPct0(
                lateQuarterPct
              )} of open pipeline is concentrated late in the quarter.`
            : null,
          needsAmount > 0 && openPipeAmount > 0
            ? `${formatPct0(
                needsAmount / openPipeAmount
              )} of open ACV is marked Needs Attention.`
            : null,
        ].filter(Boolean),
      });
    }

    const companyRank = {
      pipeline_gap: 1,
      coverage_conversion: 2,
      large_deals_risk: 3,
      late_quarter: 4,
      needs_attention: 5,
      velocity: 6,
      healthy_mix: 7,
    };

    const companySorted = [...companyItems].sort(
      (a, b) => (companyRank[a.key] ?? 99) - (companyRank[b.key] ?? 99)
    );

    // -----------------------------
    // FIELD EXECUTION / OPEN PIPE HEALTH INSIGHTS
    // -----------------------------
    const healthBuckets = {
      healthy: { count: 0, amount: 0 },
      needs_attention: { count: 0, amount: 0 },
      at_risk: { count: 0, amount: 0 },
    };

    openRows.forEach((r) => {
      const amount = toNumber(r?.open_pipeline_acv) || 0;
      if (amount <= 0) return;

      const txt = String(r?.deal_review_short ?? "").toLowerCase();

      if (txt.includes("healthy")) {
        healthBuckets.healthy.count += 1;
        healthBuckets.healthy.amount += amount;
      } else if (txt.includes("needs attention")) {
        healthBuckets.needs_attention.count += 1;
        healthBuckets.needs_attention.amount += amount;
      } else if (txt.includes("at risk")) {
        healthBuckets.at_risk.count += 1;
        healthBuckets.at_risk.amount += amount;
      }
    });

    const pct = (amt) => (openPipeAmount > 0 ? amt / openPipeAmount : 0);

    const fieldItemsRaw = [
      {
        key: "healthy",
        label: "Healthy",
        count: healthBuckets.healthy.count,
        amount: healthBuckets.healthy.amount,
        pct: pct(healthBuckets.healthy.amount),
        color: "#2563eb",
      },
      {
        key: "needs_attention",
        label: "Needs Attention",
        count: healthBuckets.needs_attention.count,
        amount: healthBuckets.needs_attention.amount,
        pct: pct(healthBuckets.needs_attention.amount),
        color: "#d97706",
      },
      {
        key: "at_risk",
        label: "At Risk",
        count: healthBuckets.at_risk.count,
        amount: healthBuckets.at_risk.amount,
        pct: pct(healthBuckets.at_risk.amount),
        color: "#c026d3",
      },
    ];

    const fieldItems = fieldItemsRaw.filter((item) => item.count > 0);
    const fieldActive = fieldItems[0] || null;

    return {
      company: {
        items: companySorted.slice(0, 6),
        active: companySorted[0] || null,
      },

      fieldExecution: {
        summary: {
          totalAmount: openPipeAmount,
          items: fieldItems,
        },
        items: fieldItems,
        active: fieldActive,
      },
    };
  }, [derivedMetrics]);
}

export default useExecutiveInsights;