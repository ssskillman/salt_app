// src/components/ui/ProductMixDrillModal.jsx

import React, { useMemo, useState } from "react";
import Modal from "./Modal";
import { fmtMoneyCompact, toNumber, ceoBusinessLineDisplayLabel } from "../../utils/formatters.jsx";
import DrillModalContextBar from "./DrillModalContextBar.jsx";

const PRODUCT_MIX_DRILL_CONTEXT =
  "Line-item $ sums SKUs on the order; Opp ACV counts each closed win once at deal level. Use “AI products only” to filter line items — expand rows to see every SKU.";

function norm(value) {
  return String(value ?? "").trim().toLowerCase();
}

/** One ACV per opp when SQL stamps the same acv_change on every line item. */
function dedupeOppAcvAcrossLineItems(lineAcvs) {
  const list = (Array.isArray(lineAcvs) ? lineAcvs : []).map((v) => toNumber(v) || 0);
  const n = list.length || 1;
  const maxLineAcv = list.length ? Math.max(0, ...list) : 0;
  const sumLineAcv = list.reduce((a, b) => a + b, 0);
  const tol = Math.max(maxLineAcv, 1) * 0.001 * n;
  const looksLikeDupStamp =
    n > 1 && maxLineAcv > 0 && Math.abs(sumLineAcv - maxLineAcv * n) <= tol;
  return looksLikeDupStamp ? maxLineAcv : sumLineAcv || maxLineAcv;
}

function compareValues(a, b, dir = "asc") {
  if (a == null && b == null) return 0;
  if (a == null) return dir === "asc" ? -1 : 1;
  if (b == null) return dir === "asc" ? 1 : -1;

  const aNum = typeof a === "number" ? a : Number(a);
  const bNum = typeof b === "number" ? b : Number(b);

  if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
    return dir === "asc" ? aNum - bNum : bNum - aNum;
  }

  const aStr = String(a).trim().toLowerCase();
  const bStr = String(b).trim().toLowerCase();

  if (aStr < bStr) return dir === "asc" ? -1 : 1;
  if (aStr > bStr) return dir === "asc" ? 1 : -1;
  return 0;
}

function buildOpportunityUrl(oppId) {
  const clean = String(oppId ?? "").trim();
  if (!clean) return null;
  return `https://iterable.lightning.force.com/lightning/r/Opportunity/${clean}/view`;
}

