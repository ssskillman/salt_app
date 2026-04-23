import React, { memo, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import { fmtMoneyCompact } from "../../utils/formatters";

const SOFT_BLUE_GRADIENT = {
  top: "rgba(147, 197, 253, 0.98)",
  bottom: "rgba(59, 130, 246, 0.72)",
};

const NB_STACK = "rgba(37, 99, 235, 0.92)";
const EXP_STACK = "rgba(14, 165, 233, 0.9)";

/** Matches BarChart margin so the FY strip lines up with category bands. */
const CHART_X_PAD = 18;

const MONTH_ABBR = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const MONTH_LONG = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

/**
 * Iterable-style FY: starts February. Q1 = Feb–Apr, Q2 = May–Jul, Q3 = Aug–Oct, Q4 = Nov–Jan.
 * Example: Feb–Apr 2026 → FY2027-Q1.
 */
function fiscalYqFebYearStart(d) {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (m === 0) return { fy: y, q: 4 };
  if (m <= 3) return { fy: y + 1, q: 1 };
  if (m <= 6) return { fy: y + 1, q: 2 };
  if (m <= 9) return { fy: y + 1, q: 3 };
  return { fy: y + 1, q: 4 };
}

function formatFyq({ fy, q }) {
  return `FY${fy}-Q${q}`;
}

function parseTrendMonthName(name) {
  const s = String(name ?? "").trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const y = parseInt(parts[parts.length - 1], 10);
  if (!Number.isFinite(y)) return null;
  const monStr = parts.slice(0, -1).join(" ");
  const key = monStr.toLowerCase().replace(/\./g, "");
  let month = MONTH_LONG[key];
  if (month == null) {
    const k3 = key.slice(0, 3);
    month = MONTH_ABBR[k3];
  }
  if (month == null) return null;
  const d = new Date(y, month, 1);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeFyqString(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const compact = s.replace(/\s+/g, " ");
  const m1 = compact.match(/^FY\s*(\d{4})\s*[-/\s]?Q\s*([1-4])$/i);
  if (m1) return `FY${m1[1]}-Q${m1[2]}`;
  const m2 = compact.match(/^(\d{4})\s*[-/]\s*Q\s*([1-4])$/i);
  if (m2) return `FY${m2[1]}-Q${m2[2]}`;
  if (/^FY\d{4}-Q[1-4]$/i.test(compact)) {
    return compact.replace(/^fy(\d{4})-q([1-4])$/i, (_, fy, q) => `FY${fy}-Q${q}`);
  }
  return s;
}

function fyqLabelForRow(row) {
  const fromData = normalizeFyqString(row?.fiscalYearquarter ?? row?.fiscal_yearquarter);
  if (fromData) return fromData;
  const d = parseTrendMonthName(row?.name);
  return d ? formatFyq(fiscalYqFebYearStart(d)) : null;
}

function buildConsecutiveFyqGroups(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const groups = [];
  let start = 0;
  let label = fyqLabelForRow(rows[0]) || "—";
  for (let i = 1; i <= rows.length; i++) {
    const nextLabel = i < rows.length ? fyqLabelForRow(rows[i]) || "—" : null;
    if (i === rows.length || nextLabel !== label) {
      const end = i - 1;
      groups.push({
        start,
        end,
        label,
      });
      start = i;
      if (i < rows.length) label = nextLabel;
    }
  }
  return groups;
}

function FiscalQuarterStrip({ data, isRollingHorizon }) {
  const groups = useMemo(() => buildConsecutiveFyqGroups(data), [data]);
  if (!groups.length) return null;

  const fyqFs = isRollingHorizon ? 8 : 9;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        boxSizing: "border-box",
        paddingLeft: CHART_X_PAD,
        paddingRight: CHART_X_PAD,
        marginTop: 4,
        minHeight: isRollingHorizon ? 18 : 20,
        alignItems: "stretch",
      }}
    >
      {groups.map((g, gi) => (
        <div
          key={`${g.label}-${g.start}-${g.end}`}
          style={{
            flex: g.end - g.start + 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            borderLeft: gi === 0 ? "none" : "1px solid rgba(15, 23, 42, 0.16)",
            paddingLeft: gi === 0 ? 0 : 5,
            boxSizing: "border-box",
          }}
          title={g.label}
        >
          <span
            style={{
              fontSize: fyqFs,
              fontWeight: 950,
              letterSpacing: 0.12,
              color: "rgba(15, 23, 42, 0.58)",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {g.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
    const pretty = (name) => {
      if (name === "newBiz") return "New Business";
      if (name === "expansion") return "Gross Expansion";
      return name;
    };
    return (
      <div
        style={{
          backgroundColor: "rgba(7, 26, 43, 0.88)",
          color: "white",
          padding: "8px 10px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.18)",
          fontSize: "12px",
          fontWeight: 800,
          zIndex: 2000,
        }}
      >
        <div style={{ opacity: 0.9 }}>{label}</div>
        {payload.length > 1 ? (
          <>
            {payload.map((p) => (
              <div key={String(p.dataKey)} style={{ marginTop: 4, opacity: 0.95 }}>
                {pretty(String(p.dataKey))}: {fmtMoneyCompact(p.value)}
              </div>
            ))}
            <div style={{ marginTop: 6, fontWeight: 950 }}>Total: {fmtMoneyCompact(total)}</div>
          </>
        ) : (
          <div style={{ marginTop: 4 }}>{fmtMoneyCompact(payload[0].value)}</div>
        )}
      </div>
    );
  }
  return null;
}

function ClosedTrendChart({ data = [], stacked = false }) {
  const isRollingHorizon = data.length > 3;
  const chartHeight = isRollingHorizon ? 128 : 110;
  const marginTop = isRollingHorizon ? 22 : 18;
  const showStack =
    stacked &&
    data.length > 0 &&
    data[0].newBiz !== undefined &&
    data[0].expansion !== undefined;

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <div style={{ width: "100%", height: chartHeight, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: marginTop, right: CHART_X_PAD, left: CHART_X_PAD, bottom: 4 }}
          barCategoryGap={isRollingHorizon ? 6 : 24}
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SOFT_BLUE_GRADIENT.top} />
              <stop offset="100%" stopColor={SOFT_BLUE_GRADIENT.bottom} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="name"
            tick={{ fill: "rgba(15, 23, 42, 0.75)", fontSize: 11, fontWeight: 900 }}
            axisLine={{ stroke: "rgba(15, 23, 42, 0.12)" }}
            tickLine={false}
            interval={0}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(15,23,42,0.06)" }} />

          {showStack ? (
            <>
              <Bar dataKey="newBiz" stackId="ct" fill={NB_STACK} radius={[0, 0, 0, 0]} isAnimationActive={false}>
                {data.map((_, index) => (
                  <Cell
                    key={`nb-${index}`}
                    fillOpacity={isRollingHorizon && index < data.length - 3 ? 0.55 : 1}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="expansion"
                stackId="ct"
                fill={EXP_STACK}
                radius={[10, 10, 0, 0]}
                isAnimationActive={false}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`ex-${index}`}
                    fillOpacity={isRollingHorizon && index < data.length - 3 ? 0.55 : 1}
                  />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  content={(props) => {
                    const { x, y, width, value, index } = props;
                    if (value == null || width == null || x == null || y == null) return null;
                    const row = data[index];
                    const total = row ? (Number(row.newBiz) || 0) + (Number(row.expansion) || 0) : Number(value);
                    const fs = isRollingHorizon ? 8 : 11;
                    const dy = isRollingHorizon ? -2 : -6;
                    return (
                      <text
                        x={x + width / 2}
                        y={y + dy}
                        textAnchor="middle"
                        style={{
                          fill: "rgba(15, 23, 42, 0.72)",
                          fontSize: fs,
                          fontWeight: 950,
                          pointerEvents: "none",
                        }}
                      >
                        {fmtMoneyCompact(total)}
                      </text>
                    );
                  }}
                />
              </Bar>
            </>
          ) : (
            <Bar dataKey="value" radius={[10, 10, 0, 0]} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill="url(#barGradient)"
                  fillOpacity={isRollingHorizon && index < data.length - 3 ? 0.55 : 1}
                />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                content={(props) => {
                  const { x, y, width, value } = props;
                  if (value == null || width == null || x == null || y == null) return null;
                  const fs = isRollingHorizon ? 8 : 11;
                  const dy = isRollingHorizon ? -2 : -6;
                  return (
                    <text
                      x={x + width / 2}
                      y={y + dy}
                      textAnchor="middle"
                      style={{
                        fill: "rgba(15, 23, 42, 0.72)",
                        fontSize: fs,
                        fontWeight: 950,
                        pointerEvents: "none",
                      }}
                    >
                      {fmtMoneyCompact(value)}
                    </text>
                  );
                }}
              />
            </Bar>
          )}
        </BarChart>
        </ResponsiveContainer>
      </div>
      <FiscalQuarterStrip data={data} isRollingHorizon={isRollingHorizon} />
    </div>
  );
}

export default memo(ClosedTrendChart);
