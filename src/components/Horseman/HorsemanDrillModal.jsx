import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import Modal from "../ui/Modal";
import { fmtMoneyCompact, toNumber, ceoBusinessLineDisplayLabel } from "../../utils/formatters.jsx";
import DrillModalContextBar from "../ui/DrillModalContextBar.jsx";

const HORSEMAN_DRILL_CONTEXT =
  "Rows match the bar segment you clicked (source or created-by bucket × outcome). Amounts use your mapped ACV field; open pipeline shows stage when relevant.";
import AnimatedMetricValue from "../ui/AnimatedMetricValue.jsx";

const OUTCOME_META = {
  won: {
    label: "Closed Won",
    tint: "rgba(96,165,250,0.16)",
    border: "rgba(96,165,250,0.35)",
  },
  lost: {
    label: "Closed Lost",
    tint: "rgba(255,107,107,0.16)",
    border: "rgba(255,107,107,0.35)",
  },
  open: {
    label: "Open Pipeline",
    tint: "rgba(0,194,178,0.16)",
    border: "rgba(0,194,178,0.35)",
  },
};

const SALESFORCE_OPP_BASE_URL =
  "https://iterable.lightning.force.com/lightning/r/Opportunity";

function buildOppUrl(oppId) {
  const id = String(oppId ?? "").trim();
  if (!id) return null;
  return `${SALESFORCE_OPP_BASE_URL}/${id}/view`;
}

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
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;

  return null;
}