function SortHeader({ label, sortKey, activeSort, activeDir, onSort, align = "left" }) {
  const isActive = activeSort === sortKey;

  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        ...styles.th,
        textAlign: align,
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
      title={`Sort by ${label}`}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span>{label}</span>
        <span style={{ opacity: isActive ? 1 : 0.45, fontSize: 11 }}>
          {isActive ? (activeDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  );
}

export default function ProductMixDrillModal({
  open,
  onClose,
  title = "Product Mix",
  rows = [],
  fieldScopeIsGlobal = true,
  fieldScopeLabel = "Global",
  businessLine = "All",
  contextHelper,
  definitionsSection = "product_mix",
  onOpenDefinitions,
}) {
  const [sortKey, setSortKey] = useState("total_price");
  const [sortDir, setSortDir] = useState("desc");
  const [aiOnly, setAiOnly] = useState(false);
  const [collapsedOpps, setCollapsedOpps] = useState({});

  const handleSort = (nextKey) => {
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir(nextKey === "total_price" ? "desc" : "asc");
  };

  const toggleOpp = (oppId) => {
    setCollapsedOpps((prev) => ({
      ...prev,
      [oppId]: !prev[oppId],
    }));
  };

  /** Full-payload ACV per opp (ignores All / AI line-item filter). */
  const oppAcvByOppId = useMemo(() => {
    const base = Array.isArray(rows) ? rows : [];
    const acvsByOpp = new Map();
    for (const r of base) {
      const oppId = String(r?.opp_id ?? "").trim();
      if (!oppId) continue;
      if (!acvsByOpp.has(oppId)) acvsByOpp.set(oppId, []);
      acvsByOpp.get(oppId).push(r?.acv_change);
    }
    const out = new Map();
    for (const [oppId, vals] of acvsByOpp) {
      out.set(oppId, dedupeOppAcvAcrossLineItems(vals));
    }
    return out;
  }, [rows]);

  const enrichedRows = useMemo(() => {
    const base = Array.isArray(rows) ? rows : [];

    const withFlags = base.map((r, idx) => {
      const productName = String(r?.product_name ?? "").trim();
      const productCode = String(r?.product_code ?? "").trim();
      const productId = String(r?.product_id ?? "").trim();
      const oppId = String(r?.opp_id ?? "").trim();
      const oppName = String(r?.opp_name ?? "").trim();
      const accountId = String(r?.account_id ?? "").trim();
      const accountName = String(r?.account_name ?? "").trim();
      const oppOwnerName = String(r?.opp_owner_name ?? "").trim();
      const businessLineValue = String(r?.business_line ?? "").trim() || "All";
      const totalPrice = toNumber(r?.total_price) || 0;

      const isAi =
        norm(productName).includes("ai ") ||
        norm(productName).includes("artificial ") ||
        norm(productCode).includes("ai ") ||
        norm(productCode).includes("artificial ");

      return {
        _row_id: `${idx}-${oppId}-${productId}-${accountId}`,
        ...r,
        opp_id: oppId || null,
        opp_name: oppName || null,
        account_id: accountId || null,
        account_name: accountName || null,
        opp_owner_name: oppOwnerName || null,
        business_line: businessLineValue,
        product_name: productName || null,
        product_code: productCode || null,
        product_id: productId || null,
        total_price: totalPrice,
        is_ai: isAi,
      };
    });

    const filtered = aiOnly ? withFlags.filter((r) => r.is_ai) : withFlags;

    return [...filtered].sort((a, b) => {
      const oppCompare = compareValues(a?.opp_name, b?.opp_name, "asc");
      if (oppCompare !== 0) return oppCompare;

      const result = compareValues(a?.[sortKey], b?.[sortKey], sortDir);
      if (result !== 0) return result;

      return compareValues(a?._row_id, b?._row_id, "asc");
    });
  }, [rows, aiOnly, sortKey, sortDir]);

  const groupedOpps = useMemo(() => {
    const oppMap = new Map();

    for (const row of enrichedRows) {
      const oppId = row?.opp_id || `unknown-${row?._row_id}`;
      if (!oppMap.has(oppId)) {
        oppMap.set(oppId, {
          opp_id: row?.opp_id ?? null,
          opp_name: row?.opp_name ?? "Unknown Opportunity",
          account_name: row?.account_name ?? null,
          opp_owner_name: row?.opp_owner_name ?? null,
          account_id: row?.account_id ?? null,
          business_line: row?.business_line ?? "All",
          rows: [],
        });
      }
      oppMap.get(oppId).rows.push(row);
    }

        return Array.from(oppMap.values()).map((opp) => {
          const oppTotalPrice = opp.rows.reduce(
            (sum, r) => sum + (toNumber(r?.total_price) || 0),
            0
          );

          const canonicalId = String(opp.opp_id ?? "").trim();
          const oppTotalAcv =
            canonicalId && oppAcvByOppId.has(canonicalId)
              ? oppAcvByOppId.get(canonicalId)
              : dedupeOppAcvAcrossLineItems(opp.rows.map((r) => r?.acv_change));

          const hasAi = opp.rows.some((r) => r.is_ai);

          return {
            ...opp,
            lineCount: opp.rows.length,
            oppTotalPrice,
            oppTotalAcv,
            hasAi,
          };
        });
  }, [enrichedRows, oppAcvByOppId]);

  const collapseAllOpps = () => {
    setCollapsedOpps(Object.fromEntries(groupedOpps.map((o) => [o.opp_id, true])));
  };

  const summary = useMemo(() => {
    const oppIds = new Set();
    const aiOppIds = new Set();
    let totalRevenue = 0;

    for (const r of enrichedRows) {
      const oppId = String(r?.opp_id ?? "").trim();
      if (oppId) oppIds.add(oppId);
      if (r?.is_ai && oppId) aiOppIds.add(oppId);
      totalRevenue += toNumber(r?.total_price) || 0;
    }

    const totalOppAcv = groupedOpps.reduce(
      (sum, o) => sum + (toNumber(o?.oppTotalAcv) || 0),
      0
    );

    return {
      oppCount: oppIds.size,
      aiOppCount: aiOppIds.size,
      totalRevenue,
      totalOppAcv,
    };
  }, [enrichedRows, groupedOpps]);

  const modalSubtitle = "SKU line items for Closed Won opportunities.";

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={modalSubtitle} width={1260}>
      <div style={styles.wrap}>
        <DrillModalContextBar
          helperText={contextHelper ?? PRODUCT_MIX_DRILL_CONTEXT}
          definitionsSection={definitionsSection}
          onOpenDefinitions={onOpenDefinitions}
        />

        <div style={styles.pillRow}>
          <div style={styles.pill}>
            <span style={styles.pillLabel}>Scope</span>
            <span style={styles.pillValue}>
              {fieldScopeIsGlobal ? "Global" : fieldScopeLabel || "Scoped"}
            </span>
          </div>

          <div style={styles.pill}>
            <span style={styles.pillLabel}>Business Line</span>
            <span style={styles.pillValue}>{ceoBusinessLineDisplayLabel(businessLine)}</span>
          </div>

          <div style={styles.pill}>
            <span style={styles.pillLabel}>Wins</span>
            <span style={styles.pillValue}>{summary.oppCount}</span>
          </div>

          <div style={styles.pill}>
            <span style={styles.pillLabel}>AI Attached</span>
            <span style={styles.pillValue}>{summary.aiOppCount}</span>
          </div>

          <div
            style={styles.pill}
            title="Sum of order_item.total_price across every SKU row in this result. Often much larger than opp-level ACV."
          >
            <span style={styles.pillLabel}>Line-item $ (sum)</span>
            <span style={styles.pillValue}>{fmtMoneyCompact(summary.totalRevenue)}</span>
          </div>

          <div
            style={styles.pill}
            title="Sum of acv_change once per opportunity (funnel grain). CEO Closed (QTD) can differ if it uses another workbook element, filters, or metric definition."
          >
            <span style={styles.pillLabel}>Opp ACV (sum)</span>
            <span style={styles.pillValue}>{fmtMoneyCompact(summary.totalOppAcv)}</span>
          </div>
        </div>

        <div style={styles.controlsRow}>
          <button
            type="button"
            onClick={() => setAiOnly(false)}
            style={{
              ...styles.filterBtn,
              ...(aiOnly ? null : styles.filterBtnActive),
            }}
          >
            All Products
          </button>

          <button
            type="button"
            onClick={() => setAiOnly(true)}
            style={{
              ...styles.filterBtn,
              ...(aiOnly ? styles.filterBtnActive : null),
            }}
          >
            AI Only
          </button>

          <button
            type="button"
            onClick={collapseAllOpps}
            disabled={groupedOpps.length === 0}
            style={{
              ...styles.filterBtn,
              marginLeft: "auto",
              ...(groupedOpps.length === 0 ? { opacity: 0.45, cursor: "not-allowed" } : null),
            }}
            title="Collapse every opportunity to its summary row"
          >
            Collapse all
          </button>
        </div>

        <div style={styles.groupStack}>
          {groupedOpps.length === 0 ? (
            <div style={styles.emptyState}>
              No product mix rows found for the current selection.
            </div>
          ) : (
            groupedOpps.map((opp) => {
              const isCollapsed = !!collapsedOpps[opp.opp_id];
              const oppUrl = buildOpportunityUrl(opp.opp_id);

              return (
                <div key={opp.opp_id || opp.opp_name} style={styles.groupCard}>
                  <button
                    type="button"
                    onClick={() => toggleOpp(opp.opp_id)}
                    style={styles.groupHeaderBtn}
                    title={isCollapsed ? "Expand opportunity" : "Collapse opportunity"}
                  >
                    <div style={styles.groupHeaderLeft}>
                      <span style={styles.groupChevron}>{isCollapsed ? "▸" : "▾"}</span>

                      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                        <div style={styles.groupTitleRow}>
                          {opp.hasAi ? <span style={styles.aiDot} /> : null}

                          {oppUrl ? (
                            <a
                              href={oppUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={styles.link}
                              onClick={(e) => e.stopPropagation()}
                              title="Open Opportunity in Salesforce"
                            >
                              {opp.opp_name || opp.opp_id || "Unknown Opportunity"}
                            </a>
                          ) : (
                            <span style={styles.groupTitle}>
                              {opp.opp_name || opp.opp_id || "Unknown Opportunity"}
                            </span>
                          )}
                        </div>

                        <div style={styles.groupSubRow}>
                          <span>{opp.account_name || "—"}</span>
                          <span>•</span>
                          <span>{opp.opp_owner_name || "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div style={styles.groupHeaderRight}>
                      <span style={styles.groupMetaPill}>{opp.lineCount} SKUs</span>

                      <span style={styles.groupMetaPill}>
                        <span style={styles.groupMetaLabel}>ACV</span>
                        <span>{fmtMoneyCompact(opp.oppTotalAcv)}</span>
                      </span>

                      <span style={styles.groupMetaPill}>
                        <span style={styles.groupMetaLabel}>Price</span>
                        <span>{fmtMoneyCompact(opp.oppTotalPrice)}</span>
                      </span>
                    </div>
                  </button>

                  {!isCollapsed ? (
                    <div style={styles.tableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <SortHeader
                              label="Product Name"
                              sortKey="product_name"
                              activeSort={sortKey}
                              activeDir={sortDir}
                              onSort={handleSort}
                            />
                            <SortHeader
                              label="Start Date"
                              sortKey="order_item_start_date"
                              activeSort={sortKey}
                              activeDir={sortDir}
                              onSort={handleSort}
                            />
                            <SortHeader
                              label="End Date"
                              sortKey="order_item_end_date"
                              activeSort={sortKey}
                              activeDir={sortDir}
                              onSort={handleSort}
                            />
                            <SortHeader
                              label="Total Price"
                              sortKey="total_price"
                              activeSort={sortKey}
                              activeDir={sortDir}
                              onSort={handleSort}
                              align="right"
                            />
                          </tr>
                        </thead>

                        <tbody>
                          {opp.rows.map((r) => (
                            <tr key={r._row_id} style={styles.tr}>
                              <td style={styles.td}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                  {r.is_ai ? <span style={styles.aiDot} /> : null}
                                  <span
                                    style={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      display: "inline-block",
                                      maxWidth: 520,
                                    }}
                                    title={r.product_name || ""}
                                  >
                                    {r.product_name || "—"}
                                  </span>
                                </div>
                              </td>

                              <td style={styles.td}>{r.order_item_start_date || "—"}</td>
                              <td style={styles.td}>{r.order_item_end_date || "—"}</td>
                              <td style={styles.tdMoney}>{fmtMoneyCompact(r.total_price || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}

const styles = {
  wrap: {
    display: "grid",
    gap: 14,
  },
  pillRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.04)",
    border: "1px solid rgba(15,23,42,0.08)",
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: 0.35,
    textTransform: "uppercase",
    color: "rgba(15,23,42,0.55)",
  },
  pillValue: {
    fontSize: 14,
    fontWeight: 950,
    color: "rgba(15,23,42,0.92)",
  },
  controlsRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  filterBtn: {
    appearance: "none",
    border: "1px solid rgba(15,23,42,0.12)",
    background: "white",
    color: "rgba(15,23,42,0.80)",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
  },
  filterBtnActive: {
    background: "rgba(89,193,167,0.16)",
    border: "1px solid rgba(89,193,167,0.34)",
    color: "rgba(15,23,42,0.94)",
  },
  groupStack: {
    display: "grid",
    gap: 12,
  },
  groupCard: {
    borderRadius: 18,
    overflow: "hidden",
    border: "1px solid rgba(15,23,42,0.10)",
    background: "white",
  },
  groupHeaderBtn: {
    width: "100%",
    appearance: "none",
    border: "none",
    background: "rgba(248,250,252,0.95)",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    cursor: "pointer",
    textAlign: "left",
  },
  groupHeaderLeft: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    minWidth: 0,
  },
  groupHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  groupChevron: {
    fontSize: 14,
    fontWeight: 1000,
    color: "rgba(15,23,42,0.75)",
    flexShrink: 0,
    paddingTop: 2,
  },
  groupTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: 950,
    color: "rgba(15,23,42,0.94)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  groupSubRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(15,23,42,0.66)",
  },
  groupMono: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  groupMetaPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.05)",
    border: "1px solid rgba(15,23,42,0.08)",
    fontSize: 11,
    fontWeight: 950,
    color: "rgba(15,23,42,0.78)",
    whiteSpace: "nowrap",
  },
  groupMetaLabel: {
    fontSize: 10,
    fontWeight: 1000,
    letterSpacing: 0.35,
    textTransform: "uppercase",
    color: "rgba(15,23,42,0.58)",
    marginRight: 6,
  },
  tableWrap: {
    borderTop: "1px solid rgba(15,23,42,0.08)",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  th: {
    background: "#334155",
    color: "white",
    fontSize: 12,
    fontWeight: 950,
    padding: "12px 14px",
    letterSpacing: 0.25,
  },
  tr: {
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  },
  td: {
    padding: "14px",
    fontSize: 13,
    fontWeight: 850,
    color: "rgba(15,23,42,0.84)",
    verticalAlign: "middle",
  },
  tdMono: {
    padding: "14px",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(15,23,42,0.80)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    verticalAlign: "middle",
  },
  tdMoney: {
    padding: "14px",
    fontSize: 13,
    fontWeight: 950,
    color: "rgba(15,23,42,0.96)",
    textAlign: "right",
    verticalAlign: "middle",
  },
  emptyState: {
    borderRadius: 18,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "white",
    padding: "28px 20px",
    textAlign: "center",
    fontSize: 14,
    fontWeight: 850,
    color: "rgba(15,23,42,0.62)",
  },
  aiDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#3B82F6",
    boxShadow: "0 0 0 3px rgba(59,130,246,0.16)",
    flexShrink: 0,
  },
  link: {
    color: "#0B5CAB",
    textDecoration: "none",
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "inline-block",
    maxWidth: 520,
  },
};