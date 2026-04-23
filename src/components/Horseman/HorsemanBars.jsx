//src/components/Horseman/HorsemanBars.jsx

import React, { useLayoutEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Rectangle,
} from "recharts";
import { fmtMoneyCompact } from "../../utils/formatters";
import { useChartPalette } from "../../hooks/useChartPalette";

const OUTCOME_LABEL = {
  won: "Closed Won",
  open: "Open Pipeline",
  lost: "Closed Lost",
};

/**
 * Stack order (left → right): Closed Won | Closed Lost (if on) | Open Pipeline.
 * Matches how reps read the funnel; do not follow filter click order.
 */
const CANONICAL_STACK = ["won", "lost", "open"];

/** First / last segment index (in stack order) with positive width for rounding & labels. */
function stackExtentIndices(payload, orderedKeys) {
  const values = orderedKeys.map((key) => Math.max(0, Number(payload?.[key]) || 0));
  let firstNZ = -1;
  let lastNZ = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > 0) {
      if (firstNZ === -1) firstNZ = i;
      lastNZ = i;
    }
  }
  return { firstNZ, lastNZ, values };
}

/**
 * [topLeft, topRight, bottomRight, bottomLeft] — only the true outer ends of the stack get radius
 * (avoids “double pill” notches where segments meet). `cornerR` should be ≤ half the bar thickness/width.
 */
function radiusForSegment(payload, segmentKey, orderedKeys, cornerR) {
  const segIdx = orderedKeys.indexOf(segmentKey);
  const { firstNZ, lastNZ } = stackExtentIndices(payload, orderedKeys);
  if (firstNZ < 0) return [0, 0, 0, 0];
  const r = Math.max(0, cornerR);
  const leftRound = segIdx === firstNZ;
  const rightRound = segIdx === lastNZ;
  return [
    leftRound ? r : 0,
    rightRound ? r : 0,
    rightRound ? r : 0,
    leftRound ? r : 0,
  ];
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const sortedPayload = [...payload].sort((a, b) => {
      const ak = String(a?.dataKey ?? a?.id ?? "");
      const bk = String(b?.dataKey ?? b?.id ?? "");
      return CANONICAL_STACK.indexOf(ak) - CANONICAL_STACK.indexOf(bk);
    });

    const total = sortedPayload.reduce((sum, entry) => sum + (entry.value || 0), 0);

    return (
      <div
        style={{
          backgroundColor: "rgba(30, 41, 59, 0.95)",
          color: "#fff",
          padding: "12px",
          borderRadius: "8px",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
          fontSize: "12px",
          minWidth: "160px",
        }}
      >
        <div
          style={{
            fontWeight: 900,
            marginBottom: "8px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {label}
        </div>

        {sortedPayload.map((entry, index) => (
          <div
            key={String(entry?.dataKey ?? entry?.id ?? index)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "2px",
                  backgroundColor: entry.fill,
                }}
              />
              <span style={{ fontWeight: 700 }}>{entry.name}:</span>
            </div>
            <span style={{ fontWeight: 900 }}>{fmtMoneyCompact(entry.value)}</span>
          </div>
        ))}

        <div
          style={{
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: "1px solid rgba(255,255,255,0.2)",
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 900,
          }}
        >
          <span>Total:</span>
          <span>{fmtMoneyCompact(total)}</span>
        </div>
      </div>
    );
  }

  return null;
};

function segmentClickPayload(barData, outcomeKey) {
  const row = barData?.payload ?? barData;
  const source = row?.name;
  const value =
    barData?.value ??
    row?.[outcomeKey] ??
    0;
  return { source, value };
}

/** Max Y-axis band (px) for Created-by after measuring tick labels (avoids Recharts `width="auto"` leaving a wide gap). */
const FIT_LABELS_YAXIS_CAP = 240;

function measureTickTextMaxWidthPx(labels, font = "800 11px ui-sans-serif, system-ui, sans-serif") {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = font;
  let max = 0;
  for (const raw of labels) {
    const t = String(raw ?? "");
    if (!t) continue;
    max = Math.max(max, ctx.measureText(t).width);
  }
  if (max <= 0) return null;
  /* Tight inset: ticks are `textAnchor: end` at the band’s right edge. */
  return Math.ceil(Math.min(max + 4, FIT_LABELS_YAXIS_CAP));
}

/**
 * Legend for stacked Horseman outcomes.
 * Render inside a `position: relative` ancestor: `absolute` bottom-right floats above the chart.
 * For Created-by, the chart scrolls in an inner wrapper so this stays outside the scroll layer.
 */
