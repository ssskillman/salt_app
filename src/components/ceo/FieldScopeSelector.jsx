// src/components/ceo/FieldScopeSelector.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ImTree } from "react-icons/im";
import { buildRevintelTree } from "../cro/buildRevintelTree.jsx";

/** Stable empty input so `rows` prop does not get a new `[]` reference every parent render. */
const EMPTY_REVINTEL_ROWS = [];

function normStr(x) {
  return String(x ?? "").trim();
}

function normKey(x) {
  return normStr(x).toLowerCase();
}

function walkTree(nodes, fn) {
  for (const node of nodes || []) {
    fn(node);
    if (Array.isArray(node.children) && node.children.length) {
      walkTree(node.children, fn);
    }
  }
}

function findNodeById(nodes, id) {
  let hit = null;
  walkTree(nodes, (node) => {
    if (!hit && node?.id === id) hit = node;
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
      label: node.displayLabel || node.label || node.id,
      rawLabel: node.label || "",
      display: `${node.displayLabel || node.label || node.id} · ${node.id}`,
      depth: node.depth ?? 0,
      node,
    });
  });

  opts.sort((a, b) => {
    const la = normKey(a.label);
    const lb = normKey(b.label);
    if (la < lb) return -1;
    if (la > lb) return 1;
    return (a.depth ?? 0) - (b.depth ?? 0);
  });

  return opts;
}

function scoreSearchOption(option, q) {
  const label = normKey(option?.label);
  const rawLabel = normKey(option?.rawLabel);
  const path = normKey(option?.path);
  const depth = option?.depth ?? 0;

  if (!q) return 0;

  if (label === q) return 1000 - depth;
  if (rawLabel === q) return 950 - depth;

  if (label.startsWith(q)) return 900 - depth;
  if (rawLabel.startsWith(q)) return 880 - depth;

  if (label.includes(q)) return 760 - depth;
  if (rawLabel.includes(q)) return 740 - depth;
  if (path.includes(q)) return 520 - depth;

  return -1;
}

function isDirectOrIndirectDescendant(parentPath, childPath) {
  const p = normStr(parentPath);
  const c = normStr(childPath);
  return !!p && !!c && c !== p && c.startsWith(`${p} > `);
}

function getAncestorPaths(path) {
  const s = normStr(path);
  if (!s) return [];
  const parts = s.split(" > ").filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    out.push(parts.slice(0, i + 1).join(" > "));
  }
  return out;
}

function getDirectReportCount(node) {
  return Array.isArray(node?.children) ? node.children.length : 0;
}

function countDescendants(node) {
  if (!node?.children?.length) return 0;
  let count = 0;
  walkTree(node.children, () => {
    count += 1;
  });
  return count;
}

function collectTerritories(node) {
  const set = new Set();

  walkTree([node], (n) => {
    const t = normStr(n?.territoryName);
    if (t) set.add(t);
  });

  return set;
}

function getNodeMetaSummary(node) {
  if (!node) {
    return {
      directReports: 0,
      descendants: 0,
      territories: 0,
      isIndividualContributor: false,
      isTopLevel: false,
    };
  }

  const directReports = getDirectReportCount(node);
  const descendants = countDescendants(node);
  const territories = collectTerritories(node).size;
  const isIndividualContributor = directReports === 0;
  const isTopLevel = (node?.depth ?? 0) === 0;

  return {
    directReports,
    descendants,
    territories,
    isIndividualContributor,
    isTopLevel,
  };
}

function getTopLevelContext(node) {
  if (!node) return null;
  if ((node?.depth ?? 0) !== 0) return null;

  const territory = normStr(node?.territoryName);
  if (territory) return territory;

  return "Global";
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
      type="button"
    >
      <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.90)" }}>
        {option.label}
      </div>
      <div style={{ fontSize: 11, fontWeight: 850, opacity: 0.65, marginTop: 2 }}>
        {option.path}
      </div>
    </button>
  );
}

function TreeChevron({ expanded, hasChildren }) {
  if (!hasChildren) {
    return <div style={{ width: 18, height: 18, flexShrink: 0 }} />;
  }

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      style={{
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 160ms ease",
        flexShrink: 0,
      }}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="rgba(15,23,42,0.62)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildFlatTree(nodes, expandedSet, out = []) {
  for (const node of nodes || []) {
    out.push(node);
    if (expandedSet.has(node.id) && Array.isArray(node.children) && node.children.length) {
      buildFlatTree(node.children, expandedSet, out);
    }
  }
  return out;
}

