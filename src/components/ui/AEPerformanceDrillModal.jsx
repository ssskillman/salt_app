// src/components/ui/AEPerformanceDrillModal.jsx
import React, { useMemo, useState, useEffect } from "react";
import { resolveColumnKey } from "../../utils/data.jsx";
import {
  resolveAeStage4CovThresholdColumnKey,
  formatAeStage4CovMult,
} from "../../ceo/aeStage4CovThreshold.js";
import { toNumber, ceoBusinessLineDisplayLabel } from "../../utils/formatters.jsx";
import DrillModalContextBar from "./DrillModalContextBar.jsx";

const DEFAULT_CONTEXT =
  "AE-level rows for the CEO • AE Performance metric you clicked. Sort columns to compare quota, Stage 4+ coverage, booked ACV, and flags.";

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function findColIdByName(cols, name) {
  if (!Array.isArray(cols) || !name) return null;
  const target = norm(name);
  const hit = cols.find((c) => norm(c?.name) === target);
  return hit?.id ?? null;
}

function findFirstColIdByNames(cols, names = []) {
  if (!Array.isArray(cols) || !names.length) return null;
  for (const name of names) {
    const hit = findColIdByName(cols, name);
    if (hit) return hit;
  }
  return null;
}

function uniqueCount(rows, key) {
  if (!key || !Array.isArray(rows) || rows.length === 0) return 0;
  return new Set(rows.map((r) => r?.[key]).filter((v) => v != null && String(v).trim() !== "")).size;
}

function fmtInt(value) {
  const n = toNumber(value);
  if (n == null) return "—";
  return Math.round(n).toLocaleString();
}

