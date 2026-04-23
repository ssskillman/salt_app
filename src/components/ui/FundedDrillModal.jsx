// src/components/ui/FundedDrillModal.jsx

import React, { useMemo, useState } from "react";
import Modal from "./Modal";
import { ceoBusinessLineDisplayLabel } from "../../utils/formatters.jsx";
import DrillModalContextBar from "./DrillModalContextBar.jsx";

const FUNDED_DRILL_CONTEXT =
  "Opportunity-level (or rolled) rows behind % Funded: numerator and denominator follow your Sigma mapping for closed vs funded commit categories.";

function isNum(v) {
  return v !== null && v !== undefined && !Number.isNaN(v);
}

function fmtPct(v) {
  if (!isNum(v)) return "—";
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function fmtNum(v) {
  if (!isNum(v)) return "—";
  const n = Number(v);
  const abs = Math.abs(n);

  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;

  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtMoneyFull(v) {
  if (!isNum(v)) return "—";
  return `$${Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function compareValues(a, b, direction = "asc") {
  const av = a ?? null;
  const bv = b ?? null;

  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;

  const aNum = typeof av === "number" ? av : Number(av);
  const bNum = typeof bv === "number" ? bv : Number(bv);

  let result = 0;

  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    result = aNum - bNum;
  } else {
    result = String(av).localeCompare(String(bv), undefined, {
      sensitivity: "base",
    });
  }

  return direction === "desc" ? -result : result;
}

function buildOpportunityUrl(oppId) {
  const id = String(oppId ?? "").trim();
  if (!id) return null;
  return `https://iterable.lightning.force.com/lightning/r/Opportunity/${id}/view`;
}

function SortableTh({ label, sortKey, sortState, onSort, align = "left" }) {
  const active = sortState.key === sortKey;
  const direction = active ? sortState.direction : null;

  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        textAlign: align,
        padding: "10px 12px",
        fontSize: 11,
        fontWeight: 950,
        color: active ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.58)",
        textTransform: "uppercase",
        letterSpacing: 0.4,
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
      }}
      title={`Sort by ${label}`}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span>{label}</span>
        <span style={{ fontSize: 10, opacity: active ? 1 : 0.45 }}>
          {direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕"}
        </span>
      </div>
    </th>
  );
}

function Card({ label, value, accent = false, sub = null }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: accent
          ? "1px solid rgba(89, 193, 167, 0.35)"
          : "1px solid rgba(15,23,42,0.10)",
        background: accent
          ? "linear-gradient(180deg, rgba(89,193,167,0.08), rgba(89,193,167,0.03))"
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
        {String(label || "").trim() || "—"}
      </div>

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

      {sub ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            fontWeight: 850,
            color: "rgba(15,23,42,0.62)",
            lineHeight: 1.35,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function Badge({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 999,
        padding: "7px 11px",
        background: "rgba(15,23,42,0.06)",
        display: "flex",
        gap: 8,
        alignItems: "baseline",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(15,23,42,0.65)" }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 950, color: "rgba(15,23,42,0.92)" }}>
        {value}
      </div>
    </div>
  );
}

function FormulaToken({ children, muted = false }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        background: muted ? "rgba(15,23,42,0.04)" : "white",
        border: "1px solid rgba(15,23,42,0.08)",
        fontWeight: 900,
        fontSize: 18,
        color: "rgba(15,23,42,0.92)",
      }}
    >
      {children}
    </div>
  );
}

