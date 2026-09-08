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
  // Labels — same type as Start ($19.7M); equal gap above/below bars
  // -----------------------------
  const LABEL_FONT = {
    fontSize: 18,
    fontWeight: 1000,
    fontFamily: "var(--salt-font-sans, inherit)",
  };
  /** Distance from bar edge to nearest edge of the label (pos above / neg below). */
  const LABEL_GAP = 14;

  // Positive labels ABOVE bars
  const renderPosLabel = (props) => {
    const { x, y, width, height, value } = props;
    const delta = toNumber(value);

    if (!Number.isFinite(delta) || delta <= 0) return null;

    const top = Math.min(y ?? 0, (y ?? 0) + (height ?? 0));

    return (
      <text
        x={(x ?? 0) + (width ?? 0) / 2}
        y={top - LABEL_GAP}
        fill="rgba(15,23,42,0.92)"
        textAnchor="middle"
        dominantBaseline="auto"
        style={LABEL_FONT}
        pointerEvents="none"
      >
        {fmtMoneyCompact(delta)}
      </text>
    );
  };

  // Negative labels BELOW bars
  const renderNegLabel = (props) => {
    const { x, y, width, height, value } = props;
    const delta = toNumber(value);

    if (!Number.isFinite(delta) || delta >= 0) return null;

    const bottom = Math.max(y ?? 0, (y ?? 0) + (height ?? 0));

    return (
      <text
        x={(x ?? 0) + (width ?? 0) / 2}
        y={bottom + LABEL_GAP}
        fill="rgba(15,23,42,0.92)"
        textAnchor="middle"
        dominantBaseline="hanging"
        style={LABEL_FONT}
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
        margin={{ top: 48, right: 30, left: 20, bottom: 56 }}
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
          // room so negative value labels don’t collide with category ticks
          padding={{ top: 16, bottom: 32 }}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />

        {/* float bar — animation off so stacked LabelLists do not flicker on redraw */}
        <Bar dataKey="placeholder" stackId="a" fill="transparent" isAnimationActive={false} />

        {/* the actual delta bar */}
        <Bar
          dataKey="delta"
          stackId="a"
          radius={[15, 15, 15, 15]}
          onClick={(d) => onBarClick?.(d)}
          style={{ cursor: "pointer" }}
          isAnimationActive={false}
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
