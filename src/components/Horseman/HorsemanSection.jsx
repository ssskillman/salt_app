// src/components/Horseman/HorsemanSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import Surface from "../ui/Surface";
import SurfaceHeader from "../ui/SurfaceHeader";
import HorsemanBars, { HorsemanLegend } from "./HorsemanBars";
import PillMultiSelect from "./PillMultiSelect";
import HorsemanDrillModal from "./HorsemanDrillModal";
import { normalizeOutcome, resolveColumnKey } from "../../utils/data";
import { toNumber } from "../../utils/formatters";

/** Default Recharts bar thickness (Created-by scroll height is derived from this). */
const HORSEMAN_BAR_SIZE = 26;
/** Pixels per category row for inner chart height (bar + band); tuned so ~8 rows fit the default viewport. */
const CHART_ROW_PITCH = 32;

function normText(v) {
  return String(v ?? "").trim().toLowerCase();
}

function ActiveOutcomeBadge({ label, color }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.82)",
        border: "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 4px 10px rgba(15,23,42,0.05)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color,
          flex: "0 0 auto",
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: "rgba(15,23,42,0.78)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function ScopeHeaderPill({ label }) {
  if (!label) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        borderRadius: 999,
        background: "rgba(89,193,167,0.14)",
        border: "1px solid rgba(89,193,167,0.30)",
        color: "rgba(15,23,42,0.90)",
        fontSize: 12,
        fontWeight: 950,
        whiteSpace: "nowrap",
        maxWidth: 220,
      }}
      title={label}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "#59C1A7",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function BusinessLineHeaderPill({ businessLine }) {
  if (!businessLine || businessLine === "All") return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.58)",
        border: "1px solid rgba(15,23,42,0.10)",
        color: "rgba(15,23,42,0.84)",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
        maxWidth: 320,
      }}
      title={`Business Line: ${businessLine}`}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "#3B82F6",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {businessLine}
      </span>
    </div>
  );
}