function fmtMoneyish(value) {
  const n = toNumber(value);
  if (n == null) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtCov(value) {
  const n = toNumber(value);
  if (n == null) return "—";
  return n.toFixed(1);
}

function firstNonEmpty(rows, key) {
  if (!key || !Array.isArray(rows) || rows.length === 0) return null;
  for (const r of rows) {
    const v = r?.[key];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}

function Pill({ label, value }) {
  return (
    <div style={styles.pill}>
      <span style={styles.pillLabel}>{label}</span>
      <span style={styles.pillValue}>{value ?? "—"}</span>
    </div>
  );
}

function ScopePill({ label = "Global" }) {
  return (
    <div style={styles.scopePill}>
      <span style={styles.scopePillLabel}>Employee Scope</span>
      <span style={styles.scopePillValue}>{label}</span>
    </div>
  );
}

function SortableHeader({ label, sortKey, sortState, onToggle, align = "left" }) {
  const isActive = sortState.key === sortKey;
  const arrow = !isActive ? "↕" : sortState.direction === "asc" ? "↑" : "↓";

  return (
    <th style={{ ...styles.th, textAlign: align }}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        style={styles.headerButton}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span style={{ opacity: isActive ? 1 : 0.65, fontSize: 12 }}>{arrow}</span>
      </button>
    </th>
  );
}

export default function AEPerformanceDrillModal({
  open,
  onClose,
  title,
  rows = [],
  columns = [],
  config,
  /** Matches CEO AE Performance Stage 4+ coverage slider (3 | 2 | 1 | 0.5). */
  stage4CovThresholdMult = 3,
  fieldScopeLabel = "Global",
  fieldScopeIsGlobal = true,
  /** CEO toggle: "All" | "New Business" | "Gross Expansion" */
  businessLine = "All",
  contextHelper,
  definitionsSection = "ae_performance",
  onOpenDefinitions,
}) {
  const keys = useMemo(() => {
    return {
      aeUserId:
        resolveColumnKey(config?.ae_user_id) ||
        findFirstColIdByNames(columns, ["AE User Id", "Ae User Id", "AE_USER_ID"]),

      aeName:
        resolveColumnKey(config?.ae_name) ||
        findFirstColIdByNames(columns, ["AE Name", "Ae Name", "AE_NAME"]),

      aeTitle:
        resolveColumnKey(config?.ae_title) ||
        findFirstColIdByNames(columns, ["AE Title", "Ae Title", "AE_TITLE"]),

      fiscalYearquarter:
        resolveColumnKey(config?.ae_fiscal_yearquarter) ||
        findFirstColIdByNames(columns, ["Fiscal Yearquarter", "Fiscal YearQuarter", "FISCAL_YEARQUARTER"]),

      businessLine:
        resolveColumnKey(config?.ae_business_line) ||
        findFirstColIdByNames(columns, ["Business Line", "BUSINESS_LINE"]),

      territoryName:
        resolveColumnKey(config?.ae_territory_name) ||
        findFirstColIdByNames(columns, ["Territory Name", "TERRITORY_NAME"]),

      quota:
        resolveColumnKey(config?.ae_quota) ||
        findFirstColIdByNames(columns, ["Quota", "QUOTA"]),

      stage4Coverage:
        resolveColumnKey(config?.ae_stage4_coverage_non_negative) ||
        findFirstColIdByNames(columns, [
          "Stage 4 Plus Coverage Non Negative",
          "STAGE_4_PLUS_COVERAGE_NON_NEGATIVE",
          "STAGE_4_PLUS_COVERAGE_NONNEG",
        ]),

      bookedAcv:
        resolveColumnKey(config?.ae_booked_acv) ||
        findFirstColIdByNames(columns, ["Booked Acv", "BOOKED_ACV"]),

      closedWonOppCount:
        resolveColumnKey(config?.ae_closed_won_opp_count) ||
        findFirstColIdByNames(columns, ["Closed Won Opp Count", "CLOSED_WON_OPP_COUNT"]),

      isAeAt0Acv:
        resolveColumnKey(config?.ae_is_at_0_acv) ||
        findFirstColIdByNames(columns, ["Is Ae at 0 Acv", "Is AE At 0 ACV (0/1)", "IS_AE_AT_0_ACV"]),

      isAeAt0Arr: findFirstColIdByNames(columns, ["Is Ae at 0 Arr", "Is AE At 0 ARR (0/1)", "IS_AE_AT_0_ARR"]),

      isAboveThreshold:
        resolveAeStage4CovThresholdColumnKey(stage4CovThresholdMult, config, { aePerformance: rows }, columns) ||
        resolveColumnKey(config?.ae_is_over_stage4_cov_threshold_3x) ||
        findFirstColIdByNames(columns, [
          "Is Ae Over Stage 4 Cov Threshold 3 X",
          "Is AE Over Stage 4 Coverage Threshold 3x (0/1)",
          "IS_AE_OVER_STAGE4_COV_THRESHOLD_3X",
        ]),
    };
  }, [config, columns, rows, stage4CovThresholdMult]);

  const [sortState, setSortState] = useState({
    key: "aeName",
    direction: "asc",
  });

  const [isVisible, setIsVisible] = useState(open);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setSortState({ key: "aeName", direction: "asc" });
    }
  }, [open]);

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

  const uniqueAEs = useMemo(() => {
    return uniqueCount(rows, keys.aeUserId || keys.aeName);
  }, [rows, keys.aeUserId, keys.aeName]);

  const sortedRows = useMemo(() => {
    const out = [...rows];

    const getValue = (row, sortKey) => {
      switch (sortKey) {
        case "aeName":
          return String(keys.aeName ? row?.[keys.aeName] ?? "" : "").toLowerCase();
        case "aeTitle":
          return String(keys.aeTitle ? row?.[keys.aeTitle] ?? "" : "").toLowerCase();
        case "territory":
          return String(keys.territoryName ? row?.[keys.territoryName] ?? "" : "").toLowerCase();
        case "quota":
          return toNumber(keys.quota ? row?.[keys.quota] : null) ?? Number.NEGATIVE_INFINITY;
        case "stage4Coverage":
          return toNumber(keys.stage4Coverage ? row?.[keys.stage4Coverage] : null) ?? Number.NEGATIVE_INFINITY;
        case "bookedAcv":
          return toNumber(keys.bookedAcv ? row?.[keys.bookedAcv] : null) ?? Number.NEGATIVE_INFINITY;
        case "closedWonOppCount":
          return toNumber(keys.closedWonOppCount ? row?.[keys.closedWonOppCount] : null) ?? Number.NEGATIVE_INFINITY;
        case "isZeroAcv":
          return keys.isAeAt0Acv ? toNumber(row?.[keys.isAeAt0Acv]) ?? 0 : 0;
        case "isAboveThreshold":
          return keys.isAboveThreshold ? toNumber(row?.[keys.isAboveThreshold]) ?? 0 : 0;
        default:
          return "";
      }
    };

    out.sort((a, b) => {
      const av = getValue(a, sortState.key);
      const bv = getValue(b, sortState.key);

      if (av < bv) return sortState.direction === "asc" ? -1 : 1;
      if (av > bv) return sortState.direction === "asc" ? 1 : -1;

      const aName = String(keys.aeName ? a?.[keys.aeName] ?? "" : "").toLowerCase();
      const bName = String(keys.aeName ? b?.[keys.aeName] ?? "" : "").toLowerCase();
      return aName.localeCompare(bName);
    });

    return out;
  }, [rows, keys, sortState]);

  const summary = useMemo(() => {
    const fyq = firstNonEmpty(sortedRows, keys.fiscalYearquarter);

    return {
      fyq: fyq || "N/A",
    };
  }, [sortedRows, keys.fiscalYearquarter]);

  const toggleSort = (key) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }

      const defaultDirection =
        key === "aeName" || key === "aeTitle" || key === "territory" ? "asc" : "desc";

      return {
        key,
        direction: defaultDirection,
      };
    });
  };

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
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        style={{
          ...styles.modal,
          opacity: isOpen ? 1 : 0,
          transform: isOpen
            ? "translateY(0) scale(1)"
            : "translateY(8px) scale(0.985)",
          transition: "opacity 180ms ease, transform 180ms cubic-bezier(0.2,0.8,0.2,1)",
        }}
      >
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{title}</div>
            <div style={styles.subtitle}>
              {uniqueAEs} AEs • {sortedRows.length} rows
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            ✕
          </button>
        </div>

        <div style={styles.tableArea}>
          <DrillModalContextBar
            helperText={contextHelper ?? DEFAULT_CONTEXT}
            definitionsSection={definitionsSection}
            onOpenDefinitions={onOpenDefinitions}
          />
          <div style={styles.summaryRow}>
            <ScopePill label={fieldScopeLabel || "Global"} />
            <Pill label="Business Line" value={ceoBusinessLineDisplayLabel(businessLine)} />
            <Pill label="FY Quarter" value={summary.fyq} />
            <Pill label="Unique AEs" value={fmtInt(uniqueAEs)} />
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <SortableHeader
                    label="AE"
                    sortKey="aeName"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                  <SortableHeader
                    label="Title"
                    sortKey="aeTitle"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                  <SortableHeader
                    label="Territory"
                    sortKey="territory"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                  <SortableHeader
                    label="Quota"
                    sortKey="quota"
                    sortState={sortState}
                    onToggle={toggleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Stg 4+ Cov"
                    sortKey="stage4Coverage"
                    sortState={sortState}
                    onToggle={toggleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Booked ACV"
                    sortKey="bookedAcv"
                    sortState={sortState}
                    onToggle={toggleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Closed Won Opps"
                    sortKey="closedWonOppCount"
                    sortState={sortState}
                    onToggle={toggleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="@ 0 ACV"
                    sortKey="isZeroAcv"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                  <SortableHeader
                    label={`> ${formatAeStage4CovMult(stage4CovThresholdMult)}`}
                    sortKey="isAboveThreshold"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r, i) => {
                  const isZeroAcv = keys.isAeAt0Acv ? (toNumber(r?.[keys.isAeAt0Acv]) || 0) === 1 : false;
                  const isAboveThreshold = keys.isAboveThreshold
                    ? (toNumber(r?.[keys.isAboveThreshold]) || 0) === 1
                    : false;

                  return (
                    <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                      <td style={styles.td}>{(keys.aeName && r?.[keys.aeName]) || "N/A"}</td>
                      <td style={styles.td}>{(keys.aeTitle && r?.[keys.aeTitle]) || "N/A"}</td>
                      <td style={styles.td}>{(keys.territoryName && r?.[keys.territoryName]) || "N/A"}</td>
                      <td style={styles.tdNum}>{keys.quota ? fmtMoneyish(r?.[keys.quota]) : "—"}</td>
                      <td style={styles.tdNum}>{keys.stage4Coverage ? fmtCov(r?.[keys.stage4Coverage]) : "—"}</td>
                      <td style={styles.tdNum}>{keys.bookedAcv ? fmtMoneyish(r?.[keys.bookedAcv]) : "—"}</td>
                      <td style={styles.tdNum}>
                        {keys.closedWonOppCount ? fmtInt(r?.[keys.closedWonOppCount]) : "—"}
                      </td>
                      <td style={styles.tdBadge}>
                        <span style={isZeroAcv ? styles.badgeAlert : styles.badgeMuted}>{isZeroAcv ? "Yes" : "No"}</span>
                      </td>
                      <td style={styles.tdBadge}>
                        <span style={isAboveThreshold ? styles.badgeGood : styles.badgeMuted}>
                          {isAboveThreshold ? "Yes" : "No"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!sortedRows.length && (
              <div style={styles.emptyState}>
                No rows found. Check AE Performance source + mappings in Sigma.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15,23,42,0.6)",
    display: "grid",
    placeItems: "center",
    zIndex: 1000,
    padding: 40,
  },
  modal: {
    backgroundColor: "white",
    borderRadius: 12,
    width: "95%",
    maxWidth: "1600px",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
    fontFamily: "system-ui",
  },
  header: {
    padding: "16px 24px",
    backgroundColor: "#0b3251",
    color: "white",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: 1000, letterSpacing: "0.5px" },
  subtitle: { fontSize: 12, opacity: 0.82, fontWeight: 750, marginTop: 2 },
  closeBtn: {
    background: "none",
    border: "none",
    color: "white",
    fontSize: 24,
    cursor: "pointer",
    fontWeight: 900,
  },
  tableArea: {
    flex: 1,
    overflowY: "auto",
    padding: "0 12px 12px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    padding: "14px 0 14px",
    background: "#ffffff",
  },
  pill: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 8,
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(15,23,42,0.05)",
    border: "1px solid rgba(15,23,42,0.08)",
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: 950,
    color: "rgba(15,23,42,0.65)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
  },
  pillValue: {
    fontSize: 14,
    fontWeight: 1000,
    color: "rgba(15,23,42,0.92)",
    whiteSpace: "nowrap",
  },
  tableWrap: {
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 14,
    overflow: "auto",
    background: "white",
    flex: 1,
    minHeight: 0,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1200,
  },
  thRow: {
    backgroundColor: "#334155",
    borderBottom: "2px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  th: {
    padding: "14px 12px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    color: "white",
    whiteSpace: "nowrap",
  },
  headerButton: {
    appearance: "none",
    border: "none",
    background: "transparent",
    color: "white",
    cursor: "pointer",
    padding: 0,
    margin: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  trEven: { backgroundColor: "#f8fafc" },
  trOdd: { backgroundColor: "#ffffff" },
  td: {
    padding: "12px 12px",
    fontSize: 13,
    borderBottom: "1px solid #f1f5f9",
    color: "#1e293b",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  tdNum: {
    padding: "12px 12px",
    fontSize: 13,
    borderBottom: "1px solid #f1f5f9",
    color: "#1e293b",
    fontWeight: 900,
    whiteSpace: "nowrap",
    textAlign: "right",
  },
  tdBadge: {
    padding: "12px 12px",
    fontSize: 13,
    borderBottom: "1px solid #f1f5f9",
    color: "#1e293b",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  badgeAlert: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(239, 68, 68, 0.12)",
    color: "#b91c1c",
    fontWeight: 950,
    border: "1px solid rgba(239, 68, 68, 0.18)",
  },
  badgeGood: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(16, 185, 129, 0.12)",
    color: "#047857",
    fontWeight: 950,
    border: "1px solid rgba(16, 185, 129, 0.18)",
  },
  badgeMuted: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(148, 163, 184, 0.14)",
    color: "#475569",
    fontWeight: 900,
    border: "1px solid rgba(148, 163, 184, 0.18)",
  },
  emptyState: {
    padding: 24,
    fontSize: 14,
    fontWeight: 800,
    color: "rgba(15,23,42,0.72)",
  },

  scopePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "12px 10px",
    background: "rgba(15,23,42,0.05)",
    border: "1px solid rgba(15,23,42,0.08)",
  },

  scopePillLabel: {
    fontSize: 10,
    fontWeight: 950,
    color: "rgba(15,23,42,0.62)",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    lineHeight: 1,
  },

  scopePillValue: {
    fontSize: 12,
    fontWeight: 1000,
    color: "rgba(15,23,42,0.92)",
    lineHeight: 1,
  },
};