import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { fmtMoneyCompact, toNumber } from "../../utils/formatters";

/**
 * Expects `data` items like:
 *  { name: "Start", amount: 123 }
 *  { name: "Closed Won", amount: -456 }  (or +456 if you treat wins as positive delta)
 *  { name: "Total", amount: 789 }
 *
 * You can also pass netAmount instead of amount; we use whichever exists.
 */
export default function WaterfallChart({ data, onBarClick }) {
  const chartData = useMemo(() => {
    let running = 0;

    return (data || []).map((item) => {
      const name = item?.name ?? item?.step ?? "";
      const raw = item?.amount ?? item?.netAmount ?? 0;
      const delta = toNumber(raw) || 0;

      const isPillar = name === "Start" || name === "Total";
      let placeholder = 0;

      if (isPillar) {
        placeholder = 0;
        running = delta;
      } else {
        if (delta >= 0) {
          placeholder = running;
          running += delta;
        } else {
          running += delta;
          placeholder = running;
        }
      }

      return {
        ...item,
        name,
        delta,
        placeholder,
        isPillar,
      };
    });
  }, [data]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div
          style={{
            backgroundColor: "#16140C",
            color: "#ffffff",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "900",
            boxShadow: "0 10px 22px rgba(0,0,0,0.2)",
          }}
        >
          <div>{d.name}</div>
          <div style={{ marginTop: 4 }}>Amount: {fmtMoneyCompact(d.delta)}</div>
        </div>
      );
    }
    return null;
  };

  // -----------------------------
  // Labels
  // -----------------------------
  // Positive labels ABOVE bars
  const renderPosLabel = (props) => {
    const { x, y, width, value, index } = props;
    const delta = toNumber(value);

    if (!Number.isFinite(delta) || delta <= 0) return null;

    const entry = chartData?.[index] || {};
    const fontSize = entry.isPillar ? 18 : 16;

    // Small nudge upward so it’s clearly above the bar
    const dy = entry.isPillar ? 10 : 8;

    return (
      <text
        x={(x ?? 0) + (width ?? 0) / 2}
        y={(y ?? 0) - dy}
        fill="rgba(15,23,42,0.92)"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize, fontWeight: 1000 }}
        pointerEvents="none"
      >
        {fmtMoneyCompact(delta)}
      </text>
    );
  };

  // Negative labels BELOW bars
  const renderNegLabel = (props) => {
    const { x, y, width, value, index } = props;
    const delta = toNumber(value);

    if (!Number.isFinite(delta) || delta >= 0) return null;

    const entry = chartData?.[index] || {};
    const fontSize = entry.isPillar ? 18 : 16;

    // Small nudge downward so it’s clearly below the bar
    const dy = entry.isPillar ? 10 : 8;

    return (
      <text
        x={(x ?? 0) + (width ?? 0) / 2}
        y={(y ?? 0) + dy}
        fill="rgba(15,23,42,0.92)"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize, fontWeight: 1000 }}
        pointerEvents="none"
      >
        {fmtMoneyCompact(delta)}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={chartData}
        // keeps chart tight while leaving room for above/below labels
        margin={{ top: 44, right: 30, left: 20, bottom: 52 }}
      >
        <CartesianGrid strokeDasharray="10" vertical={false} stroke="rgba(15,23,42,.25)" />

        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tickMargin={12}
          tick={{ fontSize: 14, fontWeight: 950, fill: "rgba(15,23,42,0.65)" }}
        />

        <YAxis
          tickFormatter={fmtMoneyCompact}
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          tick={{ fontSize: 12, fontWeight: 900, fill: "rgba(15,23,42,0.6)" }}
          // just enough breathing room so negative labels don’t hit the x-axis row
          padding={{ top: 14, bottom: 26 }}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />

        {/* float bar */}
        <Bar dataKey="placeholder" stackId="a" fill="transparent" />

        {/* the actual delta bar */}
        <Bar
          dataKey="delta"
          stackId="a"
          radius={[15, 15, 15, 15]}
          onClick={(d) => onBarClick?.(d)}
          style={{ cursor: "pointer" }}
        >
          {/* ✅ positives above */}
          <LabelList dataKey="delta" position="top" content={renderPosLabel} />
          {/* ✅ negatives below */}
          <LabelList dataKey="delta" position="bottom" content={renderNegLabel} />

          {chartData.map((entry, index) => {
            let color = entry.delta >= 0 ? "#59c1a7" : "#ff6b6b";

            if (entry.name === "Start") color = "#0b3251";
            if (entry.name === "Closed Won") color = "#0b3251";
            if (entry.name === "Closed Lost") color = "#997d00";
            if (entry.name === "Total") color = "#b3b3b3";

            return <Cell key={`cell-${index}`} fill={color} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
