// src/components/ui/PGPacingModal.jsx
import React, { useMemo, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";

import { fmtMoneyCompact, fmtPct1, toNumber, ceoBusinessLineDisplayLabel } from "../../utils/formatters.jsx";
import { resolveColumnKey } from "../../utils/data.jsx";
import DrillModalContextBar from "./DrillModalContextBar.jsx";

const PG_DRILL_CONTEXT =
  "Month-level pipeline generation vs quarter goal from your PG pacing source. Chart = goal vs created + attainment line; table lists each month. Attainment uses Created ÷ Goal when row-level attainment is absent.";

function safeNum(v) {
  const n = toNumber(v);
  return n == null || !Number.isFinite(n) ? null : n;
}

function safePct(v) {
  const n = safeNum(v);
  return n == null ? null : n;
}

function firstNonEmpty(rowsArr, key) {
  if (!key || !Array.isArray(rowsArr) || !rowsArr.length) return null;
  for (const r of rowsArr) {
    const v = r?.[key];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}

function firstNumber(rowsArr, key) {
  if (!key || !Array.isArray(rowsArr) || !rowsArr.length) return null;
  for (const r of rowsArr) {
    const n = safeNum(r?.[key]);
    if (n != null) return n;
  }
  return null;
}

function isDateLikeString(s) {
  if (typeof s !== "string") return false;
  return /^\d{4}-\d{2}/.test(s.trim());
}

function parseSortValue(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  if (v instanceof Date) return v.getTime();

  const s = String(v).trim();
  if (!s) return null;

  if (isDateLikeString(s)) {
    const datePart = s.split(" ")[0];
    const t = Date.parse(datePart);
    return Number.isFinite(t) ? t : null;
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function BarValueLabel({ x, y, width, value }) {
  const v = safeNum(value);
  if (v == null || v === 0) return null;

  const label = fmtMoneyCompact(v);
  const cx = (x ?? 0) + (width ?? 0) / 2;
  const cy = (y ?? 0) - 8;

  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      fontSize={11}
      fontWeight={900}
      fill="rgba(15, 23, 42, 0.82)"
    >
      {label}
    </text>
  );
}

function Card({ label, value, accent = false }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: accent
          ? "1px solid rgba(89, 193, 167, 0.35)"
          : "1px solid rgba(15,23,42,0.10)",
        background: accent
          ? "linear-gradient(180deg, rgba(89,193,167,0.08), rgba(89,193,167,0.03))"
          : "white",
        padding: 14,
        minHeight: 78,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 0.8,
          fontWeight: 900,
          color: "rgba(15,23,42,0.52)",
          textTransform: "uppercase",
        }}
      >
        {String(label || "").trim() || "—"}
      </div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 950,
          marginTop: 8,
          color: "rgba(15,23,42,0.96)",
          lineHeight: 1.1,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function PGPacingModal({
  open,
  onClose,
  title,
  rows,
  config,
  summary,
  /** CEO toggle: "All" | "New Business" | "Gross Expansion" */
  businessLine = "All",
  contextHelper,
  definitionsSection = "company_totals",
  onOpenDefinitions,
}) {
  const [isVisible, setIsVisible] = useState(open);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsClosing(false);
      return;
    }

    if (isVisible) {
      setIsClosing(true);
      const t = setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
      }, 180);
      return () => clearTimeout(t);
    }
  }, [open, isVisible]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const view = useMemo(() => {
    const r = Array.isArray(rows) ? rows : [];

    const fyqKey =
      resolveColumnKey(config?.pg_fiscal_yearquarter) ||
      resolveColumnKey(config?.pg_fyq) ||
      resolveColumnKey(config?.fyq) ||
      resolveColumnKey(config?.fa_fiscal_yearquarter);

    const blKey =
      resolveColumnKey(config?.pg_business_line) ||
      resolveColumnKey(config?.pg_bl) ||
      resolveColumnKey(config?.business_line) ||
      resolveColumnKey(config?.fa_business_line);

    const monthNameKey =
      resolveColumnKey(config?.pg_month_name) ||
      resolveColumnKey(config?.pg_month) ||
      resolveColumnKey(config?.pg_month_label);

    const monthSortKey =
      resolveColumnKey(config?.pg_month_sort) ||
      resolveColumnKey(config?.pg_month_date) ||
      resolveColumnKey(config?.pg_month_order);

    const monthInQtrKey =
      resolveColumnKey(config?.pg_month_in_qtr) ||
      resolveColumnKey(config?.pg_month_num) ||
      resolveColumnKey(config?.pg_month_index);

    const monthGoalKey =
      resolveColumnKey(config?.pg_month_goals) ||
      resolveColumnKey(config?.pg_goal) ||
      resolveColumnKey(config?.pg_pipe_goal) ||
      resolveColumnKey(config?.pg_month_goal);

    const monthCreatedKey =
      resolveColumnKey(config?.pg_month_created) ||
      resolveColumnKey(config?.pg_actual) ||
      resolveColumnKey(config?.pg_pipe_gen) ||
      resolveColumnKey(config?.pg_month_actual);

    const monthAttKey =
      resolveColumnKey(config?.pg_month_attainment) ||
      resolveColumnKey(config?.pg_attainment) ||
      resolveColumnKey(config?.pg_month_pct);

    const qGoalKey =
      resolveColumnKey(config?.pg_goals_qtr) ||
      resolveColumnKey(config?.pg_qtr_pipe_goal) ||
      resolveColumnKey(config?.pg_quarter_goal);

    const qCreatedKey =
      resolveColumnKey(config?.pg_created_qtr) ||
      resolveColumnKey(config?.pg_qtr_pipe_gen) ||
      resolveColumnKey(config?.pg_quarter_created);

    const qAttKey =
      resolveColumnKey(config?.pg_attainment_qtr) ||
      resolveColumnKey(config?.pg_qtr_attainment) ||
      resolveColumnKey(config?.pg_quarter_attainment);

    const canBuildFromRows = r.length > 0 && monthNameKey && (monthGoalKey || monthCreatedKey);

    if (canBuildFromRows) {
      const fyq = firstNonEmpty(r, fyqKey) ?? null;
      const businessLine = firstNonEmpty(r, blKey) ?? null;

      const byMonth = new Map();

      for (const row of r) {
        const nameRaw = row?.[monthNameKey];
        const name = nameRaw == null ? "" : String(nameRaw).trim();
        if (!name) continue;

        const sortRaw =
          (monthSortKey && row?.[monthSortKey] != null ? row?.[monthSortKey] : null) ??
          row?.[monthInQtrKey];
        const sort = parseSortValue(sortRaw);

        const goal = monthGoalKey ? safeNum(row?.[monthGoalKey]) ?? 0 : 0;
        const created = monthCreatedKey ? safeNum(row?.[monthCreatedKey]) ?? 0 : 0;

        const existing = byMonth.get(name) || {
          name,
          sort: sort ?? null,
          goal: 0,
          created: 0,
          att: null,
        };

        existing.goal += goal;
        existing.created += created;

        if (existing.sort == null && sort != null) existing.sort = sort;
        if (existing.sort != null && sort != null) existing.sort = Math.min(existing.sort, sort);

        byMonth.set(name, existing);
      }

      let months = Array.from(byMonth.values());

      months = months.map((m) => {
        let att = null;

        if (monthAttKey) {
          const hitRow = r.find(
            (row) => String(row?.[monthNameKey] ?? "").trim() === m.name
          );
          const hitAtt = safePct(hitRow?.[monthAttKey]);
          if (hitAtt != null) att = hitAtt;
        }

        if (att == null && m.goal > 0) att = m.created / m.goal;
        if (att == null) att = 0;

        return { ...m, attainment: att };
      });

      months.sort((a, b) => {
        const as = a.sort;
        const bs = b.sort;
        if (as != null && bs != null) return as - bs;
        if (as != null) return -1;
        if (bs != null) return 1;
        return String(a.name).localeCompare(String(b.name));
      });

      const qGoalFromRows = qGoalKey ? firstNumber(r, qGoalKey) : null;
      const qCreatedFromRows = qCreatedKey ? firstNumber(r, qCreatedKey) : null;

      const goalsSum = months.reduce((acc, m) => acc + (safeNum(m.goal) ?? 0), 0);
      const createdSum = months.reduce((acc, m) => acc + (safeNum(m.created) ?? 0), 0);

      const quarterGoal = qGoalFromRows != null ? qGoalFromRows : goalsSum || null;
      const quarterCreated = qCreatedFromRows != null ? qCreatedFromRows : createdSum || null;

      let quarterAttainment = qAttKey ? firstNumber(r, qAttKey) : null;
      if (
        quarterAttainment == null &&
        quarterGoal != null &&
        quarterGoal > 0 &&
        quarterCreated != null
      ) {
        quarterAttainment = quarterCreated / quarterGoal;
      }

      return {
        fyq,
        businessLine,
        quarterGoal,
        quarterCreated,
        quarterAttainment: safePct(quarterAttainment),
        months: months.map((m) => ({
          name: m.name,
          goal: m.goal,
          created: m.created,
          attainment: safePct(m.attainment),
        })),
        emptyBecause: months.length === 0 ? "no_months" : null,
      };
    }

    const monthsFallback = Array.isArray(summary?.months) ? summary.months : [];

    return {
      fyq: summary?.fyq ?? summary?.fiscal_yearquarter ?? null,
      businessLine: summary?.businessLine ?? summary?.business_line ?? null,
      quarterGoal: summary?.quarterGoal ?? summary?.goalsQtr ?? null,
      quarterCreated: summary?.quarterCreated ?? summary?.createdQtr ?? null,
      quarterAttainment: safePct(summary?.quarterAttainment ?? summary?.attainmentQtr),
      months: monthsFallback,
      emptyBecause:
        r.length === 0 ? "no_rows" : monthsFallback.length === 0 ? "no_summary_months" : null,
    };
  }, [rows, config, summary]);

  const chartData = useMemo(() => {
    return (view.months || []).map((m) => ({
      month: m.name,
      Goal: safeNum(m.goal) ?? 0,
      Created: safeNum(m.created) ?? 0,
      Attainment: safePct(m.attainment) ?? 0,
    }));
  }, [view.months]);

  const isEmpty = !Array.isArray(view.months) || view.months.length === 0;

  if (!isVisible) return null;

  const isOpen = open && !isClosing;

  return (
    <div
      style={{
        ...styles.overlay,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? "auto" : "none",
        transition: "opacity 180ms ease",
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        style={{
          ...styles.modal,
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "translateY(0) scale(1)" : "translateY(8px) scale(0.985)",
          transition: "opacity 180ms ease, transform 180ms cubic-bezier(0.2,0.8,0.2,1)",
        }}
      >
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{title || "Pipeline Generation Attainment"}</div>
          </div>

          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={{ padding: "0 16px" }}>
          <DrillModalContextBar
            helperText={contextHelper ?? PG_DRILL_CONTEXT}
            definitionsSection={definitionsSection}
            onOpenDefinitions={onOpenDefinitions}
          />
        </div>

        <div style={styles.kpiRowTop}>
          <Card label="Fiscal Year / Quarter" value={view.fyq || "—"} />
          <Card label="Business Line" value={ceoBusinessLineDisplayLabel(businessLine)} />
          <Card label="Attainment" value={fmtPct1(view.quarterAttainment)} accent />
        </div>

        <div style={styles.kpiRowBottom}>
          <Card label="Quarter Goal" value={fmtMoneyCompact(view.quarterGoal)} />
          <Card label="Quarter Created" value={fmtMoneyCompact(view.quarterCreated)} />
        </div>

        <div style={styles.chartWrap}>
          <div style={styles.chartHeaderRow}>
            <div>
              <div style={styles.chartTitle}>Pipeline Goal vs Created</div>
              <div style={styles.chartSubtitle}>Pipeline Generation Attainment</div>
            </div>

            <div style={styles.axisNote} title="Attainment is Created ÷ Goal">
              % axis <span style={{ fontWeight: 1000, opacity: 0.8 }}>ⓘ</span>
            </div>
          </div>

          <div style={{ width: "100%", height: 280 }}>
            {isEmpty ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyTitle}>No pacing rows for this selection</div>
                <div style={styles.emptyBody}>
                  Check that your Sigma prompt filters are returning rows for the quarter/business
                  line, and that the PG pacing element + month goal/created columns are mapped in
                  the plugin properties.
                </div>
              </div>
            ) : (
              <ResponsiveContainer>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 18, right: 22, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 850 }} />
                  <YAxis
                    yAxisId="money"
                    tickFormatter={(v) => fmtMoneyCompact(v)}
                    tick={{ fontSize: 11, fontWeight: 850 }}
                  />
                  <YAxis
                    yAxisId="pct"
                    orientation="right"
                    tickFormatter={(v) => `${Math.round((Number(v) || 0) * 100)}%`}
                    tick={{ fontSize: 11, fontWeight: 850 }}
                    domain={[0, "dataMax"]}
                  />

                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "Attainment") return [fmtPct1(value), "Attainment"];
                      return [fmtMoneyCompact(value), name];
                    }}
                  />
                  <Legend />

                  <Bar
                    yAxisId="money"
                    dataKey="Created"
                    fill="#3B82F6"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={44}
                    isAnimationActive={false}
                  >
                    <LabelList dataKey="Created" content={<BarValueLabel />} />
                  </Bar>

                  <Bar
                    yAxisId="money"
                    dataKey="Goal"
                    fill="#59C1A7"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={56}
                    isAnimationActive={false}
                  >
                    <LabelList dataKey="Goal" content={<BarValueLabel />} />
                  </Bar>

                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="Attainment"
                    stroke="#0F172A"
                    strokeWidth={3.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.thLeft}>Month</th>
                <th style={styles.th}>Goal</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}>Attainment</th>
              </tr>
            </thead>
            <tbody>
              {(view.months || []).map((m) => (
                <tr key={m.name}>
                  <td style={styles.tdLeft}>{m.name}</td>
                  <td style={styles.td}>{fmtMoneyCompact(m.goal)}</td>
                  <td style={styles.td}>{fmtMoneyCompact(m.created)}</td>
                  <td style={styles.td}>{fmtPct1(m.attainment)}</td>
                </tr>
              ))}
              {!view.months?.length ? (
                <tr>
                  <td colSpan={4} style={styles.tdEmpty}>
                    —
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "grid",
    placeItems: "center",
    zIndex: 2000,
    padding: 18,
  },
  modal: {
    width: "min(980px, 96vw)",
    background: "white",
    borderRadius: 14,
    boxShadow: "0 30px 90px rgba(0,0,0,0.35)",
    border: "1px solid rgba(15,23,42,0.10)",
    overflow: "hidden",
  },
  header: {
    padding: "14px 16px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottom: "1px solid rgba(15,23,42,0.10)",
  },
  title: {
    fontSize: 14,
    fontWeight: 1000,
    color: "rgba(15, 23, 42, 0.95)",
    letterSpacing: 0.2,
  },
  closeBtn: {
    appearance: "none",
    border: "1px solid rgba(15,23,42,0.12)",
    background: "white",
    borderRadius: 10,
    padding: "6px 10px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  kpiRowTop: {
    padding: 12,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    background: "rgba(248, 250, 252, 0.75)",
  },
  kpiRowBottom: {
    padding: "0 12px 12px",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(248, 250, 252, 0.75)",
  },
  chartWrap: {
    padding: 12,
    borderBottom: "1px solid rgba(15,23,42,0.08)",
  },
  chartHeaderRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 1000,
    color: "rgba(15,23,42,0.92)",
  },
  chartSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(15,23,42,0.62)",
  },
  axisNote: {
    fontSize: 11,
    fontWeight: 900,
    color: "rgba(15,23,42,0.55)",
    userSelect: "none",
    paddingTop: 4,
  },
  emptyState: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    border: "1px dashed rgba(15,23,42,0.18)",
    background: "rgba(248, 250, 252, 0.7)",
    display: "grid",
    alignContent: "center",
    justifyItems: "center",
    padding: 16,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: 1000,
    color: "rgba(15,23,42,0.9)",
  },
  emptyBody: {
    marginTop: 6,
    maxWidth: 520,
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(15,23,42,0.62)",
    lineHeight: 1.35,
  },
  tableWrap: {
    padding: 12,
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    overflow: "hidden",
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 12,
  },
  thLeft: {
    textAlign: "left",
    padding: "10px 10px",
    fontSize: 11,
    fontWeight: 1000,
    background: "rgba(248,250,252,0.9)",
    borderBottom: "1px solid rgba(15,23,42,0.08)",
  },
  th: {
    textAlign: "right",
    padding: "10px 10px",
    fontSize: 11,
    fontWeight: 1000,
    background: "rgba(248,250,252,0.9)",
    borderBottom: "1px solid rgba(15,23,42,0.08)",
  },
  tdLeft: {
    padding: "10px 10px",
    fontSize: 12,
    fontWeight: 900,
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  },
  td: {
    padding: "10px 10px",
    fontSize: 12,
    fontWeight: 900,
    textAlign: "right",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  },
  tdEmpty: {
    padding: "12px 10px",
    fontSize: 12,
    fontWeight: 900,
    textAlign: "center",
    color: "rgba(15,23,42,0.45)",
  },
};