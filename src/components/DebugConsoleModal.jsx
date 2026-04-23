// src/components/DebugConsoleModal.jsx
import React, { useMemo, useState, useEffect } from "react";
import Modal from "./ui/Modal";

// -----------------------------
// Small helpers
// -----------------------------
function safeJson(x) {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

function clip(v, n = 120) {
  const s = v == null ? "" : String(v);
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Sigma plugin versions can return columns as:
 * - array: [{id, name, ...}, ...]
 * - object wrapper: { columns: [...] }
 * - sometimes other object shapes
 */
function normalizeCols(colsMeta) {
  if (Array.isArray(colsMeta)) return colsMeta;
  if (colsMeta && Array.isArray(colsMeta.columns)) return colsMeta.columns;
  if (colsMeta && Array.isArray(colsMeta.data)) return colsMeta.data;

  if (colsMeta && typeof colsMeta === "object") {
    const vals = Object.values(colsMeta);
    const maybeCols = vals.filter((v) => v && typeof v === "object" && ("id" in v || "name" in v));
    return maybeCols.length ? maybeCols : [];
  }

  return [];
}

/**
 * Resolve a config value (often an ID) into the actual key present in the row object.
 * Mirrors the logic we used in useSigmaData so the debug panel shows the truth.
 */
function resolveRowKey(cfgVal, rowsArr, colsMeta) {
  if (cfgVal == null) return null;

  const row0 = Array.isArray(rowsArr) && rowsArr.length ? rowsArr[0] : null;
  const rowKeys = row0 ? Object.keys(row0) : [];
  const colsArr = normalizeCols(colsMeta);

  const candidates = [];
  const add = (v) => {
    if (v == null) return;
    const s = String(v).trim();
    if (!s) return;

    candidates.push(s);

    const parts = s.split("/");
    if (parts.length > 1) {
      const suffix = parts[parts.length - 1];
      if (suffix && suffix !== s) candidates.push(suffix);
    }
  };

  if (typeof cfgVal === "object") {
    add(cfgVal.name);
    add(cfgVal.field);
    add(cfgVal.columnKey);
    add(cfgVal.key);
    add(cfgVal.value);
    add(cfgVal.id);
  } else {
    add(cfgVal);
  }

  const rawToken =
    typeof cfgVal === "string"
      ? cfgVal
      : cfgVal?.id ?? cfgVal?.value ?? cfgVal?.key ?? cfgVal?.name ?? null;

  if (rawToken && colsArr.length) {
    const tok = String(rawToken);
    const tokSuffix = tok.split("/").pop();

    const hit =
      colsArr.find((c) => String(c?.id ?? "") === tok) ||
      colsArr.find((c) => String(c?.id ?? "") === tokSuffix) ||
      colsArr.find((c) => String(c?.name ?? "") === tok) ||
      colsArr.find((c) => String(c?.name ?? "") === tokSuffix);

    if (hit) {
      add(hit.name);
      add(hit.id);
      add(hit.columnKey);
      add(hit.key);
    }
  }

  if (!row0) return candidates.find(Boolean) ?? null;

  for (const c of candidates) {
    if (hasOwn(row0, c)) return c;
  }

  for (const c of candidates) {
    const hit = rowKeys.find((k) => k === c || k.endsWith(`/${c}`));
    if (hit) return hit;
  }

  return candidates.find(Boolean) ?? null;
}

function colCount(colsMeta) {
  return normalizeCols(colsMeta).length;
}

function rowKeysPreview(rowsArr, n = 40) {
  if (!Array.isArray(rowsArr) || !rowsArr.length) return [];
  return Object.keys(rowsArr[0]).slice(0, n);
}

function buildPreviewTable(rowsArr, keyLimit = 8, rowLimit = 6) {
  const keys = rowKeysPreview(rowsArr, keyLimit);
  const rowsOut = (rowsArr || []).slice(0, rowLimit).map((r) => {
    const o = {};
    for (const k of keys) o[k] = clip(r?.[k], 80);
    return o;
  });
  return { keys, rows: rowsOut };
}

// -----------------------------
// Mapping blueprint (Component -> dataset -> cfg keys)
// -----------------------------
const MAPPING_SECTIONS = [
  {
    title: "App.jsx · Company Totals (MetricCards)",
    dataset: "companyEffective",
    sourceKey: "source_company",
    fields: [
      ["Commit", "co_commit"],
      ["Plan Attainment (QTD)", "co_fin_plan_attainment_qtd"],
      ["Plan Attainment (YTD)", "co_fin_plan_attainment_year"],
      ["Closed (QTD)", "co_closed"],
      ["2Y CAGR (TTM)", "co_cagr_2y_pct"],
      ["Stage 4+ Coverage", "stage4_cvg"],
      ["Velocity", "velocity_pct"],
      ["% Funded", "funded_pct"],
      ["Gap to Commit", "gap_to_commit"],
      ["PG Attainment (legacy)", "pipeline_gen_attainment"],
      ["Closed Trend M1", "co_m1"],
      ["Closed Trend M2", "co_m2"],
      ["Closed Trend M3", "co_m3"],
      ["Closed Trend M1 Label", "co_m1Label"],
      ["Closed Trend M2 Label", "co_m2Label"],
      ["Closed Trend M3 Label", "co_m3Label"],
      ["R12 M1", "co_r12_1"],
      ["R12 M1 Label", "co_r12_1Label"],
      ["R12 M12", "co_r12_12"],
      ["R12 M12 Label", "co_r12_12Label"],
    ],
  },
  {
    title: "App.jsx · Field Execution (MetricCards)",
    dataset: "detail",
    sourceKey: "source_detail",
    fields: [
      ["Forecast ($)", "forecast_amount"],
      ["Best Case ($)", "best_case_amount"],
      ["Open Pipe ($)", "open_pipe"],
      ["Closed (Filtered) ($)", "closed_filtered"],
      ["Current User Full Name", "current_user_full_name"],
      ["Business Line", "business_line"],
    ],
  },
  {
    title: "App.jsx · Execution Health (Rollups)",
    dataset: "rollupEffective",
    sourceKey: "rollup_source",
    fields: [
      ["+1 Commit Amt", "rollup_plus_1_commit_amt"],
      ["+2 Commit Amt", "rollup_plus_2_commit_amt"],
    ],
  },
  {
    title: "App.jsx · Create & Close (Summary Cards)",
    dataset: "createCloseCard",
    sourceKey: "source_create_close_card",
    fields: [
      ["Won QTD", "ccc_closed_won_qtd_amt"],
      ["Open Pipe QTD", "ccc_open_pipe_qtd_amt"],
      ["Won QTD Y/Y", "ccc_closed_won_qtd_yoy_pct"],
      ["Open Pipe QTD Y/Y", "ccc_open_pipe_qtd_yoy_pct"],
    ],
  },
  {
    title: "CreateCloseDrillModal.jsx",
    dataset: "createCloseDetail",
    sourceKey: "source_create_close_detail",
    fields: [
      ["Fiscal YearQuarter", "ccd_fiscal_yearquarter"],
      ["Day of Quarter", "ccd_day_of_quarter"],
      ["As Of Date", "ccd_as_of_date"],
      ["Business Line", "ccd_business_line"],
      ["Opp Owner Name", "ccd_opp_owner_name"],
      ["Account Name", "ccd_account_name"],
      ["Stage Name", "ccd_stage_name"],
      ["Close Date", "ccd_close_date"],
      ["Opp Id", "ccd_opp_id"],
      ["Opp Name", "ccd_opp_name"],
      ["Closed Won", "ccd_closed_won"],
      ["Open Pipe", "ccd_open_pipe"],
      ["Closed Won Opp Count", "ccd_closed_won_opp_count"],
      ["Open Pipe Opp Count", "ccd_open_pipe_opp_count"],
      ["Closed Won PY", "ccd_closed_won_py"],
      ["Open Pipe PY", "ccd_open_pipe_py"],
      ["Closed Won Y/Y %", "ccd_closed_won_yoy_pct"],
      ["Open Pipe Y/Y %", "ccd_open_pipe_yoy_pct"],
    ],
  },
  {
    title: "HorsemanSection.jsx",
    dataset: "horseman",
    sourceKey: "source_horseman",
    fields: [
      ["Outcome Source", "hm_source"],
      ["Outcome Bucket", "hm_outcome"],
      ["Value (ARR)", "hm_value"],
    ],
  },
  {
    title: "HorsemanSection.jsx · Detail Table",
    dataset: "horsemanDetail",
    sourceKey: "source_horseman_detail",
    fields: [
      ["Opp Id", "hmd_opp_id"],
      ["Opp Name", "hmd_opp_name"],
      ["Owner", "hmd_owner"],
      ["Stage", "hmd_stage"],
      ["Close Date", "hmd_close"],
      ["ARR", "hmd_arr"],
      ["Source (optional)", "hmd_source"],
      ["Outcome (optional)", "hmd_outcome"],
    ],
  },
  {
    title: "WaterfallChart.jsx + DrillDownModal.jsx",
    dataset: "waterfall",
    sourceKey: "source_waterfall",
    fields: [
      ["Step", "wf_name"],
      ["Amount", "wf_amount"],
      ["Opp Name", "wf_opp_name"],
      ["Opp Owner", "wf_opp_owner"],
      ["Business Line", "wf_business_line"],
      ["Created FYQ", "wf_created_qtr"],
      ["Record Type", "wf_record_type"],
    ],
  },
  {
    title: "CFOTreemapSection.jsx",
    dataset: "cfoTreemap",
    sourceKey: "source_cfo_treemap",
    fields: [
      ["Bucket", "tm_bucket"],
      ["Leaf Label", "tm_leaf_label"],
      ["Fiscal YearQuarter (filter)", "tm_fiscal_yearquarter"],
      ["Level 1", "tm_level1"],
      ["Level 2", "tm_level2"],
      ["Level 3", "tm_level3"],
      ["Size Value", "tm_value"],
      ["Color Value", "tm_color_value"],
      ["Label Override", "tm_label"],
    ],
  },
  {
    title: "CRORevintelTreeSection.jsx",
    dataset: "revintelTree",
    sourceKey: "source_revintel_tree",
    fields: [
      ["FYQ", "rt_fyq"],
      ["Level 0", "rt_lvl0"],
      ["Level 1", "rt_lvl1"],
      ["Level 2", "rt_lvl2"],
      ["Level 3", "rt_lvl3"],
      ["Level 4", "rt_lvl4"],
      ["Rollup Level", "rt_rollup_level"],
      ["Node Label", "rt_node_label"],
      ["Parent Label", "rt_parent_label"],
      ["User Name", "rt_user_name"],
      ["Territory Name", "rt_territory_name"],
      ["Quota", "rt_quota"],
      ["Commit", "rt_commit"],
      ["Forecast", "rt_forecast"],
      ["Best Case", "rt_best_case"],
      ["Open Pipeline", "rt_open_pipeline"],
    ],
  },
  {
    title: "CPOScorecardPlaceholder.jsx · Calendar",
    dataset: "calendar",
    sourceKey: "calendar_source",
    fields: [
      ["Date Column", "calendar_date"],
      ["Value Column", "calendar_value"],
    ],
  },
  {
    title: "CPOAccountsSection.jsx · Accounts (preview)",
    dataset: "cpoAccounts",
    sourceKey: "cpo_accounts_source",
    fields: [],
    preview: { keyLimit: 10, rowLimit: 8 },
  },
  {
    title: "AEPerformanceDrillModal.jsx",
    dataset: "aePerformance",
    sourceKey: "source_ae_performance",
    fields: [
      ["Deals Closed (0/1)", "ae_deals_closed"],
      ["Above Threshold (0/1)", "ae_above_threshold"],
      ["AE Name", "ae_name"],
      ["Forecast User Id", "ae_user_id"],
      ["FYQ", "ae_fiscal_yearquarter"],
      ["Business Line", "ae_business_line"],
    ],
  },
  {
    title: "CAGRDrillModal.jsx",
    dataset: "drillCagr",
    sourceKey: "source_drill_cagr",
    fields: [
      ["FYQ", "dr_fiscal_yearquarter"],
      ["Business Line", "dr_business_line"],
      ["Beginning Value", "dr_beginning_value"],
      ["Ending Value", "dr_ending_value"],
      ["Years (optional)", "dr_years"],
      ["CAGR %", "dr_cagr_pct"],
      ["Begin FYQ (optional)", "dr_begin_fyq"],
      ["End FYQ (optional)", "dr_end_fyq"],
    ],
  },
  {
    title: "VelocityDrillModal.jsx",
    dataset: "drillVelocity",
    sourceKey: "source_drill_velocity",
    fields: [
      ["FYQ", "dv_fiscal_yearquarter"],
      ["Business Line", "dv_business_line"],
      ["Velocity %", "dv_velocity_pct"],
      ["Numerator", "dv_numerator"],
      ["Denominator", "dv_denominator"],
      ["Numerator Label", "dv_numerator_label"],
      ["Denominator Label", "dv_denominator_label"],
      ["Target %", "dv_target_pct"],
      ["Period", "dv_period"],
      ["Period Sort", "dv_period_sort"],
    ],
  },
  {
    title: "FundedDrillModal.jsx",
    dataset: "drillFunded",
    sourceKey: "source_drill_funded",
    fields: [
      ["FYQ", "df_fiscal_yearquarter"],
      ["Business Line", "df_business_line"],
      ["% Funded", "df_funded_pct"],
      ["Numerator", "df_numerator"],
      ["Denominator", "df_denominator"],
      ["Numerator Label", "df_numerator_label"],
      ["Denominator Label", "df_denominator_label"],
      ["Target %", "df_target_pct"],
      ["Period", "df_period"],
      ["Period Sort", "df_period_sort"],
    ],
  },
];

// -----------------------------
// UI bits
// -----------------------------
function Pill({ children, tone = "neutral" }) {
  const bg =
    tone === "ok"
      ? "rgba(16,185,129,0.14)"
      : tone === "warn"
      ? "rgba(245,158,11,0.16)"
      : tone === "bad"
      ? "rgba(239,68,68,0.14)"
      : "rgba(15,23,42,0.08)";

  const color =
    tone === "ok"
      ? "rgba(16,185,129,0.95)"
      : tone === "warn"
      ? "rgba(245,158,11,0.95)"
      : tone === "bad"
      ? "rgba(239,68,68,0.95)"
      : "rgba(15,23,42,0.75)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        background: bg,
        color,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Table({ columns, rows }) {
  return (
    <div style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "rgba(15,23,42,0.06)" }}>
              {columns.map((c) => (
                <th
                  key={c}
                  style={{
                    textAlign: "left",
                    padding: "10px 10px",
                    borderBottom: "1px solid rgba(15,23,42,0.10)",
                    fontWeight: 950,
                    color: "rgba(15,23,42,0.80)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                {columns.map((c) => (
                  <td key={c} style={{ padding: "9px 10px", verticalAlign: "top" }}>
                    {r?.[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------
// Component
// -----------------------------
    export default function DebugConsoleModal({
      open,
      onClose,
      activePersona,
      config,
      data,
      rows,
      columns,
      debugInfo,
      debugLogs = [],
      debugLoggingEnabled = false,
      onToggleDebugLogging,
      onClearDebugLogs,
      onRefreshDebugLogs,
    }) {  
    
    const PAGE_SIZE = 10;
    const [logPage, setLogPage] = useState(0);
    const [logSearch, setLogSearch] = useState("");

    useEffect(() => {
      if (!open) return;
      setLogPage(0);
    }, [open]);

    useEffect(() => {
      setLogPage(0);
    }, [logSearch]);

    const filteredLogs = useMemo(() => {
      const reversed = (debugLogs || []).slice().reverse();

      if (!logSearch.trim()) return reversed;

      const q = logSearch.toLowerCase();

      return reversed.filter((log) => {
        const haystack = [
          log?.message,
          log?.level,
          log?.ts,
        ]
          .map((v) => String(v ?? ""))
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      });
    }, [debugLogs, logSearch]);

    const totalLogs = filteredLogs.length;
    const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE));

    const pagedLogs = useMemo(() => {
      const start = logPage * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      return filteredLogs.slice(start, end);
    }, [filteredLogs, logPage]);

    const showingStart = totalLogs === 0 ? 0 : logPage * PAGE_SIZE + 1;
    const showingEnd = Math.min((logPage + 1) * PAGE_SIZE, totalLogs);
      
    const derived = useMemo(() => {
    const companyEffectiveKey = rows?.company?.length ? "company" : "detail";
    const rollupEffectiveKey = rows?.rollup?.length ? "rollup" : companyEffectiveKey;

    const datasets = {
      detail: { rows: rows?.detail ?? [], cols: columns?.detail },
      company: { rows: rows?.company ?? [], cols: columns?.company },
      companyEffective: { rows: rows?.[companyEffectiveKey] ?? [], cols: columns?.[companyEffectiveKey] },
      rollup: { rows: rows?.rollup ?? [], cols: columns?.rollup },
      rollupEffective: { rows: rows?.[rollupEffectiveKey] ?? [], cols: columns?.[rollupEffectiveKey] },

      createCloseCard: { rows: rows?.createCloseCard ?? [], cols: columns?.createCloseCard },
      createCloseDetail: { rows: rows?.createCloseDetail ?? [], cols: columns?.createCloseDetail },

      horseman: { rows: rows?.horseman ?? [], cols: columns?.horseman },
      horsemanDetail: { rows: rows?.horsemanDetail ?? [], cols: columns?.horsemanDetail },

      waterfall: { rows: rows?.waterfall ?? [], cols: columns?.waterfall },

      cfoTreemap: { rows: rows?.cfoTreemap ?? [], cols: columns?.cfoTreemap },
      cfoTreemapDetail: { rows: rows?.cfoTreemapDetail ?? [], cols: columns?.cfoTreemapDetail },

      calendar: { rows: rows?.calendar ?? [], cols: columns?.calendar },

      aePerformance: { rows: rows?.aePerformance ?? [], cols: columns?.aePerformance },

      drillCagr: { rows: rows?.drillCagr ?? [], cols: columns?.drillCagr },
      drillVelocity: { rows: rows?.drillVelocity ?? [], cols: columns?.drillVelocity },
      drillFunded: { rows: rows?.drillFunded ?? [], cols: columns?.drillFunded },

      revintelTree: { rows: rows?.revintelTree ?? [], cols: columns?.revintelTree },
      cpoAccounts: { rows: rows?.cpoAccounts ?? [], cols: columns?.cpoAccounts },
    };

    const mappingSections = MAPPING_SECTIONS.map((sec) => {
      const ds = datasets[sec.dataset] || { rows: [], cols: null };
      const row0 = ds.rows?.[0] ?? null;

      const sourceId = config?.[sec.sourceKey] ?? null;
      const dsRowCount = Array.isArray(ds.rows) ? ds.rows.length : 0;
      const dsColCount = colCount(ds.cols);

      const fields = Array.isArray(sec.fields) ? sec.fields : [];
      const hasFields = fields.length > 0;

      const rowsOut = hasFields
        ? fields.map(([label, cfgKey]) => {
            const cfgVal = config?.[cfgKey];
            const resolvedKey = resolveRowKey(cfgVal, ds.rows, ds.cols);

            const ok = !!(
              row0 &&
              resolvedKey &&
              (hasOwn(row0, resolvedKey) ||
                Object.keys(row0).some((k) => k === resolvedKey || k.endsWith(`/${resolvedKey}`)))
            );

            const status = ok ? "OK" : cfgVal ? "MISSING" : "UNMAPPED";
            const sample = ok ? clip(row0?.[resolvedKey]) : "";

            return {
              Component: sec.title,
              Dataset: sec.dataset,
              "Field (UI)": label,
              cfgKey,
              configVal: cfgVal == null ? "" : clip(cfgVal, 60),
              resolvedRowKey: resolvedKey ?? "",
              Status: status,
              Sample: sample,
            };
          })
        : [];

      const previewCfg = sec.preview || null;
      const preview = previewCfg
        ? buildPreviewTable(ds.rows, previewCfg.keyLimit ?? 8, previewCfg.rowLimit ?? 6)
        : null;

      return {
        title: sec.title,
        dataset: sec.dataset,
        sourceKey: sec.sourceKey,
        sourceId,
        dsRowCount,
        dsColCount,
        firstRowKeys: rowKeysPreview(ds.rows),
        tableRows: rowsOut,
        preview,
      };
    });

    let okCount = 0;
    let missingCount = 0;
    let unmappedCount = 0;

    for (const sec of mappingSections) {
      for (const r of sec.tableRows) {
        if (r.Status === "OK") okCount += 1;
        else if (r.Status === "MISSING") missingCount += 1;
        else unmappedCount += 1;
      }
    }

    return {
      datasets,
      companyEffectiveKey,
      rollupEffectiveKey,
      mappingSections,
      totals: { okCount, missingCount, unmappedCount },
    };
  }, [rows, columns, config]);

  const topKeys = useMemo(() => Object.keys(data || {}).sort(), [data]);

  useEffect(() => {
    if (logPage > totalPages - 1) {
      setLogPage(Math.max(0, totalPages - 1));
    }
  }, [logPage, totalPages]);


  return (
    <Modal open={open} onClose={onClose} title="Debug Console" subtitle={`Persona: ${activePersona || "—"}`} width={1180}>
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ fontWeight: 950, fontSize: 14 }}>
            Buffered Debug Console
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              fontWeight: 800,
              color: "rgba(15,23,42,0.58)",
            }}
          >
            Logging is buffered in memory. Showing {showingStart}–{showingEnd} of {totalLogs}
            {logSearch.trim() ? ` matching "${logSearch}"` : ""}.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            placeholder="Search buffered logs..."
            style={{
              minWidth: 220,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.14)",
              background: "white",
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(15,23,42,0.85)",
              outline: "none",
            }}
          />

          <button onClick={() => onToggleDebugLogging?.()}>
            {debugLoggingEnabled ? "Disable Logging" : "Enable Logging"}
          </button>

          <button onClick={() => onRefreshDebugLogs?.()}>
            Refresh
          </button>

          <button
            onClick={() => setLogPage((p) => Math.max(0, p - 1))}
            disabled={logPage === 0}
          >
            Previous 10
          </button>

          <button
            onClick={() => setLogPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={logPage >= totalPages - 1}
          >
            Next 10
          </button>

          <button onClick={() => onClearDebugLogs?.()}>
            Clear
          </button>
        </div>
      </div>

      <div style={{
        maxHeight: 220,
        overflowY: "auto",
        background: "#0f172a",
        color: "#e2e8f0",
        borderRadius: 12,
        padding: 10,
        fontSize: 11,
        fontFamily: "monospace"
      }}>
        {pagedLogs.length === 0 ? (
          <div style={{ opacity: 0.6 }}>No logs yet…</div>
        ) : (
          pagedLogs.map((log) => (
            <div
              key={log.id}
              style={{
                marginBottom: 6,
                paddingBottom: 6,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ opacity: 0.6 }}>
                {new Date(log.ts).toLocaleTimeString()}
              </span>{" "}
              <span
                style={{
                  color:
                    log.level === "error"
                      ? "#f87171"
                      : log.level === "warn"
                        ? "#facc15"
                        : log.level === "perf"
                          ? "#60a5fa"
                          : "#34d399",
                  fontWeight: 900,
                }}
              >
                [{log.level}]
              </span>{" "}
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div style={cardStyle}>
          <div style={cardLabel}>Company effective dataset</div>
          <div style={cardValue}>{derived.companyEffectiveKey}</div>
          <div style={cardHint}>If company has 0 rows, we fall back to detail.</div>
        </div>

        <div style={cardStyle}>
          <div style={cardLabel}>Rollup effective dataset</div>
          <div style={cardValue}>{derived.rollupEffectiveKey}</div>
          <div style={cardHint}>If rollup has 0 rows, we fall back to companyEffective.</div>
        </div>

        <div style={cardStyle}>
          <div style={cardLabel}>Mapping health</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            <Pill tone="ok">OK: {derived.totals.okCount}</Pill>
            <Pill tone="warn">Missing: {derived.totals.missingCount}</Pill>
            <Pill tone="bad">Unmapped: {derived.totals.unmappedCount}</Pill>
          </div>
          <div style={cardHint}>“Missing” means mapped, but doesn’t exist on row keys.</div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <details open style={detailsStyle}>
        <summary style={summaryStyle}>Element sources (selected)</summary>
        <pre style={preStyle}>{safeJson(debugInfo?.sources ?? {})}</pre>
      </details>

      <details style={detailsStyle}>
        <summary style={summaryStyle}>Dataset inventory (row counts + column counts + first row keys)</summary>

        <Table
          columns={["Dataset", "Rows", "Cols(meta)", "FirstRowKeys (preview)"]}
          rows={Object.entries(derived.datasets).map(([k, v]) => ({
            Dataset: k,
            Rows: Array.isArray(v.rows) ? v.rows.length : 0,
            "Cols(meta)": colCount(v.cols),
            "FirstRowKeys (preview)": rowKeysPreview(v.rows).join(", "),
          }))}
        />
      </details>

      <details open style={detailsStyle}>
        <summary style={summaryStyle}>Component mappings (what each section expects)</summary>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {derived.mappingSections.map((sec) => {
            const anyMissing = sec.tableRows.some((r) => r.Status === "MISSING");
            const anyUnmapped = sec.tableRows.some((r) => r.Status === "UNMAPPED");
            const hasMappingRows = sec.tableRows.length > 0;
            const hasPreview = !!sec.preview;
            const shouldOpen = (anyMissing || anyUnmapped) || (!hasMappingRows && hasPreview && sec.dsRowCount > 0);

            return (
              <details key={sec.title} style={nestedDetailsStyle} open={shouldOpen}>
                <summary style={nestedSummaryStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950 }}>{sec.title}</div>
                    <Pill>{sec.dataset}</Pill>
                    <Pill tone={sec.sourceId ? "ok" : "warn"}>
                      source: {sec.sourceKey} {sec.sourceId ? "✓" : "—"}
                    </Pill>
                    <Pill>{sec.dsRowCount} rows</Pill>
                    <Pill>{sec.dsColCount} cols(meta)</Pill>
                    {hasMappingRows && anyMissing && <Pill tone="warn">has missing</Pill>}
                    {hasMappingRows && anyUnmapped && <Pill tone="bad">has unmapped</Pill>}
                    {!hasMappingRows && hasPreview && <Pill tone="neutral">preview</Pill>}
                  </div>
                </summary>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 850, color: "rgba(15,23,42,0.70)", marginBottom: 6 }}>
                    First row keys (preview)
                  </div>
                  <div style={keysBoxStyle}>{sec.firstRowKeys.join(", ") || "—"}</div>

                  {hasPreview && (
                    <>
                      <div style={{ height: 10 }} />
                      <div style={{ fontSize: 12, fontWeight: 850, color: "rgba(15,23,42,0.70)", marginBottom: 6 }}>
                        Preview rows
                      </div>
                      <Table columns={sec.preview.keys} rows={sec.preview.rows} />
                    </>
                  )}

                  {hasMappingRows && (
                    <>
                      <div style={{ height: 10 }} />
                      <Table
                        columns={["Field (UI)", "cfgKey", "configVal", "resolvedRowKey", "Status", "Sample"]}
                        rows={sec.tableRows.map((r) => ({
                          "Field (UI)": r["Field (UI)"],
                          cfgKey: r.cfgKey,
                          configVal: r.configVal,
                          resolvedRowKey: r.resolvedRowKey,
                          Status:
                            r.Status === "OK"
                              ? "OK"
                              : r.Status === "MISSING"
                              ? "MISSING (mapped but not found)"
                              : "UNMAPPED (no config value)",
                          Sample: r.Sample,
                        }))}
                      />
                    </>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </details>

      <details style={detailsStyle}>
        <summary style={summaryStyle}>Top-level data keys (what App receives)</summary>
        <div style={keysBoxStyle}>{topKeys.join(", ") || "—"}</div>
      </details>

      <details style={detailsStyle}>
        <summary style={summaryStyle}>Raw config (careful: noisy)</summary>
        <pre style={preStyle}>{safeJson(config ?? {})}</pre>
      </details>


    </Modal>
  );
}

const cardStyle = {
  borderRadius: 14,
  border: "1px solid rgba(15,23,42,0.10)",
  background: "white",
  padding: 12,
};

const cardLabel = { fontSize: 11, fontWeight: 950, letterSpacing: 0.6, color: "rgba(15,23,42,0.55)" };
const cardValue = { marginTop: 6, fontSize: 18, fontWeight: 950, color: "rgba(15,23,42,0.92)" };
const cardHint = { marginTop: 6, fontSize: 12, color: "rgba(15,23,42,0.60)", fontWeight: 650 };

const detailsStyle = {
  border: "1px solid rgba(15,23,42,0.10)",
  borderRadius: 14,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.78)",
  marginBottom: 12,
};

const nestedDetailsStyle = {
  border: "1px solid rgba(15,23,42,0.10)",
  borderRadius: 14,
  padding: "10px 12px",
  background: "white",
};

const summaryStyle = {
  cursor: "pointer",
  fontWeight: 950,
  color: "rgba(15,23,42,0.85)",
  userSelect: "none",
};

const nestedSummaryStyle = {
  cursor: "pointer",
  userSelect: "none",
};

const preStyle = {
  marginTop: 10,
  padding: 12,
  borderRadius: 12,
  background: "rgba(15,23,42,0.06)",
  border: "1px solid rgba(15,23,42,0.08)",
  overflowX: "auto",
  fontSize: 11,
  lineHeight: 1.35,
};

const keysBoxStyle = {
  marginTop: 8,
  padding: 10,
  borderRadius: 12,
  background: "rgba(15,23,42,0.06)",
  border: "1px solid rgba(15,23,42,0.08)",
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(15,23,42,0.75)",
  overflowX: "auto",
};