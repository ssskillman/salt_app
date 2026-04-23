// src/components/cro/buildRevintelTree.jsx

function normStr(x) {
  return String(x ?? "").trim();
}

function isBlank(x) {
  return normStr(x) === "" || normStr(x).toLowerCase() === "null";
}

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function getLvl0(row) {
  return row?.lvl0;
}

function getLvl1(row) {
  return row?.lvl1;
}

function getLvl2(row) {
  return row?.lvl2;
}

function getLvl3(row) {
  return row?.lvl3;
}

function getLvl4(row) {
  return row?.lvl4;
}

function getRollupLevel(row) {
  return row?.rollup_level;
}

function getQuota(row) {
  return row?.quota;
}

function getCommit(row) {
  return row?.commit;
}

function getForecast(row) {
  return row?.forecast;
}

function getBestCase(row) {
  return row?.best_case;
}

function getOpenPipeline(row) {
  return row?.open_pipeline;
}

function getUserName(row) {
  return row?.user_name;
}

function getTerritoryName(row) {
  return row?.territory_name;
}

function getNodeLabel(row) {
  return row?.node_label;
}

function getParentLabel(row) {
  return row?.parent_label;
}

function getParts(row) {
  return [getLvl0(row), getLvl1(row), getLvl2(row), getLvl3(row), getLvl4(row)]
    .map(normStr)
    .filter(Boolean);
}

function getPathKeyFromParts(parts) {
  return parts.join(" > ");
}

function getDepthFromParts(parts) {
  return Math.max(0, parts.length - 1);
}

function getExpectedRollupLevel(parts) {
  return getDepthFromParts(parts);
}

function rowMatchesExactPath(row, parts) {
  const rowVals = [getLvl0(row), getLvl1(row), getLvl2(row), getLvl3(row), getLvl4(row)].map(normStr);

  for (let i = 0; i < 5; i++) {
    const expected = parts[i];

    if (expected == null) {
      if (!isBlank(rowVals[i])) return false;
    } else {
      if (rowVals[i] !== expected) return false;
    }
  }

  return true;
}

function getRowRollupLevel(row, parts) {
  const explicit = getRollupLevel(row);
  const parsed = Number(explicit);
  if (Number.isFinite(parsed)) return parsed;

  return getExpectedRollupLevel(parts);
}

function getNodeRow(rows, parts) {
  const expectedLevel = getExpectedRollupLevel(parts);

  return (
    rows.find((row) => {
      const rowLevel = getRowRollupLevel(row, parts);
      return rowLevel === expectedLevel && rowMatchesExactPath(row, parts);
    }) || null
  );
}

function makeMetrics(src) {
  return {
    quota: toNum(getQuota(src)),
    commit: toNum(getCommit(src)),
    forecast: toNum(getForecast(src)),
    best_case: toNum(getBestCase(src)),
    open_pipeline: toNum(getOpenPipeline(src)),
  };
}

function zeroMetrics() {
  return {
    quota: 0,
    commit: 0,
    forecast: 0,
    best_case: 0,
    open_pipeline: 0,
  };
}

function sumMetrics(nodes) {
  return (nodes || []).reduce(
    (acc, node) => {
      const m = node?.metrics || zeroMetrics();
      acc.quota += toNum(m.quota);
      acc.commit += toNum(m.commit);
      acc.forecast += toNum(m.forecast);
      acc.best_case += toNum(m.best_case);
      acc.open_pipeline += toNum(m.open_pipeline);
      return acc;
    },
    zeroMetrics()
  );
}

/**
 * Build every possible prefix path from the dataset.
 * Example:
 * row path = Doug > Chris > Ryan
 * prefixes:
 *   Doug
 *   Doug > Chris
 *   Doug > Chris > Ryan
 */
function buildPrefixMap(rows) {
  const prefixMap = new Map();

  for (const row of rows || []) {
    const parts = getParts(row);
    if (!parts.length) continue;

    for (let i = 0; i < parts.length; i++) {
      const prefix = parts.slice(0, i + 1);
      const key = getPathKeyFromParts(prefix);

      if (!prefixMap.has(key)) {
        prefixMap.set(key, prefix);
      }
    }
  }

  return prefixMap;
}

function getChildPartsListFromPrefixMap(prefixMap, parts) {
  const depth = getDepthFromParts(parts);
  const nextLen = depth + 2;
  const parentKey = getPathKeyFromParts(parts);

  const out = [];

  for (const [, candidateParts] of prefixMap.entries()) {
    if (candidateParts.length !== nextLen) continue;

    const candidateParent = candidateParts.slice(0, candidateParts.length - 1);
    const candidateParentKey = getPathKeyFromParts(candidateParent);

    if (candidateParentKey === parentKey) {
      out.push(candidateParts);
    }
  }

  out.sort((a, b) => {
    const la = normStr(a[a.length - 1]).toLowerCase();
    const lb = normStr(b[b.length - 1]).toLowerCase();
    if (la < lb) return -1;
    if (la > lb) return 1;
    return a.length - b.length;
  });

  return out;
}

function buildDisplayLabel(nodeRow, fallbackLabel, depth) {
  const userName = normStr(getUserName(nodeRow));
  const territoryName = normStr(getTerritoryName(nodeRow));
  const nodeLabel = normStr(getNodeLabel(nodeRow));

  const base = userName || nodeLabel || fallbackLabel;

  if (territoryName) {
    return `${base} (${territoryName})`;
  }

  if (depth === 0 && base) {
    return `${base} (Global)`;
  }

  return base || fallbackLabel;
}

function buildNode(rows, prefixMap, parts) {
  const nodeRow = getNodeRow(rows, parts);
  const depth = getDepthFromParts(parts);
  const label = parts[parts.length - 1];
  const id = getPathKeyFromParts(parts);
  const parentId = parts.length > 1 ? getPathKeyFromParts(parts.slice(0, -1)) : null;

  const childPartsList = getChildPartsListFromPrefixMap(prefixMap, parts);
  const children = childPartsList
    .map((childParts) => buildNode(rows, prefixMap, childParts))
    .filter(Boolean);

  const ownMetrics = nodeRow ? makeMetrics(nodeRow) : zeroMetrics();
  const childRollupMetrics = sumMetrics(children);
  const isSynthetic = !nodeRow;

  /**
   * Display rule:
   * - synthetic parent nodes (like top Doug) => show sum of immediate children
   * - real nodes from SQL => show own node values
   */
  const metrics = isSynthetic ? childRollupMetrics : ownMetrics;

  return {
    id,
    parentId,
    label,
    displayLabel: buildDisplayLabel(nodeRow, label, depth),
    depth,
    metrics,
    ownMetrics,
    childRollupMetrics,
    children,
    __row: nodeRow || null,
    isSynthetic,
    nodeLabel: normStr(getNodeLabel(nodeRow)) || label,
    parentLabel: normStr(getParentLabel(nodeRow)) || null,
    userName: normStr(getUserName(nodeRow)) || null,
    territoryName: normStr(getTerritoryName(nodeRow)) || null,
  };
}

export function buildRevintelTree(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const prefixMap = buildPrefixMap(rows);

  const rootPartsList = Array.from(prefixMap.values())
    .filter((parts) => parts.length === 1)
    .sort((a, b) => {
      const la = normStr(a[0]).toLowerCase();
      const lb = normStr(b[0]).toLowerCase();
      if (la < lb) return -1;
      if (la > lb) return 1;
      return 0;
    });

  return rootPartsList
    .map((parts) => buildNode(rows, prefixMap, parts))
    .filter(Boolean);
}