export function HorsemanLegend({ keys }) {
  const brand = useChartPalette();
  const orderedKeys = useMemo(
    () => CANONICAL_STACK.filter((k) => keys?.includes?.(k)),
    [keys]
  );

  if (orderedKeys.length <= 1) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        bottom: 10,
        zIndex: 30,
        backgroundColor: "white",
        padding: "10px 14px",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        border: "1px solid rgba(15,23,42,0.05)",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          fontWeight: 900,
          opacity: 0.4,
          letterSpacing: "0.5px",
        }}
      >
        LEGEND
      </div>

      {orderedKeys.map((k) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "3px",
              backgroundColor: brand[k],
            }}
          />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "var(--salt-text-muted)",
            }}
          >
            {OUTCOME_LABEL[k]}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function HorsemanBars({
  data,
  keys,
  onSegmentClick,
  /** Vertical bar thickness (Recharts `barSize`). */
  barSize = 26,
  /** Space for Y-axis category labels when `yAxisWidthMode` is `"fixed"`. */
  yAxisWidth = 100,
  /**
   * `fixed` — use `yAxisWidth` (Source-style multi-line labels).
   * `fitLabels` — Recharts `width="auto"` sizes the band to tick text (Created by).
   */
  yAxisWidthMode = "fixed",
  /** When true, legend is omitted here (Created-by renders `HorsemanLegend` outside the scroll layer). */
  suppressLegend = false,
}) {
  const brand = useChartPalette();
  const orderedKeys = CANONICAL_STACK.filter((k) => keys.includes(k));
  const showLegend = orderedKeys.length > 1 && !suppressLegend;

  const namesForMeasure = useMemo(
    () => (Array.isArray(data) ? data.map((d) => d?.name) : []),
    [data]
  );

  const [fitYAxisWidth, setFitYAxisWidth] = useState(null);
  useLayoutEffect(() => {
    if (yAxisWidthMode !== "fitLabels") {
      setFitYAxisWidth(null);
      return undefined;
    }
    const w = measureTickTextMaxWidthPx(namesForMeasure);
    setFitYAxisWidth(w ?? yAxisWidth);
    return undefined;
  }, [namesForMeasure, yAxisWidth, yAxisWidthMode]);

  const yAxisResolvedWidth =
    yAxisWidthMode === "fitLabels" ? (fitYAxisWidth ?? yAxisWidth) : yAxisWidth;
  const tickMarginPx = yAxisWidthMode === "fitLabels" ? 0 : 4;

  /** Pin 0 to the category axis so bars start flush; default numeric domain can exclude 0 and leave a wide empty band. */
  const xNumberDomain = ([dataMin, dataMax]) => {
    const lo = Number(dataMin);
    const hi = Number(dataMax);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, "auto"];
    return [Math.min(0, lo), Math.max(0, hi)];
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        /* Faster, more reliable taps (avoids double-tap-zoom delay on some mobile browsers). */
        touchAction: "manipulation",
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 96, left: 0, bottom: 5 }}
          barGap={0}
          reverseStackOrder={false}
          {...(yAxisWidthMode === "fitLabels" ? { barCategoryGap: 1 } : {})}
        >
          <XAxis type="number" hide domain={xNumberDomain} />
          <YAxis
            dataKey="name"
            type="category"
            orientation="left"
            padding={{ top: 0, bottom: 0 }}
            tick={{
              fontSize: 11,
              fontWeight: 800,
              fill: "var(--salt-text-muted)",
              /* Left Y-axis: end anchor keeps labels tight to the plot (same as Source). */
              textAnchor: "end",
              dominantBaseline: "middle",
            }}
            width={yAxisResolvedWidth}
            tickMargin={tickMarginPx}
            interval={0}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "var(--salt-card-scrim)" }}
            isAnimationActive={false}
            animationDuration={0}
          />

          {orderedKeys.map((k) => (
            <Bar
              key={k}
              /* Recharts 3 stacks by graphical item `id` (see getStackSeriesIdentifier), not dataKey — must match row keys. */
              id={k}
              dataKey={k}
              name={OUTCOME_LABEL[k]}
              stackId="hm"
              fill={brand[k]}
              cursor="pointer"
              /* Widen very small stacked segments so they stay easy to hit. */
              minPointSize={8}
              barSize={barSize}
              isAnimationActive={false}
              shape={(p) => {
                const w = Number(p?.width) || 0;
                const h = Number(p?.height) || 0;
                /* Recharts + minPointSize can yield 0<w<1 after scale; w<1 hid valid slivers (e.g. Closed Lost). */
                if (Math.abs(w) < 0.35 || Math.abs(h) < 0.35) return null;
                const cap = Math.min(4, w / 2 - 0.25, h / 2);
                const cornerR = Math.max(0, cap);
                const radius = radiusForSegment(p.payload, k, orderedKeys, cornerR);
                const segIdx = orderedKeys.indexOf(k);
                const { lastNZ } = stackExtentIndices(p.payload, orderedKeys);
                const showRowTotal =
                  lastNZ >= 0 ? segIdx === lastNZ : segIdx === 0;
                const x = Number(p?.x) || 0;
                const y = Number(p?.y) || 0;
                const labelX = x + w + 8;
                const labelY = y + h / 2;
                const total = p?.payload?.total ?? 0;
                const handleSegmentClick = () => {
                  const { source, value } = segmentClickPayload(p, k);
                  if (!source || !onSegmentClick) return;
                  onSegmentClick({ source, outcome: k, value });
                };
                return (
                  <>
                    <Rectangle
                      {...p}
                      radius={radius}
                      onClick={handleSegmentClick}
                      style={{ cursor: onSegmentClick ? "pointer" : "default" }}
                    />
                    {showRowTotal && (
                      <text
                        x={labelX}
                        y={labelY}
                        fill="rgba(15, 23, 42, 0.92)"
                        dominantBaseline="middle"
                        style={{ fontSize: 12, fontWeight: 950 }}
                        pointerEvents="none"
                      >
                        {fmtMoneyCompact(total)}
                      </text>
                    )}
                  </>
                );
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {showLegend ? <HorsemanLegend keys={keys} /> : null}
    </div>
  );
}