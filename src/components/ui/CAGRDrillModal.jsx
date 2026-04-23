import React, { useMemo, useEffect, useState } from "react";
import { fmtMoneyCompact, fmtPct1, toNumber, ceoBusinessLineDisplayLabel } from "../../utils/formatters";
import { resolveColumnKey } from "../../utils/data.jsx";
import DrillModalContextBar from "./DrillModalContextBar.jsx";

const CAGR_DRILL_CONTEXT =
  "Inputs behind the Company Totals 2Y CAGR (ACV): beginning vs ending trailing-twelve-month ACV, window length, and optional closed-quarter vs rolling cuts from your drill source.";

/**
 * CAGR = (end / begin)^(1/n) - 1
 * Guard rails:
 * - begin === 0 => undefined
 * - ratio <= 0  => undefined (would be complex)
 */
function computeCagr(begin, end, nYears) {
  const n = Number(nYears);
  const b = Number(begin);
  const e = Number(end);

  if (!Number.isFinite(n) || n <= 0) return { ok: false };
  if (!Number.isFinite(b) || !Number.isFinite(e)) return { ok: false };
  if (b === 0) return { ok: false };

  const ratio = e / b;
  if (!Number.isFinite(ratio) || ratio <= 0) return { ok: false };

  const cagr = Math.pow(ratio, 1 / n) - 1;
  return { ok: Number.isFinite(cagr), ratio, cagr };
}

function fmtDate(d) {
  if (!d || d === "—") return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";

  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Pill({ children, tone = "default" }) {
  const tones = {
    default: {
      background: "rgba(255,255,255,0.78)",
      border: "1px solid rgba(15,23,42,0.10)",
      color: "rgba(15,23,42,0.78)",
    },
    green: {
      background: "rgba(89,193,167,0.16)",
      border: "1px solid rgba(89,193,167,0.34)",
      color: "rgba(15,23,42,0.82)",
    },
  };

  const styleTone = tones[tone] || tones.default;

  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
        ...styleTone,
      }}
    >
      {children}
    </div>
  );
}

