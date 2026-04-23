// src/components/ui/PlanAttainmentDrillModal.jsx

import React, { useMemo, useState } from "react";
import Modal from "./Modal";
import { fmtMoneyCompact, toNumber, ceoBusinessLineDisplayLabel } from "../../utils/formatters.jsx";
import AnimatedMetricValue from "./AnimatedMetricValue.jsx";

function isNum(v) {
  return v !== null && v !== undefined && !Number.isNaN(v);
}

function fmtPct(v) {
  if (!isNum(v)) return "—";
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function fmtDeltaMoney(v) {
  const n = toNumber(v);
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmtMoneyCompact(n)}`;
}

function fmtYear(v) {
  const n = toNumber(v);
  return n == null ? "—" : String(Math.round(n));
}

function compareMaybeNumber(a, b) {
  const na = toNumber(a);
  const nb = toNumber(b);

  const aIsNum = na != null;
  const bIsNum = nb != null;

  if (aIsNum && bIsNum) return na - nb;
  if (aIsNum && !bIsNum) return -1;
  if (!aIsNum && bIsNum) return 1;

  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
}

function compareMaybeString(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
}

function SortChevron({ active, direction }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        marginLeft: 6,
        opacity: active ? 0.9 : 0.35,
        transform: active && direction === "desc" ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 140ms ease, opacity 140ms ease",
      }}
      aria-hidden="true"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function FractionBox({ top, bottom }) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "center",
        minWidth: 180,
        borderRadius: 12,
        background: "white",
        border: "1px solid rgba(15,23,42,0.08)",
        overflow: "hidden",
        boxShadow: "0 1px 0 rgba(255,255,255,0.55) inset",
      }}
    >
      <div
        style={{
          padding: "6px 14px 4px",
          textAlign: "center",
          lineHeight: 1.1,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <AnimatedMetricValue
          value={top}
          style={{
            fontWeight: 950,
            fontSize: 16,
            color: "rgba(15,23,42,0.96)",
            lineHeight: 1.1,
          }}
        />
      </div>

      <div
        style={{
          height: 1,
          background: "rgba(15,23,42,0.12)",
          margin: "0 10px",
        }}
      />

      <div
        style={{
          padding: "4px 14px 6px",
          textAlign: "center",
          lineHeight: 1.1,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <AnimatedMetricValue
          value={bottom}
          style={{
            fontWeight: 950,
            fontSize: 16,
            color: "rgba(15,23,42,0.96)",
            lineHeight: 1.1,
          }}
        />
      </div>
    </div>
  );
}

function AnimatedCardValue({ value, accent = false }) {
  return (
    <AnimatedMetricValue
      value={value}
      style={{
        fontSize: 22,
        fontWeight: 950,
        marginTop: 8,
        color: accent ? "rgba(15,23,42,0.98)" : "rgba(15,23,42,0.96)",
        lineHeight: 1.1,
        wordBreak: "break-word",
      }}
    />
  );
}

function Card({ label, value, accent = false }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: accent ? "1px solid rgba(89,193,167,0.35)" : "1px solid rgba(15,23,42,0.10)",
        background: accent ? "linear-gradient(180deg, rgba(89,193,167,0.08), rgba(89,193,167,0.03))" : "white",
        padding: 14,
        minHeight: 72,
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
        {label}
      </div>

      <AnimatedCardValue value={value} accent={accent} />
    </div>
  );
}

function Badge({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 999,
        padding: "7px 11px",
        background: "rgba(15,23,42,0.06)",
        display: "flex",
        gap: 8,
        alignItems: "baseline",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(15,23,42,0.65)" }}>{label}</div>
      <AnimatedMetricValue
        value={value}
        style={{
          fontSize: 13,
          fontWeight: 950,
          color: "rgba(15,23,42,0.92)",
        }}
      />
    </div>
  );
}

function SegPillToggle({ value, onChange, options = [] }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: "rgba(15,23,42,0.06)",
        border: "1px solid rgba(15,23,42,0.08)",
      }}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              appearance: "none",
              border: "none",
              background: selected ? "white" : "transparent",
              color: selected ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.62)",
              borderRadius: 999,
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 950,
              cursor: "pointer",
              boxShadow: selected ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function DebugToggleButton({ open, onClick }) {
  return (
    <button
      onClick={onClick}
      title={open ? "Hide debug details" : "Show debug details"}
      aria-label={open ? "Hide debug details" : "Show debug details"}
      aria-expanded={open}
      style={{
        appearance: "none",
        border: "1px solid rgba(15,23,42,0.08)",
        background: open ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.82)",
        borderRadius: 999,
        width: 30,
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "rgba(15,23,42,0.62)",
        boxShadow: "0 4px 14px rgba(15,23,42,0.06)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M9.5 3.5h5M8 6h8l1 2.5-1.5 1.5V14l-2 1v2.5h-3V16l-2-1v-5L7 8.5 8 6Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function DebugBlock({ debug, open, onToggle }) {
  if (!debug) return null;

  return (
    <div
      style={{
        marginTop: 14,
        borderRadius: 14,
        border: open ? "1px dashed rgba(15,23,42,0.16)" : "1px solid rgba(15,23,42,0.06)",
        background: open ? "rgba(248,250,252,0.78)" : "transparent",
        padding: open ? 14 : 0,
        transition: "all 160ms ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
        <DebugToggleButton open={open} onClick={onToggle} />
      </div>

      {open && (
        <>
          <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.82)", marginTop: 8, marginBottom: 8 }}>
            Debug
          </div>

          <div style={{ fontSize: 12, color: "rgba(15,23,42,0.72)", lineHeight: 1.5 }}>
            <div><strong>Row count:</strong> {debug?.rowCount ?? 0}</div>
            <div><strong>Mapped source:</strong> {debug?.config?.source || "—"}</div>
            <div><strong>Mapped FYQ:</strong> {debug?.config?.fyq || "—"}</div>
            <div><strong>Mapped Business Line:</strong> {debug?.config?.businessLine || "—"}</div>
            <div><strong>Mapped QTD Plan:</strong> {debug?.config?.qtdPlan || "—"}</div>
            <div><strong>Mapped QTD Actual:</strong> {debug?.config?.qtdActual || "—"}</div>
            <div><strong>Mapped QTD Attainment:</strong> {debug?.config?.qtdAttainment || "—"}</div>
            <div><strong>Mapped YTD Plan:</strong> {debug?.config?.ytdPlan || "—"}</div>
            <div><strong>Mapped YTD Actual:</strong> {debug?.config?.ytdActual || "—"}</div>
            <div><strong>Mapped YTD Attainment:</strong> {debug?.config?.ytdAttainment || "—"}</div>
            <div><strong>Mapped FY Bookings ACV:</strong> {debug?.config?.fyBookingsAcv || "—"}</div>
            <div><strong>Mapped FY Attainment ACV:</strong> {debug?.config?.fyAttainmentAcv || "—"}</div>
            <div><strong>Mapped Revenue Source:</strong> {debug?.config?.revenueSource || "—"}</div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(15,23,42,0.60)", marginBottom: 6 }}>
              First row keys
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(debug?.firstRowKeys || []).length ? (
                debug.firstRowKeys.map((k) => (
                  <div
                    key={k}
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "5px 8px",
                      borderRadius: 999,
                      background: "white",
                      border: "1px solid rgba(15,23,42,0.08)",
                      color: "rgba(15,23,42,0.70)",
                    }}
                  >
                    {k}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 12, color: "rgba(15,23,42,0.55)" }}>No plan attainment rows available.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function PlanAttainmentDrillModal({
  open,
  onClose,
  data,
  modeDefault = "QTD",
  /** CEO toggle: "All" | "New Business" | "Gross Expansion" */
  businessLine = "All",
}) {
  const [mode, setMode] = useState(modeDefault);
  const [debugOpen, setDebugOpen] = useState(false);
  const [sortState, setSortState] = useState({ key: "fiscalYear", direction: "desc" });

  const dp = data?.dp || {};
  const rows = Array.isArray(dp?.historyRows) ? dp.historyRows : [];

  const fyq = dp.fyq ?? "—";
  const sourceLabel = dp.revenueSource ?? "ACV";

  const current = useMemo(() => {
    if (mode === "YTD") {
      const plan = dp.ytdPlan ?? null;
      const actual = dp.ytdActual ?? null;
      const provided = dp.ytdAttainment ?? null;
      const computed = isNum(actual) && isNum(plan) && Number(plan) !== 0 ? Number(actual) / Number(plan) : null;
      return {
        plan,
        actual,
        provided,
        computed,
        shown: provided ?? computed ?? null,
        gap: isNum(actual) && isNum(plan) ? Number(actual) - Number(plan) : null,
        label: "YTD",
      };
    }

    const plan = dp.qtdPlan ?? null;
    const actual = dp.qtdActual ?? null;
    const provided = dp.qtdAttainment ?? null;
    const computed = isNum(actual) && isNum(plan) && Number(plan) !== 0 ? Number(actual) / Number(plan) : null;
    return {
      plan,
      actual,
      provided,
      computed,
      shown: provided ?? computed ?? null,
      gap: isNum(actual) && isNum(plan) ? Number(actual) - Number(plan) : null,
      label: "QTD",
    };
  }, [dp, mode]);

  const historyTableRows = useMemo(() => {
    const baseRows = rows.map((r, idx) => {
      const plan = mode === "YTD" ? r?.ytdPlan : r?.qtdPlan;
      const actual = mode === "YTD" ? r?.ytdActual : r?.qtdActual;
      const provided = mode === "YTD" ? r?.ytdAttainment : r?.qtdAttainment;
      const computed = isNum(actual) && isNum(plan) && Number(plan) !== 0 ? Number(actual) / Number(plan) : null;

      return {
        __idx: idx,
        fiscalYear: r?.fiscalYear,
        fyq: r?.fyq,
        businessLine: r?.businessLine,
        plan,
        actual,
        attainment: provided ?? computed ?? null,
        prompted: r?.prompted,
      };
    });

    const sorted = [...baseRows].sort((a, b) => {
      let cmp = 0;

      switch (sortState.key) {
        case "fiscalYear":
          cmp = compareMaybeNumber(a.fiscalYear, b.fiscalYear);
          break;
        case "fyq":
          cmp = compareMaybeString(a.fyq, b.fyq);
          break;
        case "businessLine":
          cmp = compareMaybeString(a.businessLine, b.businessLine);
          break;
        case "plan":
          cmp = compareMaybeNumber(a.plan, b.plan);
          break;
        case "actual":
          cmp = compareMaybeNumber(a.actual, b.actual);
          break;
        case "attainment":
          cmp = compareMaybeNumber(a.attainment, b.attainment);
          break;
        default:
          cmp = compareMaybeNumber(a.__idx, b.__idx);
          break;
      }

      if (cmp === 0) {
        cmp = compareMaybeNumber(a.__idx, b.__idx);
      }

      return sortState.direction === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [rows, mode, sortState]);

  const handleSort = (key) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }

      const defaultDirection =
        key === "fiscalYear" ||
        key === "fyq" ||
        key === "businessLine" ||
        key === "plan" ||
        key === "actual" ||
        key === "attainment"
          ? "desc"
          : "asc";

      return {
        key,
        direction: defaultDirection,
      };
    });
  };

  const SortableHeader = ({ label, sortKey, align = "left" }) => {
    const active = sortState.key === sortKey;

    return (
      <th style={styles.th}>
        <button
          onClick={() => handleSort(sortKey)}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: align === "right" ? "flex-end" : "flex-start",
            width: "100%",
            font: "inherit",
            color: active ? "rgba(15,23,42,0.82)" : "rgba(15,23,42,0.58)",
            textTransform: "inherit",
            letterSpacing: "inherit",
            whiteSpace: "nowrap",
          }}
          title={`Sort by ${label}`}
        >
          <span>{label}</span>
          <SortChevron active={active} direction={sortState.direction} />
        </button>
      </th>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Plan Attainment — Drilldown"
      subtitle="QTD / YTD plan vs actual, attainment formula, prior fiscal year quarter context, and ACV source transparency"
      width={1040}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(15,23,42,0.64)" }}>
          View historical comps across prior fiscal year quarters
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginLeft: "auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              borderRadius: 999,
              background: "rgba(89,193,167,0.20)",
              border: "1px solid rgba(89,193,167,0.30)",
              color: "rgba(15,23,42,0.88)",
              fontSize: 12,
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ opacity: 0.7 }}>Source</span>
            <span>{sourceLabel}</span>
          </div>

          <SegPillToggle
            value={mode}
            onChange={setMode}
            options={[
              { label: "QTD", value: "QTD" },
              { label: "YTD", value: "YTD" },
            ]}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <Card label="Fiscal Year/Quarter" value={fyq} />
        <Card label="Business Line" value={ceoBusinessLineDisplayLabel(businessLine)} />
        <Card label={`${current.label} Attainment`} value={fmtPct(current.shown)} accent />
      </div>

      <div style={{ height: 12 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <Card label="Source" value={sourceLabel} />
        <Card label="FY Bookings ACV" value={fmtMoneyCompact(dp.fyBookingsAcv)} />
        <Card label="FY Attainment ACV" value={fmtPct(dp.fyAttainmentAcv)} />
      </div>

      <div style={{ height: 12 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <Card label={`${current.label} Plan`} value={fmtMoneyCompact(current.plan)} />
        <Card label={`${current.label} Actual`} value={fmtMoneyCompact(current.actual)} />
        <Card label={`${current.label} Gap`} value={fmtDeltaMoney(current.gap)} />
        <Card label="Fiscal Year" value={fmtYear(dp.fiscalYear)} />
      </div>

      <div style={{ height: 14 }} />

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(15,23,42,0.10)",
          background: "linear-gradient(180deg, rgba(89,193,167,0.08), rgba(241,245,249,0.85))",
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 950, marginBottom: 10, color: "rgba(15,23,42,0.92)" }}>
          {current.label} attainment formula
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(15,23,42,0.04)",
              border: "1px solid rgba(15,23,42,0.08)",
              fontWeight: 900,
              fontSize: 18,
              color: "rgba(15,23,42,0.92)",
            }}
          >
            Attainment =
          </div>

          <div
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(15,23,42,0.04)",
              border: "1px solid rgba(15,23,42,0.08)",
              fontWeight: 900,
              fontSize: 18,
              color: "rgba(15,23,42,0.92)",
            }}
          >
            (
          </div>

          <FractionBox top={fmtMoneyCompact(current.actual)} bottom={fmtMoneyCompact(current.plan)} />

          <div
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(15,23,42,0.04)",
              border: "1px solid rgba(15,23,42,0.08)",
              fontWeight: 900,
              fontSize: 18,
              color: "rgba(15,23,42,0.92)",
            }}
          >
            )
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Badge label="Computed" value={fmtPct(current.computed)} />
          <Badge label="Provided" value={fmtPct(current.provided)} />
          <Badge label="Showing" value={fmtPct(current.shown)} />
          <Badge label="Gap to plan" value={fmtDeltaMoney(current.gap)} />
        </div>

        <div style={{ marginTop: 12, color: "rgba(15,23,42,0.68)", fontSize: 12, lineHeight: 1.45 }}>
          {current.label} mode swaps both the headline cards and the historical comparison values below.
        </div>

        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid rgba(15,23,42,0.10)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.82)", marginBottom: 10 }}>
            Definitions
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={styles.definitionRow}>
              <strong style={styles.definitionLabel}>{current.label} Attainment</strong>
              <span style={styles.definitionText}>
                = <code style={styles.inlineCode}>{current.label} Actual</code> /{" "}
                <code style={styles.inlineCode}>{current.label} Plan</code>
              </span>
            </div>

            <div style={styles.definitionRow}>
              <strong style={styles.definitionLabel}>{current.label} Gap</strong>
              <span style={styles.definitionText}>
                = <code style={styles.inlineCode}>{current.label} Actual</code> -{" "}
                <code style={styles.inlineCode}>{current.label} Plan</code>
              </span>
            </div>

            <div style={styles.definitionRow}>
              <strong style={styles.definitionLabel}>FY Bookings ACV</strong>
              <span style={styles.definitionText}>
                = full-year ACV bookings from the plan attainment source
              </span>
            </div>

            <div style={styles.definitionRow}>
              <strong style={styles.definitionLabel}>FY Attainment ACV</strong>
              <span style={styles.definitionText}>
                = full-year ACV attainment from the plan attainment source
              </span>
            </div>

            <div style={styles.definitionRow}>
              <strong style={styles.definitionLabel}>Source</strong>
              <span style={styles.definitionText}>
                = indicates which revenue basis is being used during the cutover
              </span>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(15,23,42,0.66)", lineHeight: 1.55 }}>
            <strong>Notes:</strong> This drilldown is intentionally showing the active source basis for transparency during the cutover.
          </div>
        </div>

        {!!historyTableRows.length && (
          <div
            style={{
              marginTop: 14,
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid rgba(15,23,42,0.08)",
              background: "rgba(255,255,255,0.78)",
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid rgba(15,23,42,0.08)",
                fontSize: 12,
                fontWeight: 950,
                color: "rgba(15,23,42,0.84)",
              }}
            >
              Prior fiscal year quarters — {current.label}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(248,250,252,0.9)" }}>
                    <SortableHeader label="FY" sortKey="fiscalYear" />
                    <SortableHeader label="FYQ" sortKey="fyq" />
                    <SortableHeader label="Business Line" sortKey="businessLine" />
                    <SortableHeader label="Plan" sortKey="plan" />
                    <SortableHeader label="Actual" sortKey="actual" />
                    <SortableHeader label="Attainment" sortKey="attainment" />
                  </tr>
                </thead>
                <tbody>
                  {historyTableRows.map((r, idx) => {
                    const isPrompted = !!r.prompted;

                    return (
                      <tr
                        key={`${r.fyq}-${idx}`}
                        style={{
                          borderTop: "1px solid rgba(15,23,42,0.06)",
                          background: isPrompted
                            ? "linear-gradient(90deg, rgba(89,193,167,0.16), rgba(89,193,167,0.06))"
                            : "transparent",
                          boxShadow: isPrompted ? "inset 4px 0 0 #59C1A7" : "none",
                        }}
                      >
                        <td style={styles.tdLabel}>{fmtYear(r.fiscalYear)}</td>

                        <td style={styles.tdLabel}>{r.fyq ?? "—"}</td>

                        <td style={styles.td}>{r.businessLine ?? "—"}</td>

                        <td style={styles.td}>
                          <AnimatedMetricValue
                            value={fmtMoneyCompact(r.plan)}
                            style={{
                              fontSize: 13,
                              fontWeight: 850,
                              color: "rgba(15,23,42,0.84)",
                              lineHeight: 1.2,
                            }}
                          />
                        </td>

                        <td style={styles.td}>
                          <AnimatedMetricValue
                            value={fmtMoneyCompact(r.actual)}
                            style={{
                              fontSize: 13,
                              fontWeight: 850,
                              color: "rgba(15,23,42,0.84)",
                              lineHeight: 1.2,
                            }}
                          />
                        </td>

                        <td style={styles.tdStrong}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <span>
                              <AnimatedMetricValue
                                value={fmtPct(r.attainment)}
                                style={{
                                  fontSize: 13,
                                  fontWeight: 950,
                                  color: "rgba(15,23,42,0.96)",
                                  lineHeight: 1.2,
                                }}
                              />
                            </span>

                            {isPrompted && <span style={styles.promptPill}>KPI row</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <DebugBlock debug={dp.debug} open={debugOpen} onToggle={() => setDebugOpen((v) => !v)} />
    </Modal>
  );
}

const styles = {
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 11,
    fontWeight: 950,
    color: "rgba(15,23,42,0.58)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 850,
    color: "rgba(15,23,42,0.84)",
    whiteSpace: "nowrap",
  },
  tdLabel: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 950,
    color: "rgba(15,23,42,0.92)",
    whiteSpace: "nowrap",
  },
  tdStrong: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 950,
    color: "rgba(15,23,42,0.96)",
    whiteSpace: "nowrap",
  },
  tableAnimatedValue: {
    fontSize: 13,
    fontWeight: 850,
    color: "rgba(15,23,42,0.84)",
    lineHeight: 1.2,
  },
  tableAnimatedValueStrong: {
    fontSize: 13,
    fontWeight: 950,
    color: "rgba(15,23,42,0.96)",
    lineHeight: 1.2,
  },
  promptPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "rgba(15,23,42,0.82)",
    background: "rgba(89,193,167,0.18)",
    border: "1px solid rgba(89,193,167,0.32)",
    whiteSpace: "nowrap",
  },
  inlineCode: {
    padding: "2px 6px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(15,23,42,0.08)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.95em",
    fontWeight: 800,
    color: "rgba(15,23,42,0.82)",
  },
  definitionRow: {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    gap: 10,
    alignItems: "start",
  },
  definitionLabel: {
    fontSize: 12,
    fontWeight: 950,
    color: "rgba(15,23,42,0.84)",
    whiteSpace: "nowrap",
  },
  definitionText: {
    fontSize: 12,
    color: "rgba(15,23,42,0.72)",
    lineHeight: 1.6,
  },
};