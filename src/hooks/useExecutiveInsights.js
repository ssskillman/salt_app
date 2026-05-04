// src/hooks/useExecutiveInsights.js
import { useMemo } from "react";
import { fmtMoneyCompact, fmtX, toNumber } from "../utils/formatters.jsx";

const COMPANY_CAROUSEL_MAX = 5;

/** Keys in insertion order — must match `readExecutiveInsightSnapshot`. */
const EXEC_INSIGHT_SNAPSHOT_KEYS = [
  "openPipeAmount",
  "forecastAmount",
  "gapToForecast",
  "closedWonAmount",
  "largeDealAmount",
  "earlyStageAmount",
  "lateStageAmount",
  "cqOpenAmount",
  "healthyAmount",
  "needsAmount",
  "riskAmount",
  "largeAtRiskAmount",
  "pacing",
  "gapPct",
  "attainment",
  "coverageRatio",
  "totalPipelineCoverageRatio",
  "conversionNeeded",
  "lateQuarterPct",
  "healthyPct",
  "riskPct",
  "earlyStagePct",
  "lateStagePct",
  "largeDealPct",
  "winRate",
  "topBlName",
  "topBlAmt",
  "medianTimeToCloseDays",
  "countOpenRows",
  "countHealthyRows",
  "countNeedsRows",
  "countRiskRows",
  "countLargeDealRows",
  "countLargeAtRiskRows",
  "countCqRows",
  "totalClosedCount",
  "wonCount",
];

function readExecutiveInsightSnapshot(dm) {
  const z = (v) => toNumber(v) || 0;
  const nOrNull = (v) => {
    const n = toNumber(v);
    return Number.isFinite(n) ? n : null;
  };

  if (!dm) {
    return {
      openPipeAmount: 0,
      forecastAmount: 0,
      gapToForecast: 0,
      closedWonAmount: 0,
      largeDealAmount: 0,
      earlyStageAmount: 0,
      lateStageAmount: 0,
      cqOpenAmount: 0,
      healthyAmount: 0,
      needsAmount: 0,
      riskAmount: 0,
      largeAtRiskAmount: 0,
      pacing: null,
      gapPct: null,
      attainment: null,
      coverageRatio: null,
      totalPipelineCoverageRatio: null,
      conversionNeeded: null,
      lateQuarterPct: 0,
      healthyPct: 0,
      riskPct: 0,
      earlyStagePct: 0,
      lateStagePct: 0,
      largeDealPct: 0,
      winRate: null,
      topBlName: "",
      topBlAmt: 0,
      medianTimeToCloseDays: null,
      countOpenRows: 0,
      countHealthyRows: 0,
      countNeedsRows: 0,
      countRiskRows: 0,
      countLargeDealRows: 0,
      countLargeAtRiskRows: 0,
      countCqRows: 0,
      totalClosedCount: 0,
      wonCount: 0,
    };
  }

  const top = dm.rollups?.topBusinessLine;
  const c = dm.counts || {};

  return {
    openPipeAmount: z(dm.amounts?.openPipeAmount),
    forecastAmount: z(dm.amounts?.forecastAmount),
    gapToForecast: z(dm.amounts?.gapToForecast),
    closedWonAmount: z(dm.amounts?.closedWonAmount),
    largeDealAmount: z(dm.amounts?.largeDealAmount),
    earlyStageAmount: z(dm.amounts?.earlyStageAmount),
    lateStageAmount: z(dm.amounts?.lateStageAmount),
    cqOpenAmount: z(dm.amounts?.cqOpenAmount),
    healthyAmount: z(dm.amounts?.healthyAmount),
    needsAmount: z(dm.amounts?.needsAmount),
    riskAmount: z(dm.amounts?.riskAmount),
    largeAtRiskAmount: z(dm.amounts?.largeAtRiskAmount),
    pacing: nOrNull(dm.ratios?.pacing),
    gapPct: nOrNull(dm.ratios?.gapToForecastPct),
    attainment: nOrNull(dm.ratios?.attainment),
    coverageRatio: nOrNull(dm.ratios?.coverageRatio),
    totalPipelineCoverageRatio: nOrNull(dm.ratios?.totalPipelineCoverageRatio),
    conversionNeeded: nOrNull(dm.ratios?.conversionNeeded),
    lateQuarterPct: nOrNull(dm.ratios?.lateQuarterPct) ?? 0,
    healthyPct: nOrNull(dm.ratios?.healthyPct) ?? 0,
    riskPct: nOrNull(dm.ratios?.riskPct) ?? 0,
    earlyStagePct: nOrNull(dm.ratios?.earlyStagePct) ?? 0,
    lateStagePct: nOrNull(dm.ratios?.lateStagePct) ?? 0,
    largeDealPct: nOrNull(dm.ratios?.largeDealPct) ?? 0,
    winRate: nOrNull(dm.ratios?.winRate),
    topBlName: top?.[0] != null ? String(top[0]) : "",
    topBlAmt: z(top?.[1]),
    medianTimeToCloseDays:
      typeof dm.rollups?.medianTimeToCloseDays === "number" &&
      Number.isFinite(dm.rollups.medianTimeToCloseDays)
        ? dm.rollups.medianTimeToCloseDays
        : null,
    countOpenRows: z(c.openRows),
    countHealthyRows: z(c.healthyRows),
    countNeedsRows: z(c.needsRows),
    countRiskRows: z(c.riskRows),
    countLargeDealRows: z(c.largeDealRows),
    countLargeAtRiskRows: z(c.largeAtRiskRows),
    countCqRows: z(c.cqRows),
    totalClosedCount: z(c.totalClosedCount),
    wonCount: z(c.wonCount),
  };
}

