// src/components/cfo/CFOTreemapSection.jsx
import React, { useMemo, useState, useEffect } from "react";
import TreemapChart from "../TreemapChart";

function safeStr(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function sortFyqDesc(a, b) {
  // expects "YYYY-QN"
  const pa = String(a ?? "").split("-Q");
  const pb = String(b ?? "").split("-Q");
  const ya = Number(pa[0]);
  const yb = Number(pb[0]);
  const qa = Number(pa[1]);
  const qb = Number(pb[1]);

  if (Number.isFinite(ya) && Number.isFinite(yb) && ya !== yb) return yb - ya;
  if (Number.isFinite(qa) && Number.isFinite(qb) && qa !== qb) return qb - qa;
  return String(b).localeCompare(String(a));
}

/**
 * CFO Treemap wrapper
 * Expects:
 *  - rows: Sigma element rows (array of objects keyed by column id)
 *  - config: {
 *      mode: "bucket_leaf" | "levels",
 *      bucketKey, leafKey,
 *      fyqKey,                 // optional, for dropdown/filter
 *      level1Key, level2Key, level3Key,
 *      valueKey, colorKey, labelKey
 *    }
 *  - isLoading: boolean (optional)
 */
export default function CFOTreemapSection({ rows = [], config = {}, isLoading = false }) {
  const rowCount = rows?.length ?? 0;

  // --- FYQ values from data ---
  const fyqValues = useMemo(() => {
    const key = config?.fyqKey;
    if (!key || !rows?.length) return [];
    const set = new Set();
    for (const r of rows) {
      const v = safeStr(r?.[key]);
      if (v) set.add(v);
    }
    return Array.from(set).sort(sortFyqDesc);
  }, [rows, config?.fyqKey]);

  // Multi-select FYQ filter state
  const [selectedFyqs, setSelectedFyqs] = useState([]);

  // Default-select the most recent FYQ when it appears (only if user hasn't selected yet)
  useEffect(() => {
    if (!fyqValues.length) return;
    setSelectedFyqs((prev) => {
      if (prev && prev.length) return prev;
      return [fyqValues[0]];
    });
  }, [fyqValues]);

  const hasFyqFilter = Boolean(config?.fyqKey) && fyqValues.length > 0;

  const filteredRows = useMemo(() => {
    const key = config?.fyqKey;
    if (!key || !rows?.length) return rows;

    // if nothing selected, show all
    if (!selectedFyqs || selectedFyqs.length === 0) return rows;

    const sel = new Set(selectedFyqs);
    return rows.filter((r) => sel.has(safeStr(r?.[key]) || ""));
  }, [rows, config?.fyqKey, selectedFyqs]);

  const missing = useMemo(() => {
    const missingBits = [];

    const mode = config?.mode;

    if (mode === "bucket_leaf") {
      if (!config?.bucketKey) missingBits.push("Bucket");
      if (!config?.leafKey) missingBits.push("Leaf Label");
      if (!config?.valueKey) missingBits.push("Size Value");
    } else {
      // legacy levels mode
      if (!config?.level1Key) missingBits.push("Level 1");
      if (!config?.valueKey) missingBits.push("Size Value");
    }

    return missingBits;
  }, [config]);

  if (isLoading) {
    return (
      <div style={styles.emptyWrap}>
        <div style={styles.loadingTitle}>Loading treemap…</div>
        <div style={styles.subtle}>Waiting on the CFO treemap element data.</div>
      </div>
    );
  }

  // Config not mapped yet
  if (missing.length) {
    const isBucketLeaf = config?.mode === "bucket_leaf";
    return (
      <div style={styles.emptyWrap}>
        <div style={styles.emptyTitle}>Treemap needs setup</div>
        <div style={styles.subtle}>
          Map these fields in the Sigma properties panel:{" "}
          <span style={styles.mono}>{missing.join(", ")}</span>
        </div>

        <div style={{ height: 10 }} />

        <div style={styles.subtle}>
          Required:
          <ul style={styles.ul}>
            <li>
              <span style={styles.mono}>source_cfo_treemap</span> (element)
            </li>

            {isBucketLeaf ? (
              <>
                <li>
                  <span style={styles.mono}>tm_bucket</span> (Bucket)
                </li>
                <li>
                  <span style={styles.mono}>tm_leaf_label</span> (Leaf Label)
                </li>
                <li>
                  <span style={styles.mono}>tm_value</span> (Size Value)
                </li>
              </>
            ) : (
              <>
                <li>
                  <span style={styles.mono}>tm_level1</span> (Level 1)
                </li>
                <li>
                  <span style={styles.mono}>tm_value</span> (Size Value)
                </li>
              </>
            )}
          </ul>

          Optional:
          <ul style={styles.ul}>
            <li>
              <span style={styles.mono}>tm_fiscal_yearquarter</span> (FYQ dropdown filter)
            </li>
            <li>
              <span style={styles.mono}>tm_level2</span>, <span style={styles.mono}>tm_level3</span> (legacy levels)
            </li>
            <li>
              <span style={styles.mono}>tm_color_value</span> (Color)
            </li>
            <li>
              <span style={styles.mono}>tm_label</span> (Label override)
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // No data (after filtering OR in general)
  if (!rowCount) {
    return (
      <div style={styles.emptyWrap}>
        <div style={styles.emptyTitle}>No treemap rows</div>
        <div style={styles.subtle}>
          Your treemap source returned <span style={styles.mono}>0</span> rows. Double-check filters / permissions in the
          underlying Sigma element.
        </div>
      </div>
    );
  }

  const visibleCount = filteredRows?.length ?? 0;

  return (
    <div style={styles.wrap}>
      {/* Top meta */}
      <div style={styles.topMeta}>
        <div style={styles.badge}>Rows: {visibleCount.toLocaleString()}</div>
        {config?.colorKey ? <div style={styles.badge}>Color: enabled</div> : <div style={styles.badge}>Color: off</div>}
      </div>

      {/* FYQ Filter row (no search; move "Quarter" to the right of Select All / Clear) */}
      {hasFyqFilter && (
        <div style={styles.filterRow}>
          <div style={styles.filterLeft}>
            <button
              type="button"
              style={styles.smallBtn}
              onClick={() => setSelectedFyqs(fyqValues)}
              title="Select all quarters"
            >
              Select all
            </button>
            <button
              type="button"
              style={styles.smallBtn}
              onClick={() => setSelectedFyqs([])}
              title="Clear selection (shows all)"
            >
              Clear
            </button>

            <div style={styles.selectedHint}>
              {selectedFyqs.length ? `${selectedFyqs.length} selected` : "All"}
            </div>
          </div>

          {/* Quarter moved up/right of the buttons (no search box) */}
          <div style={styles.filterRight}>
            <div style={styles.filterLabel}>Quarter</div>

            <div style={styles.multiWrap}>
              <div style={styles.multiList}>
                {fyqValues.map((fyq) => {
                  const checked = selectedFyqs.includes(fyq);
                  return (
                    <label key={fyq} style={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedFyqs((prev) => {
                            const cur = prev || [];
                            if (cur.includes(fyq)) return cur.filter((x) => x !== fyq);
                            return [...cur, fyq];
                          });
                        }}
                      />
                      <span style={styles.checkText}>{fyq}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={styles.chartFrame}>
        <TreemapChart rows={filteredRows} config={config} />
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  topMeta: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  badge: {
    fontSize: 11,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(15,23,42,0.12)",
    color: "rgba(15,23,42,0.85)",
  },

  // Filter row
  filterRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,255,255,0.78)",
    border: "1px solid rgba(15,23,42,0.10)",
  },
  filterLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  filterRight: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginLeft: "auto",
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 950,
    color: "rgba(15,23,42,0.85)",
    paddingTop: 6,
    whiteSpace: "nowrap",
  },
  smallBtn: {
    appearance: "none",
    border: "1px solid rgba(15,23,42,0.18)",
    background: "white",
    borderRadius: 10,
    padding: "6px 10px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  },
  selectedHint: {
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(15,23,42,0.62)",
  },

  multiWrap: {
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "rgba(255,255,255,0.95)",
    padding: 8,
    minWidth: 220,
    maxWidth: 340,
  },
  multiList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    maxHeight: 160,
    overflow: "auto",
    paddingRight: 4,
  },
  checkRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(15,23,42,0.84)",
    cursor: "pointer",
    userSelect: "none",
  },
  checkText: {
    whiteSpace: "nowrap",
  },

  chartFrame: {
    flex: 1,
    minHeight: 320,
    borderRadius: 14,
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(15,23,42,0.12)",
    overflow: "hidden",
    padding: 10,
  },

  emptyWrap: {
    height: "100%",
    width: "100%",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    padding: 18,
    borderRadius: 14,
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(15,23,42,0.12)",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 950,
    color: "rgba(15,23,42,0.92)",
    marginBottom: 6,
  },
  loadingTitle: {
    fontSize: 14,
    fontWeight: 950,
    color: "rgba(15,23,42,0.92)",
    marginBottom: 6,
  },
  subtle: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(15,23,42,0.65)",
    lineHeight: 1.4,
    maxWidth: 520,
  },
  mono: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontWeight: 900,
  },
  ul: {
    textAlign: "left",
    margin: "8px auto 0",
    maxWidth: 440,
  },
};