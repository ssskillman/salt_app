// src/components/ui/LargeDealsDrillModal.jsx

import React, { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal";
import { fmtMoneyCompact, toNumber, ceoBusinessLineDisplayLabel } from "../../utils/formatters.jsx";
import DrillModalContextBar from "./DrillModalContextBar.jsx";

const LARGE_DEALS_DRILL_CONTEXT =
  "Rows are filtered to the latest FY quarter in the dataset (prior-year quarter for YoY open pipeline). Adjust the deal-size threshold; ACV column reflects closed vs open pipeline per the metric.";

const THRESHOLDS = [
  { label: "100K+", value: 100000 },
  { label: "200K+", value: 200000 },
  { label: "300K+", value: 300000 },
  { label: "500K+", value: 500000 },
];

const SALESFORCE_OPP_BASE_URL =
  "https://iterable.lightning.force.com/lightning/r/Opportunity";

/** Canonical "YYYY-Qn" — matches App.jsx large-deals FYQ bucketing. */
function canonicalFyqKey(raw) {
  if (raw == null) return null;
  const s0 = String(raw).trim();
  if (!s0) return null;
  const s = s0.replace(/\s+/g, " ").trim();
  let m = s.match(/FY\s*(\d{4})\s*[-/]?\s*Q\s*([1-4])/i);
  if (!m) m = s.match(/^(\d{4})\s*[-/]\s*Q\s*([1-4])$/i);
  if (!m) m = s.match(/^(\d{4})\s+Q\s*([1-4])$/i);
  if (!m) m = s.match(/^(\d{4})Q([1-4])$/i);
  if (!m) return null;
  const year = Number(m[1]);
  const q = Number(m[2]);
  if (!Number.isFinite(year) || q < 1 || q > 4) return null;
  return `${year}-Q${q}`;
}

/** Same fiscal quarter, prior calendar fiscal year (matches App large-deals YoY buckets). */
function priorFiscalYearSameQuarterKey(canon) {
  if (!canon) return null;
  const m = String(canon).trim().match(/^(\d{4})-Q([1-4])$/i);
  if (!m) return null;
  const y = Number(m[1]);
  const q = m[2];
  if (!Number.isFinite(y)) return null;
  return `${y - 1}-Q${q}`;
}

function parseFyqSortValue(fyq) {
  const canon = canonicalFyqKey(fyq);
  if (!canon) return -1;
  const m = canon.match(/^(\d{4})-Q([1-4])$/i);
  if (!m) return -1;
  return Number(m[1]) * 10 + Number(m[2]);
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

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function dateSortValue(v) {
  const d = normalizeDateValue(v);
  return d ? d.getTime() : Number.NEGATIVE_INFINITY;
}

function getDaysUntil(v) {
  const d = normalizeDateValue(v);
  if (!d) return null;

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

function isOpenPipelineQtdDrillMetric(metricName) {
  const m = String(metricName ?? "").trim().toLowerCase();
  return m === "open pipeline qtd" || m === "open pipeline qtd yoy";
}

function shouldShowCloseDateBadge(metricName) {
  return isOpenPipelineQtdDrillMetric(metricName);
}

function isPriorYearMetric(metricName) {
  return String(metricName ?? "").trim().toLowerCase() === "prior year";
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

function stripHtmlToText(html) {
  const s = String(html ?? "").trim();
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<\/li>/gi, " ")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function SegButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: "none",
        border: active ? "1px solid rgba(89,193,167,0.9)" : "1px solid rgba(15,23,42,0.12)",
        background: active ? "rgba(89,193,167,0.16)" : "white",
        color: "rgba(15,23,42,0.9)",
        borderRadius: 999,
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 950,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
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

function SourcePill({ value = "ACV" }) {
  return (
    <div style={styles.sourcePill}>
      <span style={styles.sourcePillLabel}>Source</span>
      <span style={styles.sourcePillValue}>{value}</span>
    </div>
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

function DealReviewPopover({
  shortText,
  fullHtml,
  oppName,
  stageName,
  isOpen,
  onToggle,
  onClose,
}) {
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState(null);

  const hasFullReview = String(fullHtml ?? "").trim() !== "";

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      const gap = 8;
      const preferredWidth = 680;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const maxWidth = Math.min(preferredWidth, viewportW - 32);

      let left = rect.left;
      let top = rect.bottom + gap;

      if (left + maxWidth > viewportW - 16) {
        left = Math.max(16, viewportW - maxWidth - 16);
      }

      let maxHeight = Math.min(520, viewportH - top - 16);

      if (maxHeight < 240) {
        const upwardTop = Math.max(16, rect.top - 420 - gap);
        top = upwardTop;
        maxHeight = Math.min(520, viewportH - top - 16);
      }

      setPopoverStyle({
        position: "fixed",
        left,
        top,
        width: maxWidth,
        maxWidth,
        maxHeight: Math.max(240, maxHeight),
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      const insideTrigger = wrapRef.current?.contains(e.target);
      const insidePopover = popoverRef.current?.contains(e.target);
      if (!insideTrigger && !insidePopover) onClose?.();
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const popoverNode =
    isOpen && hasFullReview && popoverStyle
      ? createPortal(
          <div ref={popoverRef} style={{ ...styles.reviewPopover, ...popoverStyle }}>
            <div style={styles.reviewPopoverHeader}>
              <div style={styles.reviewPopoverTitle}>Deal Review</div>
              <button type="button" onClick={onClose} style={styles.reviewPopoverClose}>
                ✕
              </button>
            </div>

            <div style={styles.reviewMetaRow}>
              <div style={styles.reviewMetaPill}>
                <span style={styles.reviewMetaLabel}>Opportunity</span>
                <span style={styles.reviewMetaValue}>{oppName || "—"}</span>
              </div>
              <div style={styles.reviewMetaPill}>
                <span style={styles.reviewMetaLabel}>Stage</span>
                <span style={styles.reviewMetaValue}>{stageName || "—"}</span>
              </div>
            </div>

            <div
              style={styles.reviewPopoverBody}
              dangerouslySetInnerHTML={{ __html: fullHtml }}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div ref={wrapRef} style={styles.reviewWrap}>
        <button
          ref={buttonRef}
          type="button"
          onClick={hasFullReview ? onToggle : undefined}
          style={{
            ...styles.reviewChip,
            cursor: hasFullReview ? "pointer" : "default",
            opacity: hasFullReview ? 1 : 0.78,
          }}
          title={hasFullReview ? "Click to view full deal review" : "No full deal review available"}
        >
          <span style={styles.reviewChipText}>{shortText || "—"}</span>
          {hasFullReview ? <span style={styles.reviewChipIcon}>ⓘ</span> : null}
        </button>
      </div>

      {popoverNode}
    </>
  );
}



export default function LargeDealsDrillModal({
  open,
  onClose,
  title,
  rows = [],
  metricName,
  fieldScopeIsGlobal = true,
  fieldScopeLabel = "Employee",
  /** CEO toggle: "All" | "New Business" | "Gross Expansion" */
  businessLine = "All",
  contextHelper,
  definitionsSection = "deals_500k",
  onOpenDefinitions,
}) {
  const [threshold, setThreshold] = useState(500000);
  const [sortState, setSortState] = useState({
    key: "acv",
    direction: "desc",
  });
  const [openReviewKey, setOpenReviewKey] = useState(null);

  const [showAccountColumn, setShowAccountColumn] = useState(false);

  useEffect(() => {
    if (open) {
      setThreshold(500000);
      setSortState({ key: "acv", direction: "desc" });
      setOpenReviewKey(null);
      setShowAccountColumn(false);
    }
  }, [open, metricName]);

  const showCloseBadges = useMemo(() => shouldShowCloseDateBadge(metricName), [metricName]);

  const hideDealReviewColumn = useMemo(() => isPriorYearMetric(metricName), [metricName]);

  const latestFyq = useMemo(() => {
    if (!rows.length) return null;

    let bestCanon = null;
    let bestSort = -1;

    for (const r of rows) {
      const canon = canonicalFyqKey(r?.fiscal_yearquarter);
      if (!canon) continue;
      const sortVal = parseFyqSortValue(canon);
      if (sortVal > bestSort) {
        bestSort = sortVal;
        bestCanon = canon;
      }
    }

    return bestCanon;
  }, [rows]);

  const fyqFilterCanon = useMemo(() => {
    if (!latestFyq) return null;
    const metric = String(metricName ?? "").trim().toLowerCase();
    if (metric === "open pipeline qtd yoy") {
      return priorFiscalYearSameQuarterKey(latestFyq) ?? latestFyq;
    }
    return latestFyq;
  }, [latestFyq, metricName]);

  const filteredRows = useMemo(() => {
    const metric = String(metricName ?? "").trim().toLowerCase();

    return rows.filter((r) => {
      if (fyqFilterCanon && canonicalFyqKey(r?.fiscal_yearquarter) !== fyqFilterCanon) return false;

      const closedAcv = toNumber(r?.closed_acv) || 0;
      const openPipeAcv = toNumber(r?.open_pipeline_acv) || 0;

      if (metric === "open pipeline qtd" || metric === "open pipeline qtd yoy") {
        return openPipeAcv >= threshold;
      }

      return closedAcv >= threshold;
    });
  }, [rows, metricName, threshold, fyqFilterCanon]);

  const sortedRows = useMemo(() => {
    const out = [...filteredRows];

    const getValue = (row, sortKey) => {
      switch (sortKey) {
        case "businessLine":
          return String(row?.business_line ?? "").toLowerCase();
        case "accountName":
          return String(row?.account_name ?? "").toLowerCase();
        case "owner":
          return String(row?.opp_owner_name ?? "").toLowerCase();
        case "stage":
          return String(row?.stage_name ?? "").toLowerCase();
        case "oppName":
          return String(row?.opp_name ?? "").toLowerCase();
        case "dealReviewShort":
          return String(row?.deal_review_short ?? "").toLowerCase();
        case "acv":
          return isOpenPipelineQtdDrillMetric(metricName)
            ? toNumber(row?.open_pipeline_acv) ?? Number.NEGATIVE_INFINITY
            : toNumber(row?.closed_acv) ?? Number.NEGATIVE_INFINITY;
        case "closeDate":
          return dateSortValue(row?.close_date);
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
  }, [filteredRows, sortState, metricName]);

  const totalAmount = useMemo(() => {
    const metric = String(metricName ?? "").trim().toLowerCase();

    return filteredRows.reduce((sum, r) => {
      const amt =
        metric === "open pipeline qtd" || metric === "open pipeline qtd yoy"
          ? toNumber(r?.open_pipeline_acv) || 0
          : toNumber(r?.closed_acv) || 0;

      return sum + amt;
    }, 0);
  }, [filteredRows, metricName]);

  const summaryFiscalYearquarter = useMemo(() => {
    if (!filteredRows.length) return fyqFilterCanon || latestFyq || "—";
    return canonicalFyqKey(filteredRows[0]?.fiscal_yearquarter) || fyqFilterCanon || latestFyq || "—";
  }, [filteredRows, latestFyq, fyqFilterCanon]);

  const subtitle = useMemo(() => {
    return `Metric: ${metricName || "—"} • Rows: ${filteredRows.length}`;
  }, [metricName, filteredRows.length]);

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
        direction: key === "acv" ? "desc" : "asc",
      };
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} width={1700}>
      <div style={{ display: "grid", gap: 14 }}>
        <DrillModalContextBar
          helperText={contextHelper ?? LARGE_DEALS_DRILL_CONTEXT}
          definitionsSection={definitionsSection}
          onOpenDefinitions={onOpenDefinitions}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.65)" }}>
              Deal size threshold
            </div>
            {THRESHOLDS.map((opt) => (
              <SegButton
                key={opt.value}
                active={threshold === opt.value}
                onClick={() => setThreshold(opt.value)}
              >
                {opt.label}
              </SegButton>
            ))}
          </div>

          <div style={styles.topBar}>
            <SourcePill value="ACV" />
            {!fieldScopeIsGlobal ? (
              <div style={styles.totalPill}>
                <span style={styles.totalPillLabel}>Employee</span>
                <span style={styles.totalPillValue}>{fieldScopeLabel}</span>
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
              <span style={styles.totalPillLabel}>Total ACV</span>
              <span style={styles.totalPillValue}>{fmtMoneyCompact(totalAmount)}</span>
            </div>
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
          <table
            style={{
              ...styles.table,
              minWidth: hideDealReviewColumn ? 1180 : styles.table.minWidth,
            }}
          >
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
                  label="Owner"
                  sortKey="owner"
                  sortState={sortState}
                  onToggle={toggleSort}
                />
                <SortableHeader
                  label="Stage"
                  sortKey="stage"
                  sortState={sortState}
                  onToggle={toggleSort}
                />
                <SortableHeader
                  label="Close Date"
                  sortKey="closeDate"
                  sortState={sortState}
                  onToggle={toggleSort}
                />
                <SortableHeader
                  label="Opp Name"
                  sortKey="oppName"
                  sortState={sortState}
                  onToggle={toggleSort}
                />
                {!hideDealReviewColumn && (
                  <SortableHeader
                    label="Deal Review Short"
                    sortKey="dealReviewShort"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                )}
                <SortableHeader
                  label="ACV"
                  sortKey="acv"
                  sortState={sortState}
                  onToggle={toggleSort}
                  align="right"
                />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, i) => {
                const oppId = r?.opp_id;
                const oppUrl = buildOppUrl(oppId);
                const oppName = r?.opp_name || "—";
                const reviewShortRaw = r?.deal_review_short;
                const reviewHtmlRaw = r?.deal_review_html;
                const reviewShort = stripHtmlToText(reviewShortRaw);
                const rowKey = `${oppId ?? "row"}-${i}`;
                const displayAmount = isOpenPipelineQtdDrillMetric(metricName)
                  ? r?.open_pipeline_acv
                  : r?.closed_acv;

                return (
                  <tr key={rowKey} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                    {showAccountColumn && (
                      <td style={styles.td}>
                        {r?.account_name || "—"}
                      </td>
                    )}
                    <td style={styles.td}>
                      {r?.opp_owner_name || "—"}
                    </td>
                    <td style={styles.td}>
                      <StagePill value={r?.stage_name} />
                    </td>
                    <td style={styles.td}>
                      <CloseDateCell
                        value={r?.close_date}
                        showBadge={showCloseBadges}
                      />
                    </td>
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
                    {!hideDealReviewColumn ? (
                      <td style={styles.tdReview}>
                        <DealReviewPopover
                          shortText={reviewShort || "—"}
                          fullHtml={reviewHtmlRaw}
                          oppName={oppName}
                          stageName={r?.stage_name || "—"}
                          isOpen={openReviewKey === rowKey}
                          onToggle={() => setOpenReviewKey((prev) => (prev === rowKey ? null : rowKey))}
                          onClose={() => setOpenReviewKey(null)}
                        />
                      </td>
                    ) : null}
                    <td style={styles.tdAmount}>
                      {fmtMoneyCompact(displayAmount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!sortedRows.length && (
            <div style={styles.emptyState}>
              No opportunities found for <strong>{metricName}</strong> at the selected threshold.
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
    minWidth: 1450,
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
    minWidth: 260,
    verticalAlign: "top",
    lineHeight: 1.35,
  },
  tdReview: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 800,
    color: "#1e293b",
    borderBottom: "1px solid #f1f5f9",
    minWidth: 140,
    maxWidth: 170,
    width: 150,
    whiteSpace: "normal",
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
  reviewWrap: {
    position: "relative",
    display: "inline-block",
    width: "100%",
  },
  reviewChip: {
    appearance: "none",
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.8)",
    borderRadius: 10,
    padding: "8px 10px",
    width: "100%",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  reviewChipText: {
    fontSize: 13,
    fontWeight: 800,
    color: "#1e293b",
    lineHeight: 1.35,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 110,
  },
  reviewChipIcon: {
    fontSize: 12,
    fontWeight: 950,
    color: "#0b5cab",
    flex: "0 0 auto",
  },
  reviewPopover: {
    overflow: "auto",
    background: "white",
    border: "1px solid rgba(15,23,42,0.14)",
    borderRadius: 14,
    boxShadow: "0 20px 50px rgba(0,0,0,0.22)",
    padding: 14,
  },
  reviewPopoverHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  reviewPopoverTitle: {
    fontSize: 14,
    fontWeight: 1000,
    color: "#0f172a",
  },
  reviewPopoverClose: {
    appearance: "none",
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#f8fafc",
    borderRadius: 8,
    padding: "4px 8px",
    cursor: "pointer",
    fontWeight: 900,
    color: "#334155",
  },
  reviewMetaRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  reviewMetaPill: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.05)",
    border: "1px solid rgba(15,23,42,0.08)",
  },
  reviewMetaLabel: {
    fontSize: 11,
    fontWeight: 950,
    color: "rgba(15,23,42,0.62)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  reviewMetaValue: {
    fontSize: 12,
    fontWeight: 900,
    color: "#0f172a",
  },
  reviewPopoverBody: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "#1e293b",
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
  stagePillDiscovery: {
    background: "rgba(100,116,139,0.12)",
    color: "#475569",
    borderColor: "rgba(100,116,139,0.22)",
  },

  stagePillProposal: {
    background: "rgba(245,158,11,0.14)",
    color: "#92400e",
    borderColor: "rgba(245,158,11,0.26)",
  },

  stagePillCommit: {
    background: "rgba(20,184,166,0.14)",
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