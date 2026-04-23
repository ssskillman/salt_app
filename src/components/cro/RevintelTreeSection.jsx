// src/components/cro/RevintelTreeSection.jsx
import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { buildRevintelTree } from "./buildRevintelTree";

function normStr(x) {
  return String(x ?? "").trim();
}

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoneyCompactTable(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";

  const abs = Math.abs(n);

  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;

  return `$${Math.round(n)}`;
}

function fmtMoneyCompact1(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";

  const abs = Math.abs(n);

  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;

  return `$${n.toFixed(1)}`;
}

function getRowVal(row, key) {
  if (!row || !key) return undefined;

  const candidates = [key, key.toLowerCase(), key.toUpperCase()];

  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, candidate)) {
      return row[candidate];
    }
  }

  return undefined;
}

function getFyqFromRow(r) {
  return normStr(getRowVal(r, "fyq") || getRowVal(r, "fiscal_yearquarter"));
}

function getLvl0(r) {
  return getRowVal(r, "lvl0");
}
function getLvl1(r) {
  return getRowVal(r, "lvl1");
}
function getLvl2(r) {
  return getRowVal(r, "lvl2");
}
function getLvl3(r) {
  return getRowVal(r, "lvl3");
}
function getLvl4(r) {
  return getRowVal(r, "lvl4");
}

function pathFromRow(r) {
  const parts = [getLvl0(r), getLvl1(r), getLvl2(r), getLvl3(r), getLvl4(r)]
    .map(normStr)
    .filter(Boolean);
  return parts.join(" > ");
}

function flatten(node, expandedSet, out) {
  out.push(node);
  const isOpen = expandedSet.has(node.id);
  if (isOpen && node.children?.length) {
    for (const c of node.children) flatten(c, expandedSet, out);
  }
}

function walkTree(nodes, fn) {
  for (const node of nodes || []) {
    fn(node);
    if (node.children?.length) walkTree(node.children, fn);
  }
}

function findNodeById(nodes, id) {
  let hit = null;
  walkTree(nodes, (node) => {
    if (!hit && node.id === id) hit = node;
  });
  return hit;
}

function buildSearchOptionsFromTree(tree) {
  const opts = [];
  const seen = new Set();

  walkTree(tree, (node) => {
    if (!node?.id || seen.has(node.id)) return;
    seen.add(node.id);

    opts.push({
      key: node.id,
      path: node.id,
      label: node.displayLabel || node.label,
      rawLabel: node.label || "",
      display: `${node.displayLabel || node.label} · ${node.id}`,
      depth: node.depth ?? 0,
      node,
    });
  });

  opts.sort((a, b) => {
    const la = a.label.toLowerCase();
    const lb = b.label.toLowerCase();
    if (la < lb) return -1;
    if (la > lb) return 1;
    return a.path.split(" > ").length - b.path.split(" > ").length;
  });

  return opts;
}

function scoreSearchOption(option, q) {
  const label = normStr(option?.label).toLowerCase();
  const rawLabel = normStr(option?.rawLabel).toLowerCase();
  const path = normStr(option?.path).toLowerCase();
  const depth = option?.depth ?? 0;

  if (!q) return 0;

  if (label === q) return 1000 - depth;
  if (rawLabel === q) return 950 - depth;

  if (label.startsWith(q)) return 900 - depth;
  if (rawLabel.startsWith(q)) return 875 - depth;

  if (label.includes(` ${q}`) || label.includes(`${q} `) || label.includes(`(${q}`)) return 820 - depth;
  if (rawLabel.includes(` ${q}`) || rawLabel.includes(`${q} `)) return 800 - depth;

  if (label.includes(q)) return 760 - depth;
  if (rawLabel.includes(q)) return 740 - depth;

  if (path.includes(q)) return 500 - depth;

  return -1;
}

function isDirectOrIndirectDescendant(parentPath, childPath) {
  const p = normStr(parentPath);
  const c = normStr(childPath);
  return !!p && !!c && c !== p && c.startsWith(`${p} > `);
}

function Metric({ v }) {
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {v == null ? "—" : fmtMoneyCompactTable(v)}
    </span>
  );
}

