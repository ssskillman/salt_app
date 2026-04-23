import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";

// Compact number formatting for totals/tooltip/visualMap labels
function fmtAbbrev(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const abs = Math.abs(x);

  if (abs >= 1e12) return `${(x / 1e12).toFixed(1).replace(/\.0$/, "")}T`;
  if (abs >= 1e9) return `${(x / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1e6) return `${(x / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1e3) return `${(x / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(x).toLocaleString()}`;
}

function quantile(sortedAsc, q) {
  if (!sortedAsc.length) return 0;
  const pos = (sortedAsc.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const a = sortedAsc[base];
  const b = sortedAsc[Math.min(base + 1, sortedAsc.length - 1)];
  return a + (b - a) * rest;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function applyGamma01(t, gamma = 0.55) {
  // t in [0,1]
  return Math.pow(clamp(t, 0, 1), gamma);
}


export default function CalendarUsage({ data = [] }) {
  const optionAndSizing = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return null;

    const byYear = new Map();
    const rawVals = [];
    let totalRaw = 0;

    // Data is expected as: [{ date: "YYYY-MM-DD", value: number }, ...]
    for (const r of data) {
      const rawDate = r?.date ?? r?.["Metrics Date"] ?? r?.["METRICS_DATE"];
      const rawVal = r?.value ?? r?.["Emails Sent"] ?? r?.["EMAILS_SENT"];

      if (!rawDate) continue;

      let cleanDate = null;

      const s = String(rawDate).trim();
      
      // Epoch ms or seconds -> YYYY-MM-DD
      if (/^\d+$/.test(s)) {
        const n = Number(s);
        const ms = s.length <= 10 ? n * 1000 : n;
        cleanDate = new Date(ms).toISOString().slice(0, 10);
      } else {
        // "2025-08-11 00:00:00" -> "2025-08-11"
        cleanDate = s.split(" ")[0];
      }
      
      const year = Number(cleanDate.slice(0, 4));
      
      const v = Number(rawVal) || 0;

      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push([cleanDate, v]);

      rawVals.push(v);
      totalRaw += v;
    }

    const years = Array.from(byYear.keys()).sort((a, b) => b - a).slice(0, 4);
    if (years.length === 0) return null;

    // --- KEY CHANGE #1: percentile-based color scale (prevents "all same color")
    const sorted = [...rawVals].sort((a, b) => a - b);
    const p05 = quantile(sorted, 0.05);
    const p95 = quantile(sorted, 0.95);

    // Guard rails (avoid zero-width ranges)
    const scaleMin = Math.max(0, p05);
    const scaleMax = Math.max(scaleMin + 1, p95);

    // Blue gradient (light -> max)
    //const COLOR_LOW = "#EEF5FF";
    //const COLOR_HIGH = "#5B97FF";
    const COLOR_LOW = "#F8FBFF";   // near-white
    const COLOR_HIGH = "#1E40AF";  // deep blue (stronger contrast)

    const height = years.length * 150 + 140;

    return {
      height,
      option: {
        grid: { left: 0, right: 0, top: 0, bottom: 0 },

        // --- KEY CHANGE #2: keep slider stable (no hover overriding range)
        visualMap: {
          type: "continuous",
          min: scaleMin,
          max: scaleMax,
          calculable: true,
          realtime: true,
          hoverLink: false, // <-- stops hover from changing slider value
          orient: "horizontal",
          left: "center",
          bottom: 22,
          inRange: { color: [COLOR_LOW, COLOR_HIGH] },
          text: ["High", "Low"],
          formatter: (v) => fmtAbbrev(v),
          text: ["High (p95)", "Low (p05)"],
        },

        tooltip: {
          formatter: (p) => {
            // data is [date, clampedForColor, rawValue]
            const d = p?.data?.[0];
            const raw = p?.data?.[2] ?? p?.data?.[1] ?? 0;
            return `${d}<br/>${fmtAbbrev(raw)} Sends`;
          },
        },

        calendar: years.map((year, idx) => ({
          top: 54 + idx * 150,
          left: 60,
          right: 20,
          range: String(year),
          cellSize: ["auto", 14],

          yearLabel: {
            show: true,
            margin: 40,
            fontWeight: 800,
            color: "#64748b",
          },

          // Stronger day delineation
          splitLine: {
            show: true,
            lineStyle: {
              color: "rgba(15,23,42,0.12)",
              width: 1,
            },
          },
          itemStyle: {
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.26)",
          },
        })),

        series: years.map((year, idx) => ({
          type: "heatmap",
          coordinateSystem: "calendar",
          calendarIndex: idx,

          // data: [date, valueForColor, rawValue]
          // We CLAMP only the color dimension to [scaleMin, scaleMax]
          // so the gradient spreads nicely while tooltip still shows raw.
//          data: byYear.get(year).map(([d, raw]) => [d, clamp(raw, scaleMin, scaleMax), raw]),

          data: byYear.get(year).map(([d, raw]) => {
            const capped = clamp(raw, scaleMin, scaleMax);

            // normalize into [0,1]
            const t = (capped - scaleMin) / (scaleMax - scaleMin || 1);

            // gamma < 1 expands high-end contrast
            const tg = applyGamma01(t, 0.50);

            // map back to the visualMap numeric range
            const vForColor = scaleMin + tg * (scaleMax - scaleMin);

            return [d, vForColor, raw];
          }),

          emphasis: {
            itemStyle: {
              borderColor: "rgba(15,23,42,0.35)",
              borderWidth: 1,
            },
          },
        })),

        // Header text inside chart area
        graphic: [
          {
            type: "text",
            left: 24,
            top: 16,
            style: {
              text: `Total: ${fmtAbbrev(totalRaw)} Sends`,
              fontSize: 12,
              fontWeight: 800,
              fill: "rgba(15, 23, 42, 0.70)",
              fontFamily: "system-ui",
            },
          },
        ],
      },
    };
  }, [data]);

  if (!optionAndSizing) {
    return (
      <div
        style={{
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed #cbd5e1",
          borderRadius: 12,
          color: "#94a3b8",
        }}
      >
        Waiting for daily usage rows...
      </div>
    );
  }

  return (
    <div style={{ height: optionAndSizing.height, width: "100%" }}>
      <ReactECharts option={optionAndSizing.option} style={{ height: "100%" }} notMerge />
    </div>
  );
}