function FractionBox({ topLabel, bottomLabel, top, bottom }) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "center",
        minWidth: 250,
        borderRadius: 12,
        background: "white",
        border: "1px solid rgba(15,23,42,0.08)",
        overflow: "hidden",
        boxShadow: "0 1px 0 rgba(255,255,255,0.55) inset",
      }}
    >
      <div style={{ padding: "8px 14px 6px", textAlign: "center" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 950,
            color: "rgba(15,23,42,0.52)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {topLabel}
        </div>
        <div style={{ marginTop: 4, fontWeight: 950, fontSize: 16, color: "rgba(15,23,42,0.96)" }}>
          {top}
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(15,23,42,0.12)", margin: "0 10px" }} />

      <div style={{ padding: "8px 14px 10px", textAlign: "center" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 950,
            color: "rgba(15,23,42,0.52)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {bottomLabel}
        </div>
        <div style={{ marginTop: 4, fontWeight: 950, fontSize: 16, color: "rgba(15,23,42,0.96)" }}>
          {bottom}
        </div>
      </div>
    </div>
  );
}

function SourcePill({ value }) {
  if (!value) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        borderRadius: 999,
        background: "rgba(89,193,167,0.10)",
        border: "1px solid rgba(89,193,167,0.30)",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.60)" }}>Source</span>
      <span style={{ fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.96)" }}>{value}</span>
    </div>
  );
}

export default function FundedDrillModal({
  open,
  onClose,
  data,
  rows = [],
  /** CEO toggle: "All" | "New Business" | "Gross Expansion" */
  businessLine = "All",
  contextHelper,
  definitionsSection = "company_totals",
  onOpenDefinitions,
}) {
  const df = data?.df || {};
  const dr = data?.dr || {};
  const co = data?.co || {};

  const fyq = df.fyq ?? dr.fyq ?? "—";
  const bl = ceoBusinessLineDisplayLabel(businessLine);
  const source = df.source ?? "ACV";

  const provided = df.providedFundedPct ?? co.funded ?? null;
  const computed = df.computedFundedPct ?? null;
  const fundedPct = computed ?? provided ?? null;

  const numerator = df.numerator ?? null;
  const denominator = df.denominator ?? null;

  const numeratorCount = df.numeratorAndDenominatorRowCount ?? 0;
  const denominatorOnlyCount = df.denominatorOnlyRowCount ?? 0;
  const numeratorOnlyCount = df.numeratorOnlyRowCount ?? 0;
  const neitherCount = df.neitherRowCount ?? 0;

  const [sortState, setSortState] = useState({
    key: "acvChange",
    direction: "desc",
  });

  const onSort = (key) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "desc" ? "asc" : "desc",
        };
      }
      return { key, direction: "desc" };
    });
  };

  const detailRows = useMemo(() => {
    const baseRows =
      Array.isArray(df.detailRows) && df.detailRows.length
        ? df.detailRows
        : Array.isArray(rows)
          ? rows
          : [];

    if (!baseRows.length) return [];

    return [...baseRows].sort((a, b) =>
      compareValues(a?.[sortState.key], b?.[sortState.key], sortState.direction)
    );
  }, [df.detailRows, rows, sortState]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="% Funded — Drilldown"
      subtitle="Tracks the portion of funded commit that has converted to closed revenue, based on underlying opportunity detail. Percent of funded commit already closed."
      width={1180}
    >
      <DrillModalContextBar
        helperText={contextHelper ?? FUNDED_DRILL_CONTEXT}
        definitionsSection={definitionsSection}
        onOpenDefinitions={onOpenDefinitions}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <SourcePill value={source} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <Card label="Fiscal Year/Quarter" value={fyq} />
        <Card label="Business Line" value={bl} />
        <Card label="% Funded" value={fmtPct(fundedPct)} accent />
      </div>

      <div style={{ height: 12 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <Card label="Closed Won" value={fmtNum(numerator)} />
        <Card label='Funded Commit (Closed Won + "In")' value={fmtNum(denominator)} />
      </div>

      <div style={{ height: 14 }} />

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(15,23,42,0.10)",
          background: "linear-gradient(180deg, rgba(89,193,167,0.08), rgba(241,245,249,0.85))",
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 950, marginBottom: 10, color: "rgba(15,23,42,0.92)" }}>
          % Funded formula
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <FormulaToken muted>% Funded =</FormulaToken>

          <FractionBox
            topLabel="Closed Won"
            bottomLabel='Funded Commit (Closed Won + "In")'
            top={fmtMoneyFull(numerator)}
            bottom={fmtMoneyFull(denominator)}
          />

          <FormulaToken>=</FormulaToken>
          <FormulaToken>{fmtPct(fundedPct)}</FormulaToken>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Badge label="Num + Den" value={numeratorCount} />
          <Badge label="Den Only" value={denominatorOnlyCount} />
          <Badge label="Num Only" value={numeratorOnlyCount} />
          <Badge label="Excluded" value={neitherCount} />
        </div>

        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid rgba(15,23,42,0.10)",
          }}
        >
          <div
            style={{
              color: "rgba(15,23,42,0.82)",
              fontSize: 20,
              lineHeight: 1.5,
              fontWeight: 700,
            }}
          >
            <strong>% Funded =</strong> <strong>Closed Won ACV</strong> /{" "}
            <strong>Funded Commit ACV</strong>
          </div>

          <div
            style={{
              marginTop: 10,
              color: "rgba(15,23,42,0.74)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <strong>Closed Won ACV:</strong> Sum of ACV for rows included in the numerator.
          </div>

          <div
            style={{
              marginTop: 6,
              color: "rgba(15,23,42,0.74)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <strong>Funded Commit ACV:</strong> Sum of ACV for rows included in the denominator,
            which includes <strong>Closed Won</strong> plus open opportunities currently judged{" "}
            <strong>"In"</strong>.
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div
        style={{
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(15,23,42,0.08)",
          background: "rgba(255,255,255,0.78)",
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
          Detail rows used in funded calculation
        </div>

        <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: "rgba(248,250,252,0.98)",
              }}
            >
              <tr>
                <SortableTh label="Opp Name" sortKey="oppName" sortState={sortState} onSort={onSort} />
                <SortableTh label="Owner" sortKey="ownerName" sortState={sortState} onSort={onSort} />
                <SortableTh label="Close Date" sortKey="closeDate" sortState={sortState} onSort={onSort} />
                <SortableTh label="Opp Status" sortKey="oppStatus" sortState={sortState} onSort={onSort} />
                <SortableTh
                  label="Manager Judgment"
                  sortKey="managerJudgment"
                  sortState={sortState}
                  onSort={onSort}
                />
                <SortableTh
                  label="ACV Change"
                  sortKey="acvChange"
                  sortState={sortState}
                  onSort={onSort}
                  align="right"
                />
                <SortableTh
                  label="Funded Bucket"
                  sortKey="fundedBucket"
                  sortState={sortState}
                  onSort={onSort}
                />
                <SortableTh
                  label="Formula Role"
                  sortKey="formulaRole"
                  sortState={sortState}
                  onSort={onSort}
                />
              </tr>
            </thead>

            <tbody>
              {detailRows.length ? (
                detailRows.map((r, idx) => {
                  const oppUrl = buildOpportunityUrl(r?.oppId);

                  return (
                    <tr
                      key={r?._row_id ?? `${r?.oppId || "row"}-${idx}`}
                      style={{ borderTop: "1px solid rgba(15,23,42,0.06)" }}
                    >
                      <td style={styles.tdLabel}>
                        {oppUrl ? (
                          <a
                            href={oppUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: "#1d4ed8",
                              textDecoration: "underline",
                              textUnderlineOffset: 2,
                              fontWeight: 950,
                            }}
                            title="Open opportunity in Salesforce"
                          >
                            {r?.oppName || "—"}
                          </a>
                        ) : (
                          r?.oppName || "—"
                        )}
                      </td>

                      <td style={styles.td}>{r?.ownerName || r?.owner || "—"}</td>
                      <td style={styles.td}>{r?.closeDate || "—"}</td>
                      <td style={styles.td}>{r?.oppStatus || "—"}</td>
                      <td style={styles.td}>{r?.managerJudgment || "—"}</td>

                      <td
                        style={{
                          ...styles.td,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmtMoneyFull(r?.acvChange)}
                      </td>

                      <td style={styles.td}>{r?.fundedBucket || "—"}</td>
                      <td style={styles.td}>{r?.formulaRole || "—"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: 18,
                      fontSize: 13,
                      color: "rgba(15,23,42,0.60)",
                    }}
                  >
                    No funded detail rows available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

const styles = {
  td: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 850,
    color: "rgba(15,23,42,0.84)",
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  tdLabel: {
    padding: "12px",
    fontSize: 13,
    fontWeight: 950,
    color: "rgba(15,23,42,0.92)",
    minWidth: 320,
    verticalAlign: "top",
  },
};