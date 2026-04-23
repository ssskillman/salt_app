// src/components/ui/VelocityDrillModal.jsx

import React, { useMemo, useState } from "react";
import Modal from "./Modal";
import { fmtMoneyCompact, toNumber, ceoBusinessLineDisplayLabel } from "../../utils/formatters.jsx";
import DrillModalContextBar from "./DrillModalContextBar.jsx";

const VELOCITY_DRILL_CONTEXT =
  "Shows how Velocity % is built: closed vs forecast and time through the quarter (and eligibility rules before ~25% of the quarter). Same signal as Company Totals • Velocity.";

function fmtPct(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function fmtInt(v) {
  const n = toNumber(v);
  if (n == null) return "—";
  return String(Math.round(n));
}

function fmtDate(v) {
  if (v == null || v === "") return "—";
  const raw = String(v).trim();
  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) {
    return dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return raw.includes(" ") ? raw.split(" ")[0] : raw;
}

function normalizeRatio(x) {
  const n = toNumber(x);
  if (n == null) return null;
  if (n > 10) return n / 100;
  return n;
}

function safeDivide(numerator, denominator) {
  const n = toNumber(numerator);
  const d = toNumber(denominator);
  if (n == null || d == null || d === 0) return null;
  return n / d;
}

function computeVelocity(bookings, forecast, pctDaysElapsed) {
  const pctForecast = safeDivide(bookings, forecast);
  const pctDays = toNumber(pctDaysElapsed);
  if (pctForecast == null || pctDays == null || pctDays === 0) return null;
  return pctForecast / pctDays;
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

function Card({ label, value }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "white",
        padding: 12,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 0.8, fontWeight: 800, color: "rgba(0,0,0,0.55)" }}>
        {String(label || "").toUpperCase()}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function calloutTone({ eligible }) {
  if (eligible === false) return { bg: "rgba(185, 28, 28, 0.08)", border: "rgba(185, 28, 28, 0.18)" };
  return { bg: "rgba(16, 120, 87, 0.08)", border: "rgba(16, 120, 87, 0.18)" };
}

export default function VelocityDrillModal({
  open,
  onClose,
  data,
  /** CEO toggle: "All" | "New Business" | "Gross Expansion" */
  businessLine = "All",
  contextHelper,
  definitionsSection = "company_totals",
  onOpenDefinitions,
}) {
  const dv = data?.dv || {};
  const dr = data?.dr || {};

  const fyq = dv.fyq ?? dr.fyq ?? "—";
  const bl = ceoBusinessLineDisplayLabel(businessLine);
  const source = dv.source ?? "ACV";

  const asOfDate =
    dv.asOfDate ??
    dv.as_of_date ??
    data?.asOfDate ??
    null;

  const closedAmount = dv.closedAmount ?? null;
  const forecastAmount = dv.commitAmount ?? null;

  const elapsedDays = dv.quarterElapsedDays ?? null;
  const totalDays = dv.quarterTotalDays ?? null;

  const pctDaysElapsed =
    dv.pctDaysElapsed != null
      ? toNumber(dv.pctDaysElapsed)
      : elapsedDays != null && totalDays != null && toNumber(totalDays) !== 0
        ? toNumber(elapsedDays) / toNumber(totalDays)
        : null;

  const eligible =
    dv.isEligible != null
      ? Boolean(toNumber(dv.isEligible))
      : pctDaysElapsed != null
        ? toNumber(pctDaysElapsed) >= 0.25
        : null;

  const ineligibleReason =
    dv.ineligibleReason ?? (eligible === false ? "Available after 25% of quarter elapsed." : null);

  const pctForecastAchieved =
    dv.pctCommitAchieved != null
      ? toNumber(dv.pctCommitAchieved)
      : closedAmount != null && forecastAmount != null && toNumber(forecastAmount) !== 0
        ? toNumber(closedAmount) / toNumber(forecastAmount)
        : null;

  const computedVelocityRatio =
    pctForecastAchieved != null && pctDaysElapsed != null && toNumber(pctDaysElapsed) !== 0
      ? toNumber(pctForecastAchieved) / toNumber(pctDaysElapsed)
      : null;

  const pace = normalizeRatio(dv.providedVelocity) ?? computedVelocityRatio ?? null;

  const velocityScopeNote = dv.velocityScopeNote ?? dv.velocity_scope_note ?? null;

  const tone = calloutTone({ eligible: eligible === null ? true : eligible });

  const eqWrap = {
    background: "linear-gradient(180deg, rgba(89,193,167,0.12), rgba(89,193,167,0.06))",
    border: "1px solid rgba(89,193,167,0.28)",
    borderRadius: 16,
    padding: 14,
  };

  const eqTitle = { fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.72)", marginBottom: 10 };

  const eqRow = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    color: "rgba(15,23,42,0.92)",
  };

  const sym = { fontSize: 20, fontWeight: 1000 };

  const frac = {
    display: "grid",
    gridTemplateRows: "auto 1px auto",
    alignItems: "center",
    justifyItems: "center",
    padding: "6px 10px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(15,23,42,0.08)",
    minWidth: 190,
  };

  const fracTop = { fontSize: 15, fontWeight: 1000 };
  const fracLine = { width: "100%", height: 1, background: "rgba(15,23,42,0.18)" };
  const fracBot = { fontSize: 15, fontWeight: 1000 };

  const defsWrap = {
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid rgba(15,23,42,0.10)",
    display: "grid",
    gap: 6,
  };

  const defsTitle = { fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.72)" };
  const defLine = { fontSize: 12, fontWeight: 850, color: "rgba(15,23,42,0.70)" };

  const mono = {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: 12,
    fontWeight: 950,
    color: "rgba(15,23,42,0.82)",
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(15,23,42,0.10)",
    padding: "2px 6px",
    borderRadius: 8,
  };

  return (
    <Modal open={open} onClose={onClose} title="Velocity — Drilldown" width={980}>
      <DrillModalContextBar
        helperText={contextHelper ?? VELOCITY_DRILL_CONTEXT}
        definitionsSection={definitionsSection}
        onOpenDefinitions={onOpenDefinitions}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <SourcePill value={source} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Card label="Fiscal Year/Quarter" value={fyq} />
        <Card label="Business Line" value={bl} />
        <Card label="As Of Date" value={fmtDate(asOfDate)} />
        <Card label="Eligibility" value={eligible === null ? "—" : eligible ? "Eligible" : "Not eligible"} />
      </div>

      {eligible === false && (
        <div
          style={{
            marginTop: 12,
            borderRadius: 14,
            border: `1px solid ${tone.border}`,
            background: tone.bg,
            padding: 12,
            fontSize: 13,
            fontWeight: 850,
            color: "rgba(15,23,42,0.78)",
          }}
        >
          {ineligibleReason ?? "Not eligible yet."}
        </div>
      )}

      <div style={{ height: 12 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Card label="Closed Won (QTD ACV)" value={fmtMoneyCompact(closedAmount)} />
        <Card label="Forecast (ACV)" value={fmtMoneyCompact(forecastAmount)} />
        <Card label="% Forecast Achieved" value={fmtPct(pctForecastAchieved)} />
      </div>

      <div style={{ height: 12 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Card label="Elapsed Days" value={fmtInt(elapsedDays)} />
        <Card label="Total Days in Quarter" value={fmtInt(totalDays)} />
        <Card label="% Days Elapsed" value={fmtPct(pctDaysElapsed)} />
      </div>

      <div style={{ height: 12 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        <Card label="Velocity Ratio" value={fmtPct(computedVelocityRatio)} />
        <Card label="Pace" value={fmtPct(pace)} />
      </div>

      {!velocityScopeNote && (
        <>
          <div style={{ height: 14 }} />

          <div style={eqWrap}>
            <div style={eqTitle}>Velocity formula</div>

            <div style={eqRow}>
              <span style={{ ...sym, fontSize: 18 }}>1)</span>
              <span style={{ ...sym, fontSize: 18 }}>% Forecast Achieved</span>
              <span style={sym}>=</span>

              <div style={frac} aria-label="Closed over Forecast">
                <div style={fracTop}>{fmtMoneyCompact(closedAmount)}</div>
                <div style={fracLine} />
                <div style={fracBot}>{fmtMoneyCompact(forecastAmount)}</div>
              </div>

              <span style={sym}>=</span>
              <span style={{ fontSize: 18, fontWeight: 1000 }}>{fmtPct(pctForecastAchieved)}</span>
            </div>

            <div style={{ height: 10 }} />

            <div style={eqRow}>
              <span style={{ ...sym, fontSize: 18 }}>2)</span>
              <span style={{ ...sym, fontSize: 18 }}>% Days Elapsed</span>
              <span style={sym}>=</span>

              <div style={frac} aria-label="Elapsed Days over Total Days in Quarter">
                <div style={fracTop}>{fmtInt(elapsedDays)}</div>
                <div style={fracLine} />
                <div style={fracBot}>{fmtInt(totalDays)}</div>
              </div>

              <span style={sym}>=</span>
              <span style={{ fontSize: 18, fontWeight: 1000 }}>{fmtPct(pctDaysElapsed)}</span>
            </div>

            <div style={{ height: 10 }} />

            <div style={eqRow}>
              <span style={{ ...sym, fontSize: 18 }}>3)</span>
              <span style={{ ...sym, fontSize: 18 }}>Velocity Ratio</span>
              <span style={sym}>=</span>

              <div style={frac} aria-label="% Forecast Achieved over % Days Elapsed">
                <div style={fracTop}>{fmtPct(pctForecastAchieved)}</div>
                <div style={fracLine} />
                <div style={fracBot}>{fmtPct(pctDaysElapsed)}</div>
              </div>

              <span style={sym}>=</span>
              <span style={{ fontSize: 18, fontWeight: 1000 }}>{fmtPct(computedVelocityRatio)}</span>
            </div>

            <div style={{ height: 10 }} />

            <div style={eqRow}>
              <span style={{ ...sym, fontSize: 18 }}>4)</span>
              <span style={{ ...sym, fontSize: 18 }}>Velocity</span>
              <span style={sym}>=</span>
              <span style={{ fontSize: 18, fontWeight: 1000 }}>{fmtPct(pace)}</span>
            </div>

            <div style={defsWrap}>
              <div style={defsTitle}>Definitions</div>

              <div style={defLine}>
                <span style={mono}>%ForecastAchieved</span> = <span style={mono}>ClosedAmount</span> /{" "}
                <span style={mono}>ForecastAmount</span>
              </div>

              <div style={defLine}>
                <span style={mono}>%DaysElapsed</span> = <span style={mono}>ElapsedDays</span> /{" "}
                <span style={mono}>TotalDaysInQuarter</span>
              </div>

              <div style={{ ...defLine, marginTop: 8 }}>
                <strong>Forecast Data:</strong> Only available as a combination of <em>New Business + Expansion</em>.
              </div>
              <div style={defLine}>
                <strong>Closed Data:</strong> Available as <em>New Business</em>, <em>Expansion</em>, or combined groupings.
              </div>
            </div>

            <div style={{ height: 10 }} />
            <div style={{ color: "rgba(15,23,42,0.62)", fontSize: 12, fontWeight: 850 }}>
              Notes: Velocity is gated until 25% of quarter days have elapsed (to avoid noisy early-quarter reads).
            </div>
          </div>
        </>
      )}

      <div style={{ height: 14 }} />

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "rgba(241, 245, 249, 0.5)",
          padding: "16px 20px",
          textAlign: "center"
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(15,23,42,0.5)" }}>
          YoY and QoQ comparisons will be available in a future release.
        </div>
      </div>
    </Modal>
  );
}