import React, { useMemo, useState, useEffect } from "react";
import Modal from "./Modal";
import AnimatedMetricValue from "./AnimatedMetricValue";
import SegToggle from "./SegToggle";
import { toNumber, ceoBusinessLineDisplayLabel } from "../../utils/formatters.jsx";
import DrillModalContextBar from "./DrillModalContextBar.jsx";

const FA_DRILL_CONTEXT =
  "Historical and in-quarter pacing: closed won vs forecast by fiscal period. Switch QTD / in-quarter modes when available; aligns with Pacing to Forecast on Company Totals.";

function blStrEqual(a, b) {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

function rowBusinessLine(r) {
  return r?.businessLine ?? r?.business_line ?? r?.Business_Line ?? null;
}

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function fmtMoneyCompact(v) {
  if (!isNum(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtPct(v) {
  if (!isNum(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtYear(v) {
  if (v == null || v === "") return "—";
  return String(v);
}

function compareMaybeNumber(a, b) {
  const an = isNum(a) ? a : null;
  const bn = isNum(b) ? b : null;
  if (an == null && bn == null) return 0;
  if (an == null) return -1;
  if (bn == null) return 1;
  return an - bn;
}

function compareMaybeString(a, b) {
  const as = String(a ?? "");
  const bs = String(b ?? "");
  return as.localeCompare(bs);
}

function SortableHeader({ label, sortKey, sortState, setSortState }) {
  const active = sortState.key === sortKey;
  const direction = active ? sortState.direction : null;

  return (
    <th
      onClick={() => {
        setSortState((prev) => {
          if (prev.key === sortKey) {
            return {
              key: sortKey,
              direction: prev.direction === "asc" ? "desc" : "asc",
            };
          }
          return { key: sortKey, direction: "desc" };
        });
      }}
      style={{
        textAlign: "left",
        padding: "10px 12px",
        fontSize: 11,
        fontWeight: 950,
        letterSpacing: 0.35,
        textTransform: "uppercase",
        color: "rgba(15,23,42,0.72)",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span>{label}</span>
      <span style={{ marginLeft: 6, opacity: active ? 1 : 0.35 }}>
        {direction === "asc" ? "↑" : "↓"}
      </span>
    </th>
  );
}

function SummaryCard({ label, value, tone = "default" }) {
  const borderColor =
    tone === "highlight" ? "rgba(89,193,167,0.42)" : "rgba(15,23,42,0.08)";

  const background =
    tone === "highlight"
      ? "linear-gradient(180deg, rgba(239,252,248,0.95), rgba(250,255,253,0.92))"
      : "rgba(255,255,255,0.82)";

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${borderColor}`,
        background,
        padding: 14,
        minHeight: 82,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 950,
          letterSpacing: 0.35,
          textTransform: "uppercase",
          color: "rgba(15,23,42,0.58)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <AnimatedMetricValue
        value={value}
        style={{
          fontSize: 24,
          fontWeight: 950,
          color: "rgba(15,23,42,0.96)",
          lineHeight: 1.1,
        }}
      />
    </div>
  );
}

function TopMetaCard({ label, value, subValue, highlight = false }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${highlight ? "rgba(89,193,167,0.42)" : "rgba(15,23,42,0.08)"}`,
        background: highlight
          ? "linear-gradient(180deg, rgba(239,252,248,0.95), rgba(250,255,253,0.92))"
          : "rgba(255,255,255,0.82)",
        padding: 14,
        minHeight: 86,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 950,
          letterSpacing: 0.45,
          textTransform: "uppercase",
          color: "rgba(15,23,42,0.58)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 16,
          fontWeight: 950,
          color: "rgba(15,23,42,0.96)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>

      {subValue ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "rgba(15,23,42,0.68)",
            lineHeight: 1.35,
          }}
        >
          {subValue}
        </div>
      ) : null}
    </div>
  );
}

export default function ForecastAttainmentDrillModal({
  open,
  onClose,
  data,
  modeDefault = "QTD",
  /** Matches App `BusinessLineToggle` values: "All" | "New Business" | "Gross Expansion" */
  businessLine = "All",
  contextHelper,
  definitionsSection = "company_totals",
  onOpenDefinitions,
}) {
  const [mode, setMode] = useState(modeDefault);
  const [sortState, setSortState] = useState({ key: "fiscalYear", direction: "desc" });

  useEffect(() => {
    if (open) setMode(modeDefault);
  }, [open, modeDefault]);

  const baseFa = data?.fa;
  const allHistoryRows = Array.isArray(baseFa?.historyRows) ? baseFa.historyRows : [];

  const { fa, rows } = useMemo(() => {
    if (!baseFa) {
      return { fa: {}, rows: [] };
    }
    if (!businessLine || businessLine === "All") {
      return { fa: baseFa, rows: allHistoryRows };
    }

    const matching = allHistoryRows.filter((r) => blStrEqual(rowBusinessLine(r), businessLine));
    if (!matching.length) {
      return { fa: baseFa, rows: allHistoryRows };
    }

    const baseFyq = baseFa.fyq != null ? String(baseFa.fyq).trim() : "";
    const picked =
      (baseFyq ? matching.find((r) => blStrEqual(r?.fyq, baseFyq)) : null) ||
      matching.find((r) => r?.prompted) ||
      matching[0];

    const faScoped = {
      ...baseFa,
      bl: rowBusinessLine(picked) ?? businessLine,
      fiscalYear: picked?.fiscalYear ?? baseFa.fiscalYear,
      fyq: picked?.fyq ?? baseFa.fyq,
      qtdForecast: toNumber(picked?.qtdForecast),
      qtdClosed: toNumber(picked?.qtdClosed),
      qtdClosedVsForecast: toNumber(picked?.qtdClosedVsForecast),
      qtdAttainment: toNumber(picked?.qtdAttainment),
      ytdForecast: toNumber(picked?.ytdForecast),
      ytdClosed: toNumber(picked?.ytdClosed),
      ytdAttainment: toNumber(picked?.ytdAttainment),
      quota: toNumber(picked?.quota ?? baseFa.quota),
      commit: toNumber(picked?.commit ?? baseFa.commit),
      bestCase: toNumber(picked?.bestCase ?? baseFa.bestCase),
      openPipeline: toNumber(picked?.openPipeline ?? baseFa.openPipeline),
      historyRows: matching,
    };

    return { fa: faScoped, rows: matching };
  }, [baseFa, allHistoryRows, businessLine]);

  const fyq = fa.fyq ?? "—";
  const businessLineMetaLabel = ceoBusinessLineDisplayLabel(businessLine);

  const current = useMemo(() => {
    if (mode === "YTD") {
      const forecast = fa.ytdForecast ?? null;
      const closed = fa.ytdClosed ?? null;
      const provided = fa.ytdAttainment ?? null;
      const computed =
        isNum(closed) && isNum(forecast) && Number(forecast) !== 0
          ? Number(closed) / Number(forecast)
          : null;

      return {
        forecast,
        closed,
        provided,
        computed,
        shown: provided ?? computed ?? null,
        gap:
          isNum(closed) && isNum(forecast)
            ? Number(closed) - Number(forecast)
            : null,
        label: "YTD",
      };
    }

    const forecast = fa.qtdForecast ?? null;
    const closed = fa.qtdClosed ?? null;
    const provided = fa.qtdAttainment ?? null;
    const computed =
      isNum(closed) && isNum(forecast) && Number(forecast) !== 0
        ? Number(closed) / Number(forecast)
        : null;

    return {
      forecast,
      closed,
      provided,
      computed,
      shown: provided ?? computed ?? null,
      gap:
        isNum(closed) && isNum(forecast)
          ? Number(closed) - Number(forecast)
          : null,
      label: "QTD",
    };
  }, [fa, mode]);

  const historyTableRows = useMemo(() => {
    const baseRows = rows.map((r, idx) => {
      const forecast = mode === "YTD" ? r?.ytdForecast : r?.qtdForecast;
      const closed = mode === "YTD" ? r?.ytdClosed : r?.qtdClosed;
      const provided = mode === "YTD" ? r?.ytdAttainment : r?.qtdAttainment;
      const computed =
        isNum(closed) && isNum(forecast) && Number(forecast) !== 0
          ? Number(closed) / Number(forecast)
          : null;

      return {
        __idx: idx,
        fiscalYear: r?.fiscalYear,
        fyq: r?.fyq,
        businessLine: rowBusinessLine(r),
        forecast,
        closed,
        attainment: provided ?? computed ?? null,
        prompted: r?.prompted,
      };
    });

    const sorted = [...baseRows].sort((a, b) => {
      let cmp = 0;

      switch (sortState.key) {
        case "fiscalYear":
          cmp = compareMaybeNumber(a.fiscalYear, b.fiscalYear);
          break;
        case "fyq":
          cmp = compareMaybeString(a.fyq, b.fyq);
          break;
        case "businessLine":
          cmp = compareMaybeString(a.businessLine, b.businessLine);
          break;
        case "forecast":
          cmp = compareMaybeNumber(a.forecast, b.forecast);
          break;
        case "closed":
          cmp = compareMaybeNumber(a.closed, b.closed);
          break;
        case "attainment":
          cmp = compareMaybeNumber(a.attainment, b.attainment);
          break;
        default:
          cmp = compareMaybeNumber(a.__idx, b.__idx);
          break;
      }

      if (cmp === 0) cmp = compareMaybeNumber(a.__idx, b.__idx);
      return sortState.direction === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [rows, mode, sortState]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Pacing to Forecast Drilldown">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: 4,
        }}
      >
        <DrillModalContextBar
          helperText={contextHelper ?? FA_DRILL_CONTEXT}
          definitionsSection={definitionsSection}
          onOpenDefinitions={onOpenDefinitions}
        />
        {/* top summary / controls */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 950,
                color: "rgba(15,23,42,0.64)",
                lineHeight: 1.45,
              }}
            >
              Company-level pacing to forecast sourced from the pacing to forecast drill dataset.
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(89,193,167,0.34)",
                  background: "rgba(239,252,248,0.95)",
                  fontSize: 11,
                  fontWeight: 950,
                  color: "rgba(15,23,42,0.76)",
                  whiteSpace: "nowrap",
                }}
              >
                Source
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.88)",
                    border: "1px solid rgba(15,23,42,0.08)",
                    color: "rgba(15,23,42,0.88)",
                  }}
                >
                  ACV
                </span>
              </div>

              <SegToggle
                value={mode}
                onChange={setMode}
                options={[
                  { value: "QTD", label: "QTD" },
                  { value: "YTD", label: "YTD" },
                ]}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <TopMetaCard label="Fiscal Year / Quarter" value={fyq} />
            <TopMetaCard label="Business Line" value={businessLineMetaLabel} />
            <TopMetaCard
              label="% Pacing to Forecast"
              value={fmtPct(current.shown)}
              highlight
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <TopMetaCard
              label={`Forecast (${current.label})`}
              value={fmtMoneyCompact(current.forecast)}
            />
            <TopMetaCard
              label={`Closed Won (${current.label})`}
              value={fmtMoneyCompact(current.closed)}
            />
          </div>
        </div>

        {/* formula */}
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(15,23,42,0.08)",
            background: "linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,0.90))",
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 950,
              color: "rgba(15,23,42,0.88)",
              marginBottom: 12,
            }}
          >
            % Pacing to Forecast formula
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(15,23,42,0.08)",
                fontSize: 13,
                fontWeight: 950,
                color: "rgba(15,23,42,0.84)",
              }}
            >
              % Pacing to Forecast =
            </div>

            <div
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(15,23,42,0.08)",
                minWidth: 120,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 950,
                  color: "rgba(15,23,42,0.58)",
                  textTransform: "uppercase",
                  letterSpacing: 0.35,
                }}
              >
                Closed Won
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 18,
                  fontWeight: 950,
                  color: "rgba(15,23,42,0.96)",
                }}
              >
                {fmtMoneyCompact(current.closed)}
              </div>
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 950,
                color: "rgba(15,23,42,0.76)",
              }}
            >
              /
            </div>

            <div
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(15,23,42,0.08)",
                minWidth: 120,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 950,
                  color: "rgba(15,23,42,0.58)",
                  textTransform: "uppercase",
                  letterSpacing: 0.35,
                }}
              >
                Forecast
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 18,
                  fontWeight: 950,
                  color: "rgba(15,23,42,0.96)",
                }}
              >
                {fmtMoneyCompact(current.forecast)}
              </div>
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 950,
                color: "rgba(15,23,42,0.76)",
              }}
            >
              =
            </div>

            <div
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.96)",
                border: "1px solid rgba(89,193,167,0.34)",
                minWidth: 96,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 950,
                  color: "rgba(15,23,42,0.96)",
                }}
              >
                {fmtPct(current.shown)}
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              color: "rgba(15,23,42,0.68)",
              lineHeight: 1.55,
            }}
          >
            Numerator: <strong>{current.label} Closed Won</strong> from the pacing to forecast source.<br />
            Denominator: <strong>{current.label} Forecast</strong> from the same source.
          </div>
        </div>

        {/* historical table */}
        {!!historyTableRows.length && (
          <div
            style={{
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(15,23,42,0.08)",
              background: "rgba(255,255,255,0.82)",
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid rgba(15,23,42,0.08)",
                fontSize: 12,
                fontWeight: 950,
                color: "rgba(15,23,42,0.84)",
              }}
            >
              Historical View — {current.label}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(248,250,252,0.9)" }}>
                    <SortableHeader
                      label="FY"
                      sortKey="fiscalYear"
                      sortState={sortState}
                      setSortState={setSortState}
                    />
                    <SortableHeader
                      label="FYQ"
                      sortKey="fyq"
                      sortState={sortState}
                      setSortState={setSortState}
                    />
                    <SortableHeader
                      label="Business Line"
                      sortKey="businessLine"
                      sortState={sortState}
                      setSortState={setSortState}
                    />
                    <SortableHeader
                      label="Forecast"
                      sortKey="forecast"
                      sortState={sortState}
                      setSortState={setSortState}
                    />
                    <SortableHeader
                      label="Closed Won"
                      sortKey="closed"
                      sortState={sortState}
                      setSortState={setSortState}
                    />
                    <SortableHeader
                      label="Pacing"
                      sortKey="pacing"
                      sortState={sortState}
                      setSortState={setSortState}
                    />
                  </tr>
                </thead>
                <tbody>
                  {historyTableRows.map((r, idx) => {
                    const isPrompted =
                      !!r.prompted ||
                      (!!businessLine &&
                        businessLine !== "All" &&
                        fyq !== "—" &&
                        blStrEqual(r.fyq, fyq));

                    return (
                      <tr
                        key={`${r.fyq}-${r.businessLine}-${idx}`}
                        style={{
                          borderTop: "1px solid rgba(15,23,42,0.06)",
                          background: isPrompted
                            ? "linear-gradient(90deg, rgba(89,193,167,0.16), rgba(89,193,167,0.06))"
                            : "transparent",
                          boxShadow: isPrompted ? "inset 4px 0 0 #59C1A7" : "none",
                        }}
                      >
                        <td
                          style={{
                            padding: "10px 12px",
                            fontSize: 13,
                            fontWeight: 800,
                            color: "rgba(15,23,42,0.82)",
                          }}
                        >
                          {fmtYear(r.fiscalYear)}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontSize: 13,
                            fontWeight: 800,
                            color: "rgba(15,23,42,0.82)",
                          }}
                        >
                          {r.fyq ?? "—"}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontSize: 13,
                            color: "rgba(15,23,42,0.74)",
                          }}
                        >
                          {rowBusinessLine(r) ?? "—"}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <AnimatedMetricValue
                            value={fmtMoneyCompact(r.forecast)}
                            style={{
                              fontSize: 13,
                              fontWeight: 850,
                              color: "rgba(15,23,42,0.84)",
                            }}
                          />
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <AnimatedMetricValue
                            value={fmtMoneyCompact(r.closed)}
                            style={{
                              fontSize: 13,
                              fontWeight: 850,
                              color: "rgba(15,23,42,0.84)",
                            }}
                          />
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <AnimatedMetricValue
                            value={fmtPct(r.attainment)}
                            style={{
                              fontSize: 13,
                              fontWeight: 950,
                              color: "rgba(15,23,42,0.96)",
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}