function CagrTimelineViz({
  beginFYQ,
  endFYQ,
  beginValue,
  endValue,
  nYears,
  cagr: cagrOverride,
  maxDots = 5,
  showImpliedDots = true,
}) {
  const money = (v) => (Number.isFinite(Number(v)) ? fmtMoneyCompact(Number(v)) : "—");

  const model = useMemo(() => {
    const nRaw = Number(nYears);
    const n = Number.isFinite(nRaw) ? nRaw : null;

    const calc = computeCagr(beginValue, endValue, nRaw);
    const cagr = Number.isFinite(Number(cagrOverride)) ? Number(cagrOverride) : calc.ok ? calc.cagr : null;
    const ratio = calc.ok ? calc.ratio : null;

    const deltaPct =
      Number.isFinite(Number(beginValue)) && Number(beginValue) !== 0 && Number.isFinite(Number(endValue))
        ? (Number(endValue) - Number(beginValue)) / Number(beginValue)
        : null;

    let points = [];
    const nInt = Number.isFinite(nRaw) ? Math.max(0, Math.round(nRaw)) : 0;

    if (showImpliedDots && calc.ok && Number.isFinite(cagr) && nInt >= 2) {
      for (let t = 0; t <= nInt; t += 1) {
        points.push({
          t,
          value: Number(beginValue) * Math.pow(1 + cagr, t),
        });
      }

      if (points.length > maxDots + 2) {
        const keep = new Set([0, points.length - 1]);
        const target = maxDots;
        for (let k = 1; k <= target; k += 1) {
          const idx = Math.round((k * (points.length - 1)) / (target + 1));
          keep.add(idx);
        }
        points = points.filter((_, idx) => keep.has(idx));
      }
    }

    return { n, nInt, ok: calc.ok, cagr, ratio, deltaPct, points };
  }, [beginValue, endValue, nYears, cagrOverride, maxDots, showImpliedDots]);

  const x0 = 10;
  const x1 = 90;
  const y = 18;

  const hasDots = Array.isArray(model.points) && model.points.length >= 3;

  const beginLabel = beginFYQ; // we will pass date instead now
  const endLabel = endFYQ;

  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(89,193,167,0.12), rgba(89,193,167,0.06))",
        border: "1px solid rgba(89,193,167,0.28)",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.72)" }}>
          CAGR window (smoothed growth view)
        </div>
        <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(15,23,42,0.62)" }}>
          {(beginLabel || "Begin Date")} → {(endLabel || "End Date")} {model.n != null ? `(N = ${model.n} years)` : ""}
        </div>
      </div>

      <svg viewBox="0 0 100 34" style={{ width: "100%", height: 110, marginTop: 8 }}>
        <line x1={x0} y1={y} x2={x1} y2={y} stroke="rgba(15,23,42,0.70)" strokeWidth="1.8" />

        <circle cx={x0} cy={y} r="3.2" fill="#59C1A7" />
        <circle cx={x1} cy={y} r="3.2" fill="#59C1A7" />

        <text x={x0} y={7} textAnchor="middle" fontSize="3.2" fill="rgba(15,23,42,0.72)">
          Begin
        </text>
        <text x={x1} y={7} textAnchor="middle" fontSize="3.2" fill="rgba(15,23,42,0.72)">
          End
        </text>

        <text x={x0} y={26} textAnchor="middle" fontSize="3.8" fontWeight="800" fill="rgba(15,23,42,0.88)">
          {money(beginValue)}
        </text>
        <text x={x1} y={26} textAnchor="middle" fontSize="3.8" fontWeight="800" fill="rgba(15,23,42,0.88)">
          {money(endValue)}
        </text>

        <text x={x0} y={31} textAnchor="middle" fontSize="3.0" fill="rgba(15,23,42,0.60)">
          {beginLabel || ""}
        </text>
        <text x={x1} y={31} textAnchor="middle" fontSize="3.0" fill="rgba(15,23,42,0.60)">
          {endLabel || ""}
        </text>

        {hasDots &&
          model.ok &&
          model.points.map((p, i) => {
            if (p.t === 0 || p.t === model.nInt) return null;

            const frac = model.nInt > 0 ? p.t / model.nInt : 0;
            const cx = x0 + (x1 - x0) * frac;

            return (
              <g key={`${p.t}-${i}`}>
                <circle cx={cx} cy={y} r="2.2" fill="white" stroke="rgba(15,23,42,0.70)" strokeWidth="1.2" />
                <text x={cx} y={10} textAnchor="middle" fontSize="3.0" fill="rgba(15,23,42,0.62)">
                  {`Y${p.t}`}
                </text>
                <text x={cx} y={26} textAnchor="middle" fontSize="3.2" fill="rgba(15,23,42,0.78)">
                  {money(p.value)}
                </text>
              </g>
            );
          })}
      </svg>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Pill>
          Growth factor: <span style={{ fontWeight: 1000 }}>{model.ratio != null ? `${model.ratio.toFixed(4)}×` : "—"}</span>
        </Pill>
        <Pill>
          Δ vs begin: <span style={{ fontWeight: 1000 }}>{model.deltaPct != null ? fmtPct1(model.deltaPct) : "—"}</span>
        </Pill>
        <Pill>
          CAGR: <span style={{ fontWeight: 1000 }}>{model.cagr != null ? fmtPct1(model.cagr) : "—"}</span>
        </Pill>
        {showImpliedDots && (
          <Pill>
            Implied path: <span style={{ fontWeight: 1000 }}>{model.ok ? "constant-rate" : "n/a"}</span>
          </Pill>
        )}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          fontWeight: 850,
          color: "rgba(15,23,42,0.62)",
          display: "grid",
          gap: 6,
        }}
      >
        {hasDots && (
          <>
            <div>Dots show the implied constant-rate path between Begin and End.</div>
            <div>This is a hypothetical CAGR path, not the actual quarter-by-quarter trajectory.</div>

            <div
              style={{
                marginTop: 4,
                paddingTop: 6,
                borderTop: "1px solid rgba(15,23,42,0.08)",
                display: "grid",
                gap: 4,
              }}
            >
              <div><strong>Constant-rate (shown):</strong> smooth CAGR path; standard finance convention.</div>
              <div><strong>Actual path (not shown):</strong> real daily movement; usually lumpier and more volatile.</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CAGRDrillModal({
  open,
  onClose,
  title = "2Y CAGR (ACV) — Drilldown",
  rows = [],
  columns = [],
  config,
  /** CEO toggle: "All" | "New Business" | "Gross Expansion" */
  businessLine = "All",
  fallback = {
    fyq: null,
    businessLine: null,
    nYears: 2,
    cagrNotes: null,
    beginDate: null,
    endDate: null,
    beginFyq: null,
    endFyq: null,
    beginningTtmAcv: null,
    endingTtmAcv: null,
    cagrRate: null,
  },
  contextHelper,
  definitionsSection = "company_totals",
  onOpenDefinitions,
}) {
  const [isVisible, setIsVisible] = useState(open);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsClosing(false);
      return;
    }

    if (isVisible) {
      setIsClosing(true);
      const t = setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
      }, 180);
      return () => clearTimeout(t);
    }
  }, [open, isVisible]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const model = useMemo(() => {
    const norm = (s) => String(s ?? "").trim().toLowerCase();

    const findColIdByNames = (cols, names = []) => {
      if (!Array.isArray(cols) || cols.length === 0) return null;
      const targets = names.map(norm);
      const hit = cols.find((c) => targets.includes(norm(c?.name)));
      return hit?.id ?? null;
    };

    const firstNonEmpty = (arr, key) => {
      if (!key || !Array.isArray(arr) || arr.length === 0) return null;
      for (const r of arr) {
        const v = r?.[key];
        if (v != null && String(v).trim() !== "") return v;
      }
      return null;
    };

    const fyqKey =
      resolveColumnKey(config?.dr_fiscal_yearquarter) ||
      findColIdByNames(columns, [
        "selected_fyq",
        "fiscal_yearquarter",
        "fiscal yearquarter",
        "fiscal year quarter",
        "fyq",
      ]);

    const businessLineKey =
      resolveColumnKey(config?.dr_business_line) ||
      findColIdByNames(columns, ["business_line", "business line", "bl"]);

    const notesKey =
      resolveColumnKey(config?.dr_cagr_notes) ||
      findColIdByNames(columns, ["cagr_notes", "cagr notes"]);

    const beginDateKey =
      resolveColumnKey(config?.dr_beginning_date) ||
      findColIdByNames(columns, ["beginning_date", "beginning date"]);

    const endDateKey =
      resolveColumnKey(config?.dr_ending_date) ||
      findColIdByNames(columns, ["ending_date", "ending date"]);

    const beginFyqKey =
      findColIdByNames(columns, ["beginning_fyq_mapped", "beginning fyq mapped"]) ||
      resolveColumnKey(config?.dr_closed_qtr_cagr_beginning_fiscal_yearquarter_2y) ||
      findColIdByNames(columns, [
        "closed_qtr_cagr_beginning_fiscal_yearquarter_2y",
        "closed qtr cagr beginning fiscal yearquarter 2y",
      ]);

    const endFyqKey =
      findColIdByNames(columns, ["ending_fyq_mapped", "ending fyq mapped"]) ||
      resolveColumnKey(config?.dr_closed_qtr_cagr_ending_fiscal_yearquarter) ||
      findColIdByNames(columns, [
        "closed_qtr_cagr_ending_fiscal_yearquarter",
        "closed qtr cagr ending fiscal yearquarter",
      ]);

    const beginTtmKey =
      findColIdByNames(columns, ["beginning_ttm_acv", "beginning ttm acv"]) ||
      resolveColumnKey(config?.dr_closed_qtr_total_acv_cagr_beginning_ttm_2y) ||
      findColIdByNames(columns, [
        "closed_qtr_total_acv_cagr_beginning_ttm_2y",
        "closed qtr total acv cagr beginning ttm 2y",
      ]);

    const endTtmKey =
      findColIdByNames(columns, ["ending_ttm_acv", "ending ttm acv"]) ||
      resolveColumnKey(config?.dr_closed_qtr_total_acv_cagr_ending_ttm) ||
      findColIdByNames(columns, [
        "closed_qtr_total_acv_cagr_ending_ttm",
        "closed qtr total acv cagr ending ttm",
      ]);

    const cagrRateKey =
      findColIdByNames(columns, ["two_year_cagr_rate", "two year cagr rate"]) ||
      resolveColumnKey(config?.dr_closed_qtr_total_acv_cagr_2y_rate) ||
      findColIdByNames(columns, [
        "closed_qtr_total_acv_cagr_2y_rate",
        "closed qtr total acv cagr 2y rate",
      ]);

    const fyq = (fyqKey ? firstNonEmpty(rows, fyqKey) : null) ?? fallback.fyq ?? "—";
    const businessLine = (businessLineKey ? firstNonEmpty(rows, businessLineKey) : null) ?? fallback.businessLine ?? "—";
    const cagrNotes = (notesKey ? firstNonEmpty(rows, notesKey) : null) ?? fallback.cagrNotes ?? "";

    const beginDate = (beginDateKey ? firstNonEmpty(rows, beginDateKey) : null) ?? fallback.beginDate ?? "—";
    const endDate = (endDateKey ? firstNonEmpty(rows, endDateKey) : null) ?? fallback.endDate ?? "—";

    const beginFyq = (beginFyqKey ? firstNonEmpty(rows, beginFyqKey) : null) ?? fallback.beginFyq ?? "—";
    const endFyq = (endFyqKey ? firstNonEmpty(rows, endFyqKey) : null) ?? fallback.endFyq ?? "—";

    const beginningTtmAcv =
      toNumber(beginTtmKey ? firstNonEmpty(rows, beginTtmKey) : null) ??
      toNumber(fallback.beginningTtmAcv) ??
      null;

    const endingTtmAcv =
      toNumber(endTtmKey ? firstNonEmpty(rows, endTtmKey) : null) ??
      toNumber(fallback.endingTtmAcv) ??
      null;

    const mappedCagrRate =
      toNumber(cagrRateKey ? firstNonEmpty(rows, cagrRateKey) : null) ??
      toNumber(fallback.cagrRate) ??
      null;

    const nYears = toNumber(fallback.nYears) ?? 2;
    const calc = computeCagr(beginningTtmAcv, endingTtmAcv, nYears);

    return {
      fyq,
      businessLine,
      cagrNotes,
      beginDate,
      endDate,
      beginFyq,
      endFyq,
      beginningTtmAcv,
      endingTtmAcv,
      nYears,
      mappedCagrRate,
      computedCagrRate: calc.ok ? calc.cagr : null,
      ratio: calc.ok ? calc.ratio : null,
      deltaPct:
        Number.isFinite(beginningTtmAcv) && beginningTtmAcv !== 0 && Number.isFinite(endingTtmAcv)
          ? (endingTtmAcv - beginningTtmAcv) / beginningTtmAcv
          : null,
      hasInputs:
        Number.isFinite(beginningTtmAcv) &&
        Number.isFinite(endingTtmAcv) &&
        Number.isFinite(nYears),
    };
  }, [rows, columns, config, fallback]);

  if (!isVisible) return null;

  const isOpen = open && !isClosing;

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.38)",
    display: "grid",
    placeItems: "center",
    zIndex: 9999,
    padding: 18,
    opacity: isOpen ? 1 : 0,
    pointerEvents: isOpen ? "auto" : "none",
    transition: "opacity 180ms ease",
  };

  const card = {
    width: "min(1120px, 96vw)",
    maxHeight: "min(1000px, 92vh)",
    overflow: "auto",
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 18,
    boxShadow: "0 24px 60px rgba(0,0,0,0.20)",
    backdropFilter: "blur(14px)",
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? "translateY(0) scale(1)" : "translateY(8px) scale(0.985)",
    transition: "opacity 180ms ease, transform 180ms cubic-bezier(0.2,0.8,0.2,1)",
  };

  const header = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: "16px 16px 10px 16px",
    borderBottom: "1px solid rgba(15,23,42,0.08)",
  };

  const hTitle = { fontSize: 16, fontWeight: 950, color: "rgba(15,23,42,0.92)" };
  const hSub = { fontSize: 12, fontWeight: 850, color: "rgba(15,23,42,0.62)", marginTop: 4 };

  const closeBtn = {
    appearance: "none",
    border: "1px solid rgba(15,23,42,0.14)",
    background: "white",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 950,
    color: "rgba(15,23,42,0.82)",
  };

  const body = { padding: 16, display: "flex", flexDirection: "column", gap: 14 };

  const grid3 = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  };

  const grid4 = {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  };

  const tile = {
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 14,
    padding: 11,
    boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
    minHeight: 62,
  };

  const tLabel = {
    fontSize: 10.5,
    fontWeight: 950,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "rgba(15,23,42,0.48)",
  };

  const tValue = {
    marginTop: 6,
    fontSize: 16,
    fontWeight: 950,
    color: "rgba(15,23,42,0.92)",
    lineHeight: 1.2,
  };

  const tSub = { marginTop: 6, fontSize: 12, fontWeight: 900, color: "rgba(15,23,42,0.62)" };

  const sectionWrap = {
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 14,
    padding: 12,
    boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
  };

  const sectionTitle = {
    fontSize: 12,
    fontWeight: 950,
    color: "rgba(15,23,42,0.72)",
    marginBottom: 10,
  };

  const eqWrap = {
    background: "linear-gradient(180deg, rgba(89,193,167,0.12), rgba(89,193,167,0.06))",
    border: "1px solid rgba(89,193,167,0.28)",
    borderRadius: 16,
    padding: 16,
  };

  const eqTitle = { fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.72)", marginBottom: 14 };

  const eqRow = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    color: "rgba(15,23,42,0.92)",
  };

  const sym = { fontSize: 34, fontWeight: 1000, lineHeight: 1 };
  const frac = {
    display: "grid",
    gridTemplateRows: "auto 1px auto",
    alignItems: "center",
    justifyItems: "center",
    padding: "6px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.78)",
    border: "1px solid rgba(15,23,42,0.08)",
    minWidth: 136,
  };

  const fracTop = { fontSize: 24, fontWeight: 1000, lineHeight: 1.2 };
  const fracLine = { width: "100%", height: 1, background: "rgba(15,23,42,0.18)" };
  const fracBot = { fontSize: 24, fontWeight: 1000, lineHeight: 1.2 };
  const pow = { fontSize: 18, fontWeight: 950, opacity: 0.9 };

  const miniRow = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 };

  const noteWrap = {
    background: "rgba(248,250,252,0.92)",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 14,
    padding: 12,
  };

  const beginStr = Number.isFinite(model.beginningTtmAcv) ? fmtMoneyCompact(model.beginningTtmAcv) : "—";
  const endStr = Number.isFinite(model.endingTtmAcv) ? fmtMoneyCompact(model.endingTtmAcv) : "—";

  return (
    <div style={overlay} onMouseDown={(e) => (e.target === e.currentTarget ? onClose?.() : null)}>
      <div style={card}>
        <div style={header}>
          <div>
            <div style={hTitle}>{title}</div>
            <div style={hSub}>Simplified 2-year CAGR drilldown using beginning and ending TTM ACV.</div>
          </div>

          <button style={closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={body}>
          <DrillModalContextBar
            helperText={contextHelper ?? CAGR_DRILL_CONTEXT}
            definitionsSection={definitionsSection}
            onOpenDefinitions={onOpenDefinitions}
          />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill tone="green">
                Selected FYQ: <span style={{ fontWeight: 1000 }}>{model.fyq || "—"}</span>
              </Pill>
              <Pill>
                Business Line:{" "}
                <span style={{ fontWeight: 1000 }}>{ceoBusinessLineDisplayLabel(businessLine)}</span>
              </Pill>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill tone="green">
                Revenue Source: <span style={{ fontWeight: 1000 }}>ACV</span>
              </Pill>

              <Pill>
                2Y CAGR:{" "}
                <span style={{ fontWeight: 1000 }}>
                  {model.mappedCagrRate == null ? "—" : fmtPct1(model.mappedCagrRate)}
                </span>
              </Pill>
            </div>
          </div>

          <div style={grid3}>
            <div style={tile}>
              <div style={tLabel}>Selected FYQ</div>
              <div style={tValue}>{model.fyq}</div>
            </div>

            <div style={tile}>
              <div style={tLabel}>Beginning Date</div>
              <div style={tValue}>{fmtDate(model.beginDate) || "—"}</div>
            </div>

            <div style={tile}>
              <div style={tLabel}>Ending Date</div>
              <div style={tValue}>{fmtDate(model.endDate) || "—"}</div>
            </div>
          </div>

          <div style={grid3}>
            <div style={tile}>
              <div style={tLabel}>Beginning TTM ACV</div>
              <div style={tValue}>{beginStr}</div>
              <div style={tSub}>{fmtDate(model.beginDate) || "—"}</div>
            </div>

            <div style={tile}>
              <div style={tLabel}>Ending TTM ACV</div>
              <div style={tValue}>{endStr}</div>
              <div style={tSub}>{fmtDate(model.endDate) || "—"}</div>
            </div>

            <div style={tile}>
              <div style={tLabel}>CAGR</div>
              <div style={tValue}>{model.mappedCagrRate == null ? "—" : fmtPct1(model.mappedCagrRate)}</div>
              <div style={tSub}>N = {model.nYears} years</div>
            </div>
          </div>

          <CagrTimelineViz
            beginFYQ={fmtDate(model.beginDate)}
            endFYQ={fmtDate(model.endDate)}
            beginValue={model.beginningTtmAcv}
            endValue={model.endingTtmAcv}
            nYears={model.nYears}
            cagr={model.mappedCagrRate ?? model.computedCagrRate}
            showImpliedDots
            maxDots={5}
          />

          <div style={eqWrap}>
            <div style={eqTitle}>2Y CAGR formula</div>

            <div style={eqRow}>
              <span style={sym}>CAGR</span>
              <span style={sym}>=</span>
              <span style={sym}>(</span>

              <div style={frac} aria-label="Ending over Beginning">
                <div style={fracTop}>{endStr}</div>
                <div style={fracLine} />
                <div style={fracBot}>{beginStr}</div>
              </div>

              <span style={sym}>)</span>

              <span style={pow}>
                <sup>1/{model.nYears}</sup>
              </span>

              <span style={sym}>− 1</span>
            </div>

            <div style={miniRow}>
              <Pill>
                Ratio (Ending/Beginning):{" "}
                <span style={{ fontWeight: 1000 }}>{model.ratio == null ? "—" : model.ratio.toFixed(4)}</span>
              </Pill>

              <Pill>
                Δ vs Beginning:{" "}
                <span style={{ fontWeight: 1000 }}>{model.deltaPct == null ? "—" : fmtPct1(model.deltaPct)}</span>
              </Pill>

              <Pill>
                Computed CAGR:{" "}
                <span style={{ fontWeight: 1000 }}>
                  {model.computedCagrRate == null ? "—" : fmtPct1(model.computedCagrRate)}
                </span>
              </Pill>

              <Pill>
                Mapped CAGR:{" "}
                <span style={{ fontWeight: 1000 }}>
                  {model.mappedCagrRate == null ? "—" : fmtPct1(model.mappedCagrRate)}
                </span>
              </Pill>
            </div>

            {!model.hasInputs && (
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 850, color: "rgba(15,23,42,0.65)" }}>
                To fully populate this drilldown, pass Beginning TTM ACV, Ending TTM ACV, and 2Y CAGR Rate.
              </div>
            )}
          </div>

          <div style={noteWrap}>
            <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.72)", marginBottom: 6 }}>
              Notes
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, fontWeight: 850, color: "rgba(15,23,42,0.72)" }}>
              {model.cagrNotes || "2-year CAGR based on Beginning TTM ACV and Ending TTM ACV for the mapped FYQ window."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}