function MetricCell({ value, quota, color = "#2f8f46", showBar = false }) {
  const q = toNum(quota);
  const v = value == null ? null : toNum(value);
  const pct = q > 0 && v != null ? v / q : null;
  const pctLabel = pct != null ? `${Math.round(pct * 100)}%` : null;
  const pctWidth = pct != null ? Math.min(100, Math.max(0, pct * 100)) : 0;

  return (
    <div style={{ textAlign: "right", fontWeight: 850 }}>
      <div>
        <Metric v={value} />
      </div>

      {showBar && pct != null && (
        <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: "rgba(15,23,42,0.55)",
              minWidth: 28,
              textAlign: "right",
            }}
          >
            {pctLabel}
          </div>
          <div
            style={{
              width: 68,
              height: 5,
              borderRadius: 999,
              background: "rgba(15,23,42,0.10)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pctWidth}%`,
                height: "100%",
                borderRadius: 999,
                background: color,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ node, expanded, toggle, selectNode, isSelected, cols, baseDepth = 0 }) {
  const hasKids = Array.isArray(node.children) && node.children.length > 0;
  const metricMode = node.isSynthetic ? "Showing summed direct-report totals" : "Showing exact node values";
  const quota = node.metrics?.quota ?? null;

  const renderDepth = Math.max(0, (node.depth ?? 0) - baseDepth);

  const handleNameClick = () => {
    selectNode(node);

    if (hasKids) {
      toggle(node.id);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${cols} 120px 132px 132px 132px 146px`,
        gap: 10,
        alignItems: "center",
        padding: "9px 10px",
        borderBottom: "1px solid rgba(15,23,42,0.08)",
        background: isSelected ? "rgba(255,255,255,0.38)" : "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: renderDepth * 14 }}>
        {hasKids ? (
          <button
            onClick={() => toggle(node.id)}
            style={{
              width: 22,
              height: 22,
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.18)",
              background: "rgba(255,255,255,0.85)",
              cursor: "pointer",
              fontWeight: 950,
              lineHeight: "22px",
              padding: 0,
              flexShrink: 0,
            }}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "–" : "+"}
          </button>
        ) : (
          <div style={{ width: 22, flexShrink: 0 }} />
        )}

        <button
          onClick={handleNameClick}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            textAlign: "left",
            cursor: "pointer",
            fontWeight: 900,
            color: isSelected ? "rgba(15,23,42,0.98)" : "rgba(15,23,42,0.88)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          }}
          title={`${node.displayLabel || node.label}\n${metricMode}\nClick to select${hasKids ? " and expand/collapse" : ""}`}
        >
          {node.displayLabel || node.label}
        </button>
      </div>

      <MetricCell value={node.metrics?.quota} quota={quota} showBar={false} />
      <MetricCell value={node.metrics?.commit} quota={quota} showBar color="#c57a00" />
      <MetricCell value={node.metrics?.forecast} quota={quota} showBar color="#2f8f46" />
      <MetricCell value={node.metrics?.best_case} quota={quota} showBar color="#2f8f46" />
      <MetricCell value={node.metrics?.open_pipeline} quota={quota} showBar color="#2f8f46" />
    </div>
  );
}

function RollupMetricRow({ label, value, quota, color, showBar = true }) {
  const q = toNum(quota);
  const v = value == null ? null : toNum(value);
  const pct = q > 0 && v != null ? v / q : null;
  const pctWidth = pct != null ? Math.min(100, Math.max(0, pct * 100)) : 0;
  const pctLabel = pct != null ? `${Math.round(pct * 100)}%` : "—";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "96px 1fr auto",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(15,23,42,0.62)" }}>{label}</div>

      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: showBar ? "rgba(15,23,42,0.10)" : "transparent",
          overflow: "hidden",
        }}
      >
        {showBar && (
          <div
            style={{
              width: `${pctWidth}%`,
              height: "100%",
              borderRadius: 999,
              background: color,
            }}
          />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 112, justifyContent: "flex-end" }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: "rgba(15,23,42,0.55)" }}>
          {showBar ? pctLabel : ""}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 950,
            color: "rgba(15,23,42,0.92)",
            fontVariantNumeric: "tabular-nums",
            minWidth: 56,
            textAlign: "right",
          }}
        >
          {value == null ? "—" : fmtMoneyCompact1(value)}
        </div>
      </div>
    </div>
  );
}

export function RollupCard({ label, node }) {
  const quota = node?.metrics?.quota ?? null;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 280,
        borderRadius: 16,
        padding: "14px 16px",
        background: "rgba(255,255,255,0.72)",
        border: "1px solid rgba(15,23,42,0.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 950,
              color: "rgba(15,23,42,0.55)",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {label}
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              fontWeight: 950,
              color: "rgba(15,23,42,0.82)",
              lineHeight: 1.25,
              wordBreak: "break-word",
            }}
          >
            {node?.displayLabel || "—"}
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            minWidth: 88,
            textAlign: "right",
            padding: "6px 10px",
            borderRadius: 12,
            background: "rgba(15,23,42,0.05)",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 950,
              color: "rgba(15,23,42,0.55)",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Quota
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 16,
              fontWeight: 1000,
              color: "rgba(15,23,42,0.92)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {quota == null ? "—" : fmtMoneyCompact1(quota)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <RollupMetricRow label="Commit" value={node?.metrics?.commit ?? null} quota={quota} color="#c57a00" />
        <RollupMetricRow label="Forecast" value={node?.metrics?.forecast ?? null} quota={quota} color="#2f8f46" />
        <RollupMetricRow label="Best Case" value={node?.metrics?.best_case ?? null} quota={quota} color="#2f8f46" />
        <RollupMetricRow label="Open Pipeline" value={node?.metrics?.open_pipeline ?? null} quota={quota} color="#2f8f46" />
      </div>
    </div>
  );
}

function SearchSectionHeader({ children }) {
  return (
    <div
      style={{
        padding: "8px 10px 6px",
        fontSize: 10,
        fontWeight: 1000,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.96)",
        background: "#0B2344",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {children}
    </div>
  );
}

function SearchOptionButton({ option, onSelect }) {
  return (
    <button
      key={option.key}
      onClick={() => onSelect(option)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        border: "none",
        background: "white",
        cursor: "pointer",
      }}
      title={option.path}
    >
      <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.90)" }}>{option.label}</div>
      <div style={{ fontSize: 11, fontWeight: 850, opacity: 0.65, marginTop: 2 }}>{option.path}</div>
    </button>
  );
}

export default function RevintelTreeSection({ rows, onSelectNode }) {
  const fyqOptions = useMemo(() => {
    const s = new Set();
    for (const r of rows || []) {
      const v = getFyqFromRow(r);
      if (v) s.add(v);
    }
    return Array.from(s).sort();
  }, [rows]);

  const [selectedFyq, setSelectedFyq] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedOption, setSelectedOption] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  const didInitDefaultExpand = useRef(false);

  useEffect(() => {
    if (!fyqOptions.length) return;
    if (!selectedFyq || !fyqOptions.includes(selectedFyq)) {
      setSelectedFyq(fyqOptions[0]);
    }
  }, [fyqOptions, selectedFyq]);

  const rowsFyq = useMemo(() => {
    if (!rows?.length) return [];
    const hasAnyFyq = rows.some((r) => getFyqFromRow(r));
    if (!hasAnyFyq) return rows;
    if (!selectedFyq) return rows;
    return rows.filter((r) => getFyqFromRow(r) === selectedFyq);
  }, [rows, selectedFyq]);

  const baseTree = useMemo(() => buildRevintelTree(rowsFyq || []), [rowsFyq]);

  const searchOptions = useMemo(() => buildSearchOptionsFromTree(baseTree), [baseTree]);

  const filteredOptions = useMemo(() => {
    const q = normStr(searchText).toLowerCase();
    if (!q) return searchOptions.slice(0, 30);

    return searchOptions
      .map((o) => ({ ...o, __score: scoreSearchOption(o, q) }))
      .filter((o) => o.__score >= 0)
      .sort((a, b) => {
        if (b.__score !== a.__score) return b.__score - a.__score;

        const la = a.label.toLowerCase();
        const lb = b.label.toLowerCase();
        if (la < lb) return -1;
        if (la > lb) return 1;

        return a.depth - b.depth;
      })
      .slice(0, 30);
  }, [searchText, searchOptions]);

  const groupedFilteredOptions = useMemo(() => {
    const q = normStr(searchText).toLowerCase();
    if (!q || filteredOptions.length === 0) {
      return {
        primary: filteredOptions,
        descendants: [],
      };
    }

    const primary = filteredOptions.filter((o) => {
      const label = normStr(o.label).toLowerCase();
      const rawLabel = normStr(o.rawLabel).toLowerCase();
      return (
        label === q ||
        rawLabel === q ||
        label.startsWith(q) ||
        rawLabel.startsWith(q) ||
        label.includes(q) ||
        rawLabel.includes(q)
      );
    });

    const primaryPaths = new Set(primary.map((o) => o.path));

    const descendants = filteredOptions.filter((o) => {
      if (primaryPaths.has(o.path)) return false;
      for (const p of primary) {
        if (isDirectOrIndirectDescendant(p.path, o.path)) return true;
      }
      return false;
    });

    const fallbackOthers = filteredOptions.filter((o) => {
      if (primaryPaths.has(o.path)) return false;
      return !descendants.some((d) => d.path === o.path);
    });

    return {
      primary,
      descendants: [...descendants, ...fallbackOthers],
    };
  }, [filteredOptions, searchText]);

  const selectedNode = useMemo(() => {
    if (!selectedOption?.path) return null;
    return findNodeById(baseTree, selectedOption.path);
  }, [baseTree, selectedOption]);

  const plus1Node = useMemo(() => {
    if (!selectedNode?.parentId) return null;
    return findNodeById(baseTree, selectedNode.parentId);
  }, [baseTree, selectedNode]);

  const plus2Node = useMemo(() => {
    if (!plus1Node?.parentId) return null;
    return findNodeById(baseTree, plus1Node.parentId);
  }, [baseTree, plus1Node]);

  const visibleTree = useMemo(() => {
    if (!selectedNode) return baseTree;
    return [selectedNode];
  }, [baseTree, selectedNode]);

  const visualBaseDepth = useMemo(() => {
    return selectedNode?.depth ?? 0;
  }, [selectedNode]);

  const storageKey = useMemo(() => `salt.revintel.expanded.${selectedFyq || "all"}`, [selectedFyq]);

  useEffect(() => {
    let restored = [];
    try {
      restored = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    } catch {
      restored = [];
    }

    setExpanded(new Set(Array.isArray(restored) ? restored : []));
    didInitDefaultExpand.current = false;
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(expanded)));
    } catch {
      // no-op
    }
  }, [expanded, storageKey]);

  useEffect(() => {
    if (!baseTree?.length) return;
    if (selectedOption?.path) return;
    if (expanded.size > 0) return;
    if (didInitDefaultExpand.current) return;

    const dougRoot = baseTree.find((n) => String(n.label || "").trim().toLowerCase() === "doug adamic") || null;

    if (dougRoot) {
      setExpanded(new Set([dougRoot.id]));
      didInitDefaultExpand.current = true;
    }
  }, [baseTree, expanded.size, selectedOption]);

  useEffect(() => {
    if (!selectedOption?.path) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(selectedOption.path);
      return next;
    });
  }, [selectedOption]);

  const toggle = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectNode = useCallback((node) => {
    if (!node?.id) return;

    setSelectedOption({
      key: node.id,
      path: node.id,
      label: node.displayLabel || node.label,
      rawLabel: node.label || "",
      display: `${node.displayLabel || node.label} · ${node.id}`,
      depth: node.depth ?? 0,
      node,
    });

    if (onSelectNode) onSelectNode(node);

    setSearchText("");
  }, [onSelectNode]);

  const expandAll = useCallback(() => {
    const ids = new Set();
    walkTree(visibleTree, (n) => {
      if (n.children?.length) ids.add(n.id);
    });
    setExpanded(ids);
  }, [visibleTree]);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const flat = useMemo(() => {
    const out = [];
    for (const n of visibleTree) flatten(n, expanded, out);
    return out;
  }, [visibleTree, expanded]);

  const cols = "1fr";

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(15,23,42,0.12)",
        background: "rgba(255,255,255,0.65)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 12px",
          borderBottom: "1px solid rgba(15,23,42,0.10)",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.72)" }}>
          Quota / Commit / Forecast Rollups
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {fyqOptions.length > 0 && (
            <select
              value={selectedFyq}
              onChange={(e) => {
                setSelectedFyq(e.target.value);
                setSelectedOption(null);
                setSearchText("");
                collapseAll();
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.18)",
                background: "white",
                fontWeight: 900,
              }}
              title="Fiscal quarter"
            >
              {fyqOptions.map((fyq) => (
                <option key={fyq} value={fyq}>
                  {fyq}
                </option>
              ))}
            </select>
          )}

          <div style={{ position: "relative" }}>
            <input
              value={selectedOption ? selectedOption.display : searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                if (selectedOption) setSelectedOption(null);
              }}
              placeholder="Search territory or name…"
              style={{
                width: 340,
                maxWidth: "70vw",
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.18)",
                background: "white",
                fontWeight: 900,
              }}
            />

            {!selectedOption && filteredOptions.length > 0 && normStr(searchText) && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  zIndex: 30,
                  maxHeight: 320,
                  overflow: "auto",
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.14)",
                  background: "white",
                  boxShadow: "0 14px 30px rgba(0,0,0,0.12)",
                }}
              >
                {groupedFilteredOptions.primary.length > 0 && (
                  <>
                    <SearchSectionHeader>Matches</SearchSectionHeader>
                    {groupedFilteredOptions.primary.map((o) => (
                      <SearchOptionButton
                        key={o.key}
                        option={o}
                        onSelect={(option) => {
                          setSelectedOption(option);
                          setSearchText("");
                        }}
                      />
                    ))}
                  </>
                )}

                {groupedFilteredOptions.descendants.length > 0 && (
                  <>
                    <SearchSectionHeader>Team Members</SearchSectionHeader>
                    {groupedFilteredOptions.descendants.map((o) => (
                      <SearchOptionButton
                        key={o.key}
                        option={o}
                        onSelect={(option) => {
                          setSelectedOption(option);
                          setSearchText("");
                        }}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {selectedOption && (
            <button
              onClick={() => {
                setSelectedOption(null);
                setSearchText("");
              }}
              style={btn}
              title="Clear search filter"
            >
              Clear
            </button>
          )}

          <button onClick={expandAll} style={btn}>
            Expand all
          </button>
          <button onClick={collapseAll} style={btn}>
            Collapse
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${cols} 120px 132px 132px 132px 146px`,
          gap: 10,
          padding: "10px 10px",
          fontSize: 11,
          fontWeight: 950,
          color: "rgba(15,23,42,0.60)",
        }}
      >
        <div>Name</div>
        <div style={{ textAlign: "right" }}>Quota</div>
        <div style={{ textAlign: "right" }}>Commit</div>
        <div style={{ textAlign: "right" }}>Forecast</div>
        <div style={{ textAlign: "right" }}>Best Case</div>
        <div style={{ textAlign: "right" }}>Open Pipeline</div>
      </div>

      <div style={{ maxHeight: 520, overflow: "auto" }}>
        {flat.length === 0 ? (
          <div style={{ padding: 14, fontWeight: 900, color: "rgba(15,23,42,0.65)" }}>No rows.</div>
        ) : (
          flat.map((n) => (
            <Row
              key={n.id}
              node={n}
              expanded={expanded.has(n.id)}
              toggle={toggle}
              selectNode={selectNode}
              isSelected={selectedNode?.id === n.id}
              cols={cols}
              baseDepth={visualBaseDepth}
            />
          ))
        )}
      </div>

      {selectedNode && (
        <div
          style={{
            padding: "14px 12px 16px",
            borderTop: "1px solid rgba(15,23,42,0.08)",
            background: "rgba(255,255,255,0.48)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.68)", marginBottom: 10 }}>
            Hierarchy Roll-ups
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <RollupCard label="Selected" node={selectedNode} />
            <RollupCard label="+1 Roll-up" node={plus1Node} />
            <RollupCard label="+2 Roll-up" node={plus2Node} />
          </div>
        </div>
      )}
    </div>
  );
}

const btn = {
  appearance: "none",
  border: "1px solid rgba(15,23,42,0.18)",
  background: "white",
  borderRadius: 10,
  padding: "6px 10px",
  fontWeight: 900,
  cursor: "pointer",
};