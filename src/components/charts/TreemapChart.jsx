import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { toNumber } from "../../utils/formatters.jsx";

function fmtAbbrev(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const abs = Math.abs(x);

  if (abs >= 1e12) return `${(x / 1e12).toFixed(1).replace(/\.0$/, "")}T`;
  if (abs >= 1e9) return `${(x / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1e6) return `${(x / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1e3) return `${(x / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(x).toLocaleString()}`;
}

function safeStr(v, fallback = "Unknown") {
  const s = String(v ?? "").trim();
  return s.length ? s : fallback;
}

function normBucket(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "Open Pipeline";

  if (s.includes("won") || s === "w") return "Won";
  if (s.includes("lost") || s.includes("closed lost") || s === "l") return "Lost";

  if (s.includes("open") || s.includes("pipe") || s.includes("pipeline")) return "Open Pipeline";

  return safeStr(v, "Open Pipeline");
}

/**
 * NEW: 3-bucket treemap (bucket -> leaf)
 * - bucketKey: outcome bucket (Won/Lost/Open)
 * - leafKey: opp name (or other leaf label)
 * - valueKey: amount
 * - colorKey: optional color metric
 * - labelKey: optional label override (applies to leaf)
 */
function buildBucketLeafTreemap(rows, cfg) {
  const { bucketKey, leafKey, valueKey, colorKey, labelKey } = cfg || {};
  if (!bucketKey || !leafKey || !valueKey) return [];

  const buckets = new Map();

  function getBucket(name) {
    if (!buckets.has(name)) {
      buckets.set(name, {
        name,
        __sum: 0,
        __colorSum: 0,
        __colorN: 0,
        __leafMap: new Map(),
      });
    }
    return buckets.get(name);
  }

  function getLeaf(bucket, leafName) {
    const m = bucket.__leafMap;
    if (!m.has(leafName)) {
      m.set(leafName, {
        name: leafName,
        __sum: 0,
        __colorSum: 0,
        __colorN: 0,
      });
    }
    return m.get(leafName);
  }

  for (const r of rows || []) {
    const v = toNumber(r?.[valueKey]) || 0;
    if (!Number.isFinite(v) || v === 0) continue;

    const b = normBucket(r?.[bucketKey]);

    const override = labelKey ? String(r?.[labelKey] ?? "").trim() : "";
    const leafBase = safeStr(r?.[leafKey], "Unknown Opportunity");
    const leaf = override || leafBase;

    const c = colorKey ? toNumber(r?.[colorKey]) : null;

    const bn = getBucket(b);
    bn.__sum += v;
    if (Number.isFinite(c)) {
      bn.__colorSum += c;
      bn.__colorN += 1;
    }

    const ln = getLeaf(bn, leaf);
    ln.__sum += v;
    if (Number.isFinite(c)) {
      ln.__colorSum += c;
      ln.__colorN += 1;
    }
  }

  const preferredOrder = ["Open Pipeline", "Lost", "Won"];
  const allBucketNames = Array.from(buckets.keys());
  allBucketNames.sort((a, b) => {
    const ia = preferredOrder.indexOf(a);
    const ib = preferredOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  return allBucketNames.map((name) => {
    const bn = buckets.get(name);

    const children = Array.from(bn.__leafMap.values())
      .filter((x) => Number.isFinite(x.__sum) && x.__sum !== 0)
      .sort((a, b) => Math.abs(b.__sum) - Math.abs(a.__sum))
      .map((leaf) => {
        const node = { name: leaf.name, value: leaf.__sum };
        if (leaf.__colorN > 0) node.colorValue = leaf.__colorSum / leaf.__colorN;
        return node;
      });

    const bucketNode = { name: bn.name, value: bn.__sum, children };
    if (bn.__colorN > 0) bucketNode.colorValue = bn.__colorSum / bn.__colorN;

    return bucketNode;
  });
}

function buildTreemapHierarchy(rows, cfg) {
  const { level1Key, level2Key, level3Key, valueKey, colorKey, labelKey } = cfg || {};
  if (!valueKey || !level1Key) return [];

  const root = new Map();

  function getOrCreateChild(parentChildrenMap, name) {
    if (!parentChildrenMap.has(name)) {
      parentChildrenMap.set(name, {
        name,
        children: [],
        __childMap: new Map(),
        __sum: 0,
        __colorSum: 0,
        __colorN: 0,
      });
    }
    return parentChildrenMap.get(name);
  }

  for (const r of rows || []) {
    const v = toNumber(r?.[valueKey]) || 0;
    if (!Number.isFinite(v)) continue;

    const l1 = safeStr(r?.[level1Key]);
    const l2 = level2Key ? safeStr(r?.[level2Key], null) : null;
    const l3 = level3Key ? safeStr(r?.[level3Key], null) : null;

    const labelOverride = labelKey ? String(r?.[labelKey] ?? "").trim() : "";
    const leafLabel = labelOverride || (l3 || l2 || l1);

    const c = colorKey ? toNumber(r?.[colorKey]) : null;

    const n1 = getOrCreateChild(root, l1);
    n1.__sum += v;
    if (Number.isFinite(c)) {
      n1.__colorSum += c;
      n1.__colorN += 1;
    }

    let parent = n1;
    if (l2) {
      const n2 = getOrCreateChild(parent.__childMap, l2);
      n2.__sum += v;
      if (Number.isFinite(c)) {
        n2.__colorSum += c;
        n2.__colorN += 1;
      }
      parent = n2;
    }

    if (l3) {
      const n3 = getOrCreateChild(parent.__childMap, l3);
      n3.__sum += v;
      if (Number.isFinite(c)) {
        n3.__colorSum += c;
        n3.__colorN += 1;
      }
      parent = n3;
    }

    parent.__leafLabel = leafLabel;
  }

  function finalize(node) {
    const children = node.__childMap ? Array.from(node.__childMap.values()) : [];
    for (const ch of children) finalize(ch);

    node.children = children.map((c) => {
      const out = { ...c };
      delete out.__childMap;

      if (out.__leafLabel) out.name = out.__leafLabel;

      out.value = out.__sum;
      if (out.__colorN > 0) out.colorValue = out.__colorSum / out.__colorN;

      delete out.__sum;
      delete out.__colorSum;
      delete out.__colorN;
      delete out.__leafLabel;

      return out;
    });

    delete node.__childMap;
  }

  return Array.from(root.values()).map((n) => {
    const out = { ...n };
    finalize(out);

    out.value = out.__sum;
    if (out.__colorN > 0) out.colorValue = out.__colorSum / out.__colorN;

    delete out.__sum;
    delete out.__colorSum;
    delete out.__colorN;

    return out;
  });
}

export default function TreemapChart({ rows = [], config = {}, height = 460, title = "Treemap" }) {
  const option = useMemo(() => {
    let data = [];

    if (config?.mode === "bucket_leaf") {
      data = buildBucketLeafTreemap(rows, config);
    } else {
      data = buildTreemapHierarchy(rows, config);
    }

    if (!data || data.length === 0) return null;

    const usesColor = Boolean(config?.colorKey);

    return {
      tooltip: {
        formatter: (p) => {
          const name = p?.name ?? "";
          const v = p?.value ?? 0;
          const cv = p?.data?.colorValue;

          const lines = [`<b>${name}</b>`, `Size: ${fmtAbbrev(v)}`];
          if (usesColor && Number.isFinite(cv)) lines.push(`Color: ${fmtAbbrev(cv)}`);
          return lines.join("<br/>");
        },
      },

      series: [
        {
          type: "treemap",
          data,

          roam: true,
          nodeClick: "zoomToNode",

          breadcrumb: {
            show: true,
            left: 12,
            top: 8,
            itemStyle: { color: "rgba(255,255,255,0.85)" },
            emphasis: { itemStyle: { color: "rgba(255,255,255,0.95)" } },
          },

          label: {
            show: true,
            formatter: "{b}",
            overflow: "truncate",
            color: "rgba(255,255,255,0.92)",
            fontSize: 12,
            fontWeight: 800,
          },

          upperLabel: {
            show: true,
            height: 22,
            color: "rgba(15,23,42,0.85)",
            fontWeight: 900,
          },

          itemStyle: {
            borderColor: "rgba(255,255,255,0.55)",
            borderWidth: 1,
            gapWidth: 2,
          },

          visualDimension: usesColor ? "colorValue" : undefined,
          levels: [
            { itemStyle: { borderWidth: 0, gapWidth: 2 } },
            { itemStyle: { borderWidth: 2, gapWidth: 2 }, upperLabel: { show: true } },
            { itemStyle: { borderWidth: 1, gapWidth: 2 }, upperLabel: { show: true } },
            { itemStyle: { borderWidth: 1, gapWidth: 1 } },
          ],
        },
      ],

      graphic: [
        {
          type: "text",
          left: 14,
          top: 10,
          style: {
            text: title,
            fontSize: 12,
            fontWeight: 900,
            fill: "rgba(15, 23, 42, 0.70)",
            fontFamily: "system-ui",
          },
        },
      ],
    };
  }, [rows, config, title]);

  if (!option) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed #cbd5e1",
          borderRadius: 12,
          color: "#94a3b8",
        }}
      >
        Waiting for treemap rows...
      </div>
    );
  }

  return (
    <div style={{ height, width: "100%" }}>
      <ReactECharts option={option} style={{ height: "100%" }} notMerge />
    </div>
  );
}