// src/components/ui/CreateCloseDrillModal.jsx

import React, { useMemo, useState, useEffect } from "react";
import Modal from "./Modal";
import { resolveColumnKey } from "../../utils/data.jsx";
import { fmtMoneyCompact, fmtPct1, toNumber, ceoBusinessLineDisplayLabel } from "../../utils/formatters.jsx";
import DrillModalContextBar from "./DrillModalContextBar.jsx";

const CREATE_CLOSE_DRILL_CONTEXT =
  "Opportunities that created and closed in the same fiscal quarter (per your Sigma mapping). Sort columns to compare owners, stages, and amounts.";

const SALESFORCE_OPP_BASE_URL =
  "https://iterable.lightning.force.com/lightning/r/Opportunity";

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function findColIdByName(cols, name) {
  if (!Array.isArray(cols) || !name) return null;
  const target = norm(name);
  const hit = cols.find((c) => norm(c?.name) === target);
  return hit?.id ?? null;
}

function findRowKeyByCandidates(rowsArr, candidates = []) {
  if (!Array.isArray(rowsArr) || rowsArr.length === 0 || !Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const row0 = rowsArr[0] || {};
  const rowKeys = Object.keys(row0);

  for (const candidate of candidates) {
    const target = norm(candidate);

    const exact = rowKeys.find((k) => norm(k) === target);
    if (exact) return exact;

    const suffix = rowKeys.find((k) => norm(k).endsWith(`/${target}`));
    if (suffix) return suffix;
  }

  return null;
}

function normalizeDateValue(v) {
  if (v == null || String(v).trim() === "") return null;

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v;
  }

  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isNaN(n) && Number.isFinite(n)) {
    const ms = n > 100_000_000_000 ? n : n * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const s = String(v).trim();

  const yyyyMmDd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (yyyyMmDd) {
    const d = new Date(`${yyyyMmDd[1]}-${yyyyMmDd[2]}-${yyyyMmDd[3]}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return null;
}

function fmtDate(v) {
  const d = normalizeDateValue(v);
  if (!d) return "—";

  if (d.getFullYear() < 2000) return "—";

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function dateSortValue(v) {
  const d = normalizeDateValue(v);
  if (!d) return Number.NEGATIVE_INFINITY;
  if (d.getFullYear() < 2000) return Number.NEGATIVE_INFINITY;
  return d.getTime();
}

function getDaysUntil(v) {
  const d = normalizeDateValue(v);
  if (!d) return null;
  if (d.getFullYear() < 2000) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
}

function getCloseDateBadge(v) {
  const days = getDaysUntil(v);
  if (days == null) return null;

  if (days < 0) {
    return {
      label: `${Math.abs(days)}d late`,
      tone: "late",
    };
  }

  if (days === 0) {
    return {
      label: "Today",
      tone: "urgent",
    };
  }

  if (days <= 7) {
    return {
      label: `${days}d`,
      tone: "soon",
    };
  }

  return null;
}

function shouldShowCloseDateBadge(metricName) {
  const m = String(metricName ?? "").trim().toLowerCase();
  return m === "open pipeline qtd";
}

function CloseDateCell({ value, showBadge = false }) {
  const badge = showBadge ? getCloseDateBadge(value) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
      <span>{fmtDate(value)}</span>

      {badge ? (
        <span
          style={{
            ...styles.closeBadge,
            ...(badge.tone === "urgent"
              ? styles.closeBadgeUrgent
              : badge.tone === "soon"
                ? styles.closeBadgeSoon
                : styles.closeBadgeLate),
          }}
        >
          {badge.label}
        </span>
      ) : null}
    </div>
  );
}

function buildOppUrl(oppId) {
  const id = String(oppId ?? "").trim();
  if (!id) return null;
  return `${SALESFORCE_OPP_BASE_URL}/${id}/view`;
}

function SortableHeader({ label, sortKey, sortState, onToggle, align = "left" }) {
  const isActive = sortState.key === sortKey;
  const arrow = !isActive ? "↕" : sortState.direction === "asc" ? "↑" : "↓";

  return (
    <th style={{ ...styles.th, textAlign: align }}>
      <button
        onClick={() => onToggle(sortKey)}
        style={styles.headerButton}
        title={`Sort by ${label}`}
        type="button"
      >
        <span>{label}</span>
        <span style={{ opacity: isActive ? 1 : 0.65, fontSize: 12 }}>{arrow}</span>
      </button>
    </th>
  );
}

function getStageTone(stageName) {
  const s = String(stageName ?? "").trim().toLowerCase();

  if (!s) return "neutral";

  if (s.includes("closed won")) return "commit";
  if (s.includes("closed lost")) return "lost";

  if (
    s.includes("discovery") ||
    s.includes("identified") ||
    s.includes("qualified")
  ) {
    return "discovery";
  }

  if (
    s.includes("solution aligned") ||
    s.includes("negotiation") ||
    s.includes("final review") ||
    s.includes("proposal")
  ) {
    return "proposal";
  }

  if (s.includes("commit")) {
    return "commit";
  }

  return "neutral";
}

function StagePill({ value }) {
  const text = String(value ?? "").trim();
  if (!text) return <span>—</span>;

  const tone = getStageTone(text);

  const toneStyle =
    tone === "discovery"
      ? styles.stagePillDiscovery
      : tone === "proposal"
        ? styles.stagePillProposal
        : tone === "commit"
          ? styles.stagePillCommit
          : tone === "lost"
            ? styles.stagePillLost
            : styles.stagePillNeutral;

  return (
    <span style={{ ...styles.stagePill, ...toneStyle }}>
      {text}
    </span>
  );
}

function SourcePill({ value = "ACV" }) {
  return (
    <div style={styles.sourcePill}>
      <span style={styles.sourcePillLabel}>Source</span>
      <span style={styles.sourcePillValue}>{value}</span>
    </div>
  );
}

export default function CreateCloseDrillModal({
  open,
  onClose,
  title = "Create & Close",
  rows = [],
  columns = [],
  config,
  metricName,
  fieldScopeIsGlobal = false,
  fieldScopeLabel = "Global",
  /** CEO toggle: "All" | "New Business" | "Gross Expansion" */
  businessLine = "All",
  contextHelper,
  definitionsSection = "create_close",
  onOpenDefinitions,
}) {
  const [sortState, setSortState] = useState({
    key: "value",
    direction: "desc",
  });

  const [showAccountColumn, setShowAccountColumn] = useState(false);

  useEffect(() => {
    if (open) {
      setSortState({ key: "value", direction: "desc" });
      setShowAccountColumn(false);
    }
  }, [open, metricName]);

  const showCloseBadges = useMemo(() => shouldShowCloseDateBadge(metricName), [metricName]);

  const keys = useMemo(() => {
    return {
      fiscalYearquarter:
        findRowKeyByCandidates(rows, [
          "fiscal_yearquarter",
          "close_fiscal_yearquarter",
        ]) ||
        findColIdByName(columns, "Fiscal Yearquarter"),

      businessLine:
        findRowKeyByCandidates(rows, ["business_line"]) ||
        findColIdByName(columns, "Business Line"),

      oppOwnerName:
        findRowKeyByCandidates(rows, ["opp_owner_name"]) ||
        findColIdByName(columns, "Opp Owner Name"),

      accountName:
        findRowKeyByCandidates(rows, ["account_name", "acct_name"]) ||
        findColIdByName(columns, "Account Name"),

      stageName:
        findRowKeyByCandidates(rows, ["stage_name"]) ||
        findColIdByName(columns, "Stage Name"),

      closeDate:
        findRowKeyByCandidates(rows, ["close_date"]) ||
        findColIdByName(columns, "Close Date"),

      oppId:
        findRowKeyByCandidates(rows, ["opp_id"]) ||
        findColIdByName(columns, "Opp Id"),

      oppName:
        findRowKeyByCandidates(rows, ["opp_name"]) ||
        findColIdByName(columns, "Opp Name"),

      closedWon:
        findRowKeyByCandidates(rows, ["cc_qtd_closed_won"]) ||
        findColIdByName(columns, "Cc Qtd Closed Won"),

      openPipe:
        findRowKeyByCandidates(rows, ["cc_qtd_open_pipe"]) ||
        findColIdByName(columns, "Cc Qtd Open Pipe"),

      closedWonYoyPct:
        findRowKeyByCandidates(rows, ["cc_qtd_closed_won_yoy_pct"]) ||
        findColIdByName(columns, "Cc Qtd Closed Won Yoy Pct"),

      openPipeYoyPct:
        findRowKeyByCandidates(rows, ["cc_qtd_open_pipe_yoy_pct"]) ||
        findColIdByName(columns, "Cc Qtd Open Pipe Yoy Pct"),
    };
  }, [columns, rows]);

  const metricConfig = useMemo(() => {
    const m = String(metricName ?? "").trim().toLowerCase();

    if (m === "won qtd") {
      return {
        label: "Won QTD",
        valueKey: keys.closedWon,
        totalType: "money",
      };
    }

    if (m === "open pipe qtd") {
      return {
        label: "Open Pipe QTD",
        valueKey: keys.openPipe,
        totalType: "money",
      };
    }

    if (m === "won qtd yoy") {
      return {
        label: "Won QTD YoY",
        valueKey: keys.closedWonYoyPct,
        totalType: "pct",
      };
    }

    if (m === "open pipelinr qtd yoy") {
      return {
        label: "Open Pipeline QTD YoY",
        valueKey: keys.openPipeYoyPct,
        totalType: "pct",
      };
    }

    return {
      label: metricName || "Metric",
      valueKey: null,
      totalType: "money",
    };
  }, [
    metricName,
    keys.closedWon,
    keys.openPipe,
    keys.closedWonYoyPct,
    keys.openPipeYoyPct,
  ]);

  const hideStageColumn = useMemo(() => {
    return String(metricName ?? "").trim().toLowerCase() === "won qtd";
  }, [metricName]);

  const filteredRows = useMemo(() => {
    const valueKey = metricConfig.valueKey;
    if (!valueKey) return [];

    return rows.filter((r) => {
      const raw = r?.[valueKey];
      const num = toNumber(raw);
      return num != null && num !== 0;
    });
  }, [rows, metricConfig.valueKey]);

    const ownerValues = useMemo(() => {
    if (!keys.oppOwnerName || !filteredRows.length) return [];

    return Array.from(
      new Set(
        filteredRows
          .map((r) => {
            const v = r?.[keys.oppOwnerName];
            return v == null ? null : String(v).trim();
          })
          .filter(Boolean)
      )
    );
  }, [filteredRows, keys.oppOwnerName]);

  const isSingleOwner = ownerValues.length === 1;
  const showOwnerColumn = ownerValues.length > 1;

  const sortedRows = useMemo(() => {
    const out = [...filteredRows];

    const getValue = (row, sortKey) => {
      switch (sortKey) {
        case "businessLine":
          return String(keys.businessLine ? row?.[keys.businessLine] ?? "" : "").toLowerCase();

        case "owner":
          return String(keys.oppOwnerName ? row?.[keys.oppOwnerName] ?? "" : "").toLowerCase();

        case "accountName":
          return String(keys.accountName ? row?.[keys.accountName] ?? "" : "").toLowerCase();

        case "stageName":
          return String(keys.stageName ? row?.[keys.stageName] ?? "" : "").toLowerCase();

        case "closeDate":
          return dateSortValue(keys.closeDate ? row?.[keys.closeDate] : null);

        case "oppName":
          return String(keys.oppName ? row?.[keys.oppName] ?? "" : "").toLowerCase();

        case "value":
          return toNumber(metricConfig.valueKey ? row?.[metricConfig.valueKey] : null) ?? Number.NEGATIVE_INFINITY;

        case "oppId":
          return String(keys.oppId ? row?.[keys.oppId] ?? "" : "").toLowerCase();

        default:
          return "";
      }
    };

    out.sort((a, b) => {
      const av = getValue(a, sortState.key);
      const bv = getValue(b, sortState.key);

      if (av < bv) return sortState.direction === "asc" ? -1 : 1;
      if (av > bv) return sortState.direction === "asc" ? 1 : -1;
      return 0;
    });

    return out;
  }, [filteredRows, keys, metricConfig.valueKey, sortState]);

  const totalValue = useMemo(() => {
    const valueKey = metricConfig.valueKey;
    if (!valueKey) return null;

    const nums = filteredRows
      .map((r) => toNumber(r?.[valueKey]))
      .filter((n) => n != null);

    if (!nums.length) return null;

    if (metricConfig.totalType === "pct") {
      return nums[0];
    }

    return nums.reduce((sum, n) => sum + n, 0);
  }, [filteredRows, metricConfig]);

  const summaryFiscalYearquarter = useMemo(() => {
    if (!keys.fiscalYearquarter || !filteredRows.length) return "—";
    for (const r of filteredRows) {
      const v = r?.[keys.fiscalYearquarter];
      if (v != null && String(v).trim() !== "") return v;
    }
    return "—";
  }, [filteredRows, keys.fiscalYearquarter]);

  const subtitle = useMemo(() => {
    return `Metric: ${metricConfig.label} • Rows: ${filteredRows.length}`;
  }, [metricConfig.label, filteredRows.length]);

  const toggleSort = (key) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: key === "value" ? "desc" : "asc",
      };
    });
  };

  const formatMetricValue = (v) => {
    if (metricConfig.totalType === "pct") return fmtPct1(v);
    return fmtMoneyCompact(v);
  };

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} width={1500}>
      <div style={{ display: "grid", gap: 14 }}>
        <DrillModalContextBar
          helperText={contextHelper ?? CREATE_CLOSE_DRILL_CONTEXT}
          definitionsSection={definitionsSection}
          onOpenDefinitions={onOpenDefinitions}
        />
        <div style={styles.topBar}>
          <SourcePill value="ACV" />

          {fieldScopeIsGlobal ? (
            <div style={styles.totalPill}>
              <span style={styles.totalPillLabel}>Employee Scope</span>
              <span style={styles.totalPillValue}>Global</span>
            </div>
          ) : isSingleOwner ? (
            <div style={styles.totalPill}>
              <span style={styles.totalPillLabel}>Employee</span>
              <span style={styles.totalPillValue}>{fieldScopeLabel || ownerValues[0]}</span>
            </div>
          ) : ownerValues.length > 1 ? (
            <div style={styles.totalPill}>
              <span style={styles.totalPillLabel}>Employee Scope</span>
              <span style={styles.totalPillValue}>{fieldScopeLabel || `${ownerValues[0]} + ${ownerValues.length - 1}`}</span>
            </div>
          ) : null}

          <div style={styles.totalPill}>
            <span style={styles.totalPillLabel}>FY Quarter</span>
            <span style={styles.totalPillValue}>{summaryFiscalYearquarter}</span>
          </div>

          <div style={styles.totalPill}>
            <span style={styles.totalPillLabel}>Business Line</span>
            <span style={styles.totalPillValue}>{ceoBusinessLineDisplayLabel(businessLine)}</span>
          </div>

          <div style={styles.totalPill}>
            <span style={styles.totalPillLabel}>Total {metricConfig.label}</span>
            <span style={styles.totalPillValue}>
              {totalValue == null ? "—" : formatMetricValue(totalValue)}
            </span>
          </div>
        </div>

        <div style={styles.columnToggleRow}>
          <button
            type="button"
            onClick={() => setShowAccountColumn((v) => !v)}
            style={styles.columnToggleBtn}
          >
            {showAccountColumn ? "− Account" : "+ Account"}
          </button>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                {showAccountColumn && (
                  <SortableHeader
                    label="Account Name"
                    sortKey="accountName"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                )}
                <SortableHeader
                  label="Opp Name"
                  sortKey="oppName"
                  sortState={sortState}
                  onToggle={toggleSort}
                />
                {showOwnerColumn && (
                  <SortableHeader
                    label="Opp Owner Name"
                    sortKey="owner"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                )}
                {!hideStageColumn && (
                  <SortableHeader
                    label="Stage Name"
                    sortKey="stageName"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                )}
                <SortableHeader
                  label="Close Date"
                  sortKey="closeDate"
                  sortState={sortState}
                  onToggle={toggleSort}
                />
                <SortableHeader
                  label={metricConfig.label}
                  sortKey="value"
                  sortState={sortState}
                  onToggle={toggleSort}
                  align="right"
                />
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((r, i) => {
                const rowValue = metricConfig.valueKey ? r?.[metricConfig.valueKey] : null;
                const oppId = keys.oppId ? r?.[keys.oppId] : null;
                const oppUrl = buildOppUrl(oppId);
                const oppName = (keys.oppName && r?.[keys.oppName]) || "—";

                return (
                  <tr
                    key={`${i}-${oppId ?? (keys.oppOwnerName ? r?.[keys.oppOwnerName] ?? "row" : "row")}`}
                    style={i % 2 === 0 ? styles.trEven : styles.trOdd}
                  >
                    {showAccountColumn && (
                      <td style={styles.td}>
                        {(keys.accountName && r?.[keys.accountName]) || "—"}
                      </td>
                    )}
                    <td style={styles.tdWide}>
                      {oppUrl ? (
                        <a
                          href={oppUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.link}
                          title="Open opportunity in Salesforce"
                        >
                          {oppName}
                        </a>
                      ) : (
                        oppName
                      )}
                    </td>

                    {showOwnerColumn && (
                      <td style={styles.td}>
                        {(keys.oppOwnerName && r?.[keys.oppOwnerName]) || "—"}
                      </td>
                    )}
                    {!hideStageColumn && (
                      <td style={styles.td}>
                        <StagePill value={keys.stageName ? r?.[keys.stageName] : null} />
                      </td>
                    )}
                    <td style={styles.td}>
                      <CloseDateCell
                        value={keys.closeDate ? r?.[keys.closeDate] : null}
                        showBadge={showCloseBadges}
                      />
                    </td>
                    <td style={styles.tdAmount}>
                      {formatMetricValue(rowValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!sortedRows.length && (
            <div style={styles.emptyState}>
              No rows found for <strong>{metricConfig.label}</strong>.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

const styles = {
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  totalPill: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 8,
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(15,23,42,0.05)",
    border: "1px solid rgba(15,23,42,0.08)",
  },
  totalPillLabel: {
    fontSize: 11,
    fontWeight: 950,
    color: "rgba(15,23,42,0.65)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  totalPillValue: {
    fontSize: 14,
    fontWeight: 1000,
    color: "rgba(15,23,42,0.92)",
  },
  tableWrap: {
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 14,
    overflow: "auto",
    background: "white",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1200,
  },
  thRow: {
    background: "#334155",
    position: "sticky",
    top: 0,
    zIndex: 1,
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
  trEven: {
    background: "#ffffff",
  },
  trOdd: {
    background: "#f8fafc",
  },
  td: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  tdWide: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "normal",
    minWidth: 320,
    verticalAlign: "top",
    lineHeight: 1.35,
  },
  tdAmount: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 950,
    color: "#0f172a",
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
    verticalAlign: "top",
    textAlign: "right",
  },
  link: {
    color: "#0b5cab",
    textDecoration: "none",
    fontWeight: 900,
  },
  emptyState: {
    padding: 24,
    fontSize: 14,
    fontWeight: 800,
    color: "rgba(15,23,42,0.72)",
  },
  closeBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 1000,
    letterSpacing: 0.2,
    border: "1px solid transparent",
    lineHeight: 1,
  },
  closeBadgeSoon: {
    background: "rgba(245, 158, 11, 0.12)",
    color: "#b45309",
    borderColor: "rgba(245, 158, 11, 0.24)",
  },
  closeBadgeUrgent: {
    background: "rgba(249, 115, 22, 0.14)",
    color: "#c2410c",
    borderColor: "rgba(249, 115, 22, 0.28)",
  },
  closeBadgeLate: {
    background: "rgba(239, 68, 68, 0.12)",
    color: "#b91c1c",
    borderColor: "rgba(239, 68, 68, 0.24)",
  },
  columnToggleRow: {
    display: "flex",
    justifyContent: "flex-start",
    marginTop: -2,
    marginBottom: 6,
    paddingLeft: 2,
  },
  columnToggleBtn: {
    appearance: "none",
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#fff",
    color: "#334155",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  sourcePill: {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 999,
  padding: "7px 12px",
  background: "rgba(89,193,167,0.14)",
  border: "1px solid rgba(89,193,167,0.30)",
},

sourcePillLabel: {
  fontSize: 11,
  fontWeight: 950,
  color: "rgba(15,23,42,0.68)",
  textTransform: "uppercase",
  letterSpacing: 0.3,
},

sourcePillValue: {
  fontSize: 12,
  fontWeight: 1000,
  color: "rgba(15,23,42,0.92)",
},

stagePill: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
  lineHeight: 1.1,
  border: "1px solid transparent",
  whiteSpace: "nowrap",
},

// Colorblind-safer choices
stagePillDiscovery: {
  background: "rgba(100,116,139,0.12)",   // slate
  color: "#475569",
  borderColor: "rgba(100,116,139,0.22)",
},

stagePillProposal: {
  background: "rgba(245,158,11,0.14)",    // amber
  color: "#92400e",
  borderColor: "rgba(245,158,11,0.26)",
},

stagePillCommit: {
  background: "rgba(20,184,166,0.14)",    // teal, safer than pure green
  color: "#0f766e",
  borderColor: "rgba(20,184,166,0.26)",
},

stagePillLost: {
  background: "rgba(239,68,68,0.12)",
  color: "#b91c1c",
  borderColor: "rgba(239,68,68,0.24)",
},

stagePillNeutral: {
  background: "rgba(15,23,42,0.06)",
  color: "#475569",
  borderColor: "rgba(15,23,42,0.10)",
},
};