export default function HorsemanSection({
  horsemanRows = [],
  horsemanRowsByCreatedBy,
  horsemanDetailRows = [],
  config,
  onInfo,
  onOpenDefinitions,
  /** Optional: capture last section + metric label for dashboard feedback context. */
  onFeedbackAnchorCapture,
  /** Optional: notify parent when Horseman drill modal opens/closes (blocking / stacking UX). */
  onDrillModalOpenChange,
  height = 280,
  wrapInSurface = true,
  surfaceStyle = null,
  title = "HORSEMAN",
  fieldScopeLabel = "Global",
  fieldScopeIsGlobal = true,
  fieldScopeUserCount = 0,
  businessLine,
}) {
  /** Active segment keys only change via pill toggles — never auto-pruned from chart data. */
  const [outcomes, setOutcomes] = useState(["won", "lost", "open"]);
  const [bucketMode, setBucketMode] = useState("source");
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillState, setDrillState] = useState({
    source: null,
    outcome: null,
  });
  const outcomeSet = useMemo(() => new Set(outcomes), [outcomes]);

  const createdBySupported = useMemo(() => {
    const hmCb = resolveColumnKey(config?.hm_created_by);
    const hasEsoSlice =
      Array.isArray(horsemanRowsByCreatedBy) && horsemanRowsByCreatedBy.length > 0;
    return !!(hmCb || hasEsoSlice);
  }, [config, horsemanRowsByCreatedBy]);

  useEffect(() => {
    if (!createdBySupported && bucketMode === "created_by") {
      setBucketMode("source");
    }
  }, [createdBySupported, bucketMode]);

  const keys = useMemo(() => {
  return {
    hmSource: resolveColumnKey(config?.hm_source),
    hmCreatedBy: resolveColumnKey(config?.hm_created_by),
    hmOutcome: resolveColumnKey(config?.hm_outcome),
    hmValue: resolveColumnKey(config?.hm_value),

    hmdSource: resolveColumnKey(config?.hmd_source),
    hmdCreatedBy: resolveColumnKey(config?.hmd_created_by),
    hmdOutcome: resolveColumnKey(config?.hmd_outcome),
    hmdStage: resolveColumnKey(config?.hmd_stage),
    hmdOppName: resolveColumnKey(config?.hmd_opp_name),
    hmdOwner: resolveColumnKey(config?.hmd_owner),
    hmdArr: resolveColumnKey(config?.hmd_arr),
    hmdClose: resolveColumnKey(config?.hmd_close),
    hmdDealReview: resolveColumnKey(config?.hmd_deal_review),
    hmdDealReviewShort: resolveColumnKey(config?.hmd_deal_review_short),
    hmdOppId: resolveColumnKey(config?.hmd_opp_id),

    // ESO fallback support
    esoOppId: "eso_opp_id",
    esoOppName: "eso_opp",
    esoOwner: "eso_opp_owner_name",
    esoStage: "eso_stage",
    esoArr: "eso_arr",
    esoClose: "eso_close",
    esoDealReview: "eso_deal_review",
    esoDealReviewShort: "eso_deal_review_short",
  };
}, [config]);

  const chartInputRows = useMemo(() => {
    if (
      bucketMode === "created_by" &&
      Array.isArray(horsemanRowsByCreatedBy) &&
      horsemanRowsByCreatedBy.length > 0
    ) {
      return horsemanRowsByCreatedBy;
    }
    return horsemanRows;
  }, [bucketMode, horsemanRows, horsemanRowsByCreatedBy]);

  const chartData = useMemo(() => {
    const { hmSource, hmOutcome, hmValue, hmCreatedBy } = keys;

    const usesEsoCreatedBySlice =
      bucketMode === "created_by" &&
      Array.isArray(horsemanRowsByCreatedBy) &&
      horsemanRowsByCreatedBy.length > 0;

    const bucketCol = usesEsoCreatedBySlice
      ? hmSource
      : bucketMode === "created_by" && hmCreatedBy
        ? hmCreatedBy
        : hmSource;

    if (!bucketCol || !hmOutcome || !hmValue || !chartInputRows.length) return [];

    const agg = new Map();

    for (const r of chartInputRows) {
      const bucketLabel = String(r?.[bucketCol] ?? "").trim();
      if (!bucketLabel) continue;

      const outcome = normalizeOutcome(r?.[hmOutcome]);
      const value = toNumber(r?.[hmValue]) ?? 0;

      if (!agg.has(bucketLabel)) {
        agg.set(bucketLabel, { won: 0, lost: 0, open: 0 });
      }

      const cur = agg.get(bucketLabel);
      cur[outcome] = (cur[outcome] ?? 0) + value;
    }

    return Array.from(agg.entries())
      .map(([name, o]) => ({
        name,
        won: o.won,
        lost: o.lost,
        open: o.open,
        total:
          (outcomeSet.has("won") ? o.won : 0) +
          (outcomeSet.has("lost") ? o.lost : 0) +
          (outcomeSet.has("open") ? o.open : 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [chartInputRows, keys, outcomeSet, bucketMode, horsemanRowsByCreatedBy]);

  const chartInnerHeightCreatedBy = useMemo(() => {
    const n = chartData.length;
    if (!n) return height;
    return Math.max(Math.ceil(n * CHART_ROW_PITCH + 24), height);
  }, [chartData.length, height]);

  /** Same width for Source and Created by so category labels sit like Source (flush toward bars). */
  const yAxisLabelWidth = 100;

const filteredDrillRows = useMemo(() => {
  const { source, outcome } = drillState;
  const { hmdSource, hmdCreatedBy, hmdOutcome, hmdStage } = keys;

  if (!source || !outcome) return [];

  return horsemanDetailRows.filter((r) => {
    const rowBucket = normText(
      bucketMode === "created_by"
        ? (r?.eso_created_by ?? (hmdCreatedBy ? r?.[hmdCreatedBy] : ""))
        : (r?.eso_source ?? (hmdSource ? r?.[hmdSource] : ""))
    );

    const clickedSource = normText(source);

    if (rowBucket !== clickedSource) return false;

    // ✅ Prefer ESO outcome
    const rowOutcome = normalizeOutcome(
      r?.eso_outcome ??
      r?.[hmdOutcome] ??
      r?.[hmdStage]
    );

    return rowOutcome === outcome;
  });
}, [drillState, horsemanDetailRows, keys, bucketMode]);

  const toggleOutcome = (key) => {
    setOutcomes((prev) => {
      const next = new Set(prev);

      if (next.has(key)) {
        if (next.size === 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }

      // Always won → lost → open (left → middle → right); never Set insertion order.
      return ["won", "lost", "open"].filter((k) => next.has(k));
    });
  };

  const handleSegmentClick = ({ source, outcome }) => {
    if (!source || !outcome) return;

    onFeedbackAnchorCapture?.({
      section: title,
      metricCard: `${source} · ${outcome}`,
    });
    setDrillState({ source, outcome });
    setDrillOpen(true);
    onDrillModalOpenChange?.(true);
  };

const modalFieldKeys = useMemo(() => {
  const sample = horsemanDetailRows?.[0] || {};

  const hasEsoShape =
    "eso_opp_id" in sample ||
    "eso_opp" in sample ||
    "eso_source" in sample ||
    "eso_created_by" in sample ||
    "eso_outcome" in sample;

  if (hasEsoShape) {
    return {
      oppIdKey: keys.esoOppId,
      oppNameKey: keys.esoOppName,
      ownerKey: keys.esoOwner,
      stageKey: keys.esoStage,
      arrKey: keys.esoArr,
      closeKey: keys.esoClose,
      dealReviewKey: keys.esoDealReview,
      dealReviewShortKey: keys.esoDealReviewShort,
    };
  }

  return {
    oppIdKey: keys.hmdOppId,
    oppNameKey: keys.hmdOppName,
    ownerKey: keys.hmdOwner,
    stageKey: keys.hmdStage,
    arrKey: keys.hmdArr,
    closeKey: keys.hmdClose,
    dealReviewKey: keys.hmdDealReview,
    dealReviewShortKey: keys.hmdDealReviewShort,
  };
}, [horsemanDetailRows, keys]);


  const inner = (
    <>
      <SurfaceHeader
        title={title}
        onInfo={onInfo}
        rightNode={
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {!fieldScopeIsGlobal && <ScopeHeaderPill label={fieldScopeLabel} />}
            <BusinessLineHeaderPill businessLine={businessLine} />
          </div>
        }
      />

      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {createdBySupported ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 950,
                  letterSpacing: 0.45,
                  textTransform: "uppercase",
                  color: "rgba(15,23,42,0.45)",
                }}
              >
                Axis
              </span>
              <button
                type="button"
                onClick={() => setBucketMode("source")}
                style={{
                  appearance: "none",
                  border:
                    bucketMode === "source"
                      ? "1px solid rgba(89,193,167,0.34)"
                      : "1px solid rgba(15,23,42,0.12)",
                  background:
                    bucketMode === "source" ? "rgba(89,193,167,0.16)" : "white",
                  color: "rgba(15,23,42,0.88)",
                  borderRadius: 999,
                  padding: "6px 11px",
                  fontSize: 11,
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                Source
              </button>
              <button
                type="button"
                onClick={() => setBucketMode("created_by")}
                style={{
                  appearance: "none",
                  border:
                    bucketMode === "created_by"
                      ? "1px solid rgba(89,193,167,0.34)"
                      : "1px solid rgba(15,23,42,0.12)",
                  background:
                    bucketMode === "created_by" ? "rgba(89,193,167,0.16)" : "white",
                  color: "rgba(15,23,42,0.88)",
                  borderRadius: 999,
                  padding: "6px 11px",
                  fontSize: 11,
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                Created by
              </button>
            </div>
          ) : null}

          <div
            style={{
              fontSize: 11,
              fontWeight: 950,
              letterSpacing: 0.45,
              textTransform: "uppercase",
              color: "rgba(15,23,42,0.50)",
            }}
          >
            Active segments
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <PillMultiSelect
            valueSet={outcomeSet}
            onToggle={toggleOutcome}
            options={[
              { label: "Closed Won", value: "won" },
              { label: "Closed Lost", value: "lost" },
              { label: "Open Pipeline", value: "open" },
            ]}
          />
        </div>
      </div>

      {chartData.length ? (
        bucketMode === "created_by" ? (
          <>
            <div
              style={{
                position: "relative",
                marginTop: 12,
                height,
                maxHeight: height,
                overflow: "hidden",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.08)",
                background: "rgba(255,255,255,0.35)",
              }}
            >
              {/*
                Inner layer scrolls the tall chart only. Legend stays a sibling of this layer
                so position:absolute bottom-right is anchored to the visible card (true float).
              */}
              <div
                style={{
                  position: "relative",
                  zIndex: 0,
                  height: "100%",
                  width: "100%",
                  overflowY:
                    chartInnerHeightCreatedBy > height + 1 ? "auto" : "hidden",
                  overflowX: "hidden",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                <div style={{ height: chartInnerHeightCreatedBy, width: "100%" }}>
                  <HorsemanBars
                    data={chartData}
                    keys={outcomes}
                    onSegmentClick={handleSegmentClick}
                    barSize={HORSEMAN_BAR_SIZE}
                    yAxisWidth={yAxisLabelWidth}
                    yAxisWidthMode="fitLabels"
                    suppressLegend
                  />
                </div>
              </div>
              <HorsemanLegend keys={outcomes} />
            </div>
          </>
        ) : (
          <div style={{ height, marginTop: 12 }}>
            <HorsemanBars
              data={chartData}
              keys={outcomes}
              onSegmentClick={handleSegmentClick}
              barSize={HORSEMAN_BAR_SIZE}
              yAxisWidth={yAxisLabelWidth}
              yAxisWidthMode="fixed"
            />
          </div>
        )
      ) : (
        <div
          style={{
            marginTop: 10,
            height,
            borderRadius: 12,
            border: "1px dashed rgba(15,23,42,0.18)",
            background: "rgba(255,255,255,0.6)",
            display: "grid",
            placeItems: "center",
            color: "rgba(15,23,42,0.65)",
            fontSize: 12,
            fontWeight: 850,
          }}
        >
          No Horseman data (check hm_source, hm_outcome, hm_value on chart rows. Created-by axis uses the scoped opportunity spine: map ESO · Opportunity Created By, or map CORE · HM: Created By to a column that exists on that spine.)
        </div>
      )}

      <HorsemanDrillModal
        open={drillOpen}
        onClose={() => {
          setDrillOpen(false);
          onDrillModalOpenChange?.(false);
        }}
        source={drillState.source}
        bucketAxisLabel={bucketMode === "created_by" ? "Created by" : "Source"}
        outcome={drillState.outcome}
        rows={filteredDrillRows}
        oppIdKey={modalFieldKeys.oppIdKey}
        oppNameKey={modalFieldKeys.oppNameKey}
        ownerKey={modalFieldKeys.ownerKey}
        stageKey={modalFieldKeys.stageKey}
        arrKey={modalFieldKeys.arrKey}
        closeKey={modalFieldKeys.closeKey}
        dealReviewKey={modalFieldKeys.dealReviewKey}
        dealReviewShortKey={modalFieldKeys.dealReviewShortKey}
        fieldScopeLabel={fieldScopeLabel}
        fieldScopeIsGlobal={!!fieldScopeIsGlobal}
        fieldScopeUserCount={fieldScopeUserCount ?? 0}
        businessLine={businessLine ?? "All"}
        onOpenDefinitions={onOpenDefinitions}
      />
    </>
  );

  if (!wrapInSurface) return inner;

  return <Surface style={surfaceStyle || undefined}>{inner}</Surface>;
}