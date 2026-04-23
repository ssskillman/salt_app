import React, { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import Modal from "./Modal";
import { fmtMoneyCompact, toNumber, ceoBusinessLineDisplayLabel } from "../../utils/formatters.jsx";
import { createPortal } from "react-dom";
import DrillModalContextBar from "./DrillModalContextBar.jsx";

const OPEN_PIPELINE_DRILL_CONTEXT =
  "Scoped opportunity rows for this drill (open pipeline, closed won, or closed lost depending on the title). Sort columns; risk filters apply when you arrived from Open Pipeline Health.";

const SALESFORCE_OPP_BASE_URL =
  "https://iterable.lightning.force.com/lightning/r/Opportunity";

function normalizeDateValue(v) {
  if (v == null || String(v).trim() === "") return null;

  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;

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

  if (days < 0) return { label: `${Math.abs(days)}d late`, tone: "late" };
  if (days === 0) return { label: "Today", tone: "urgent" };
  if (days <= 7) return { label: `${days}d`, tone: "soon" };

  return null;
}

function CloseDateCell({ value, showRelativeBadge = true }) {
  const badge = showRelativeBadge ? getCloseDateBadge(value) : null;

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

  if (s.includes("commit")) return "commit";
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

  return <span style={{ ...styles.stagePill, ...toneStyle }}>{text}</span>;
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

function ReviewChip({ shortText, hasFullReview, isOpen, onToggle }) {
  const label = stripHtmlToText(shortText) || "—";

  return (
    <button
      type="button"
      onClick={hasFullReview ? onToggle : undefined}
      style={{
        ...styles.reviewChip,
        cursor: hasFullReview ? "pointer" : "default",
        opacity: hasFullReview ? 1 : 0.82,
        boxShadow: isOpen ? "0 0 0 2px rgba(59,130,246,0.12)" : "none",
      }}
    >
      <div style={styles.reviewChipLeft}>
        <span style={styles.reviewChipText}>{label}</span>
      </div>

      {hasFullReview ? <span style={styles.reviewChipIcon}>ⓘ</span> : null}
    </button>
  );
}

function DealReviewPopover({
  shortText,
  fullHtml,
  /** Plain-text detail (escaped in the popover); used when `fullHtml` is empty. */
  fullPlainText = null,
  popoverTitle = "Deal Health",
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

  const hasFullReview =
    String(fullHtml ?? "").trim() !== "" || String(fullPlainText ?? "").trim() !== "";

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      const gap = 8;
      const preferredWidth = 720;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const maxWidth = Math.min(preferredWidth, viewportW - 32);

      let left = rect.left;
      let top = rect.bottom + gap;

      if (left + maxWidth > viewportW - 16) {
        left = Math.max(16, viewportW - maxWidth - 16);
      }

      let maxHeight = Math.min(560, viewportH - top - 16);

      if (maxHeight < 260) {
        const upwardTop = Math.max(16, rect.top - 440 - gap);
        top = upwardTop;
        maxHeight = Math.min(560, viewportH - top - 16);
      }

      setPopoverStyle({
        position: "fixed",
        left,
        top,
        width: maxWidth,
        maxWidth,
        maxHeight: Math.max(260, maxHeight),
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
              <div style={styles.reviewPopoverTitle}>{popoverTitle}</div>
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

            {String(fullHtml ?? "").trim() ? (
              <div
                style={styles.reviewPopoverBody}
                dangerouslySetInnerHTML={{ __html: fullHtml }}
              />
            ) : (
              <div style={{ ...styles.reviewPopoverBody, whiteSpace: "pre-wrap" }}>
                {String(fullPlainText ?? "").trim() || "—"}
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div ref={wrapRef} style={styles.reviewWrap}>
        <div ref={buttonRef}>
          <ReviewChip
            shortText={shortText}
            hasFullReview={hasFullReview}
            isOpen={isOpen}
            onToggle={onToggle}
          />
        </div>
      </div>

      {popoverNode}
    </>
  );
}

function getReviewRiskBucket(shortText) {
  const s = stripHtmlToText(shortText).toLowerCase();

  if (!s) return "unknown";
  if (s.includes("healthy")) return "healthy";
  if (s.includes("needs attention")) return "needs_attention";
  if (s.includes("at risk")) return "at_risk";
  return "unknown";
}

/** Non-empty `competition` values: counts + closed-lost sums for Closed Lost modal insights. */
function aggregateCompetitorsByRows(rows, amountField) {
  const m = new Map();
  for (const r of rows || []) {
    const raw = String(r?.competition ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    let o = m.get(key);
    if (!o) {
      o = { key, display: raw, count: 0, sum: 0 };
      m.set(key, o);
    }
    o.count += 1;
    o.sum += toNumber(r?.[amountField]) || 0;
  }
  if (m.size === 0) {
    return { mostFreq: null, topRevenue: null, list: [] };
  }
  const list = [...m.values()];

  const mostFreq = list.reduce((best, cur) => {
    if (!best) return cur;
    if (cur.count > best.count) return cur;
    if (cur.count < best.count) return best;
    if (cur.sum > best.sum) return cur;
    return cur.display.localeCompare(best.display) < 0 ? cur : best;
  }, null);

  const topRevenue = list.reduce((best, cur) => {
    if (!best) return cur;
    if (cur.sum > best.sum) return cur;
    if (cur.sum < best.sum) return best;
    if (cur.count > best.count) return cur;
    return cur.display.localeCompare(best.display) < 0 ? cur : best;
  }, null);

  list.sort((a, b) => b.count - a.count || b.sum - a.sum || a.display.localeCompare(b.display));
  return { mostFreq, topRevenue, list };
}

/** Non-empty `lost_reason` values: counts + ACV sums for “most frequent lost reason” pill. */
function aggregateLostReasonsByRows(rows, amountField) {
  const m = new Map();
  for (const r of rows || []) {
    const raw = String(r?.lost_reason ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    let o = m.get(key);
    if (!o) {
      o = { key, display: raw, count: 0, sum: 0 };
      m.set(key, o);
    }
    o.count += 1;
    o.sum += toNumber(r?.[amountField]) || 0;
  }
  if (m.size === 0) {
    return { mostFreq: null };
  }
  const list = [...m.values()];
  const mostFreq = list.reduce((best, cur) => {
    if (!best) return cur;
    if (cur.count > best.count) return cur;
    if (cur.count < best.count) return best;
    if (cur.sum > best.sum) return cur;
    return cur.display.localeCompare(best.display) < 0 ? cur : best;
  }, null);
  return { mostFreq };
}

export default function OpenPipelineDrillModal({
  open,
  onClose,
  title = "Open Pipeline",
  rows = [],
  fieldScopeIsGlobal = true,
  fieldScopeLabel = "Global",
  selectedRisk = "all",
  /** CEO toggle: "All" | "New Business" | "Gross Expansion" */
  businessLine = "All",
  /** Row field used for filter, sort, total, and amount column (e.g. "open_pipeline_acv" | "closed_acv"). */
  amountField = "open_pipeline_acv",
  amountColumnLabel = "Open Pipeline",
  totalPillLabel = "Total Open Pipeline",
  emptyStateMessage = "No open pipeline rows found for this scope.",
  /** When false, close date shows only the calendar date (no “Nd late” / urgency pills). */
  showCloseDateRelativeBadges = true,
  /** Closed Lost drill: lost reason (chip + popover), Competition column, insight pills (incl. most frequent lost reason). */
  showLostReasonColumn = false,
  /**
   * When set (e.g. "Closed Lost"), shows a Stage pill in the header and hides the per-row Stage Name column.
   */
  fixedStageHeader = null,
  contextHelper,
  definitionsSection = "field_execution",
  onOpenDefinitions,
}) {
  const [sortState, setSortState] = useState({
    key: amountField,
    direction: "desc",
  });

  /** `"deal:${rowKey}"` | `"lost:${rowKey}"` so Deal Health vs Lost Reason popovers do not clash. */
  const [openPopover, setOpenPopover] = useState(null);

  const [showAccountColumn, setShowAccountColumn] = useState(false);

  /** Closed Lost: filter table by `competition` (value = lowercase key, "" = all). */
  const [competitorFilter, setCompetitorFilter] = useState("");

  /**
   * Deal-health row filter (open pipeline only). Initialized from `selectedRisk` when the modal opens;
   * user can change via header toggles without closing.
   */
  const [healthFilter, setHealthFilter] = useState("all");
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      setSortState({ key: amountField, direction: "desc" });
      setShowAccountColumn(false);
      setOpenPopover(null);
      setCompetitorFilter("");
    }
  }, [open, amountField]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const fromEntry =
        selectedRisk === "needs_attention" ||
        selectedRisk === "at_risk" ||
        selectedRisk === "healthy" ||
        selectedRisk === "unknown"
          ? selectedRisk
          : "all";
      setHealthFilter(fromEntry);
    }
    wasOpenRef.current = open;
  }, [open, selectedRisk]);

  useEffect(() => {
    if (!open || !fixedStageHeader) return;
    setSortState((prev) =>
      prev.key === "stage_name" ? { key: amountField, direction: "desc" } : prev
    );
  }, [open, fixedStageHeader, amountField]);

  const riskFilteredRows = useMemo(() => {
    const base = (rows || []).filter((r) => (toNumber(r?.[amountField]) ?? 0) > 0);

    if (!healthFilter || healthFilter === "all") return base;

    /** Empty or unrecognized deal health — not Healthy / Needs attention / At risk. */
    if (healthFilter === "unknown") {
      return base.filter((r) => getReviewRiskBucket(r?.deal_review_short) === "unknown");
    }

    return base.filter((r) => getReviewRiskBucket(r?.deal_review_short) === healthFilter);
  }, [rows, healthFilter, amountField]);

  /** Scoped open-pipe sums by deal-health bucket (full drill scope, not narrowed by `selectedRisk`). */
  const openPipelineDealHealthTotals = useMemo(() => {
    if (amountField !== "open_pipeline_acv") {
      return { needsAttention: 0, atRisk: 0 };
    }
    let needsAttention = 0;
    let atRisk = 0;
    for (const r of rows || []) {
      const amt = toNumber(r?.[amountField]) || 0;
      if (amt <= 0) continue;
      const b = getReviewRiskBucket(r?.deal_review_short);
      if (b === "needs_attention") needsAttention += amt;
      else if (b === "at_risk") atRisk += amt;
    }
    return { needsAttention, atRisk };
  }, [rows, amountField]);

  const showNeedsAttentionHealthPill =
    amountField === "open_pipeline_acv" && selectedRisk !== "at_risk";
  const showAtRiskHealthPill =
    amountField === "open_pipeline_acv" && selectedRisk !== "needs_attention";

  const showDealHealthHeaderToggles =
    amountField === "open_pipeline_acv" && !showLostReasonColumn;

  const competitorSelectOptions = useMemo(() => {
    if (!showLostReasonColumn) return [];
    return aggregateCompetitorsByRows(riskFilteredRows, amountField).list;
  }, [showLostReasonColumn, riskFilteredRows, amountField]);

  const filteredRows = useMemo(() => {
    if (!showLostReasonColumn || !competitorFilter) return riskFilteredRows;
    return riskFilteredRows.filter(
      (r) => String(r?.competition ?? "").trim().toLowerCase() === competitorFilter
    );
  }, [riskFilteredRows, showLostReasonColumn, competitorFilter]);

  const competitorDisplayStats = useMemo(() => {
    if (!showLostReasonColumn) return { mostFreq: null, topRevenue: null };
    return aggregateCompetitorsByRows(filteredRows, amountField);
  }, [showLostReasonColumn, filteredRows, amountField]);

  const lostReasonInsightStats = useMemo(() => {
    if (!showLostReasonColumn) return { mostFreq: null };
    return aggregateLostReasonsByRows(filteredRows, amountField);
  }, [showLostReasonColumn, filteredRows, amountField]);

  const sortedRows = useMemo(() => {
    const out = [...filteredRows];

    const getValue = (row, sortKey) => {
      switch (sortKey) {
        case "account_name":
          return String(row?.account_name ?? "").toLowerCase();
        case "opp_owner_name":
          return String(row?.opp_owner_name ?? "").toLowerCase();
        case "stage_name":
          return String(row?.stage_name ?? "").toLowerCase();
        case "close_date":
          return dateSortValue(row?.close_date);
        case "opp_name":
          return String(row?.opp_name ?? "").toLowerCase();
        case "business_line":
          return String(row?.business_line ?? "").toLowerCase();
        case "reviewShort":
          return stripHtmlToText(row?.deal_review_short ?? "").toLowerCase();
        case "lostReasonShort":
          return String(row?.lost_reason ?? "").trim().toLowerCase();
        case "competition":
          return String(row?.competition ?? "").trim().toLowerCase();
        default: {
          if (sortKey === amountField) {
            const n = toNumber(row?.[amountField]);
            return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
          }
          return "";
        }
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
  }, [filteredRows, sortState, amountField]);

  const totalAmount = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + (toNumber(r?.[amountField]) || 0), 0);
  }, [filteredRows, amountField]);

  const summaryFiscalYearquarter = useMemo(() => {
    const vals = [...new Set(filteredRows.map((r) => String(r?.fiscal_yearquarter ?? "").trim()).filter(Boolean))];
    if (!vals.length) return "—";
    if (vals.length === 1) return vals[0];
    return "Multiple";
  }, [filteredRows]);

  const subtitle = useMemo(() => {
    const riskLabel =
      healthFilter === "healthy"
        ? "Healthy"
        : healthFilter === "needs_attention"
          ? "Needs Attention"
          : healthFilter === "at_risk"
            ? "At Risk"
            : healthFilter === "unknown"
              ? "Unknown"
              : null;

    return riskLabel
      ? `Rows: ${filteredRows.length} • Filter: ${riskLabel}`
      : `Rows: ${filteredRows.length}`;
  }, [filteredRows.length, healthFilter]);

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
        direction: key === amountField ? "desc" : "asc",
      };
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} width={1500}>
      <div style={{ display: "grid", gap: 14 }}>
        <DrillModalContextBar
          helperText={contextHelper ?? OPEN_PIPELINE_DRILL_CONTEXT}
          definitionsSection={definitionsSection}
          onOpenDefinitions={onOpenDefinitions}
        />
        <div style={styles.topBar}>
          <SourcePill value="ACV" />

          {fixedStageHeader ? (
            getStageTone(fixedStageHeader) === "lost" ? (
              <div style={styles.fixedStagePillLostWrap}>
                <span style={styles.fixedStagePillLostLabel}>Stage</span>
                <span style={styles.fixedStagePillLostValue}>{fixedStageHeader}</span>
              </div>
            ) : (
              <div style={styles.totalPill}>
                <span style={styles.totalPillLabel}>Stage</span>
                <span style={styles.totalPillValue}>{fixedStageHeader}</span>
              </div>
            )
          ) : null}

          {!fieldScopeIsGlobal ? (
            <div style={styles.totalPill}>
              <span style={styles.totalPillLabel}>Employee</span>
              <span style={styles.totalPillValue}>{fieldScopeLabel}</span>
            </div>
          ) : (
            <div style={styles.totalPill}>
              <span style={styles.totalPillLabel}>Employee Scope</span>
              <span style={styles.totalPillValue}>Global</span>
            </div>
          )}

          <div style={styles.totalPill}>
            <span style={styles.totalPillLabel}>FY Quarter</span>
            <span style={styles.totalPillValue}>{summaryFiscalYearquarter}</span>
          </div>

          <div style={styles.totalPill}>
            <span style={styles.totalPillLabel}>Business Line</span>
            <span style={styles.totalPillValue}>{ceoBusinessLineDisplayLabel(businessLine)}</span>
          </div>

          <div style={styles.totalPill}>
            <span style={styles.totalPillLabel}>{totalPillLabel}</span>
            <span style={styles.totalPillValue}>{fmtMoneyCompact(totalAmount)}</span>
          </div>
        </div>

        {showLostReasonColumn ? (
          <div style={styles.competitorInsightsRow}>
            <div style={styles.competitionFilterWrap}>
              <label htmlFor="closed-lost-competition-filter" style={styles.competitionFilterTitle}>
                Competition filter
              </label>
              <select
                id="closed-lost-competition-filter"
                value={competitorFilter}
                onChange={(e) => setCompetitorFilter(e.target.value)}
                style={styles.competitorSelectTinted}
                aria-label="Competition filter"
              >
                <option value="">All competitors</option>
                {competitorSelectOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.display} ({opt.count})
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.totalPill}>
              <span style={styles.totalPillLabel}>Most frequent lost reason</span>
              <span style={styles.totalPillValue}>
                {lostReasonInsightStats.mostFreq
                  ? `${lostReasonInsightStats.mostFreq.display} · ${lostReasonInsightStats.mostFreq.count} opps`
                  : "—"}
              </span>
            </div>
            <div style={styles.totalPill}>
              <span style={styles.totalPillLabel}>Most frequent competitor</span>
              <span style={styles.totalPillValue}>
                {competitorDisplayStats.mostFreq
                  ? `${competitorDisplayStats.mostFreq.display} · ${competitorDisplayStats.mostFreq.count} opps`
                  : "—"}
              </span>
            </div>
            <div style={styles.totalPill}>
              <span style={styles.totalPillLabel}>Top closed-lost ACV</span>
              <span style={styles.totalPillValue}>
                {competitorDisplayStats.topRevenue
                  ? `${competitorDisplayStats.topRevenue.display} · ${fmtMoneyCompact(competitorDisplayStats.topRevenue.sum)}`
                  : "—"}
              </span>
            </div>
          </div>
        ) : null}

        <div style={styles.columnToggleRow}>
          <div style={styles.columnToggleLeft}>
            <button
              type="button"
              onClick={() => setShowAccountColumn((v) => !v)}
              style={styles.columnToggleBtn}
            >
              {showAccountColumn ? "− Account" : "+ Account"}
            </button>

            {showDealHealthHeaderToggles ? (
              <div style={styles.dealHealthToggleGroup} role="group" aria-label="Deal health filter">
                <span style={styles.dealHealthToggleLegend}>Deal health</span>
                {[
                  { key: "all", label: "All" },
                  { key: "at_risk", label: "At risk" },
                  { key: "healthy", label: "Healthy" },
                  { key: "needs_attention", label: "Needs attention" },
                  { key: "unknown", label: "Unknown" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setHealthFilter(key)}
                    aria-pressed={healthFilter === key}
                    style={{
                      ...styles.dealHealthToggleBtn,
                      ...(healthFilter === key ? styles.dealHealthToggleBtnActive : null),
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {showNeedsAttentionHealthPill || showAtRiskHealthPill ? (
            <div style={styles.dealHealthPillsWrap}>
              {showNeedsAttentionHealthPill ? (
                <div style={styles.totalPill}>
                  <span style={styles.totalPillLabel}>Needs attention (open pipe)</span>
                  <span style={styles.totalPillValue}>
                    {fmtMoneyCompact(openPipelineDealHealthTotals.needsAttention)}
                  </span>
                </div>
              ) : null}
              {showAtRiskHealthPill ? (
                <div style={styles.totalPill}>
                  <span style={styles.totalPillLabel}>At risk (open pipe)</span>
                  <span style={styles.totalPillValue}>
                    {fmtMoneyCompact(openPipelineDealHealthTotals.atRisk)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                {showAccountColumn && (
                  <SortableHeader
                    label="Account Name"
                    sortKey="account_name"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                )}
                <SortableHeader
                  label="Opp Name"
                  sortKey="opp_name"
                  sortState={sortState}
                  onToggle={toggleSort}
                />
                <SortableHeader
                  label="Opp Owner Name"
                  sortKey="opp_owner_name"
                  sortState={sortState}
                  onToggle={toggleSort}
                />
                {!fixedStageHeader ? (
                  <SortableHeader
                    label="Stage Name"
                    sortKey="stage_name"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                ) : null}
                <SortableHeader
                  label="Close Date"
                  sortKey="close_date"
                  sortState={sortState}
                  onToggle={toggleSort}
                />
                <SortableHeader
                  label={amountColumnLabel}
                  sortKey={amountField}
                  sortState={sortState}
                  onToggle={toggleSort}
                  align="right"
                />
                <SortableHeader
                  label="Deal Health"
                  sortKey="reviewShort"
                  sortState={sortState}
                  onToggle={toggleSort}
                />
                {showLostReasonColumn ? (
                  <SortableHeader
                    label="Lost Reason"
                    sortKey="lostReasonShort"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                ) : null}
                {showLostReasonColumn ? (
                  <SortableHeader
                    label="Competition"
                    sortKey="competition"
                    sortState={sortState}
                    onToggle={toggleSort}
                  />
                ) : null}
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((r, i) => {
                const oppId = r?.opp_id;
                const oppUrl = buildOppUrl(oppId);
                const oppName = r?.opp_name || "—";
                
                const rowKey = `${i}-${r?.opp_id ?? r?.opp_owner_name ?? "row"}`;
                const shortReviewRaw = r?.deal_review_short;
                const fullReviewHtml = r?.deal_review_details;
                const lostReasonShort = r?.lost_reason;
                const lostReasonDesc = r?.lost_reason_description;
                const stageForMeta = fixedStageHeader || r?.stage_name || "—";

                return (
                  <tr
                    key={`${i}-${oppId ?? r?.opp_owner_name ?? "row"}`}
                    style={i % 2 === 0 ? styles.trEven : styles.trOdd}
                  >
                    {showAccountColumn && (
                      <td style={styles.td}>{r?.account_name || "—"}</td>
                    )}

                    <td style={styles.tdLabel}>
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

                    <td style={styles.td}>{r?.opp_owner_name || "—"}</td>
                    {!fixedStageHeader ? (
                      <td style={styles.td}>
                        <StagePill value={r?.stage_name} />
                      </td>
                    ) : null}
                    <td style={styles.td}>
                      <CloseDateCell value={r?.close_date} showRelativeBadge={showCloseDateRelativeBadges} />
                    </td>
                    <td style={styles.tdAmount}>
                      {fmtMoneyCompact(r?.[amountField])}
                    </td>
                    <td style={styles.tdReview}>
                      <DealReviewPopover
                        shortText={shortReviewRaw}
                        fullHtml={fullReviewHtml}
                        oppName={r?.opp_name || "—"}
                        stageName={stageForMeta}
                        isOpen={openPopover === `deal:${rowKey}`}
                        onToggle={() =>
                          setOpenPopover((prev) => (prev === `deal:${rowKey}` ? null : `deal:${rowKey}`))
                        }
                        onClose={() => setOpenPopover(null)}
                      />
                    </td>
                    {showLostReasonColumn ? (
                      <td style={styles.tdReview}>
                        <DealReviewPopover
                          popoverTitle="Lost Reason"
                          shortText={lostReasonShort}
                          fullHtml={null}
                          fullPlainText={lostReasonDesc}
                          oppName={r?.opp_name || "—"}
                          stageName={stageForMeta}
                          isOpen={openPopover === `lost:${rowKey}`}
                          onToggle={() =>
                            setOpenPopover((prev) => (prev === `lost:${rowKey}` ? null : `lost:${rowKey}`))
                          }
                          onClose={() => setOpenPopover(null)}
                        />
                      </td>
                    ) : null}
                    {showLostReasonColumn ? (
                      <td style={styles.tdCompetition}>{r?.competition ? String(r.competition).trim() : "—"}</td>
                    ) : null}
                  </tr>
                );
              })}

            </tbody>
          </table>

          {!sortedRows.length && (
            <div style={styles.emptyState}>
              {emptyStateMessage}
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
  dealHealthToggleGroup: {
    display: "inline-flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.04)",
    border: "1px solid rgba(15,23,42,0.08)",
  },
  dealHealthToggleLegend: {
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: 0.35,
    textTransform: "uppercase",
    color: "rgba(15,23,42,0.48)",
    marginRight: 4,
  },
  dealHealthToggleBtn: {
    appearance: "none",
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#fff",
    color: "rgba(15,23,42,0.82)",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 11,
    fontWeight: 950,
    cursor: "pointer",
  },
  dealHealthToggleBtnActive: {
    border: "1px solid rgba(89,193,167,0.45)",
    background: "rgba(89,193,167,0.18)",
    color: "rgba(15,23,42,0.92)",
  },
  /** Header Stage pill — matches row `StagePill` lost colors (Closed Lost). */
  fixedStagePillLostWrap: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 8,
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.24)",
  },
  fixedStagePillLostLabel: {
    fontSize: 11,
    fontWeight: 950,
    color: "rgba(127,29,29,0.82)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  fixedStagePillLostValue: {
    fontSize: 14,
    fontWeight: 1000,
    color: "#b91c1c",
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
  tdLabel: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 950,
    color: "#334155",
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "normal",
    minWidth: 320,
    verticalAlign: "top",
    lineHeight: 1.35,
  },
  tdReview: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 800,
    color: "#1e293b",
    borderBottom: "1px solid #f1f5f9",
    minWidth: 160,
    maxWidth: 220,
    width: 270,
    whiteSpace: "normal",
    verticalAlign: "top",
    lineHeight: 1.35,
    },
  tdCompetition: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
    borderBottom: "1px solid #f1f5f9",
    minWidth: 120,
    maxWidth: 300,
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
  competitorInsightsRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    marginTop: -4,
    marginBottom: 4,
    paddingLeft: 2,
    paddingRight: 2,
  },
  /** Closed Lost: competition dropdown (mint band matches Source / Horseman axis pills). */
  competitionFilterWrap: {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 12,
    background: "rgba(89,193,167,0.14)",
    border: "1px solid rgba(89,193,167,0.30)",
    minWidth: 220,
    maxWidth: 360,
  },
  competitionFilterTitle: {
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: 0.35,
    textTransform: "uppercase",
    color: "rgba(15,23,42,0.55)",
    cursor: "default",
  },
  competitorSelectTinted: {
    fontSize: 13,
    fontWeight: 800,
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.10)",
    padding: "8px 10px",
    background: "rgba(255,255,255,0.92)",
    color: "#0f172a",
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
  },
  columnToggleRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: -2,
    marginBottom: 6,
    paddingLeft: 2,
    paddingRight: 2,
  },
  columnToggleLeft: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    flex: "1 1 200px",
    minWidth: 0,
  },
  dealHealthPillsWrap: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flex: "1 1 280px",
    minWidth: 0,
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
  reviewChipLeft: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  reviewChipText: {
    fontSize: 13,
    fontWeight: 800,
    color: "#1e293b",
    lineHeight: 1.35,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 180,
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
};