function formatPct0(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function shuffleArrayInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

export function useExecutiveInsights({ derivedMetrics, shuffleNonce = 0 }) {
  const snap = readExecutiveInsightSnapshot(derivedMetrics);

  const stableInputKey = useMemo(
    () => JSON.stringify(snap),
    EXEC_INSIGHT_SNAPSHOT_KEYS.map((k) => snap[k])
  );

  return useMemo(() => {
    const openPipeAmount = snap.openPipeAmount;
    const forecastAmount = snap.forecastAmount;
    const gapToForecast = snap.gapToForecast;
    const closedWonAmount = snap.closedWonAmount;
    const largeDealAmount = snap.largeDealAmount;
    const earlyStageAmount = snap.earlyStageAmount;
    const lateStageAmount = snap.lateStageAmount;

    const pacing = snap.pacing;
    const gapPct = snap.gapPct;
    const attainment = snap.attainment;
    const coverageRatio = snap.coverageRatio;
    const totalPipelineCoverageRatio = snap.totalPipelineCoverageRatio;
    const conversionNeeded = snap.conversionNeeded;
    const lateQuarterPct = snap.lateQuarterPct;
    const healthyPct = snap.healthyPct;
    const riskPct = snap.riskPct;
    const earlyStagePct = snap.earlyStagePct;
    const lateStagePct = snap.lateStagePct;
    const largeDealPct = snap.largeDealPct;
    const winRate = snap.winRate;

    const cqOpenAmount = snap.cqOpenAmount;
    const healthyAmount = snap.healthyAmount;
    const needsAmount = snap.needsAmount;
    const riskAmount = snap.riskAmount;
    const largeAtRiskAmount = snap.largeAtRiskAmount;

    const topBusinessLine = snap.topBlName ? [snap.topBlName, snap.topBlAmt] : null;
    const medianTimeToCloseDays = snap.medianTimeToCloseDays;

    const dm = derivedMetrics;
    const openRows = dm?.rows?.openRows || [];

    const totalClosedCount = snap.totalClosedCount;

    const largeAtRiskRowCount = snap.countLargeAtRiskRows;
    const largeDealRowCount = snap.countLargeDealRows;
    const openRowCount = snap.countOpenRows;

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
        teaser: "Timing risk",
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
        headline: `${largeAtRiskRowCount} large deals (${fmtMoneyCompact(
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
        teaser: "Needs attn",
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
        teaser: "CQ pipeline pacing",
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

    if (pacing != null && pacing >= 1 && forecastAmount > 0) {
      companyItems.push({
        key: "ahead_of_plan",
        teaser: "Attainment",
        headline: `Closed won is ${formatPct0(attainment ?? pacing)} of forecast — currently at or ahead of linear quarter pacing.`,
        supporting: [
          gapToForecast > 0
            ? `Remaining gap to full forecast is ${fmtMoneyCompact(gapToForecast)}.`
            : `Forecast target is fully covered by closed won to date.`,
          openPipeAmount > 0
            ? `Open pipeline adds ${fmtMoneyCompact(openPipeAmount)} of additional upside.`
            : null,
        ].filter(Boolean),
      });
    }

    if (
      openPipeAmount > 0 &&
      totalPipelineCoverageRatio != null &&
      totalPipelineCoverageRatio >= 2.5 &&
      forecastAmount > 0
    ) {
      companyItems.push({
        key: "deep_coverage",
        teaser: "Deep coverage",
        headline: `Total pipeline coverage (open + closed won) is ${fmtX(
          totalPipelineCoverageRatio
        )} against forecast — multiple paths to plan.`,
        supporting: [
          coverageRatio != null
            ? `Open pipeline alone is ${fmtX(coverageRatio)} of forecast.`
            : null,
          conversionNeeded != null && openPipeAmount > 0
            ? `${formatPct0(conversionNeeded)} of open ACV must still convert to close the full gap.`
            : null,
        ].filter(Boolean),
      });
    }

    if (openPipeAmount > 0 && earlyStagePct >= 0.45) {
      companyItems.push({
        key: "top_of_funnel",
        teaser: "Early-stage mix",
        headline: `${formatPct0(earlyStagePct)} of open ACV sits in early stages (0–3) — monitor qualification and exit criteria.`,
        supporting: [
          earlyStageAmount > 0
            ? `Early-stage open pipeline totals ${fmtMoneyCompact(earlyStageAmount)}.`
            : null,
          lateStagePct > 0
            ? `${formatPct0(lateStagePct)} of open ACV is already in late stages (4–6).`
            : null,
        ].filter(Boolean),
      });
    }

    if (openPipeAmount > 0 && lateStagePct >= 0.4) {
      companyItems.push({
        key: "late_stage_focus",
        teaser: "Late-stage",
        headline: `${formatPct0(lateStagePct)} of open ACV is in late stages (4–6) — focus on validation, procurement, and close plans.`,
        supporting: [
          lateStageAmount > 0
            ? `Late-stage open pipeline totals ${fmtMoneyCompact(lateStageAmount)}.`
            : null,
          medianTimeToCloseDays != null && cqOpenAmount > 0
            ? `Median time to close across current-quarter deals is ${medianTimeToCloseDays} days.`
            : null,
        ].filter(Boolean),
      });
    }

    if (openPipeAmount > 0 && riskPct >= 0.12) {
      companyItems.push({
        key: "at_risk_share",
        teaser: "At Risk share",
        headline: `${formatPct0(riskPct)} of open ACV is flagged At Risk — prioritize recovery plays and exec sponsorship.`,
        supporting: [
          riskAmount > 0 ? `At Risk exposure totals ${fmtMoneyCompact(riskAmount)}.` : null,
          healthyPct > 0
            ? `${formatPct0(healthyPct)} of open ACV remains Healthy, providing a stabilizing base.`
            : null,
        ].filter(Boolean),
      });
    }

    if (largeDealAmount > 0 && largeAtRiskAmount <= 0 && largeDealRowCount > 0) {
      companyItems.push({
        key: "large_deals_stable",
        teaser: "Large deals",
        headline: `${largeDealRowCount} large ($500K+) deals in open pipeline (${fmtMoneyCompact(
          largeDealAmount
        )}) — none flagged At Risk right now.`,
        supporting: [
          openPipeAmount > 0 && largeDealPct > 0
            ? `Large deals represent ${formatPct0(largeDealPct)} of open pipeline ACV.`
            : null,
          topBusinessLine ? `${topBusinessLine[0]} leads concentration among open business lines.` : null,
        ].filter(Boolean),
      });
    }

    if (winRate != null && totalClosedCount >= 5 && (winRate <= 0.35 || winRate >= 0.65)) {
      const lean = winRate <= 0.35 ? "below" : "above";
      companyItems.push({
        key: "win_rate_signal",
        teaser: "Win rate",
        headline: `Win rate is ${formatPct0(winRate)} across ${totalClosedCount} closed opportunities — ${lean} typical peer bands for this cohort.`,
        supporting: [
          closedWonAmount > 0
            ? `Closed won ACV totals ${fmtMoneyCompact(closedWonAmount)} quarter-to-date.`
            : null,
          openPipeAmount > 0
            ? `Open pipeline remains ${fmtMoneyCompact(openPipeAmount)}.`
            : null,
        ].filter(Boolean),
      });
    }

    if (openPipeAmount > 0 && lateQuarterPct > 0 && lateQuarterPct < 0.12) {
      companyItems.push({
        key: "timing_spread",
        teaser: "Close timing",
        headline: `Only ${formatPct0(
          lateQuarterPct
        )} of open ACV closes in the final two weeks — timing is relatively spread across the quarter.`,
        supporting: [
          cqOpenAmount > 0
            ? `Current-quarter open pipeline is ${fmtMoneyCompact(cqOpenAmount)}.`
            : null,
          medianTimeToCloseDays != null
            ? `Median time to close is ${medianTimeToCloseDays} days.`
            : null,
        ].filter(Boolean),
      });
    }

    if (openPipeAmount >= 500000) {
      companyItems.push({
        key: "open_pipe_scale",
        teaser: "Open pipe",
        headline: `Open pipeline stands at ${fmtMoneyCompact(openPipeAmount)} across ${openRowCount} open opportunities.`,
        supporting: [
          topBusinessLine
            ? `${topBusinessLine[0]} is the largest business-line slice of that open ACV.`
            : null,
          forecastAmount > 0 && coverageRatio != null
            ? `That is ${fmtX(coverageRatio)} coverage against the ${fmtMoneyCompact(forecastAmount)} forecast.`
            : null,
        ].filter(Boolean),
      });
    }

    const pool = shuffleArrayInPlace([...companyItems]);
    const companyCarousel = pool.slice(0, Math.min(COMPANY_CAROUSEL_MAX, pool.length));

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
        items: companyCarousel,
        active: companyCarousel[0] || null,
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
    // `derivedMetrics` omitted from deps: `stableInputKey` captures the scalar snapshot so we
    // do not reshuffle when the parent passes a new `derivedMetrics` object with the same data.
     
  }, [stableInputKey, shuffleNonce]);
}

export default useExecutiveInsights;