function buildExpandedSetForPath(tree, selectedPath) {
  const next = new Set();

  if (!selectedPath) {
    const rootIds = (tree || []).map((n) => n?.id).filter(Boolean);
    for (const id of rootIds) next.add(id);
    return next;
  }

  const ancestors = getAncestorPaths(selectedPath);
  for (const a of ancestors) next.add(a);

  return next;
}

function TreeRow({
  node,
  expanded,
  onToggle,
  onSelect,
  isSelected,
  isHovered,
  isAncestorHover,
  hoverPath,
  setHoverPath,
  flashSelected,
}) {
  const depth = node?.depth ?? 0;
  const hasChildren = Array.isArray(node?.children) && node.children.length > 0;
  const isTopLevel = depth === 0;
  const topLevelContext = getTopLevelContext(node);

  const handleSelect = () => {
    onSelect?.(node);
  };

  const highlightBg = isSelected
    ? "rgba(89,193,167,0.20)"
    : flashSelected
      ? "rgba(89,193,167,0.14)"
      : isHovered
        ? "rgba(15,23,42,0.06)"
        : isAncestorHover
          ? "rgba(15,23,42,0.035)"
          : "transparent";

  const leftGuideVisible = depth > 0;

  return (
    <div
      onMouseEnter={() => setHoverPath?.(node?.id || null)}
      onMouseLeave={() => setHoverPath?.(null)}
      style={{
        position: "relative",
        background: highlightBg,
        borderBottom: "1px solid rgba(15,23,42,0.06)",
        transition: "background 140ms ease",
      }}
    >
      {leftGuideVisible && (
        <div
          style={{
            position: "absolute",
            left: 18 + (depth - 1) * 18 + 8,
            top: 0,
            bottom: 0,
            width: 1,
            background: "rgba(15,23,42,0.08)",
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          paddingLeft: 14 + depth * 18,
          minHeight: 44,
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (hasChildren) onToggle?.(node.id);
          }}
          disabled={!hasChildren}
          aria-label={hasChildren ? (expanded ? "Collapse node" : "Expand node") : "Leaf node"}
          style={{
            appearance: "none",
            border: "1px solid rgba(15,23,42,0.12)",
            background: hasChildren ? "rgba(255,255,255,0.92)" : "transparent",
            borderRadius: 8,
            width: 24,
            height: 24,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: hasChildren ? "pointer" : "default",
            padding: 0,
            flexShrink: 0,
            opacity: hasChildren ? 1 : 0,
          }}
        >
          <TreeChevron expanded={expanded} hasChildren={hasChildren} />
        </button>

        <button
          type="button"
          onClick={handleSelect}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            minWidth: 0,
            textAlign: "left",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flex: 1,
          }}
          title={node?.id || ""}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: hasChildren ? 950 : 850,
              color: "rgba(15,23,42,0.92)",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {node?.displayLabel || node?.label || "—"}
          </div>

          {isTopLevel && topLevelContext && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                color: "rgba(15,23,42,0.52)",
                letterSpacing: 0.3,
                textTransform: "uppercase",
                lineHeight: 1.1,
              }}
            >
              {topLevelContext}
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

function TreeDrawer({
  open,
  onClose,
  tree,
  selectedPath,
  onSelectNode,
  placeholder = "Search territory or manager…",
}) {
  const [searchText, setSearchText] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [hoverPath, setHoverPath] = useState(null);
  const [flashPath, setFlashPath] = useState(null);

  const drawerRef = useRef(null);
  const treeRef = useRef(tree);
  treeRef.current = tree;

  const searchOptions = useMemo(() => buildSearchOptionsFromTree(tree), [tree]);

  const selectedNode = useMemo(() => {
    if (!selectedPath) return null;
    return findNodeById(tree, selectedPath);
  }, [tree, selectedPath]);

  const selectedMeta = useMemo(() => getNodeMetaSummary(selectedNode), [selectedNode]);

  // Reset expansion when opening the drawer or when the selected scope path changes — not on every
  // `tree` reference change. Otherwise `buildRevintelTree` / parent `rows` churn re-runs this effect
  // after each expand/collapse toggle and overwrites user-expanded state (broken chevrons / missing children).
  useEffect(() => {
    if (!open) return;
    setExpanded(buildExpandedSetForPath(treeRef.current, selectedPath));
  }, [open, selectedPath]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e) => {
      if (!drawerRef.current?.contains(e.target)) {
        onClose?.();
      }
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
  }, [open, onClose]);

  const filteredOptions = useMemo(() => {
    const q = normKey(searchText);
    if (!q) return searchOptions.slice(0, 40);

    return searchOptions
      .map((o) => ({ ...o, __score: scoreSearchOption(o, q) }))
      .filter((o) => o.__score >= 0)
      .sort((a, b) => {
        if (b.__score !== a.__score) return b.__score - a.__score;

        const la = normKey(a.label);
        const lb = normKey(b.label);
        if (la < lb) return -1;
        if (la > lb) return 1;

        return (a.depth ?? 0) - (b.depth ?? 0);
      })
      .slice(0, 40);
  }, [searchOptions, searchText]);

  const groupedFilteredOptions = useMemo(() => {
    const q = normKey(searchText);
    if (!q || filteredOptions.length === 0) {
      return { primary: filteredOptions, descendants: [] };
    }

    const primary = filteredOptions.filter((o) => {
      const label = normKey(o.label);
      const rawLabel = normKey(o.rawLabel);
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

  const handleToggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    const next = new Set();
    walkTree(tree, (node) => {
      if (Array.isArray(node?.children) && node.children.length) next.add(node.id);
    });
    setExpanded(next);
  };

  const handleCollapse = () => {
    setExpanded(buildExpandedSetForPath(tree, selectedPath));
  };

  const handleSelect = (node) => {
    if (!node?.id) return;

    setFlashPath(node.id);
    onSelectNode?.({
      key: node.id,
      path: node.id,
      label: node.displayLabel || node.label || node.id,
      rawLabel: node.label || "",
      display: `${node.displayLabel || node.label || node.id} · ${node.id}`,
      depth: node.depth ?? 0,
      node,
    });

    setTimeout(() => {
      setFlashPath(null);
      onClose?.();
    }, 140);
  };

  const flatTree = useMemo(() => buildFlatTree(tree, expanded, []), [tree, expanded]);
  const hoverAncestors = useMemo(() => new Set(getAncestorPaths(hoverPath)), [hoverPath]);

  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 120,
          background: "rgba(15,23,42,0.16)",
          backdropFilter: "blur(3px)",
        }}
      />

        <div
        ref={drawerRef}
        style={{
          position: "fixed",
          top: 18,
          right: 18,
          width: "min(460px, 92vw)",
          maxHeight: "calc(100vh - 36px)",
          zIndex: 130,
          background: "rgba(255,255,255,0.98)",
          border: "1px solid rgba(15,23,42,0.10)",
          borderRadius: 18,
          boxShadow: "-18px 0 42px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 18px 14px",
            borderBottom: "1px solid rgba(15,23,42,0.08)",
            background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.98) 100%)",
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
            <div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 1000,
                  color: "rgba(15,23,42,0.96)",
                  lineHeight: 1.1,
                }}
              >
                Browse Field Hierarchy
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  fontWeight: 850,
                  color: "rgba(15,23,42,0.58)",
                }}
              >
                Select a manager, territory, or individual contributor
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close hierarchy browser"
              style={{
                appearance: "none",
                border: "1px solid rgba(15,23,42,0.12)",
                background: "rgba(255,255,255,0.92)",
                width: 38,
                height: 38,
                borderRadius: 10,
                cursor: "pointer",
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                lineHeight: 1,
                color: "rgba(15,23,42,0.62)",
                flexShrink: 0,
              }}
            >
              <span style={{ transform: "translateY(-1px)" }}>×</span>
            </button>
          </div>

          {selectedNode && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(89,193,167,0.10)",
                border: "1px solid rgba(89,193,167,0.22)",
                position: "sticky",
                top: 0,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 1000,
                  color: "rgba(15,23,42,0.54)",
                  textTransform: "uppercase",
                  letterSpacing: 0.35,
                }}
              >
                Current Selection
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 13,
                  fontWeight: 950,
                  color: "rgba(15,23,42,0.92)",
                }}
              >
                {selectedNode.displayLabel || selectedNode.label || "—"}
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  fontWeight: 850,
                  color: "rgba(15,23,42,0.62)",
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                {selectedMeta.isIndividualContributor ? (
                  <span>Individual contributor</span>
                ) : (
                  <>
                    <span>{selectedMeta.directReports} direct reports</span>
                    <span>{selectedMeta.descendants} descendants</span>
                    <span>{selectedMeta.territories} territories</span>
                  </>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={placeholder}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.16)",
                background: "white",
                fontSize: 12,
                fontWeight: 900,
                color: "rgba(15,23,42,0.92)",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => onSelectNode?.(null)}
              style={drawerBtn}
            >
              Global
            </button>
            <button
              type="button"
              onClick={handleExpandAll}
              style={drawerBtn}
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={handleCollapse}
              style={drawerBtn}
            >
              Collapse
            </button>
          </div>
        </div>

        {normStr(searchText) ? (
          <div style={{ overflow: "auto", flex: "0 1 auto", minHeight: 0 }}>
            {groupedFilteredOptions.primary.length > 0 && (
              <>
                <SearchSectionHeader>Matches</SearchSectionHeader>
                {groupedFilteredOptions.primary.map((o) => (
                  <SearchOptionButton
                    key={o.key}
                    option={o}
                    onSelect={(option) => handleSelect(option.node || option)}
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
                    onSelect={(option) => handleSelect(option.node || option)}
                  />
                ))}
              </>
            )}

            {groupedFilteredOptions.primary.length === 0 &&
              groupedFilteredOptions.descendants.length === 0 && (
                <div
                  style={{
                    padding: "16px 14px",
                    fontSize: 12,
                    fontWeight: 850,
                    color: "rgba(15,23,42,0.62)",
                  }}
                >
                  No matches found.
                </div>
              )}
          </div>
                ) : (
          <div
            style={{
              overflow: "auto",
              flex: "0 1 auto",
              minHeight: 0,
              maxHeight: "min(56vh, calc(100vh - 280px))",
            }}
          >
            {flatTree.map((node, rowIdx) => {
              const isSelected = selectedPath === node.id;
              const isHovered = hoverPath === node.id;
              const isAncestorHover =
                hoverPath && hoverAncestors.has(node.id) && hoverPath !== node.id;
              const flashSelected = flashPath === node.id;

              return (
                <TreeRow
                  key={`${rowIdx}:${node.id}`}
                  node={node}
                  expanded={expanded.has(node.id)}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                  isSelected={isSelected}
                  isHovered={isHovered}
                  isAncestorHover={isAncestorHover}
                  hoverPath={hoverPath}
                  setHoverPath={setHoverPath}
                  flashSelected={flashSelected}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

const drawerBtn = {
  appearance: "none",
  border: "1px solid rgba(15,23,42,0.16)",
  background: "white",
  borderRadius: 10,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 950,
  cursor: "pointer",
  color: "rgba(15,23,42,0.88)",
};

export default function FieldScopeSelector({
  rows = EMPTY_REVINTEL_ROWS,
  selectedPath = null,
  onSelectNode,
  onClear,
  label = "Field Scope",
  placeholder = "Search territory or manager…",
}) {
  const [searchText, setSearchText] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);

  const wrapRef = useRef(null);

  const tree = useMemo(() => buildRevintelTree(Array.isArray(rows) ? rows : []), [rows]);
  const searchOptions = useMemo(() => buildSearchOptionsFromTree(tree), [tree]);

  const selectedOption = useMemo(() => {
    if (!selectedPath) return null;
    return searchOptions.find((o) => o.path === selectedPath) || null;
  }, [searchOptions, selectedPath]);

  const selectedNode = useMemo(() => {
    if (!selectedPath) return null;
    return findNodeById(tree, selectedPath);
  }, [tree, selectedPath]);

  const selectedMeta = useMemo(() => getNodeMetaSummary(selectedNode), [selectedNode]);

  const filteredOptions = useMemo(() => {
    const q = normKey(searchText);
    if (!q) return searchOptions.slice(0, 30);

    return searchOptions
      .map((o) => ({ ...o, __score: scoreSearchOption(o, q) }))
      .filter((o) => o.__score >= 0)
      .sort((a, b) => {
        if (b.__score !== a.__score) return b.__score - a.__score;

        const la = normKey(a.label);
        const lb = normKey(b.label);
        if (la < lb) return -1;
        if (la > lb) return 1;

        return (a.depth ?? 0) - (b.depth ?? 0);
      })
      .slice(0, 30);
  }, [searchOptions, searchText]);

  const groupedFilteredOptions = useMemo(() => {
    const q = normKey(searchText);
    if (!q || filteredOptions.length === 0) {
      return { primary: filteredOptions, descendants: [] };
    }

    const primary = filteredOptions.filter((o) => {
      const label = normKey(o.label);
      const rawLabel = normKey(o.rawLabel);
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

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        // no-op here; search dropdown stays simple and closes only when cleared or selected
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const handleSelect = (option) => {
    onSelectNode?.(option);
    setSearchText("");
  };

  const activeLabel = selectedOption?.label || "Global";
  const activePath = selectedOption?.path || null;

  return (
    <>
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "12px 14px",
          borderRadius: 16,
          background: "rgba(255,255,255,0.82)",
          border: "1px solid rgba(15, 23, 42, 0.10)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 1000,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: "rgba(15, 23, 42, 0.62)",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              padding: "8px 12px",
              background: selectedPath ? "rgba(89,193,167,0.14)" : "rgba(15,23,42,0.05)",
              border: selectedPath
                ? "1px solid rgba(89,193,167,0.32)"
                : "1px solid rgba(15,23,42,0.08)",
              minWidth: 0,
              maxWidth: 420,
            }}
            title={activePath || "Global"}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: selectedPath ? "#59C1A7" : "rgba(15,23,42,0.45)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 950,
                color: "rgba(15,23,42,0.90)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {activeLabel}
            </span>
          </div>

          {selectedPath && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 850,
                color: "rgba(15,23,42,0.58)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 420,
              }}
              title={activePath}
            >
              {activePath}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={placeholder}
              style={{
                width: 300,
                maxWidth: "70vw",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.18)",
                background: "white",
                fontWeight: 900,
                fontSize: 12,
              }}
            />

            {normStr(searchText) && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  zIndex: 60,
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
                      <SearchOptionButton key={o.key} option={o} onSelect={handleSelect} />
                    ))}
                  </>
                )}

                {groupedFilteredOptions.descendants.length > 0 && (
                  <>
                    <SearchSectionHeader>Team Members</SearchSectionHeader>
                    {groupedFilteredOptions.descendants.map((o) => (
                      <SearchOptionButton key={o.key} option={o} onSelect={handleSelect} />
                    ))}
                  </>
                )}

                {groupedFilteredOptions.primary.length === 0 &&
                  groupedFilteredOptions.descendants.length === 0 && (
                    <div
                      style={{
                        padding: "12px 10px",
                        fontSize: 12,
                        fontWeight: 850,
                        color: "rgba(15,23,42,0.62)",
                      }}
                    >
                      No matches found.
                    </div>
                  )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowDrawer(true)}
            style={styles.btn}
            title="Browse hierarchy"
          >
            <ImTree size={20} />
          </button>

          {selectedPath && (
            <button
              type="button"
              onClick={() => {
                onClear?.();
                setSearchText("");
              }}
              style={styles.btn}
              title="Clear field scope"
            >
              Clear
            </button>
          )}
        </div>

        {selectedNode && (
          <div
            style={{
              width: "100%",
              marginTop: 2,
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(15,23,42,0.04)",
              border: "1px solid rgba(15,23,42,0.06)",
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 950,
                color: "rgba(15,23,42,0.90)",
                whiteSpace: "nowrap",
              }}
            >
              Selected:
            </span>

            <span
              style={{
                fontSize: 12,
                fontWeight: 950,
                color: "rgba(15,23,42,0.96)",
              }}
            >
              {selectedNode.displayLabel || selectedNode.label || "—"}
            </span>

            {selectedMeta.isIndividualContributor ? (
              <>
                <span style={styles.metaDivider}>•</span>
                <span style={styles.metaText}>IC</span>
              </>
            ) : (
              <>
                <span style={styles.metaDivider}>•</span>
                <span style={styles.metaText}>
                  {selectedMeta.directReports} directs
                </span>
                <span style={styles.metaDivider}>•</span>
                <span style={styles.metaText}>
                  {selectedMeta.descendants} descendants
                </span>
                <span style={styles.metaDivider}>•</span>
                <span style={styles.metaText}>
                  {selectedMeta.territories} territories
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <TreeDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        tree={tree}
        selectedPath={selectedPath}
        onSelectNode={onSelectNode}
        placeholder={placeholder}
      />
    </>
  );
}

const styles = {
  btn: {
    appearance: "none",
    border: "1px solid rgba(15,23,42,0.18)",
    background: "white",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
    color: "rgba(15,23,42,0.90)",
    whiteSpace: "nowrap",
  },
  iconBtn: {
    appearance: "none",
    border: "1px solid rgba(15,23,42,0.18)",
    background: "white",
    borderRadius: 10,
    width: 38,
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
    color: "rgba(15,23,42,0.78)",
    whiteSpace: "nowrap",
    flexShrink: 0,
    padding: 0,
  },
  metaText: {
    fontSize: 11,
    fontWeight: 850,
    color: "rgba(15,23,42,0.62)",
    whiteSpace: "nowrap",
  },
  metaDivider: {
    fontSize: 11,
    fontWeight: 900,
    color: "rgba(15,23,42,0.30)",
    lineHeight: 1,
  },
};