function fmtDate(v) {
  const d = normalizeDateValue(v);
  if (!d) return "—";

  return d.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function compareMaybeString(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareMaybeNumber(a, b) {
  const na = toNumber(a);
  const nb = toNumber(b);

  const aIsNum = na != null;
  const bIsNum = nb != null;

  if (aIsNum && bIsNum) return na - nb;
  if (aIsNum && !bIsNum) return -1;
  if (!aIsNum && bIsNum) return 1;

  return compareMaybeString(a, b);
}

function compareMaybeDate(a, b) {
  const da = normalizeDateValue(a);
  const db = normalizeDateValue(b);

  const ta = da ? da.getTime() : null;
  const tb = db ? db.getTime() : null;

  const aIsDate = ta != null;
  const bIsDate = tb != null;

  if (aIsDate && bIsDate) return ta - tb;
  if (aIsDate && !bIsDate) return -1;
  if (!aIsDate && bIsDate) return 1;

  return compareMaybeString(a, b);
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

function SortChevron({ active, direction }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        marginLeft: 6,
        flexShrink: 0,
        /* Keep rotated SVG inside a fixed box so hit-testing stays on the sort button. */
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: active ? 0.95 : 0.55,
          transform:
            active && direction === "desc"
              ? "rotate(180deg)"
              : "rotate(0deg)",
          transition: "transform 140ms ease, opacity 140ms ease",
          color: "white",
        }}
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

function ScopePill({ label = "Global" }) {
  return (
    <div style={styles.scopePill}>
      <span style={styles.scopePillLabel}>Employee Scope</span>
      <span style={styles.scopePillValue}>{label}</span>
    </div>
  );
}

function BusinessLinePill({ text }) {
  return (
    <div style={styles.scopePill} title="CEO business line filter">
      <span style={styles.scopePillLabel}>Business Line</span>
      <span style={{ ...styles.scopePillValue, maxWidth: 280 }}>{text}</span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent = false,
  tint,
  border,
  animated = false,
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: accent
          ? `1px solid ${border || "rgba(89,193,167,0.35)"}`
          : "1px solid rgba(15,23,42,0.10)",
        background: accent
          ? `linear-gradient(180deg, ${tint || "rgba(89,193,167,0.08)"}, rgba(255,255,255,0.92))`
          : "white",
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

      {animated ? (
        <AnimatedMetricValue
          value={value}
          style={{
            fontSize: 22,
            fontWeight: 950,
            marginTop: 8,
            color: "rgba(15,23,42,0.96)",
            lineHeight: 1.1,
            wordBreak: "break-word",
          }}
        />
      ) : (
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
      )}
    </div>
  );
}

function ReviewChip({
  shortText,
  hasFullReview,
  isOpen,
  onToggle,
}) {
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
      title={
        hasFullReview
          ? "Click to view full deal health"
          : "No full deal health available"
      }
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
              <div style={styles.reviewPopoverTitle}>Deal Health</div>
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

export default function HorsemanDrillModal({
  open,
  onClose,
  source,
  bucketAxisLabel = "Source",
  outcome,
  rows = [],
  oppIdKey,
  oppNameKey,
  ownerKey,
  stageKey,
  arrKey,
  closeKey,
  dealReviewKey,
  dealReviewShortKey,
  fieldScopeLabel = "Global",
  fieldScopeIsGlobal = true,
  fieldScopeUserCount = 0,
  /** CEO toggle: "All" | "New Business" | "Gross Expansion" */
  businessLine = "All",
  contextHelper,
  definitionsSection = "horseman",
  onOpenDefinitions,
}) {
  const [sortState, setSortState] = useState({
    key: "arr",
    direction: "desc",
  });
  const [openReviewKey, setOpenReviewKey] = useState(null);

  useEffect(() => {
    if (open) {
      setSortState({ key: "arr", direction: "desc" });
      setOpenReviewKey(null);
    }
  }, [open, source, outcome]);

  const meta = OUTCOME_META[outcome] || {
    label: "Selected Segment",
    tint: "rgba(15,23,42,0.08)",
    border: "rgba(15,23,42,0.18)",
  };

  const showStageColumn = outcome === "open";
  const showOwnerColumn = fieldScopeIsGlobal || fieldScopeUserCount !== 1;

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (toNumber(r?.[arrKey]) || 0), 0),
    [rows, arrKey]
  );

  const sortedRows = useMemo(() => {
    const withIndex = rows.map((r, idx) => ({ __idx: idx, __row: r }));

    const sorted = [...withIndex].sort((a, b) => {
      const ra = a.__row;
      const rb = b.__row;
      let cmp = 0;

      switch (sortState.key) {
        case "opportunity":
          cmp = compareMaybeString(ra?.[oppNameKey], rb?.[oppNameKey]);
          break;
        case "owner":
          cmp = compareMaybeString(ra?.[ownerKey], rb?.[ownerKey]);
          break;
        case "stage":
          cmp = compareMaybeString(ra?.[stageKey], rb?.[stageKey]);
          break;
        case "arr":
          cmp = compareMaybeNumber(ra?.[arrKey], rb?.[arrKey]);
          break;
        case "closeDate":
          cmp = compareMaybeDate(ra?.[closeKey], rb?.[closeKey]);
          break;
        case "reviewShort":
          cmp = compareMaybeString(
            stripHtmlToText(ra?.[dealReviewShortKey]),
            stripHtmlToText(rb?.[dealReviewShortKey])
          );
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

    return sorted.map((x) => x.__row);
  }, [
    rows,
    sortState,
    oppNameKey,
    ownerKey,
    stageKey,
    arrKey,
    closeKey,
    dealReviewShortKey,
  ]);

  const handleSort = (key) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction:
          key === "opportunity" ||
          key === "owner" ||
          key === "stage" ||
          key === "reviewShort"
            ? "asc"
            : "desc",
      };
    });
  };

  const SortableHeader = ({ label, sortKey }) => {
    const active = sortState.key === sortKey;

    return (
      <th style={styles.th}>
        <button
          type="button"
          onClick={() => handleSort(sortKey)}
          style={styles.headerButton}
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
      onClose={() => {
        setOpenReviewKey(null);
        onClose?.();
      }}
      title={`Horseman Drill — ${source || "—"}`}
      subtitle={`${meta.label} • ${rows.length} opportunit${rows.length === 1 ? "y" : "ies"} • ${fmtMoneyCompact(total)}`}
      width={showStageColumn ? 1460 : 1320}
    >
      <DrillModalContextBar
        helperText={contextHelper ?? HORSEMAN_DRILL_CONTEXT}
        definitionsSection={definitionsSection}
        onOpenDefinitions={onOpenDefinitions}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
          gap: 12,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            minHeight: 72,
          }}
        >
          <SourcePill value="ACV" />
          <ScopePill label={fieldScopeLabel || "Global"} />
          <BusinessLinePill text={ceoBusinessLineDisplayLabel(businessLine)} />
        </div>

        <SummaryCard label={bucketAxisLabel} value={source || "—"} />

        <SummaryCard
          label="Outcome"
          value={meta.label}
          accent
          tint={meta.tint}
          border={meta.border}
        />

        <SummaryCard
          label="Segment Total"
          value={fmtMoneyCompact(total)}
          animated
        />
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={styles.summaryPill}>
          <span style={styles.summaryLabel}>Rows</span>
          <AnimatedMetricValue
            value={String(rows.length)}
            style={styles.summaryValueAnimated}
          />
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div style={styles.tableWrap}>
        <table
          style={{
            ...styles.table,
            minWidth: showStageColumn
              ? showOwnerColumn
                ? 1240
                : 1120
              : showOwnerColumn
                ? 1100
                : 980,
          }}
        >
          <thead>
            <tr style={styles.thRow}>
              <SortableHeader label="Opportunity" sortKey="opportunity" />
              {showOwnerColumn ? (
                <SortableHeader label="Owner" sortKey="owner" />
              ) : null}
              {showStageColumn ? (
                <SortableHeader label="Stage" sortKey="stage" />
              ) : null}
              <SortableHeader label="ACV" sortKey="arr" />
              <SortableHeader label="Close Date" sortKey="closeDate" />
              <SortableHeader label="Deal Health" sortKey="reviewShort" />
            </tr>
          </thead>

          <tbody>
            {sortedRows.length ? (
              sortedRows.map((r, idx) => {
                const rowKey =
                  oppIdKey && r?.[oppIdKey] != null && String(r[oppIdKey]).trim() !== ""
                    ? `opp-${String(r[oppIdKey]).trim()}`
                    : `${String(r?.[oppNameKey] ?? "row")}-${idx}`;
                const shortReviewRaw = dealReviewShortKey ? r?.[dealReviewShortKey] : null;
                const fullReviewHtml = dealReviewKey ? r?.[dealReviewKey] : null;
                const oppUrl = buildOppUrl(oppIdKey ? r?.[oppIdKey] : null);

                return (
                  <tr
                    key={rowKey}
                    style={idx % 2 === 0 ? styles.trEven : styles.trOdd}
                  >
                    <td style={styles.tdLabel}>
                      {oppUrl ? (
                        <a
                          href={oppUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.link}
                          title="Open opportunity in Salesforce"
                        >
                          {r?.[oppNameKey] || "—"}
                        </a>
                      ) : (
                        r?.[oppNameKey] || "—"
                      )}
                    </td>
                    {showOwnerColumn ? (
                      <td style={styles.td}>{r?.[ownerKey] || "—"}</td>
                    ) : null}
                    {showStageColumn ? (
                      <td style={styles.td}>{r?.[stageKey] || "—"}</td>
                    ) : null}
                    <td style={styles.tdAmount}>
                      <AnimatedMetricValue
                        value={fmtMoneyCompact(toNumber(r?.[arrKey]) || 0)}
                        style={{
                          fontSize: 13,
                          fontWeight: 950,
                          color: "#0b3251",
                          lineHeight: 1.2,
                        }}
                      />
                    </td>
                    <td style={styles.td}>{fmtDate(r?.[closeKey])}</td>
                    <td style={styles.tdWide}>
                      <DealReviewPopover
                        shortText={shortReviewRaw}
                        fullHtml={fullReviewHtml}
                        oppName={r?.[oppNameKey] || "—"}
                        stageName={r?.[stageKey] || "—"}
                        isOpen={openReviewKey === rowKey}
                        onToggle={() =>
                          setOpenReviewKey((prev) => (prev === rowKey ? null : rowKey))
                        }
                        onClose={() => setOpenReviewKey(null)}
                      />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={
                    showStageColumn
                      ? showOwnerColumn
                        ? 6
                        : 5
                      : showOwnerColumn
                        ? 5
                        : 4
                  }
                  style={styles.emptyState}
                >
                  No opportunities found for this exact Horseman segment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

const styles = {
  headerButton: {
    appearance: "none",
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    width: "100%",
    font: "inherit",
    color: "white",
    textTransform: "inherit",
    letterSpacing: "inherit",
    whiteSpace: "nowrap",
    fontSize: 11,
    fontWeight: 950,
  },
  summaryPill: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(15,23,42,0.05)",
    border: "1px solid rgba(15,23,42,0.08)",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: 950,
    color: "rgba(15,23,42,0.65)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  summaryValueAnimated: {
    fontSize: 14,
    fontWeight: 1000,
    color: "rgba(15,23,42,0.92)",
    lineHeight: 1.1,
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
  },
  /* Sticky on <tr> is unreliable; tbody can paint above and steal clicks. Use per-cell <th> sticky. */
  thRow: {
    background: "#334155",
  },
  th: {
    padding: "14px 12px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    color: "white",
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "#334155",
    boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.12)",
  },
  trEven: {
    background: "#f8fafc",
  },
  trOdd: {
    background: "#ffffff",
  },
  td: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 800,
    color: "#1e293b",
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
    verticalAlign: "top",
    position: "relative",
    zIndex: 0,
  },
  tdLabel: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 950,
    color: "#1e293b",
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
    verticalAlign: "top",
    position: "relative",
    zIndex: 0,
  },
  tdAmount: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 950,
    color: "#0b3251",
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
    verticalAlign: "top",
    position: "relative",
    zIndex: 0,
  },
  tdWide: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 800,
    color: "#1e293b",
    borderBottom: "1px solid #f1f5f9",
    minWidth: 190,
    maxWidth: 220,
    width: 200,
    whiteSpace: "normal",
    verticalAlign: "top",
    lineHeight: 1.35,
    position: "relative",
    zIndex: 0,
  },
  emptyState: {
    padding: 24,
    fontSize: 14,
    fontWeight: 800,
    color: "rgba(15,23,42,0.72)",
  },
  link: {
    color: "#0b5cab",
    textDecoration: "none",
    fontWeight: 950,
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
    maxWidth: 200,
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
  lineHeight: 1,
},

sourcePillValue: {
  fontSize: 12,
  fontWeight: 1000,
  color: "rgba(15,23,42,0.92)",
  lineHeight: 1,
},

scopePill: {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 999,
  padding: "7px 12px",
  background: "rgba(15,23,42,0.05)",
  border: "1px solid rgba(15,23,42,0.08)",
},

scopePillLabel: {
  fontSize: 11,
  fontWeight: 950,
  color: "rgba(15,23,42,0.62)",
  textTransform: "uppercase",
  letterSpacing: 0.3,
  lineHeight: 1,
},

scopePillValue: {
  fontSize: 12,
  fontWeight: 1000,
  color: "rgba(15,23,42,0.92)",
  lineHeight: 1,
},
};