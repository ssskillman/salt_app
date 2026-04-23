// src/App.jsx
import React, { useState, useMemo, useEffect, useRef } from "react";

// Hooks
import { useSigmaData } from "./hooks/useSigmaData";

// Formatter Utils
import { fmtMoneyCompact, fmtPct1, fmtX, toNumber } from "./utils/formatters.jsx";
import { resolveColumnKey } from "./utils/data.jsx";

// Components
import Surface from "./components/ui/Surface";
import SurfaceHeader from "./components/ui/SurfaceHeader";
import MetricCard from "./components/ui/MetricCard";
import HorsemanSection from "./components/Horseman/HorsemanSection";
import DefinitionsDrawer from "./components/DefinitionsDrawer";
import IconButton from "./components/ui/IconButton";
import WaterfallChart from "./components/charts/WaterfallChart";
import DrillDownModal from "./components/ui/DrillDownModal";
import OpenPipelineDrillModal from "./components/ui/OpenPipelineDrillModal";

// Closed Trend chart + toggle
import ClosedTrendChart from "./components/charts/ClosedTrendChart";
import SegToggle from "./components/ui/SegToggle";

// AE Drill-through modal
import AEPerformanceDrillModal from "./components/ui/AEPerformanceDrillModal";

// CFO Treemap Section
import CFOTreemapSection from "./components/charts/cfo/CFOTreemapSection";

// CFO Treemap Drill Modal
import CFOTreemapDrillModal from "./components/ui/CFOTreemapDrillModal";

// PG pacing modal
import PGPacingModal from "./components/ui/PGPacingModal";

// CAGR modal
import CAGRDrillModal from "./components/ui/CAGRDrillModal";

// Velocity modal
import VelocityDrillModal from "./components/ui/VelocityDrillModal";

// Plan Attainment modal
import PlanAttainmentDrillModal from "./components/ui/PlanAttainmentDrillModal";

// Funded modal
import FundedDrillModal from "./components/ui/FundedDrillModal";

// Large Deals modal
import LargeDealsDrillModal from "./components/ui/LargeDealsDrillModal";

// Debug Console Modal
import DebugConsoleModal from "./components/DebugConsoleModal";

// Create & Close Modal
import CreateCloseDrillModal from "./components/ui/CreateCloseDrillModal";

// Persona Placeholders
import CMOScorecardPlaceholder from "./components/cmo/CMOScorecardPlaceholder";
import CPOScorecardPlaceholder from "./components/cpo/CPOScorecardPlaceholder";
import CPCOScorecardPlaceholder from "./components/cpco/CPCOScorecardPlaceholder";

// CRO Tree
import RevintelTreeSection from "./components/cro/RevintelTreeSection.jsx";

// CEO Field Scope
import FieldScopeSelector from "./components/ceo/FieldScopeSelector.jsx";

import { buildRevintelTree } from "./components/cro/buildRevintelTree.jsx";

import RollupTabs from "./components/ui/RollupTabs.jsx";

// Forecast Attainment Modal
import ForecastAttainmentDrillModal from "./components/ui/ForecastAttainmentDrillModal.jsx";

// Exec Insights
import ExecutiveInsightPopover from "./components/ui/ExecutiveInsightPopover.jsx";
import useDerivedMetrics from "./hooks/useDerivedMetrics";
import useExecutiveInsights from "./hooks/useExecutiveInsights";

// Debug Details
import {
  debugLog,
  debugWarn,
  debugError,
  getDebugLogs,
  clearDebugLogs,
  isDebugEnabled,
  setDebugEnabled,
} from "./utils/debug.js";


const ArchitectureMapV2 = React.lazy(() =>
  import("./components/architecture/ArchitectureMapV2")
);


// -----------------------------
// helpers (local to App)
// -----------------------------
function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function findColIdByName(cols, name) {
  if (!Array.isArray(cols) || !name) return null;
  const target = norm(name);
  const hit = cols.find((c) => norm(c?.name) === target);
  return hit?.id ?? null;
}

function firstNonEmpty(rowsArr, key) {
  if (!key || !Array.isArray(rowsArr) || !rowsArr.length) return null;
  for (const r of rowsArr) {
    const v = r?.[key];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}

function parseSortValue(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;

  // Date-ish strings (e.g., 2025-11-01 00:00:00 or ISO)
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return t;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function safeDivide(numerator, denominator, fallback = null) {
  const n = toNumber(numerator);
  const d = toNumber(denominator);
  if (n == null || d == null || d === 0) return fallback;
  return n / d;
}

function safeSubtract(a, b, fallback = null) {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na == null || nb == null) return fallback;
  return na - nb;
}

function findRowKeyByCandidates(rowsArr, candidates = []) {
  if (!Array.isArray(rowsArr) || rowsArr.length === 0 || !Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  
  const row0 = rowsArr[0] || {};
  const rowKeys = Object.keys(row0);

  for (const candidate of candidates) {
    const target = norm(candidate);

    const exact = rowKeys.find((k) => norm(k) === target);
    if (exact) return exact;

    const suffix = rowKeys.find((k) => norm(k).endsWith(`/${target}`));
    if (suffix) return suffix;
  }

  return null;
}

function daysUntilDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function normalizeReviewText(text) {
  return String(text ?? "").trim().toLowerCase();
}

function getHealthBucketFromReview(text) {
  const s = normalizeReviewText(text);
  if (!s) return "unknown";
  if (s.includes("healthy")) return "healthy";
  if (s.includes("needs attention")) return "needs_attention";
  if (s.includes("at risk")) return "at_risk";
  return "unknown";
}

function getCurrentQuarterDateRange() {
  const now = new Date();
  const month = now.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  const start = new Date(now.getFullYear(), quarterStartMonth, 1);
  const end = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
  return { start, end };
}

function isWithinCurrentQuarter(value) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const { start, end } = getCurrentQuarterDateRange();
  return d >= start && d <= end;
}

function isInLastTwoWeeksOfQuarter(value) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const { end } = getCurrentQuarterDateRange();
  const diff = Math.round((end.getTime() - d.getTime()) / 86400000);
  return diff >= 0 && diff <= 14;
}

function formatPct0(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}


function getPathFromRevintelRow(row) {
  return [row?.lvl0, row?.lvl1, row?.lvl2, row?.lvl3, row?.lvl4]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(" > ");
}

function BusinessLineHeaderPill({ businessLine }) {
  if (!businessLine || businessLine === "All") return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.58)",
        border: "1px solid rgba(15,23,42,0.10)",
        color: "rgba(15,23,42,0.84)",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
      title={`Business Line: ${businessLine}`}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "#3B82F6",
          flexShrink: 0,
        }}
      />
      <span>{businessLine}</span>
    </div>
  );
}

function ScopeHeaderPill({ label }) {
  if (!label) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        borderRadius: 999,
        background: "rgba(89,193,167,0.14)",
        border: "1px solid rgba(89,193,167,0.30)",
        color: "rgba(15,23,42,0.90)",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
        maxWidth: 280,
      }}
      title={label}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "#59C1A7",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function MiniAcvPill() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2px 6px",
        borderRadius: 999,
        background: "rgba(89,193,167,0.14)",
        border: "1px solid rgba(89,193,167,0.30)",
        color: "rgba(15,23,42,0.88)",
        fontSize: 11,
        fontWeight: 950,
        letterSpacing: 0.3,
        textTransform: "uppercase",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}
    >
      ACV
    </div>
  );
}

function buildFieldScopeBridge(revintelRows, selectedPath) {
  if (!selectedPath || !Array.isArray(revintelRows) || revintelRows.length === 0) {
    return {
      selectedPath: null,
      selectedLabel: "Global",
      paths: new Set(),
      userNames: new Set(),
      territoryNames: new Set(),
      isGlobal: true,
    };
  }

  const paths = new Set();
  const userNames = new Set();
  const territoryNames = new Set();
  let selectedLabel = selectedPath;

  for (const row of revintelRows) {
    const path = getPathFromRevintelRow(row);
    if (!path) continue;

    if (path === selectedPath || path.startsWith(`${selectedPath} > `)) {
      paths.add(path);

      const userName = String(row?.user_name ?? "").trim();
      const territoryName = String(row?.territory_name ?? "").trim();
      const nodeLabel = String(row?.node_label ?? "").trim();

      if (userName) userNames.add(userName.toLowerCase());
      if (territoryName) territoryNames.add(territoryName.toLowerCase());

      if (path === selectedPath) {
        selectedLabel = userName || nodeLabel || territoryName || selectedPath;
      }
    }
  }

  return {
    selectedPath,
    selectedLabel,
    paths,
    userNames,
    territoryNames,
    isGlobal: false,
  };
}

function filterRowsByScope(rowsArr, bridge, options = {}) {
  const {
    ownerKey = null,
    territoryKey = null,
    fallbackToAll = true,
  } = options;

  if (!Array.isArray(rowsArr)) return [];
  if (!bridge || bridge.isGlobal) return rowsArr;

  const hasOwner = !!ownerKey;
  const hasTerritory = !!territoryKey;

  if (!hasOwner && !hasTerritory) {
    return fallbackToAll ? rowsArr : [];
  }

  return rowsArr.filter((row) => {
    const owner = hasOwner ? String(row?.[ownerKey] ?? "").trim().toLowerCase() : "";
    const territory = hasTerritory ? String(row?.[territoryKey] ?? "").trim().toLowerCase() : "";

    const ownerMatch = owner && bridge.userNames.has(owner);
    const territoryMatch = territory && bridge.territoryNames.has(territory);

    return ownerMatch || territoryMatch;
  });
}

function filterRowsByBusinessLine(rowsArr, businessLine, key) {
  if (!Array.isArray(rowsArr)) return [];
  if (!businessLine || businessLine === "All") return rowsArr;
  if (!key) return rowsArr;

  return rowsArr.filter((row) => {
    const val = String(row?.[key] ?? "").trim();
    return val === businessLine;
  });
}

/**
 * "Data as of" pill lives in the GLOBAL header (next to Definitions)
 * so it never overlaps card content and feels consistent across the app.
 */
function AsOfPill({ text = "Data as of 28Feb26" }) {
  return (
    <>
      <style>{`
        @keyframes saltPulse {
          0%, 100% { transform: translateZ(0) scale(1); box-shadow: 0 10px 22px rgba(0,0,0,0.08); }
          50%      { transform: translateZ(0) scale(1.03); box-shadow: 0 14px 30px rgba(0,0,0,0.12); }
        }
      `}</style>

      <div
        style={{
          padding: "8px 10px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.78)",
          border: "1px solid rgba(15, 23, 42, 0.12)",
          backdropFilter: "blur(10px)",
          fontSize: 12,
          fontWeight: 950,
          color: "rgba(15, 23, 42, 0.78)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          whiteSpace: "nowrap",
        }}
        title="Snapshot date"
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "rgba(59, 130, 246, 0.95)",
            boxShadow: "0 0 0 3px rgba(59,130,246,0.18)",
          }}
        />
        {text}
      </div>
    </>
  );
}

function InDevelopmentBanner({
  label = "In Development",
  text = "Early preview. Layout and visuals are available while requirements and definitions are being finalized.",
}) {
  return (
    <div
      style={{
        marginTop: 14,
        marginBottom: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "12px 14px",
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(255,255,255,0.84) 0%, rgba(255,255,255,0.70) 100%)",
        border: "1px solid rgba(15, 23, 42, 0.10)",
        boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(15, 23, 42, 0.06)",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            fontSize: 11,
            fontWeight: 1000,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: "rgba(15, 23, 42, 0.82)",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 850,
            color: "rgba(15, 23, 42, 0.70)",
            lineHeight: 1.35,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;

    const update = () => setPrefersReduced(Boolean(mq.matches));
    update();

    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }

    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  return prefersReduced;
}

function SaltRescueModal({ open, onClose }) {
  const handleCopy = async () => {
    const text = `localStorage.clear();
sessionStorage.clear();`;

    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      debugError("Failed to copy Salt rescue commands:", err);
    }
  };

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes saltRescueFadeIn {
          0% { opacity: 0; transform: translateY(8px) scale(0.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="salt-rescue-title"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10001,
          background: "rgba(15, 23, 42, 0.42)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            width: "min(760px, 100%)",
            maxHeight: "90vh",
            overflowY: "auto",
            borderRadius: 22,
            background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
            border: "1px solid rgba(15, 23, 42, 0.10)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.28)",
            padding: 22,
            animation: "saltRescueFadeIn 180ms ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(15, 23, 42, 0.06)",
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  fontSize: 11,
                  fontWeight: 1000,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  color: "rgba(15, 23, 42, 0.75)",
                }}
              >
                🧂 Easter Egg
              </div>

              <h2
                id="salt-rescue-title"
                style={{
                  margin: "12px 0 6px",
                  fontSize: 28,
                  lineHeight: 1.1,
                  fontWeight: 1000,
                  color: "rgba(15, 23, 42, 0.96)",
                }}
              >
                Salt taking too long to load?
              </h2>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "rgba(15, 23, 42, 0.72)",
                  maxWidth: 620,
                }}
              >
                If Salt is not loading in a timely manner, this may be a browser session issue such as a{" "}
                <strong>414 URI Too Long</strong> / oversized URL state problem.
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close Salt rescue dialog"
              style={{
                appearance: "none",
                border: "1px solid rgba(15, 23, 42, 0.10)",
                background: "rgba(255,255,255,0.85)",
                color: "rgba(15, 23, 42, 0.72)",
                borderRadius: 12,
                width: 38,
                height: 38,
                fontSize: 22,
                fontWeight: 900,
                cursor: "pointer",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                padding: 0,
              }}
              title="Close"
            >
              <span
                style={{
                  display: "block",
                  transform: "translateY(-1px)",
                }}
              >
                ×
              </span>
            </button>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: "14px 16px",
              borderRadius: 16,
              background: "rgba(245, 247, 250, 0.95)",
              border: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 950, color: "rgba(15, 23, 42, 0.88)", marginBottom: 8 }}>
              What to do
            </div>

            <ol
              style={{
                margin: 0,
                paddingLeft: 20,
                color: "rgba(15, 23, 42, 0.80)",
                fontSize: 14,
                lineHeight: 1.65,
              }}
            >
              <li>
                Open Chrome DevTools: <code style={stylesInline.code}>Cmd + Option + I</code>
              </li>
              <li>Go to the <strong>Console</strong> tab</li>
              <li>
                Use the <strong>bottom command prompt</strong>, not the top filter/search bar
              </li>
              <li>Run these commands:</li>
            </ol>

            <div
              style={{
                marginTop: 12,
                borderRadius: 14,
                background: "#0f172a",
                color: "#e2e8f0",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "14px 16px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 13,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
{`localStorage.clear();
sessionStorage.clear();`}
            </div>

            <ol
              start={5}
              style={{
                margin: "12px 0 0",
                paddingLeft: 20,
                color: "rgba(15, 23, 42, 0.80)",
                fontSize: 14,
                lineHeight: 1.65,
              }}
            >
              <li>
                Hard refresh the page: <code style={stylesInline.code}>Cmd + Shift + R</code>
              </li>
              <li>If needed, close the tab and reopen Salt</li>
            </ol>
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              color: "rgba(15, 23, 42, 0.72)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <strong>Shortcut:</strong> open this help anytime with{" "}
            <code style={stylesInline.code}>Cmd/Ctrl + Shift + S</code>.
            <br />
            <strong>Note:</strong> Salt cannot read Chrome DevTools console output directly. This help is shown
            because loading may be unusually slow, not because the console was definitively inspected.
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={handleCopy}
              style={{
                appearance: "none",
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "white",
                color: "rgba(15, 23, 42, 0.88)",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Copy commands
            </button>

            <button
              onClick={onClose}
              style={{
                appearance: "none",
                border: "none",
                background: "rgba(15, 23, 42, 0.92)",
                color: "white",
                borderRadius: 12,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 950,
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const stylesInline = {
  code: {
    padding: "2px 6px",
    borderRadius: 8,
    background: "rgba(15, 23, 42, 0.06)",
    border: "1px solid rgba(15, 23, 42, 0.08)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.95em",
  },
};

const overlayStyles = {
  position: "fixed",
  inset: 0,
  background: "rgba(10, 14, 20, 0.92)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(6px)",
};

const closeButtonStyles = {
  position: "absolute",
  top: 20,
  right: 24,
  background: "rgba(255,255,255,0.08)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 8,
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 16,
};

function BusinessLineToggle({ value, onChange }) {
  const options = [
    { label: "All", value: "All" },
    { label: "New Biz", value: "New Business" },
    { label: "Expansion", value: "Gross Expansion" },
  ];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: "rgba(255,255,255,0.16)",
        border: "1px solid rgba(255,255,255,0.22)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
        flexWrap: "nowrap",
      }}
    >
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            title={option.value}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 950,
              letterSpacing: 0.2,
              whiteSpace: "nowrap",
              transition: "all 160ms ease",
              background: selected ? "rgba(255,255,255,0.96)" : "transparent",
              color: selected ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.94)",
              boxShadow: selected ? "0 2px 8px rgba(0,0,0,0.10)" : "none",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function App() {

  const goToPrevFieldExecutionInsight = () => {
    if (!fieldExecutionInsightItems.length) return;
    setFieldExecutionInsightIndex((prev) =>
      (prev - 1 + fieldExecutionInsightItems.length) % fieldExecutionInsightItems.length
    );
  };

  const goToNextFieldExecutionInsight = () => {
    if (!fieldExecutionInsightItems.length) return;
    setFieldExecutionInsightIndex((prev) =>
      (prev + 1) % fieldExecutionInsightItems.length
    );
  };

  const jumpToFieldExecutionInsight = (index) => {
    setFieldExecutionInsightIndex(index);
  };

  const [debugLogs, setDebugLogs] = useState(() => getDebugLogs());
  const [debugLoggingEnabled, setDebugLoggingEnabled] = useState(() => isDebugEnabled());

  const [executiveInsightIndex, setExecutiveInsightIndex] = useState(0);
  const [executiveInsightPaused, setExecutiveInsightPaused] = useState(false);
  const [executiveInsightProgress, setExecutiveInsightProgress] = useState(0);

  const [showArchitecture, setShowArchitecture] = useState(false);

  const [showForecastAttainmentModal, setShowForecastAttainmentModal] = useState(false);

  const [cpoSelectedAccount, setCpoSelectedAccount] = useState(null);

  const { data, rows, columns, isLoading, config, debugInfo } = useSigmaData({
    cpoAccountId: cpoSelectedAccount?.account_id ?? null,
    cpoIterableOrgId: cpoSelectedAccount?.iterable_org_id ?? null,
    cpoAccountName: cpoSelectedAccount?.account_name ?? null,
  });

  const co = data?.co ?? {};
  const d = data?.d ?? {};
  const fa = data?.fa ?? {};

  const commitValue = co.commit ?? null;
  const quotaValue = co.quota ?? null;
  const forecastValue = co.forecast ?? null;
  const bestCaseValue = co.best_case ?? null;
  const openPipelineValue = co.open_pipeline ?? null;
  const closedQTDValue = co.closedQTD ?? null;
  const budgetValue = co.budget ?? null;


  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leftNavOpen, setLeftNavOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [defSection, setDefSection] = useState(null);
  const [drillCategory, setDrillCategory] = useState(null);

  const [debugConsoleOpen, setDebugConsoleOpen] = useState(false);
  const [aeDrillOpen, setAeDrillOpen] = useState(false);
  const [aeDrillMetric, setAeDrillMetric] = useState("AEs @ 0 ACV");
  const [cfoDrillOpen, setCfoDrillOpen] = useState(false);
  const [pgDrillOpen, setPgDrillOpen] = useState(false);
  const [cagrDrillOpen, setCagrDrillOpen] = useState(false);
  const [velocityDrillOpen, setVelocityDrillOpen] = useState(false);
  const [planAttainmentDrillOpen, setPlanAttainmentDrillOpen] = useState(false);
  const [fundedDrillOpen, setFundedDrillOpen] = useState(false);

  const [largeDealsDrillOpen, setLargeDealsDrillOpen] = useState(false);
  const [largeDealsDrillMetric, setLargeDealsDrillMetric] = useState("Won QTD");

  const [closedTrendMode, setClosedTrendMode] = useState("CQ");
  const [closedTrendOpen, setClosedTrendOpen] = useState(false);
  const closedTrendRef = useRef(null);
  const sideNavRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const personaTransitionTimerRef = useRef(null);
  const rescueTimerRef = useRef(null);
  const [closedTrendHover, setClosedTrendHover] = useState(false);

  const prefersReducedMotion = useReducedMotion();
  const [personaTransitioning, setPersonaTransitioning] = useState(false);

  const [activePersona, setActivePersona] = useState("CEO");
  const [pendingScrollId, setPendingScrollId] = useState(null);

  const [createCloseDrillOpen, setCreateCloseDrillOpen] = useState(false);
  const [createCloseDrillMetric, setCreateCloseDrillMetric] = useState("Won QTD");

  const [saltRescueOpen, setSaltRescueOpen] = useState(false);
  const [saltRescueAutoOpened, setSaltRescueAutoOpened] = useState(false);

  const [fieldScopePath, setFieldScopePath] = useState(null);
  const [businessLine, setBusinessLine] = useState("All");

  const [employeeFiltersOpen, setEmployeeFiltersOpen] = useState(false);

  const [employeeFiltersHelpOpen, setEmployeeFiltersHelpOpen] = useState(false);

  const [openPipelineDrillOpen, setOpenPipelineDrillOpen] = useState(false);
  const [openPipelineSelectedRisk, setOpenPipelineSelectedRisk] = useState("all");
  const [fieldExecutionInsightIndex, setFieldExecutionInsightIndex] = useState(0);
  const [fieldExecutionInsightPaused, setFieldExecutionInsightPaused] = useState(false);

  
  // ------------------------------------------------------------
  // Persona availability gating
  // ------------------------------------------------------------
  const hasCEO = true;
  const hasCRO = true;
  const hasWaterfall = true;

  const hasCFO = !!config?.source_cfo_treemap;
  const hasCPO = !!config?.calendar_source || !!config?.cpo_accounts_source;

  // Placeholder-only personas removed from live nav for now
  const hasCPCO = false;
  const hasCMO = false;

  useEffect(() => {
    if (!pendingScrollId) return;

    const t = setTimeout(() => {
      const el = document.getElementById(pendingScrollId);
      if (el) {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch {
          // no-op
        }
      }
      setPendingScrollId(null);
    }, 60);

    return () => clearTimeout(t);
  }, [activePersona, pendingScrollId]);

  const handleViewSelect = (persona) => {
    setActivePersona((prev) => {
      if (prev === persona) return prev;
      return persona;
    });

    if (!prefersReducedMotion) {
      setPersonaTransitioning(true);
      if (personaTransitionTimerRef.current) clearTimeout(personaTransitionTimerRef.current);
      personaTransitionTimerRef.current = setTimeout(() => {
        setPersonaTransitioning(false);
      }, 220);
    }

    if (!isPinned) setLeftNavOpen(false);
  };

  useEffect(() => {
    const availability = {
      CEO: hasCEO,
      CRO: hasCRO,
      WATERFALL: hasWaterfall,
      CFO: hasCFO,
      CPO: hasCPO,
      CPCO: hasCPCO,
      CMO: hasCMO,
    };

    if (!availability[activePersona]) {
      setActivePersona("CEO");
    }
  }, [activePersona, hasCEO, hasCRO, hasWaterfall, hasCFO, hasCPO, hasCPCO, hasCMO]);

  const scrollClosedTrendIntoView = () => {
    setTimeout(() => {
      try {
        closedTrendRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch {
        // no-op
      }
    }, 0);
  };

  const openClosedTrendFromMetric = () => {
    setClosedTrendMode("CQ");

    setClosedTrendOpen((v) => {
      const next = !v;
      if (next) scrollClosedTrendIntoView();
      return next;
    });
  };

  const toggleClosedTrend = () => {
    setClosedTrendOpen((v) => {
      const next = !v;
      if (next) scrollClosedTrendIntoView();
      return next;
    });
  };

  const openLargeDealsDrill = (metricName) => {
    setLargeDealsDrillMetric(metricName);
    setLargeDealsDrillOpen(true);
  };

  const openCreateCloseDrill = (metricName) => {
    setCreateCloseDrillMetric(metricName);
    setCreateCloseDrillOpen(true);
  };

  const openAeDrill = (metricName) => {
    setAeDrillMetric(metricName);
    setAeDrillOpen(true);
  };

  useEffect(() => {
    const appReady = !isLoading && !!data;

    if (appReady) {
      if (rescueTimerRef.current) {
        clearTimeout(rescueTimerRef.current);
        rescueTimerRef.current = null;
      }
      return;
    }

    if (saltRescueAutoOpened) return;
    if (rescueTimerRef.current) return;

    rescueTimerRef.current = setTimeout(() => {
      setSaltRescueOpen(true);
      setSaltRescueAutoOpened(true);
      rescueTimerRef.current = null;
    }, 15000);

    return () => {
      if (rescueTimerRef.current) {
        clearTimeout(rescueTimerRef.current);
        rescueTimerRef.current = null;
      }
    };
  }, [isLoading, data, saltRescueAutoOpened]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const key = String(e.key || "").toLowerCase();
      const meta = e.metaKey || e.ctrlKey;

      // Salt rescue easter egg
      if (meta && e.shiftKey && key === "s") {
        e.preventDefault();
        setSaltRescueOpen(true);
        return;
      }

      // Hidden debug console
      if (meta && e.shiftKey && key === "d") {
        e.preventDefault();
        setDebugConsoleOpen((v) => !v);
        return;
      }

      // ESC closes unpinned Views drawer
      if (key === "escape" && leftNavOpen && !isPinned) {
        e.preventDefault();
        setLeftNavOpen(false);
        return;
      }

      // ESC also closes Salt rescue if open
      if (key === "escape" && saltRescueOpen) {
        e.preventDefault();
        setSaltRescueOpen(false);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leftNavOpen, isPinned, saltRescueOpen]);

  useEffect(() => {
    if (!debugConsoleOpen) return;
    setDebugLogs(getDebugLogs());
  }, [debugConsoleOpen]);


  useEffect(() => {
    if (activePersona !== "CEO") {
      setClosedTrendOpen(false);
      setClosedTrendMode("CQ");
      setClosedTrendHover(false);
    }
  }, [activePersona]);

  useEffect(() => {
    if (!leftNavOpen || isPinned) return;

    const handlePointerDown = (e) => {
      const drawerEl = sideNavRef.current;
      if (!drawerEl) return;

      if (!drawerEl.contains(e.target)) {
        setLeftNavOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [leftNavOpen, isPinned]);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;

    try {
      el.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    } catch {
      el.scrollTop = 0;
    }
  }, [activePersona, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (personaTransitionTimerRef.current) {
        clearTimeout(personaTransitionTimerRef.current);
      }
      if (rescueTimerRef.current) {
        clearTimeout(rescueTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!employeeFiltersHelpOpen) return;

    const handlePointerDown = (e) => {
      const helpEl = document.getElementById("employee-filters-help-popover");
      const btnEl = document.getElementById("employee-filters-help-button");

      if (!helpEl || !btnEl) return;

      const clickedInsideHelp = helpEl.contains(e.target);
      const clickedButton = btnEl.contains(e.target);

      if (!clickedInsideHelp && !clickedButton) {
        setEmployeeFiltersHelpOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setEmployeeFiltersHelpOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [employeeFiltersHelpOpen]);

  const closedTrendData = useMemo(() => {
    const trend = data?.closedTrend;
    if (!trend) return [];

    const sourceRows = closedTrendMode === "R12" ? trend.allRows : trend.quarterRows;
    if (!Array.isArray(sourceRows) || sourceRows.length === 0) return [];

    const businessLineKey =
      findRowKeyByCandidates(sourceRows, ["businessLine", "business_line", "Business Line"]);

    const filteredRows = filterRowsByBusinessLine(
      sourceRows,
      businessLine,
      businessLineKey
    );

    return filteredRows.map((r, i) => ({
      name:
        r?.name != null && String(r.name).trim() !== ""
          ? String(r.name).trim()
          : `M${i + 1}`,
      value: toNumber(r?.value) ?? 0,
      businessLine: r?.businessLine ?? r?.business_line ?? null,
      fiscalYearquarter: r?.fiscalYearquarter ?? null,
      sort: toNumber(r?.sort),
    }));
  }, [data?.closedTrend, closedTrendMode, businessLine]);

  const processedWaterfallData = useMemo(() => {
    const wfRows = rows?.waterfall || [];
    if (wfRows.length === 0) return [];

    const buckets = {
      Start: { amt: 0, rows: [] },
      Contraction: { amt: 0, rows: [] },
      "Closed Lost": { amt: 0, rows: [] },
      "Closed Won": { amt: 0, rows: [] },
      New: { amt: 0, rows: [] },
      Expansion: { amt: 0, rows: [] },
      Total: { amt: 0, rows: [] },
    };

    const nameKey = resolveColumnKey(config?.wf_name);
    const amountKey = resolveColumnKey(config?.wf_amount);

    wfRows.forEach((row) => {
      const cat = row?.[nameKey];
      const val = toNumber(row?.[amountKey]) || 0;

      if (buckets[cat]) {
        buckets[cat].amt += val;
        buckets[cat].rows.push(row);
      }
    });

    const displayOrder = ["Start", "Contraction", "Closed Lost", "Closed Won", "New", "Expansion", "Total"];

    return displayOrder.map((name) => ({
      name,
      amount: buckets[name].amt,
      detailRows: buckets[name].rows,
    }));
  }, [rows?.waterfall, config?.wf_name, config?.wf_amount]);

  const drillData = useMemo(() => {
    const category = processedWaterfallData.find((b) => b.name === drillCategory);
    return {
      rows: category?.detailRows || [],
      total: category?.amount || 0,
    };
  }, [drillCategory, processedWaterfallData]);

  const aeZeroAcvRows = useMemo(() => {
    const aeCols = columns?.aePerformance || [];

    const zeroAcvKey =
      resolveColumnKey(config?.ae_is_at_0_acv) ||
      findColIdByName(aeCols, "Is AE At 0 ACV (0/1)") ||
      findColIdByName(aeCols, "IS_AE_AT_0_ACV");

    const userIdKey =
      resolveColumnKey(config?.ae_user_id) ||
      findColIdByName(aeCols, "AE User Id") ||
      findColIdByName(aeCols, "AE_USER_ID");

    if (!rows?.aePerformance?.length || !zeroAcvKey) return [];

    if (!userIdKey) {
      return rows.aePerformance.filter((r) => toNumber(r?.[zeroAcvKey]) === 1);
    }

    const zeroIds = new Set(
      rows.aePerformance
        .filter((r) => toNumber(r?.[zeroAcvKey]) === 1)
        .map((r) => r?.[userIdKey])
        .filter(Boolean)
    );

    return rows.aePerformance.filter((r) => zeroIds.has(r?.[userIdKey]));
  }, [rows?.aePerformance, columns?.aePerformance, config?.ae_is_at_0_acv, config?.ae_user_id]);

  const aeAboveThresholdRows = useMemo(() => {
    const aeCols = columns?.aePerformance || [];

    const aboveThresholdKey =
      resolveColumnKey(config?.ae_is_over_stage4_cov_threshold_3x) ||
      findColIdByName(aeCols, "Is AE Over Stage 4 Coverage Threshold 3x (0/1)") ||
      findColIdByName(aeCols, "Is Ae Over Stage 4 Cov Threshold 3 X") ||
      findColIdByName(aeCols, "IS_AE_OVER_STAGE4_COV_THRESHOLD_3X");

    const userIdKey =
      resolveColumnKey(config?.ae_user_id) ||
      findColIdByName(aeCols, "AE User Id") ||
      findColIdByName(aeCols, "AE_USER_ID");

    if (!rows?.aePerformance?.length || !aboveThresholdKey) return [];

    if (!userIdKey) {
      return rows.aePerformance.filter((r) => toNumber(r?.[aboveThresholdKey]) === 1);
    }

    const aboveIds = new Set(
      rows.aePerformance
        .filter((r) => toNumber(r?.[aboveThresholdKey]) === 1)
        .map((r) => r?.[userIdKey])
        .filter(Boolean)
    );

    return rows.aePerformance.filter((r) => aboveIds.has(r?.[userIdKey]));
  }, [rows?.aePerformance, columns?.aePerformance, config?.ae_is_over_stage4_cov_threshold_3x, config?.ae_user_id]);



  const aeDrillRows = useMemo(() => {
    return aeDrillMetric === "AEs > 3x Stage 4 Cov" ? aeAboveThresholdRows : aeZeroAcvRows;
  }, [aeDrillMetric, aeAboveThresholdRows, aeZeroAcvRows]);

  const pgBusinessLineKey = useMemo(() => {
    return (
      resolveColumnKey(config?.fa_business_line) ||
      findRowKeyByCandidates(rows?.pgPacing || [], [
        "business_line",
        "Business Line",
        "business line",
        "BUSINESS_LINE",
        "bl",
        "BL",
      ])
    );
  }, [config?.pg_business_line, rows?.pgPacing]);

  function normalizeBusinessLineLabel(value) {
    return String(value ?? "").trim().toLowerCase();
  }
  
  function matchesPgBusinessLine(selected, rowValue) {
    const selectedNorm = normalizeBusinessLineLabel(selected);
    const rowNorm = normalizeBusinessLineLabel(rowValue);

    if (!rowNorm) return false;

    if (selectedNorm === "all") {
      return (
        rowNorm === "all" ||
        rowNorm === "new business + expansion" ||
        rowNorm === "new business+expansion" ||
        rowNorm === "new business & expansion" ||
        rowNorm === "combined"
      );
    }

    if (selectedNorm === "new business") {
      return rowNorm === "new business";
    }

    if (selectedNorm === "gross expansion") {
      return (
        rowNorm === "gross expansion" ||
        rowNorm === "expansion"
      );
    }

    return rowNorm === selectedNorm;
  }

  const filteredPgRows = useMemo(() => {
    const base = rows?.pgPacing || [];
    if (!pgBusinessLineKey) {
      debugWarn("[PG] business line key not found; returning unfiltered rows");
      return base;
    }

    return base.filter((r) =>
      matchesPgBusinessLine(businessLine, r?.[pgBusinessLineKey])
    );
  }, [rows?.pgPacing, businessLine, pgBusinessLineKey]);
  
  useEffect(() => {
  if (!debugLoggingEnabled) return;

  debugLog("[PG] selected businessLine:", businessLine);
  debugLog("[PG] resolved key:", pgBusinessLineKey);
  debugLog(
    "[PG] all PG BL values:",
    [...new Set((rows?.pgPacing || []).map((r) => String(pgBusinessLineKey ? r?.[pgBusinessLineKey] : "").trim()))]
  );
  debugLog("[PG] filtered row count:", filteredPgRows.length);
  debugLog("[PG] filtered rows sample:", filteredPgRows.slice(0, 5));
}, [debugLoggingEnabled, businessLine, pgBusinessLineKey, rows?.pgPacing, filteredPgRows]);

  const pgSummary = useMemo(() => {
    const r = filteredPgRows ?? [];
    if (!Array.isArray(r) || r.length === 0) {
      return {
        hasData: false,
        fyq: null,
        businessLine: null,
        quarterGoal: null,
        quarterCreated: null,
        quarterAttainment: null,
        months: [],
      };
    }

  const fyqKey = resolveColumnKey(config?.fa_fiscal_yearquarter);
  const blKey = resolveColumnKey(config?.fa_business_line);

  // These may not exist in the forecast-attainment dataset, so let them fall back safely
  const monthSortKey =
    resolveColumnKey(config?.pg_month_sort) ||
    findRowKeyByCandidates(r, ["month_sort", "Month Sort"]);

  const monthNameKey =
    resolveColumnKey(config?.pg_month_name) ||
    findRowKeyByCandidates(r, ["month_name", "Month Name"]);

  const monthInQtrKey =
    resolveColumnKey(config?.pg_month_in_qtr) ||
    findRowKeyByCandidates(r, ["month_in_qtr", "Month In Quarter"]);

  const monthGoalsKey =
    resolveColumnKey(config?.pg_month_goals) ||
    findRowKeyByCandidates(r, ["month_goals", "Month Goals"]);

  const monthCreatedKey =
    resolveColumnKey(config?.pg_month_created) ||
    findRowKeyByCandidates(r, ["month_created", "Month Created"]);

  const goalsQtrKey = resolveColumnKey(config?.fa_qtd_forecast);
  const createdQtrKey = resolveColumnKey(config?.fa_qtd_closed);
  const attainmentQtrKey = resolveColumnKey(config?.fa_qtd_attainment);

    const fyq = firstNonEmpty(r, fyqKey);
    const businessLine = firstNonEmpty(r, blKey);

    const byMonth = new Map();
    for (const row of r) {
      const mNameRaw = monthNameKey ? row?.[monthNameKey] : null;
      const mName = mNameRaw != null && String(mNameRaw).trim() !== "" ? String(mNameRaw).trim() : null;
      if (!mName) continue;

      const sortA = monthSortKey ? parseSortValue(row?.[monthSortKey]) : null;
      const sortB = monthInQtrKey ? toNumber(row?.[monthInQtrKey]) : null;
      const sort = sortB != null ? sortB : sortA;

      const goal = monthGoalsKey ? (toNumber(row?.[monthGoalsKey]) || 0) : 0;
      const created = monthCreatedKey ? (toNumber(row?.[monthCreatedKey]) || 0) : 0;

      const cur = byMonth.get(mName) || { name: mName, sort: sort ?? 0, goal: 0, created: 0 };
      cur.goal += goal;
      cur.created += created;

      if (cur.sort == null || cur.sort === 0) cur.sort = sort ?? cur.sort ?? 0;

      byMonth.set(mName, cur);
    }

    const months = Array.from(byMonth.values())
      .map((m) => ({
        ...m,
        attainment: m.goal ? m.created / m.goal : null,
      }))
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    const qGoalRaw = goalsQtrKey ? toNumber(firstNonEmpty(r, goalsQtrKey)) : null;
    const qCreatedRaw = createdQtrKey ? toNumber(firstNonEmpty(r, createdQtrKey)) : null;
    const qAttRaw = attainmentQtrKey ? toNumber(firstNonEmpty(r, attainmentQtrKey)) : null;

    const summedQuarterGoal = months.reduce((acc, m) => acc + (m.goal || 0), 0);
    const summedQuarterCreated = months.reduce((acc, m) => acc + (m.created || 0), 0);

    const quarterGoal =
      qGoalRaw != null
        ? qGoalRaw
        : summedQuarterGoal > 0
          ? summedQuarterGoal
          : null;

    const quarterCreated =
      qCreatedRaw != null
        ? qCreatedRaw
        : summedQuarterCreated > 0
          ? summedQuarterCreated
          : null;

    const quarterAttainment =
      qAttRaw != null
        ? qAttRaw
        : safeDivide(quarterCreated, quarterGoal, null);

    return {
      hasData: true,
      fyq: fyq ?? null,
      businessLine: businessLine ?? null,
      quarterGoal: Number.isFinite(quarterGoal) ? quarterGoal : null,
      quarterCreated: Number.isFinite(quarterCreated) ? quarterCreated : null,
      quarterAttainment: Number.isFinite(quarterAttainment) ? quarterAttainment : null,
      months,
    };
  }, [
    filteredPgRows,
    config?.fa_fiscal_yearquarter,
    config?.fa_business_line,
    config?.pg_month_sort,
    config?.pg_month_name,
    config?.pg_month_in_qtr,
    config?.pg_month_goals,
    config?.pg_month_created,
    config?.fa_qtd_forecast,
    config?.fa_qtd_closed,
    config?.fa_qtd_attainment,
  ]);

useEffect(() => {
  if (!debugLoggingEnabled) return;

  const sampleRow = (rows?.pgPacing || [])[0] || null;

  debugLog("[PG] selected businessLine:", businessLine);
  debugLog("[PG] pg row count:", (rows?.pgPacing || []).length);
  debugLog("[PG] pg sample row:", sampleRow);
  debugLog("[PG] pg sample row keys:", sampleRow ? Object.keys(sampleRow) : []);
  debugLog("[PG] resolved pgBusinessLineKey:", pgBusinessLineKey);

  debugLog(
    "[PG] distinct BL values:",
    [...new Set((rows?.pgPacing || []).map((r) => {
      const v = pgBusinessLineKey ? r?.[pgBusinessLineKey] : null;
      return String(v ?? "").trim();
    }))]
  );

  debugLog("[PG] filtered row count:", filteredPgRows.length);
  debugLog("[PG] filtered rows:", filteredPgRows);

  debugLog("[PG] summary:", pgSummary);
}, [
  debugLoggingEnabled,
  businessLine,
  rows?.pgPacing,
  pgBusinessLineKey,
  filteredPgRows,
  pgSummary,
]);

  const revintelRows = data?.cro?.revintelTreeRows ?? [];

  const fieldScopeBridge = useMemo(() => {
    return buildFieldScopeBridge(revintelRows, fieldScopePath);
  }, [revintelRows, fieldScopePath]);

  const revintelTree = useMemo(() => {
    if (!revintelRows?.length) return [];
    return buildRevintelTree(revintelRows);
  }, [revintelRows]);

  const [selectedRollupNodeId, setSelectedRollupNodeId] = useState(null);

  function findNodeById(nodes, id) {
    let hit = null;
    const walk = (arr) => {
      for (const n of arr || []) {
        if (n.id === id) {
          hit = n;
          return;
        }
        if (n.children?.length) walk(n.children);
      }
    };
    walk(nodes);
    return hit;
  }

  const ceoDefaultRollupNode = useMemo(() => {
    if (!Array.isArray(revintelTree) || revintelTree.length === 0) return null;

    return (
      revintelTree.find((n) => String(n?.label || "").trim().toLowerCase() === "doug adamic") ||
      revintelTree.find((n) => String(n?.displayLabel || "").trim().toLowerCase().includes("doug adamic")) ||
      null
    );
  }, [revintelTree]);

  const ceoSelectedRollupNode = useMemo(() => {
    if (fieldScopePath) {
      return findNodeById(revintelTree, fieldScopePath);
    }

    return ceoDefaultRollupNode;
  }, [revintelTree, fieldScopePath, ceoDefaultRollupNode]);

  const ceoPlus1Node = useMemo(() => {
    if (!ceoSelectedRollupNode?.parentId) return null;
    return findNodeById(revintelTree, ceoSelectedRollupNode.parentId);
  }, [revintelTree, ceoSelectedRollupNode]);

const ceoPlus2Node = useMemo(() => {
  if (!ceoPlus1Node?.parentId) return null;
  return findNodeById(revintelTree, ceoPlus1Node.parentId);
}, [revintelTree, ceoPlus1Node]);

const scopedForecastValue = useMemo(() => {
  const raw =
    ceoSelectedRollupNode?.forecast ??
    ceoSelectedRollupNode?.metrics?.forecast ??
    ceoSelectedRollupNode?.values?.forecast ??
    null;

  return toNumber(raw);
}, [ceoSelectedRollupNode]);

useEffect(() => {
  if (!debugLoggingEnabled) return;
  debugLog("[SALT] ceoSelectedRollupNode:", ceoSelectedRollupNode);
  debugLog(
    "[SALT] ceoSelectedRollupNode keys:",
    ceoSelectedRollupNode ? Object.keys(ceoSelectedRollupNode) : []
  );
}, [ceoSelectedRollupNode]);

const croSelectedRollupNode = useMemo(() => {
  if (!selectedRollupNodeId) return null;
  return findNodeById(revintelTree, selectedRollupNodeId);
}, [revintelTree, selectedRollupNodeId]);

  const croPlus1Node = useMemo(() => {
    if (!croSelectedRollupNode?.parentId) return null;
    return findNodeById(revintelTree, croSelectedRollupNode.parentId);
  }, [revintelTree, croSelectedRollupNode]);

  const croPlus2Node = useMemo(() => {
    if (!croPlus1Node?.parentId) return null;
    return findNodeById(revintelTree, croPlus1Node.parentId);
  }, [revintelTree, croPlus1Node]);

  if (isLoading || !data) {
    return (
      <div style={styles.loadingScreen}>
        <div
          style={{
            display: "grid",
            gap: 10,
            justifyItems: "center",
            textAlign: "center",
            padding: 24,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 22 }}>Loading SALT Report…</div>
          <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.92 }}>
            If this takes longer than expected, press <span style={{ fontWeight: 1000 }}>Cmd/Ctrl + Shift + S</span>
          </div>
        </div>

        <SaltRescueModal open={saltRescueOpen} onClose={() => setSaltRescueOpen(false)} />
      </div>
    );
  }


  const rawAsOfDate = firstNonEmpty(
    rows?.drillVelocity || [],
    resolveColumnKey(config?.dv_as_of_date)
  );

  const formattedAsOfDate = rawAsOfDate
    ? new Date(Number(rawAsOfDate)).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const firstName =
    data?.currentUserFullName
      ? String(data.currentUserFullName).trim().split(/\s+/)[0]
      : null;

  const currentHour = new Date().getHours();

  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 18
        ? "Good afternoon"
        : "Good evening";

  const headerMetaText =
    firstName && formattedAsOfDate
      ? `${greeting}, ${firstName} • As of ${formattedAsOfDate}`
      : firstName
        ? `${greeting}, ${firstName}`
        : formattedAsOfDate
          ? `As of ${formattedAsOfDate}`
          : null;


  const gapToForecastValue = fa?.qtdClosedVsForecast ?? co.gap ?? safeSubtract(closedQTDValue, forecastValue, null);
  const planAttainmentValue = co.finPlanQTD ?? safeDivide(closedQTDValue, quotaValue, null);
  const closedVsForecastDelta = fa?.qtdClosedVsForecast ?? safeSubtract(closedQTDValue, forecastValue, null);


  const openDefs = (section) => {
    setDefSection(section);
    setDrawerOpen(true);
  };

  const SIDEBAR_WIDTH = 320;

  const fieldScopeLabel = fieldScopeBridge?.isGlobal
    ? "Global"
    : fieldScopeBridge?.selectedLabel || "Scoped";

  const cpoAccountOptions = useMemo(() => {
    const baseRows =
      rows?.cpoAccounts ||
      rows?.cpo_accounts ||
      rows?.cpoAccountsSource ||
      rows?.cpo_accounts_source ||
      [];

    const orgKey = resolveColumnKey(config?.cpo_iterable_org_id);
    const idKey = resolveColumnKey(config?.cpo_account_id);
    const nameKey = resolveColumnKey(config?.cpo_account_name);
    const mgrKey = resolveColumnKey(config?.cpo_account_manager);

    if (!Array.isArray(baseRows) || baseRows.length === 0) return [];

    return baseRows.map((r) => {
      const iterable_org_id = orgKey ? (r?.[orgKey] ?? null) : null;
      const account_id = idKey ? (r?.[idKey] ?? null) : null;
      const account_name = nameKey ? (r?.[nameKey] ?? null) : null;
      const account_manager = mgrKey ? (r?.[mgrKey] ?? null) : null;

      return {
        iterable_org_id,
        iterable_org_id_c: iterable_org_id,
        account_id,
        account_name,
        account_manager,
        __raw: r,
      };
    });
  }, [
    rows?.cpoAccounts,
    rows?.cpo_accounts,
    rows?.cpoAccountsSource,
    rows?.cpo_accounts_source,
    config?.cpo_iterable_org_id,
    config?.cpo_account_id,
    config?.cpo_account_name,
    config?.cpo_account_manager,
  ]);

  const drillCagrRows = rows?.drillCagr ?? rows?.cagrDrill ?? [];
  const drillCagrCols = columns?.drillCagr ?? columns?.cagrDrill ?? [];

  const scopedCreateCloseKeys = useMemo(() => {
    return {
      owner:
        resolveColumnKey(config?.ccd_opp_owner_name) ||
        findRowKeyByCandidates(rows?.createCloseDetail || [], [
          "opp_owner_name",
          "Opp Owner Name",
          "owner_name",
          "Owner Name",
          "user_name",
          "User Name",
        ]),
      territory:
        resolveColumnKey(config?.ccd_territory_name) ||
        findRowKeyByCandidates(rows?.createCloseDetail || [], [
          "territory_name",
          "Territory Name",
          "territory",
          "Territory",
        ]),
      closedWon:
        resolveColumnKey(config?.ccd_closed_won) ||
        findRowKeyByCandidates(rows?.createCloseDetail || [], [
          "cc_qtd_closed_won",
          "Cc Qtd Closed Won",
          "closed_won",
        ]),
      openPipe:
        resolveColumnKey(config?.ccd_open_pipe) ||
        findRowKeyByCandidates(rows?.createCloseDetail || [], [
          "cc_qtd_open_pipe",
          "Cc Qtd Open Pipe",
          "open_pipe",
        ]),
      wonYoyPct:
        resolveColumnKey(config?.ccd_closed_won_yoy_pct) ||
        findRowKeyByCandidates(rows?.createCloseDetail || [], [
          "cc_qtd_closed_won_yoy_pct",
          "Cc Qtd Closed Won Yoy Pct",
        ]),
      openPipeYoyPct:
        resolveColumnKey(config?.ccd_open_pipe_yoy_pct) ||
        findRowKeyByCandidates(rows?.createCloseDetail || [], [
          "cc_qtd_open_pipe_yoy_pct",
          "Cc Qtd Open Pipe Yoy Pct",
        ]),
    };
  }, [config, rows?.createCloseDetail]);

  const scopedCreateCloseRows = useMemo(() => {
    return filterRowsByScope(rows?.createCloseDetail || [], fieldScopeBridge, {
      ownerKey: scopedCreateCloseKeys.owner,
      territoryKey: scopedCreateCloseKeys.territory,
    });
  }, [rows?.createCloseDetail, fieldScopeBridge, scopedCreateCloseKeys]);

  const scopedCreateCloseSummary = useMemo(() => {
    const wonVals = scopedCreateCloseRows
      .map((r) => toNumber(scopedCreateCloseKeys.closedWon ? r?.[scopedCreateCloseKeys.closedWon] : null))
      .filter((v) => v != null);

    const openVals = scopedCreateCloseRows
      .map((r) => toNumber(scopedCreateCloseKeys.openPipe ? r?.[scopedCreateCloseKeys.openPipe] : null))
      .filter((v) => v != null);

    const wonYoyVals = scopedCreateCloseRows
      .map((r) => toNumber(scopedCreateCloseKeys.wonYoyPct ? r?.[scopedCreateCloseKeys.wonYoyPct] : null))
      .filter((v) => v != null);

    const openYoyVals = scopedCreateCloseRows
      .map((r) => toNumber(scopedCreateCloseKeys.openPipeYoyPct ? r?.[scopedCreateCloseKeys.openPipeYoyPct] : null))
      .filter((v) => v != null);

    return {
      wonQTD: wonVals.length ? wonVals.reduce((a, b) => a + b, 0) : co.cc_won_qtd,
      openPipeQTD: openVals.length ? openVals.reduce((a, b) => a + b, 0) : co.cc_open_pipe_qtd,
      wonQTDYoy: wonYoyVals.length ? wonYoyVals[0] : co.cc_won_qtd_yoy,
      openPipeQTDYoy: openYoyVals.length ? openYoyVals[0] : co.cc_open_pipe_qtd_yoy,
    };
  }, [scopedCreateCloseRows, scopedCreateCloseKeys, co]);



  const scopedAeKeys = useMemo(() => {
    return {
      name:
        resolveColumnKey(config?.ae_name) ||
        findRowKeyByCandidates(rows?.aePerformance || [], [
          "ae_name",
          "AE Name",
          "forecast_owner_name",
          "Forecast Owner Name",
          "user_name",
        ]),
      territory:
        resolveColumnKey(config?.ae_territory_name) ||
        findRowKeyByCandidates(rows?.aePerformance || [], [
          "territory_name",
          "Territory Name",
          "territory",
        ]),
      zeroAtAcv:
        resolveColumnKey(config?.ae_is_at_0_acv) ||
        findRowKeyByCandidates(rows?.aePerformance || [], [
          "is_ae_at_0_acv",
          "Is AE At 0 ACV (0/1)",
        ]),
      overThreshold:
        resolveColumnKey(config?.ae_is_over_stage4_cov_threshold_3x) ||
        findRowKeyByCandidates(rows?.aePerformance || [], [
          "is_ae_over_stage4_cov_threshold_3x",
          "Is AE Over Stage 4 Coverage Threshold 3x (0/1)",
        ]),

      businessLine:
        resolveColumnKey(config?.ae_business_line) ||
        findRowKeyByCandidates(rows?.aePerformance || [], [
          "business_line",
          "Business Line",
        ]),
    };
  }, [config, rows?.aePerformance]);

    const scopedAeRows = useMemo(() => {
      const scoped = filterRowsByScope(
        rows?.aePerformance || [],
        fieldScopeBridge,
        {
          ownerKey: scopedAeKeys.name,
          territoryKey: scopedAeKeys.territory,
        }
      );

      return filterRowsByBusinessLine(
        scoped,
        businessLine,
        scopedAeKeys.businessLine
      );
    }, [
      rows?.aePerformance,
      fieldScopeBridge,
      scopedAeKeys,
      businessLine,
    ]);

  const scopedAeZeroAcvRows = useMemo(() => {
    if (!scopedAeKeys.zeroAtAcv) return aeZeroAcvRows;
    return scopedAeRows.filter((r) => toNumber(r?.[scopedAeKeys.zeroAtAcv]) === 1);
  }, [scopedAeRows, scopedAeKeys.zeroAtAcv, aeZeroAcvRows]);

  const scopedAeAboveThresholdRows = useMemo(() => {
    if (!scopedAeKeys.overThreshold) return aeAboveThresholdRows;
    return scopedAeRows.filter((r) => toNumber(r?.[scopedAeKeys.overThreshold]) === 1);
  }, [scopedAeRows, scopedAeKeys.overThreshold, aeAboveThresholdRows]);

  const scopedAePerfCounts = useMemo(() => {
    return {
      overThreshold: scopedAeAboveThresholdRows.length,
      zeroAtAcv: scopedAeZeroAcvRows.length,
    };
  }, [scopedAeAboveThresholdRows, scopedAeZeroAcvRows]);

  const aePerfCounts = useMemo(() => {
    if (fieldScopeBridge?.isGlobal) {
      return {
        overThreshold: data?.ae?.overThreshold ?? 0,
        zeroAtAcv: data?.ae?.zeroAtAcv ?? data?.ae?.zeroDealsClosed ?? 0,
      };
    }

    return scopedAePerfCounts;
  }, [
    data?.ae?.overThreshold,
    data?.ae?.zeroAtAcv,
    data?.ae?.zeroDealsClosed,
    fieldScopeBridge?.isGlobal,
    scopedAePerfCounts,
  ]);

  const scopedDetailKeys = useMemo(() => {
    return {
      owner: findRowKeyByCandidates(rows?.detail || [], [
        "opp_owner_name",
        "owner_name",
        "forecast_owner_name",
        "user_name",
        "ae_name",
        "name",
      ]),
      territory: findRowKeyByCandidates(rows?.detail || [], [
        "territory_name",
        "territory",
      ]),
      forecast: resolveColumnKey(config?.forecast_amount) || findRowKeyByCandidates(rows?.detail || [], ["forecast_amount"]),
      openPipe: resolveColumnKey(config?.open_pipe) || findRowKeyByCandidates(rows?.detail || [], ["open_pipe"]),
      closed: resolveColumnKey(config?.closed_filtered) || findRowKeyByCandidates(rows?.detail || [], ["closed_filtered"]),
    };
  }, [config, rows?.detail]);

  const scopedDetailRows = useMemo(() => {
    return filterRowsByScope(rows?.detail || [], fieldScopeBridge, {
      ownerKey: scopedDetailKeys.owner,
      territoryKey: scopedDetailKeys.territory,
    });
  }, [rows?.detail, fieldScopeBridge, scopedDetailKeys]);

  useEffect(() => {
    if (!debugLoggingEnabled) return;
    debugLog("DETAIL ROW SAMPLE:", rows.detail?.[0]);
    debugLog("SCOPED DETAIL ROW SAMPLE:", scopedDetailRows?.[0]);
    debugLog("SCOPED DETAIL KEYS:", scopedDetailKeys);
  }, [rows.detail, scopedDetailRows, scopedDetailKeys]);

const scopedFieldExecutionSpineKeys = useMemo(() => {
  return {
    owner:
      resolveColumnKey(config?.eso_opp_owner_name) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "opp_owner_name",
        "Opp Owner Name",
        "owner_name",
        "Owner Name",
      ]),
    openPipe:
      resolveColumnKey(config?.eso_open_pipeline_acv) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "open_pipeline_acv",
        "Open Pipeline Acv",
      ]),
    closed:
      resolveColumnKey(config?.eso_closed_acv) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "closed_acv",
        "Closed Acv",
      ]),
  };
}, [config, rows?.employeeScopeOpportunitySpine]);

const scopedFieldExecutionSpineRows = useMemo(() => {
  const scoped = filterRowsByScope(
    rows?.employeeScopeOpportunitySpine || [],
    fieldScopeBridge,
    {
      ownerKey: scopedFieldExecutionSpineKeys.owner,
      territoryKey: null,
    }
  );

  const businessLineKey =
    resolveColumnKey(config?.eso_bl) ||
    findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
      "business_line",
      "Business Line",
    ]);

  return filterRowsByBusinessLine(scoped, businessLine, businessLineKey);
}, [
  rows?.employeeScopeOpportunitySpine,
  fieldScopeBridge,
  scopedFieldExecutionSpineKeys,
  businessLine,
  config?.eso_bl,
]);

const companyTotalsSpineKeys = useMemo(() => {
  return {
    owner:
      resolveColumnKey(config?.eso_opp_owner_name) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "opp_owner_name",
        "Opp Owner Name",
        "owner_name",
        "Owner Name",
      ]),
    openPipe:
      resolveColumnKey(config?.eso_open_pipeline_acv) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "open_pipeline_acv",
        "Open Pipeline Acv",
      ]),
    closed:
      resolveColumnKey(config?.eso_closed_acv) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "closed_acv",
        "Closed Acv",
      ]),
  };
}, [config, rows?.employeeScopeOpportunitySpine]);

const companyTotalsSpineRows = useMemo(() => {
  const businessLineKey =
    resolveColumnKey(config?.eso_bl) ||
    findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
      "business_line",
      "Business Line",
    ]);

  return filterRowsByBusinessLine(
    rows?.employeeScopeOpportunitySpine || [],
    businessLine,
    businessLineKey
  );
}, [
  rows?.employeeScopeOpportunitySpine,
  businessLine,
  config?.eso_bl,
]);

const companyTotalsDerivedMetricsSpineRows = useMemo(() => {
  if (!Array.isArray(companyTotalsSpineRows) || companyTotalsSpineRows.length === 0) {
    return [];
  }

  const stageKey = resolveColumnKey(config?.eso_stage);
  const closeKey = resolveColumnKey(config?.eso_close);
  const businessLineKey = resolveColumnKey(config?.eso_bl);
  const largeDealBucketKey = resolveColumnKey(config?.eso_ld_bucket);
  const dealReviewShortKey = resolveColumnKey(config?.eso_deal_review);

  return companyTotalsSpineRows.map((r) => ({
    opp_owner_name: companyTotalsSpineKeys.owner
      ? r?.[companyTotalsSpineKeys.owner] ?? null
      : null,

    open_pipeline_acv: companyTotalsSpineKeys.openPipe
      ? r?.[companyTotalsSpineKeys.openPipe] ?? null
      : null,

    closed_acv: companyTotalsSpineKeys.closed
      ? r?.[companyTotalsSpineKeys.closed] ?? null
      : null,

    stage_name: stageKey ? r?.[stageKey] ?? null : null,
    close_date: closeKey ? r?.[closeKey] ?? null : null,
    business_line: businessLineKey ? r?.[businessLineKey] ?? null : null,
    large_deal_bucket: largeDealBucketKey ? r?.[largeDealBucketKey] ?? null : null,
    deal_review_short: dealReviewShortKey ? r?.[dealReviewShortKey] ?? null : null,
  }));
}, [
  companyTotalsSpineRows,
  companyTotalsSpineKeys,
  config,
]);

const companyTotalsDerivedMetrics = useDerivedMetrics({
  spineRows: companyTotalsDerivedMetricsSpineRows,
  forecastAmount: forecastValue,
});

  const companyClosedQTDValue = companyTotalsSpineRows.reduce(
    (sum, r) => sum + (toNumber(r?.[companyTotalsSpineKeys.closed]) || 0),
    0
  );

  const companyStage4Value = useMemo(() => {
    const stageKey =
      resolveColumnKey(config?.eso_stage) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "stage_name",
        "Stage Name",
      ]);

    const openPipeKey = companyTotalsSpineKeys.openPipe;

    if (!stageKey || !openPipeKey) return null;

    const stage4Open = companyTotalsSpineRows.reduce((sum, r) => {
      const stage = String(r?.[stageKey] ?? "").trim().toLowerCase();
      const isStage4Plus =
        stage === "stage 4" ||
        stage === "stage 5" ||
        stage === "stage 6" ||
        stage.includes("stage 4") ||
        stage.includes("stage 5") ||
        stage.includes("stage 6");

      if (!isStage4Plus) return sum;
      return sum + (toNumber(r?.[openPipeKey]) || 0);
    }, 0);

    return safeDivide(stage4Open, forecastValue, null);
  }, [companyTotalsSpineRows, companyTotalsSpineKeys.openPipe, forecastValue, config?.eso_stage, rows?.employeeScopeOpportunitySpine]);

  const velocityPctDaysElapsed = useMemo(() => {
    const dv = data?.dv || {};

    if (toNumber(dv?.pctDaysElapsed) != null) {
      return toNumber(dv.pctDaysElapsed);
    }

    const daysElapsed = toNumber(dv?.quarterElapsedDays ?? dv?.daysElapsed);
    const daysTotal = toNumber(dv?.quarterTotalDays ?? dv?.daysTotal);

    return safeDivide(daysElapsed, daysTotal, null);
  }, [data?.dv]);

  const companyVelocityValue = useMemo(() => {
    const pctForecastAchieved = safeDivide(companyClosedQTDValue, forecastValue, null);
    return safeDivide(pctForecastAchieved, velocityPctDaysElapsed, null);
  }, [companyClosedQTDValue, forecastValue, velocityPctDaysElapsed]);

  const companyVelocityModalData = useMemo(() => {
    const baseDv = data?.dv || {};

    return {
      ...baseDv,
      bl: businessLine === "All" ? (baseDv.bl ?? "All") : businessLine,
      closedAmount: companyClosedQTDValue,
      commitAmount: forecastValue,
      providedVelocity: companyVelocityValue,
    };
  }, [data?.dv, businessLine, companyClosedQTDValue, forecastValue, companyVelocityValue]);

  function normalizeFormulaRole(value) {
    return String(value ?? "").trim().toLowerCase();
  }

const fundedBusinessLineKey = useMemo(() => {
    return findRowKeyByCandidates(
      data?.df?.detailRows || rows?.drillFunded || [],
      ["business_line", "Business Line"]
    );
  }, [data?.df?.detailRows, rows?.drillFunded]);

  const filteredFundedRows = useMemo(() => {
    const baseRows = data?.df?.detailRows || rows?.drillFunded || [];
    return filterRowsByBusinessLine(baseRows, businessLine, fundedBusinessLineKey);
  }, [data?.df?.detailRows, rows?.drillFunded, businessLine, fundedBusinessLineKey]);

  const companyFundedCalc = useMemo(() => {
    const rowsArr = filteredFundedRows || [];

    let numerator = 0;
    let denominator = 0;

    for (const r of rowsArr) {
      const acv = toNumber(r?.acvChange);
      if (acv == null) continue;

      const role = normalizeFormulaRole(r?.formulaRole);
      const bucket = normalizeFormulaRole(r?.fundedBucket);
      const status = normalizeFormulaRole(r?.oppStatus);
      const mgr = normalizeFormulaRole(r?.managerJudgment);

      const inNumerator =
        role.includes("num") ||
        status === "closed won";

      const inDenominator =
        role.includes("den") ||
        bucket.includes("den") ||
        status === "closed won" ||
        mgr === "in";

      if (inNumerator) numerator += acv;
      if (inDenominator) denominator += acv;
    }

    return {
      numerator,
      denominator,
      pct: safeDivide(numerator, denominator, null),
    };
  }, [filteredFundedRows]);

  const companyFundedValue = companyFundedCalc.pct;

  const companyFundedModalData = useMemo(() => {
    const baseDf = data?.df || {};

    return {
      ...baseDf,
      bl: businessLine === "All" ? (baseDf.bl ?? "All") : businessLine,
      numerator: companyFundedCalc.numerator,
      denominator: companyFundedCalc.denominator,
      providedFundedPct: companyFundedCalc.pct,
      detailRows: filteredFundedRows,
    };
  }, [data?.df, businessLine, companyFundedCalc, filteredFundedRows]);

  const companyPacingToForecastValue = safeDivide(
    companyClosedQTDValue,
    forecastValue,
    null
  );

  const companyCagrValue =
    companyTotalsDerivedMetrics?.cagrRate ??
    companyTotalsDerivedMetrics?.cagr ??
    data?.dr?.closedQtr?.cagrRate ??
    null;

  const companyClosedVsForecastDelta =
    safeSubtract(companyClosedQTDValue, forecastValue, null);

const scopedOpenPipelineFyqKey = useMemo(() => {
  return findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
    "close_fiscal_yearquarter",
    "Close Fiscal Yearquarter",
    "fiscal_yearquarter",
    "Fiscal Yearquarter",
  ]);
}, [rows?.employeeScopeOpportunitySpine]);

const scopedOpenPipelineDrillRows = useMemo(() => {
  if (!Array.isArray(scopedFieldExecutionSpineRows) || scopedFieldExecutionSpineRows.length === 0) {
    return [];
  }

  const accountKey = resolveColumnKey(config?.eso_acct);
  const oppIdKey = resolveColumnKey(config?.eso_opp_id);
  const oppNameKey = resolveColumnKey(config?.eso_opp);
  const stageKey = resolveColumnKey(config?.eso_stage);
  const closeKey = resolveColumnKey(config?.eso_close);
  const businessLineKey = resolveColumnKey(config?.eso_bl);

  const dealReviewShortKey =
    resolveColumnKey(config?.eso_deal_review) ||
    findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
      "deal_review_short",
      "Deal Review Short",
      "deal_review",
      "Deal Review",
    ]);

  const dealReviewDetailsKey =
    resolveColumnKey(config?.eso_deal_review_details) ||
    findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
      "deal_review_c",
      "Deal Review C",
      "deal_review_details",
      "Deal Review Details",
      "deal_review",
      "Deal Review",
    ]);

  return scopedFieldExecutionSpineRows
    .filter(
      (r) =>
        (toNumber(
          scopedFieldExecutionSpineKeys.openPipe
            ? r?.[scopedFieldExecutionSpineKeys.openPipe]
            : null
        ) || 0) > 0
    )
    .map((r) => ({
      opp_owner_name: scopedFieldExecutionSpineKeys.owner
        ? r?.[scopedFieldExecutionSpineKeys.owner] ?? null
        : null,

      account_name: accountKey ? r?.[accountKey] ?? null : null,
      opp_id: oppIdKey ? r?.[oppIdKey] ?? null : null,
      opp_name: oppNameKey ? r?.[oppNameKey] ?? null : null,
      stage_name: stageKey ? r?.[stageKey] ?? null : null,
      close_date: closeKey ? r?.[closeKey] ?? null : null,
      business_line: businessLineKey ? r?.[businessLineKey] ?? null : null,
      fiscal_yearquarter: scopedOpenPipelineFyqKey ? r?.[scopedOpenPipelineFyqKey] ?? null : null,

      open_pipeline_acv: toNumber(
        scopedFieldExecutionSpineKeys.openPipe
          ? r?.[scopedFieldExecutionSpineKeys.openPipe]
          : null
      ) || 0,

      deal_review_short: dealReviewShortKey ? r?.[dealReviewShortKey] ?? null : null,
      deal_review_details: dealReviewDetailsKey ? r?.[dealReviewDetailsKey] ?? null : null,

    }));
}, [
  scopedFieldExecutionSpineRows,
  scopedFieldExecutionSpineKeys,
  config,
  scopedOpenPipelineFyqKey,
]);

const scopedDerivedMetricsSpineRows = useMemo(() => {
  if (!Array.isArray(scopedFieldExecutionSpineRows) || scopedFieldExecutionSpineRows.length === 0) {
    return [];
  }

  const stageKey = resolveColumnKey(config?.eso_stage);
  const closeKey = resolveColumnKey(config?.eso_close);
  const businessLineKey = resolveColumnKey(config?.eso_bl);
  const largeDealBucketKey = resolveColumnKey(config?.eso_ld_bucket);
  const dealReviewShortKey = resolveColumnKey(config?.eso_deal_review);

  return scopedFieldExecutionSpineRows.map((r) => ({
    opp_owner_name: scopedFieldExecutionSpineKeys.owner
      ? r?.[scopedFieldExecutionSpineKeys.owner] ?? null
      : null,

    open_pipeline_acv: scopedFieldExecutionSpineKeys.openPipe
      ? r?.[scopedFieldExecutionSpineKeys.openPipe] ?? null
      : null,

    closed_acv: scopedFieldExecutionSpineKeys.closed
      ? r?.[scopedFieldExecutionSpineKeys.closed] ?? null
      : null,

    stage_name: stageKey ? r?.[stageKey] ?? null : null,
    close_date: closeKey ? r?.[closeKey] ?? null : null,
    business_line: businessLineKey ? r?.[businessLineKey] ?? null : null,
    large_deal_bucket: largeDealBucketKey ? r?.[largeDealBucketKey] ?? null : null,
    deal_review_short: dealReviewShortKey ? r?.[dealReviewShortKey] ?? null : null,
  }));
}, [
  scopedFieldExecutionSpineRows,
  scopedFieldExecutionSpineKeys,
  config,
]);

const derivedMetrics = useDerivedMetrics({
  spineRows: scopedDerivedMetricsSpineRows,
  forecastAmount: scopedForecastValue,
});


const openOpenPipelineDrillForRisk = (riskKey = "all") => {
  setOpenPipelineSelectedRisk(riskKey);
  setOpenPipelineDrillOpen(true);
};


const scopedFieldExecution = useMemo(() => {
  const keysResolved =
    !!scopedFieldExecutionSpineKeys.owner &&
    !!scopedFieldExecutionSpineKeys.openPipe &&
    !!scopedFieldExecutionSpineKeys.closed;

  if (!keysResolved) {
    return {
      forecast: scopedForecastValue,
      pipe: 0,
      closedFiltered: 0,
    };
  }

  const scopedPipe = scopedFieldExecutionSpineRows.reduce(
    (sum, r) => sum + (toNumber(r?.[scopedFieldExecutionSpineKeys.openPipe]) || 0),
    0
  );

  const scopedClosed = scopedFieldExecutionSpineRows.reduce(
    (sum, r) => sum + (toNumber(r?.[scopedFieldExecutionSpineKeys.closed]) || 0),
    0
  );

  return {
    forecast: scopedForecastValue,
    pipe: scopedPipe,
    closedFiltered: scopedClosed,
  };
}, [
  scopedFieldExecutionSpineRows,
  scopedFieldExecutionSpineKeys,
  scopedForecastValue,
]);

  useEffect(() => {
    if (!debugLoggingEnabled) return;
    debugLog("FE owner key:", scopedFieldExecutionSpineKeys.owner);
    debugLog("FE openPipe key:", scopedFieldExecutionSpineKeys.openPipe);
    debugLog("FE closed key:", scopedFieldExecutionSpineKeys.closed);
    debugLog("FE spine sample row:", rows.employeeScopeOpportunitySpine?.[0]);
    debugLog("FE scoped row count:", scopedFieldExecutionSpineRows.length);
    debugLog("FE scoped sample row:", scopedFieldExecutionSpineRows?.[0]);
  }, [
    scopedFieldExecutionSpineKeys,
    rows.employeeScopeOpportunitySpine,
    scopedFieldExecutionSpineRows,
  ]);

const scopedCreateCloseSpineKeys = useMemo(() => {
  return {
    owner:
      resolveColumnKey(config?.eso_opp_owner_name) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "opp_owner_name",
        "Opp Owner Name",
        "owner_name",
        "Owner Name",
      ]),

    isCreateAndClose:
      resolveColumnKey(config?.eso_is_create_and_close) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "is_create_and_close",
        "Is Create And Close",
      ]),

    ccOpen:
      resolveColumnKey(config?.eso_ccop) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "is_create_and_close_open_pipe",
        "Is Create And Close Open Pipe",
      ]),

    openPipe:
      resolveColumnKey(config?.eso_open_pipeline_acv) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "open_pipeline_acv",
        "Open Pipeline Acv",
      ]),

    closed:
      resolveColumnKey(config?.eso_closed_acv) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "closed_acv",
        "Closed Acv",
      ]),

    accountName:
      resolveColumnKey(config?.eso_acct) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "acct_name",
        "Acct Name",
        "account_name",
        "Account Name",
      ]),

    oppId:
      resolveColumnKey(config?.eso_opp_id) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "opp_id",
        "Opp Id",
      ]),

    oppName:
      resolveColumnKey(config?.eso_opp) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "opp_name",
        "Opp Name",
      ]),

    stageName:
      resolveColumnKey(config?.eso_stage) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "stage_name",
        "Stage Name",
      ]),

    closeDate:
      resolveColumnKey(config?.eso_close) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "close_date",
        "Close Date",
      ]),

    businessLine:
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "business_line",
        "Business Line",
      ]),

    fyq:
      resolveColumnKey(config?.eso_fyq) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "close_fiscal_yearquarter",
        "Close Fiscal Yearquarter",
        "fiscal_yearquarter",
        "Fiscal Yearquarter",
      ]),
  };
}, [config, rows?.employeeScopeOpportunitySpine]);

const scopedCreateCloseSpineRows = useMemo(() => {
  const scoped = filterRowsByScope(
    rows?.employeeScopeOpportunitySpine || [],
    fieldScopeBridge,
    {
      ownerKey: scopedCreateCloseSpineKeys.owner,
      territoryKey: null,
    }
  );

  return filterRowsByBusinessLine(
    scoped,
    businessLine,
    scopedCreateCloseSpineKeys.businessLine
  );
}, [
  rows?.employeeScopeOpportunitySpine,
  fieldScopeBridge,
  scopedCreateCloseSpineKeys,
  businessLine,
]);

const createCloseMetrics = useMemo(() => {
  const canCompute =
    !!scopedCreateCloseSpineKeys.isCreateAndClose &&
    !!scopedCreateCloseSpineKeys.ccOpen &&
    !!scopedCreateCloseSpineKeys.openPipe &&
    !!scopedCreateCloseSpineKeys.closed &&
    scopedCreateCloseSpineRows.length > 0;

  if (!canCompute) {
    return {
      wonQTD: scopedCreateCloseSummary.wonQTD,
      openPipeQTD: scopedCreateCloseSummary.openPipeQTD,
    };
  }

  const wonRows = scopedCreateCloseSpineRows.filter(
    (r) => toNumber(r?.[scopedCreateCloseSpineKeys.isCreateAndClose]) === 1
  );

  const openRows = scopedCreateCloseSpineRows.filter(
    (r) => toNumber(r?.[scopedCreateCloseSpineKeys.ccOpen]) === 1
  );

  return {
    wonQTD: wonRows.reduce(
      (sum, r) => sum + (toNumber(r?.[scopedCreateCloseSpineKeys.closed]) || 0),
      0
    ),
    openPipeQTD: openRows.reduce(
      (sum, r) => sum + (toNumber(r?.[scopedCreateCloseSpineKeys.openPipe]) || 0),
      0
    ),
  };
}, [scopedCreateCloseSpineRows, scopedCreateCloseSpineKeys, scopedCreateCloseSummary]);

  const scopedCreateCloseDrillRows = useMemo(() => {
    if (!Array.isArray(scopedCreateCloseSpineRows) || scopedCreateCloseSpineRows.length === 0) {
      return [];
    }

    const metric = String(createCloseDrillMetric ?? "").trim().toLowerCase();

    const baseRows =
      metric === "open pipe qtd"
        ? scopedCreateCloseSpineRows.filter(
            (r) => toNumber(r?.[scopedCreateCloseSpineKeys.ccOpen]) === 1
          )
        : scopedCreateCloseSpineRows.filter(
            (r) => toNumber(r?.[scopedCreateCloseSpineKeys.isCreateAndClose]) === 1
          );

    return baseRows.map((r) => ({
      opp_owner_name: scopedCreateCloseSpineKeys.owner
        ? r?.[scopedCreateCloseSpineKeys.owner] ?? null
        : null,

      account_name: scopedCreateCloseSpineKeys.accountName
        ? r?.[scopedCreateCloseSpineKeys.accountName] ?? null
        : null,

      stage_name: scopedCreateCloseSpineKeys.stageName
        ? r?.[scopedCreateCloseSpineKeys.stageName] ?? null
        : null,

      close_date: scopedCreateCloseSpineKeys.closeDate
        ? r?.[scopedCreateCloseSpineKeys.closeDate] ?? null
        : null,

      opp_id: scopedCreateCloseSpineKeys.oppId
        ? r?.[scopedCreateCloseSpineKeys.oppId] ?? null
        : null,

      opp_name: scopedCreateCloseSpineKeys.oppName
        ? r?.[scopedCreateCloseSpineKeys.oppName] ?? null
        : null,

      business_line: scopedCreateCloseSpineKeys.businessLine
        ? r?.[scopedCreateCloseSpineKeys.businessLine] ?? null
        : null,

      fiscal_yearquarter: scopedCreateCloseSpineKeys.fyq
        ? r?.[scopedCreateCloseSpineKeys.fyq] ?? null
        : null,

      cc_qtd_closed_won: toNumber(
        scopedCreateCloseSpineKeys.closed
          ? r?.[scopedCreateCloseSpineKeys.closed]
          : null
      ) || 0,

      cc_qtd_open_pipe: toNumber(
        scopedCreateCloseSpineKeys.openPipe
          ? r?.[scopedCreateCloseSpineKeys.openPipe]
          : null
      ) || 0,
    }));
  }, [scopedCreateCloseSpineRows, scopedCreateCloseSpineKeys, createCloseDrillMetric]);

  const scopedLargeDealsSpineKeys = useMemo(() => {
    return {
      owner:
        resolveColumnKey(config?.eso_opp_owner_name) ||
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "opp_owner_name",
          "Opp Owner Name",
          "owner_name",
          "Owner Name",
        ]),

      accountName:
        resolveColumnKey(config?.eso_acct) ||
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "acct_name",
          "Acct Name",
          "account_name",
          "Account Name",
        ]),

      oppId:
        resolveColumnKey(config?.eso_opp_id) ||
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "opp_id",
          "Opp Id",
        ]),

      oppName:
        resolveColumnKey(config?.eso_opp) ||
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "opp_name",
          "Opp Name",
        ]),

      stageName:
        resolveColumnKey(config?.eso_stage) ||
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "stage_name",
          "Stage Name",
        ]),

      closeDate:
        resolveColumnKey(config?.eso_close) ||
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "close_date",
          "Close Date",
        ]),

      businessLine:
        resolveColumnKey(config?.eso_bl) ||
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "business_line",
          "Business Line",
        ]),

      bucket:
        resolveColumnKey(config?.eso_ld_bucket) ||
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "large_deal_bucket",
          "Large Deal Bucket",
        ]),

      closedAcv:
        resolveColumnKey(config?.eso_closed_acv) ||
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "closed_acv",
          "Closed Acv",
        ]),

      openPipeAcv:
        resolveColumnKey(config?.eso_open_pipeline_acv) ||
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "open_pipeline_acv",
          "Open Pipeline Acv",
        ]),

      dealReview:
        resolveColumnKey(config?.eso_deal_review) ||
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "deal_review_short",
          "Deal Review Short",
          "deal_review",
          "Deal Review",
        ]),

      dealReviewDetails:
        resolveColumnKey(config?.eso_deal_review_details) ||
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "deal_review_c",
          "Deal Review C",
          "deal_review_details",
          "Deal Review Details",
          "deal_review",
          "Deal Review",
        ]),

      fyq:
        findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
          "close_fiscal_yearquarter",
          "Close Fiscal Yearquarter",
          "fiscal_yearquarter",
          "Fiscal Yearquarter",
        ]),
    };
  }, [config, rows?.employeeScopeOpportunitySpine]);

  const largeDealsPyKeys = useMemo(() => {
    return {
      owner:
        resolveColumnKey(config?.ldpy_opp_owner_name) ||
        findRowKeyByCandidates(rows?.largeDealsPyDetail || [], [
          "opp_owner_name",
          "Opp Owner Name",
        ]),

      accountName:
        resolveColumnKey(config?.ldpy_account_name) ||
        findRowKeyByCandidates(rows?.largeDealsPyDetail || [], [
          "account_name",
          "Account Name",
        ]),

      oppId:
        resolveColumnKey(config?.ldpy_opp_id) ||
        findRowKeyByCandidates(rows?.largeDealsPyDetail || [], [
          "opp_id",
          "Opp Id",
        ]),

      oppName:
        resolveColumnKey(config?.ldpy_opp_name) ||
        findRowKeyByCandidates(rows?.largeDealsPyDetail || [], [
          "opp_name",
          "Opp Name",
        ]),

      stageName:
        resolveColumnKey(config?.ldpy_stage_name) ||
        findRowKeyByCandidates(rows?.largeDealsPyDetail || [], [
          "stage_name",
          "Stage Name",
        ]),

      closeDate:
        resolveColumnKey(config?.ldpy_close_date) ||
        findRowKeyByCandidates(rows?.largeDealsPyDetail || [], [
          "close_date",
          "Close Date",
        ]),

      businessLine:
        resolveColumnKey(config?.ldpy_business_line) ||
        findRowKeyByCandidates(rows?.largeDealsPyDetail || [], [
          "business_line",
          "Business Line",
        ]),

      fyq:
        resolveColumnKey(config?.ldpy_fiscal_yearquarter) ||
        findRowKeyByCandidates(rows?.largeDealsPyDetail || [], [
          "close_fiscal_yearquarter",
          "Close Fiscal Yearquarter",
          "fiscal_yearquarter",
          "Fiscal Yearquarter",
        ]),

      bucket:
        resolveColumnKey(config?.ldpy_large_deal_bucket) ||
        findRowKeyByCandidates(rows?.largeDealsPyDetail || [], [
          "large_deal_bucket",
          "Large Deal Bucket",
        ]),

      closedAcv:
        resolveColumnKey(config?.ldpy_closed_acv) ||
        findRowKeyByCandidates(rows?.largeDealsPyDetail || [], [
          "closed_acv",
          "Closed Acv",
        ]),

      dealReview:
        resolveColumnKey(config?.ldpy_deal_review_short) ||
        findRowKeyByCandidates(rows?.largeDealsPyDetail || [], [
          "deal_review_short_version_c",
          "Deal Review Short Version C",
          "deal_review_short",
          "Deal Review Short",
        ]),

      dealReviewDetails:
        resolveColumnKey(config?.ldpy_deal_review_details) ||
        findRowKeyByCandidates(rows?.largeDealsPyDetail || [], [
          "deal_review_c",
          "Deal Review C",
          "deal_review_details",
          "Deal Review Details",
        ]),
    };
  }, [config, rows?.largeDealsPyDetail]);

  useEffect(() => {
    if (!debugLoggingEnabled) return;
    debugLog("PY rows key exists:", Object.keys(rows || {}));
    debugLog("PY rows length:", rows?.largeDealsPyDetail?.length ?? null);
    debugLog("PY rows sample:", rows?.largeDealsPyDetail?.slice?.(0, 3) ?? null);
    debugLog("PY keys:", largeDealsPyKeys);
  }, [debugLoggingEnabled, rows, largeDealsPyKeys]);

  const scopedLargeDealsPyDrillRows = useMemo(() => {
    const pyRows = Array.isArray(rows?.largeDealsPyDetail) ? rows.largeDealsPyDetail : [];
    if (!pyRows.length) return [];

    // TEMP DEBUG: bypass employee scope filtering for PY
    const filtered = filterRowsByBusinessLine(
      pyRows,
      businessLine,
      largeDealsPyKeys.businessLine
    );

    return filtered.map((r) => ({
      opp_owner_name: largeDealsPyKeys.owner ? r?.[largeDealsPyKeys.owner] ?? null : null,
      account_name: largeDealsPyKeys.accountName ? r?.[largeDealsPyKeys.accountName] ?? null : null,
      stage_name: largeDealsPyKeys.stageName ? r?.[largeDealsPyKeys.stageName] ?? null : null,
      close_date: largeDealsPyKeys.closeDate ? r?.[largeDealsPyKeys.closeDate] ?? null : null,
      opp_id: largeDealsPyKeys.oppId ? r?.[largeDealsPyKeys.oppId] ?? null : null,
      opp_name: largeDealsPyKeys.oppName ? r?.[largeDealsPyKeys.oppName] ?? null : null,
      business_line: largeDealsPyKeys.businessLine ? r?.[largeDealsPyKeys.businessLine] ?? null : null,
      fiscal_yearquarter: largeDealsPyKeys.fyq ? r?.[largeDealsPyKeys.fyq] ?? null : null,
      large_deal_bucket: largeDealsPyKeys.bucket ? r?.[largeDealsPyKeys.bucket] ?? null : null,
      closed_acv: toNumber(
        largeDealsPyKeys.closedAcv ? r?.[largeDealsPyKeys.closedAcv] : null
      ) || 0,
      open_pipeline_acv: 0,
      deal_review_short: largeDealsPyKeys.dealReview ? r?.[largeDealsPyKeys.dealReview] ?? null : null,
      deal_review_html: largeDealsPyKeys.dealReviewDetails ? r?.[largeDealsPyKeys.dealReviewDetails] ?? null : null,
    }));
  }, [rows?.largeDealsPyDetail, largeDealsPyKeys, businessLine]);

    const selectedFiscalYearquarter =
      pgSummary?.fyq ||
      fa?.fiscalYearquarter ||
      firstNonEmpty(
        rows?.employeeScopeOpportunitySpine || [],
        scopedLargeDealsSpineKeys?.fyq
      ) ||
      null;

    const priorYearFiscalYearquarter = useMemo(() => {
      const s = String(selectedFiscalYearquarter ?? "").trim();
      const match = s.match(/^(\d{4})-Q([1-4])$/i);
      if (!match) return null;
      return `${Number(match[1]) - 1}-Q${match[2]}`;
    }, [selectedFiscalYearquarter]);

  const scopedLargeDealsSpineRows = useMemo(() => {
    const scoped = filterRowsByScope(
      rows?.employeeScopeOpportunitySpine || [],
      fieldScopeBridge,
      {
        ownerKey: scopedLargeDealsSpineKeys.owner,
        territoryKey: null,
      }
    );

    return filterRowsByBusinessLine(
      scoped,
      businessLine,
      scopedLargeDealsSpineKeys.businessLine
    );
  }, [
    rows?.employeeScopeOpportunitySpine,
    fieldScopeBridge,
    scopedLargeDealsSpineKeys,
    businessLine,
  ]);

  const scopedLargeDealsSummary = useMemo(() => {
    const hasKeys =
      !!scopedLargeDealsSpineKeys.stageName &&
      !!scopedLargeDealsSpineKeys.bucket &&
      !!scopedLargeDealsSpineKeys.fyq;

    if (!hasKeys || scopedLargeDealsSpineRows.length === 0) {
      const pyFromDrill = Array.isArray(scopedLargeDealsPyDrillRows)
        ? scopedLargeDealsPyDrillRows.filter(
            (r) => (toNumber(r?.closed_acv) || 0) >= 500000
          ).length
        : 0;

      return {
        wonQTD: 0,
        wonQTDYoy: co.deals500k_won_qtd_yoy,
        openPipeQTD: 0,
        openPipeQTDYoy: co.deals500k_open_pipe_yoy,
        py: pyFromDrill,
      };
    }

    const is500kPlus = (row) =>
      String(row?.[scopedLargeDealsSpineKeys.bucket] ?? "").trim() === "$500K+";

    const stageValue = (row) =>
      String(row?.[scopedLargeDealsSpineKeys.stageName] ?? "").trim().toLowerCase();

    const fyqValue = (row) =>
      String(row?.[scopedLargeDealsSpineKeys.fyq] ?? "").trim();

    const wonQTD = scopedLargeDealsSpineRows.filter(
      (r) => is500kPlus(r) && stageValue(r) === "closed won"
    ).length;

    const openPipeQTD = scopedLargeDealsSpineRows.filter(
      (r) =>
        is500kPlus(r) &&
        !["closed won", "closed lost"].includes(stageValue(r))
    ).length;

    let py = co.deals500k_py;

    if (Array.isArray(scopedLargeDealsPyDrillRows) && scopedLargeDealsPyDrillRows.length >= 0) {
      py = scopedLargeDealsPyDrillRows.filter(
        (r) => (toNumber(r?.closed_acv) || 0) >= 500000
      ).length;
    }

    if (debugLoggingEnabled) {
      debugLog("LD selected FYQ / PY:", {
        selectedFiscalYearquarter,
        priorYearFiscalYearquarter,
        py: co.deals500k_py,
        computedPy: py,
      });

      debugLog("LD FYQs present:", [
          ...new Set(
            scopedLargeDealsSpineRows
              .map((r) => String(r?.[scopedLargeDealsSpineKeys.fyq] ?? "").trim())
              .filter(Boolean)
          ),
        ]);

        debugLog("LD business lines present:", [
          ...new Set(
            scopedLargeDealsSpineRows
              .map((r) => String(r?.[scopedLargeDealsSpineKeys.businessLine] ?? "").trim())
              .filter(Boolean)
          ),
        ]);

        debugLog("LD owners present sample:", [
          ...new Set(
            scopedLargeDealsSpineRows
              .map((r) => String(r?.[scopedLargeDealsSpineKeys.owner] ?? "").trim())
              .filter(Boolean)
          ),
        ].slice(0, 25));


    }



    return {
      wonQTD,
      wonQTDYoy: co.deals500k_won_qtd_yoy,
      openPipeQTD,
      openPipeQTDYoy: co.deals500k_open_pipe_yoy,
      py,
    };
    }, [
      scopedLargeDealsSpineRows,
      scopedLargeDealsSpineKeys,
      scopedLargeDealsPyDrillRows,
      co,
      debugLoggingEnabled,
      selectedFiscalYearquarter,
      priorYearFiscalYearquarter,
    ]);

useEffect(() => {
  if (!debugLoggingEnabled) return;
  debugLog("LD owner key:", scopedLargeDealsSpineKeys.owner);
  debugLog("LD stage key:", scopedLargeDealsSpineKeys.stageName);
  debugLog("LD bucket key:", scopedLargeDealsSpineKeys.bucket);
  debugLog("LD closedAcv key:", scopedLargeDealsSpineKeys.closedAcv);
  debugLog("LD openPipeAcv key:", scopedLargeDealsSpineKeys.openPipeAcv);
  debugLog("LD FYQ key:", scopedLargeDealsSpineKeys.fyq);

  debugLog("LD spine sample row:", rows.employeeScopeOpportunitySpine?.[0]);
  debugLog("LD scoped row count:", scopedLargeDealsSpineRows.length);
  debugLog("LD scoped sample row:", scopedLargeDealsSpineRows?.[0]);
  debugLog("LD spine rows sample:", scopedLargeDealsSpineRows.slice(0, 3));
  debugLog("LD spine keys:", scopedLargeDealsSpineKeys);

  const sampleCounts = (scopedLargeDealsSpineRows || []).reduce(
    (acc, r) => {
      const bucket = scopedLargeDealsSpineKeys.bucket
        ? String(r?.[scopedLargeDealsSpineKeys.bucket] ?? "").trim()
        : "";
      const stage = scopedLargeDealsSpineKeys.stageName
        ? String(r?.[scopedLargeDealsSpineKeys.stageName] ?? "").trim().toLowerCase()
        : "";

      if (bucket === "$500K+") acc.bucket500k += 1;
      if (stage === "closed won") acc.closedWon += 1;
      if (!["closed won", "closed lost"].includes(stage)) acc.openPipe += 1;
      if (bucket === "$500K+" && !["closed won", "closed lost"].includes(stage)) acc.openPipe500k += 1;

      return acc;
    },
    { bucket500k: 0, closedWon: 0, openPipe: 0, openPipe500k: 0 }
  );

  debugLog("LD derived counts:", sampleCounts);
}, [
  scopedLargeDealsSpineKeys,
  scopedLargeDealsSpineRows,
  debugLoggingEnabled,
  rows.employeeScopeOpportunitySpine,
]);

  const scopedLargeDealsDrillRows = useMemo(() => {
    const metric = String(largeDealsDrillMetric ?? "").trim().toLowerCase();

    if (metric === "prior year") {
      return scopedLargeDealsPyDrillRows;
    }

    if (!Array.isArray(scopedLargeDealsSpineRows) || scopedLargeDealsSpineRows.length === 0) {
      return [];
    }

    const stageValue = (row) =>
      String(row?.[scopedLargeDealsSpineKeys.stageName] ?? "").trim().toLowerCase();

    let baseRows = [];

    if (metric === "open pipeline qtd") {
      baseRows = scopedLargeDealsSpineRows.filter(
        (r) => !["closed won", "closed lost"].includes(stageValue(r))
      );
    } else if (metric === "won qtd") {
      baseRows = scopedLargeDealsSpineRows.filter(
        (r) => stageValue(r) === "closed won"
      );
    } else {
      baseRows = [];
    }

    return baseRows.map((r) => ({
      opp_owner_name: scopedLargeDealsSpineKeys.owner
        ? r?.[scopedLargeDealsSpineKeys.owner] ?? null
        : null,

      account_name: scopedLargeDealsSpineKeys.accountName
        ? r?.[scopedLargeDealsSpineKeys.accountName] ?? null
        : null,

      stage_name: scopedLargeDealsSpineKeys.stageName
        ? r?.[scopedLargeDealsSpineKeys.stageName] ?? null
        : null,

      close_date: scopedLargeDealsSpineKeys.closeDate
        ? r?.[scopedLargeDealsSpineKeys.closeDate] ?? null
        : null,

      opp_id: scopedLargeDealsSpineKeys.oppId
        ? r?.[scopedLargeDealsSpineKeys.oppId] ?? null
        : null,

      opp_name: scopedLargeDealsSpineKeys.oppName
        ? r?.[scopedLargeDealsSpineKeys.oppName] ?? null
        : null,

      business_line: scopedLargeDealsSpineKeys.businessLine
        ? r?.[scopedLargeDealsSpineKeys.businessLine] ?? null
        : null,

      fiscal_yearquarter: scopedLargeDealsSpineKeys.fyq
        ? r?.[scopedLargeDealsSpineKeys.fyq] ?? null
        : null,

      large_deal_bucket: scopedLargeDealsSpineKeys.bucket
        ? r?.[scopedLargeDealsSpineKeys.bucket] ?? null
        : null,

      closed_acv: toNumber(
        scopedLargeDealsSpineKeys.closedAcv
          ? r?.[scopedLargeDealsSpineKeys.closedAcv]
          : null
      ) || 0,

      open_pipeline_acv: toNumber(
        scopedLargeDealsSpineKeys.openPipeAcv
          ? r?.[scopedLargeDealsSpineKeys.openPipeAcv]
          : null
      ) || 0,

      deal_review_short: scopedLargeDealsSpineKeys.dealReview
        ? r?.[scopedLargeDealsSpineKeys.dealReview] ?? null
        : null,

      deal_review_html: scopedLargeDealsSpineKeys.dealReviewDetails
        ? r?.[scopedLargeDealsSpineKeys.dealReviewDetails] ?? null
        : null,
    }));
  }, [
    scopedLargeDealsSpineRows,
    scopedLargeDealsSpineKeys,
    scopedLargeDealsPyDrillRows,
    largeDealsDrillMetric,
  ]);

  const executiveInsights = useExecutiveInsights({
    derivedMetrics,
  });

  const scopedDerivedMetrics = useDerivedMetrics({
    spineRows: scopedDerivedMetricsSpineRows,
    forecastAmount: scopedForecastValue,
  });

  const companyExecutiveInsights = useExecutiveInsights({
    derivedMetrics: companyTotalsDerivedMetrics,
  });

  const scopedExecutiveInsights = useExecutiveInsights({
    derivedMetrics: scopedDerivedMetrics,
  });

  const executiveInsightItems = useMemo(() => {
    return companyExecutiveInsights?.company?.items || [];
  }, [companyExecutiveInsights]);

  const activeExecutiveInsight =
    executiveInsightItems[executiveInsightIndex] ||
    companyExecutiveInsights?.company?.active ||
    null;

  const openPipelineHealthSummary =
    scopedExecutiveInsights?.fieldExecution?.summary || {
      totalAmount: 0,
      items: [],
    };

  const fieldExecutionInsightItems =
    scopedExecutiveInsights?.fieldExecution?.items || [];

  const currentFieldExecutionInsight =
    fieldExecutionInsightItems[fieldExecutionInsightIndex] ||
    scopedExecutiveInsights?.fieldExecution?.active ||
    null;

    useEffect(() => {
      if (fieldExecutionInsightPaused) return;
      if (!fieldExecutionInsightItems.length) return;

      const t = setInterval(() => {
        setFieldExecutionInsightIndex((prev) => (prev + 1) % fieldExecutionInsightItems.length);
      }, 4000);

      return () => clearInterval(t);
    }, [fieldExecutionInsightPaused, fieldExecutionInsightItems.length]);

    useEffect(() => {
      setFieldExecutionInsightIndex(0);
    }, [fieldExecutionInsightItems.length]);

  const goToPrevExecutiveInsight = () => {
    if (!executiveInsightItems.length) return;
    setExecutiveInsightIndex((prev) =>
      (prev - 1 + executiveInsightItems.length) % executiveInsightItems.length
    );
    setExecutiveInsightProgress(0);
  };

  const jumpToExecutiveInsight = (index) => {
    if (!executiveInsightItems.length) return;

    const safeIndex = Math.max(0, Math.min(index, executiveInsightItems.length - 1));
    setExecutiveInsightIndex(safeIndex);
    setExecutiveInsightProgress(0);
  };

  const goToNextExecutiveInsight = () => {
    if (!executiveInsightItems.length) return;
    setExecutiveInsightIndex((prev) =>
      (prev + 1) % executiveInsightItems.length
    );
    setExecutiveInsightProgress(0);
  };

  
  useEffect(() => {
    if (executiveInsightPaused) {
      return;
    }
    if (executiveInsightItems.length <= 1) {
      setExecutiveInsightProgress(0);
      return;
    }

    const cycleMs = 4800;
    const fillMs = 4200;
    const pauseMs = cycleMs - fillMs;
    const tickMs = 40;

    let elapsed = 0;

    setExecutiveInsightProgress(0);

    const t = setInterval(() => {
      elapsed += tickMs;

      if (elapsed <= fillMs) {
        setExecutiveInsightProgress(elapsed / fillMs);
        return;
      }

      setExecutiveInsightProgress(1);

      if (elapsed >= fillMs + pauseMs) {
        setExecutiveInsightIndex((prev) => (prev + 1) % executiveInsightItems.length);
        elapsed = 0;
        setExecutiveInsightProgress(0);
      }
    }, tickMs);

    return () => clearInterval(t);
  }, [executiveInsightPaused, executiveInsightItems.length]);

  useEffect(() => {
    if (!debugLoggingEnabled) return;
    debugLog("Executive items:", executiveInsightItems.map((x) => x.teaser));
    debugLog("Executive index:", executiveInsightIndex);
    debugLog("Executive active teaser:", activeExecutiveInsight?.teaser);
    debugLog("Executive paused:", executiveInsightPaused);
  }, [
    executiveInsightItems,
    executiveInsightIndex,
    activeExecutiveInsight,
    executiveInsightPaused,
  ]);

  useEffect(() => {
    setExecutiveInsightIndex(0);
    setExecutiveInsightProgress(0);
  }, [executiveInsightItems.length]);

  const handleClearDebugLogs = () => {
    clearDebugLogs();
    setDebugLogs(getDebugLogs());
  };

  const handleToggleDebugLogging = () => {
    const next = !debugLoggingEnabled;
    setDebugEnabled(next);
    setDebugLoggingEnabled(next);
    debugLog("Debug logging", next ? "enabled" : "disabled");
    setDebugLogs(getDebugLogs());
  };

  const handleRefreshDebugLogs = () => {
    setDebugLogs(getDebugLogs());
  };

const scopedHorsemanEsoKeys = useMemo(() => {
  return {
    owner:
      resolveColumnKey(config?.eso_opp_owner_name) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "opp_owner_name",
        "Opp Owner Name",
        "owner_name",
        "Owner Name",
      ]),

    source:
      resolveColumnKey(config?.eso_opp_source) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "opportunity_source",
        "Opportunity Source",
      ]),

    outcome:
      resolveColumnKey(config?.eso_horseman_outcome) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "horseman_outcome",
        "Horseman Outcome",
      ]),

    closedAcv:
      resolveColumnKey(config?.eso_closed_acv) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "closed_acv",
        "Closed Acv",
      ]),

    openPipeAcv:
      resolveColumnKey(config?.eso_open_pipeline_acv) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "open_pipeline_acv",
        "Open Pipeline Acv",
      ]),

    businessLine:
      resolveColumnKey(config?.eso_bl) ||
      findRowKeyByCandidates(rows?.employeeScopeOpportunitySpine || [], [
        "business_line",
        "Business Line",
      ]),

    hmSourceOut: resolveColumnKey(config?.hm_source),
    hmOutcomeOut: resolveColumnKey(config?.hm_outcome),
    hmValueOut: resolveColumnKey(config?.hm_value),
  };
}, [config, rows?.employeeScopeOpportunitySpine]);

  const scopedHorsemanEsoRows = useMemo(() => {
    const scoped = filterRowsByScope(
      rows?.employeeScopeOpportunitySpine || [],
      fieldScopeBridge,
      {
        ownerKey: scopedHorsemanEsoKeys.owner,
        territoryKey: null,
      }
    );

    return filterRowsByBusinessLine(
      scoped,
      businessLine,
      scopedHorsemanEsoKeys.businessLine
    );
  }, [
    rows?.employeeScopeOpportunitySpine,
    fieldScopeBridge,
    scopedHorsemanEsoKeys,
    businessLine,
  ]);

const horsemanRowsFromEso = useMemo(() => {
  const {
    source,
    outcome,
    closedAcv,
    openPipeAcv,
    hmSourceOut,
    hmOutcomeOut,
    hmValueOut,
  } = scopedHorsemanEsoKeys;

  const canBuild =
    !!source &&
    !!outcome &&
    !!closedAcv &&
    !!openPipeAcv &&
    !!hmSourceOut &&
    !!hmOutcomeOut &&
    !!hmValueOut &&
    Array.isArray(scopedHorsemanEsoRows) &&
    scopedHorsemanEsoRows.length > 0;

  if (!canBuild) {
    return rows?.horseman || [];
  }

  const buckets = new Map();

  for (const r of scopedHorsemanEsoRows) {
    const src = String(r?.[source] ?? "").trim();
    const out = String(r?.[outcome] ?? "").trim();

    if (!src || !out) continue;

    const outNorm = out.toLowerCase();
    const value =
      outNorm === "won"
        ? toNumber(r?.[closedAcv]) || 0
        : outNorm === "lost"
          ? 0
          : toNumber(r?.[openPipeAcv]) || 0;

    const bucketKey = `${src}__${out}`;

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        [hmSourceOut]: src,
        [hmOutcomeOut]: out,
        [hmValueOut]: 0,
      });
    }

    const cur = buckets.get(bucketKey);
    cur[hmValueOut] += value;
  }

  return Array.from(buckets.values());
}, [scopedHorsemanEsoKeys, scopedHorsemanEsoRows, rows?.horseman]);

const horsemanDetailRowsFromEso = useMemo(() => {
  if (!Array.isArray(scopedHorsemanEsoRows) || scopedHorsemanEsoRows.length === 0) {
    return [];
  }

  return scopedHorsemanEsoRows.map((r) => {
    const outcomeRaw = scopedHorsemanEsoKeys.outcome
      ? String(r?.[scopedHorsemanEsoKeys.outcome] ?? "").trim().toLowerCase()
      : "";

    const arrValue =
      outcomeRaw === "won"
        ? toNumber(
            scopedHorsemanEsoKeys.closedAcv
              ? r?.[scopedHorsemanEsoKeys.closedAcv]
              : null
          ) || 0
        : outcomeRaw === "lost"
          ? 0
          : toNumber(
              scopedHorsemanEsoKeys.openPipeAcv
                ? r?.[scopedHorsemanEsoKeys.openPipeAcv]
                : null
            ) || 0;

    return {
      eso_opp_id: resolveColumnKey(config?.eso_opp_id)
        ? r?.[resolveColumnKey(config?.eso_opp_id)]
        : null,

      eso_opp: resolveColumnKey(config?.eso_opp)
        ? r?.[resolveColumnKey(config?.eso_opp)]
        : null,

      eso_opp_owner_name: scopedHorsemanEsoKeys.owner
        ? r?.[scopedHorsemanEsoKeys.owner]
        : null,

      eso_stage: resolveColumnKey(config?.eso_stage)
        ? r?.[resolveColumnKey(config?.eso_stage)]
        : null,

      eso_close: resolveColumnKey(config?.eso_close)
        ? r?.[resolveColumnKey(config?.eso_close)]
        : null,

      eso_arr: arrValue,

      eso_source: scopedHorsemanEsoKeys.source
        ? r?.[scopedHorsemanEsoKeys.source]
        : null,

      eso_outcome: scopedHorsemanEsoKeys.outcome
        ? r?.[scopedHorsemanEsoKeys.outcome]
        : null,

      eso_deal_review: resolveColumnKey(config?.eso_deal_review_details)
        ? r?.[resolveColumnKey(config?.eso_deal_review_details)]
        : null,

      eso_deal_review_short: resolveColumnKey(config?.eso_deal_review)
        ? r?.[resolveColumnKey(config?.eso_deal_review)]
        : null,
    };
  });
}, [scopedHorsemanEsoRows, scopedHorsemanEsoKeys, config]);

  useEffect(() => {
    if (!debugLoggingEnabled) return;
    debugLog("Horseman ESO keys:", scopedHorsemanEsoKeys);
    debugLog("Horseman ESO scoped rows:", scopedHorsemanEsoRows.length);
    debugLog("Horseman output rows:", horsemanRowsFromEso);
  }, [scopedHorsemanEsoKeys, scopedHorsemanEsoRows, horsemanRowsFromEso]);

  useEffect(() => {
    if (!debugLoggingEnabled) return;
    debugLog("CC metric:", createCloseDrillMetric);
    debugLog("CC keys:", scopedCreateCloseSpineKeys);
    debugLog("CC spine sample row:", scopedCreateCloseSpineRows?.[0]);
    debugLog("CC drill rows count:", scopedCreateCloseDrillRows.length);
    debugLog("CC drill sample row:", scopedCreateCloseDrillRows?.[0]);
  }, [
    createCloseDrillMetric,
    scopedCreateCloseSpineKeys,
    scopedCreateCloseSpineRows,
    scopedCreateCloseDrillRows,
  ]);

  useEffect(() => {
  const handler = (e) => {
    if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "y") {
      setShowArchitecture(true);
    }
  };

  window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const aeDrillRowsScoped = useMemo(() => {
    return aeDrillMetric === "AEs > 3x Stage 4 Cov" ? scopedAeAboveThresholdRows : scopedAeZeroAcvRows;
  }, [aeDrillMetric, scopedAeAboveThresholdRows, scopedAeZeroAcvRows]);

  return (
    <div
      style={{
        ...styles.appContainer,
        paddingLeft: isPinned ? SIDEBAR_WIDTH + 12 : 12,
        transition: "padding-left 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <style>{`
        @keyframes saltPersonaFadeIn {
          0% { opacity: 0.72; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }


        @keyframes executiveSparklePulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 0 rgba(37,99,235,0));
          }
          50% {
            transform: scale(1.08);
            filter: drop-shadow(0 0 8px rgba(37,99,235,0.28));
          }
        }

      `}</style>

      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <img src="/iterable-main_logo_2026.svg" alt="Iterable" style={styles.logo} />
          {!isPinned && (
            <IconButton onClick={() => setLeftNavOpen(true)} selected={leftNavOpen}>
              ☰ Views
            </IconButton>
          )}
          <div style={styles.viewPill}>{activePersona} View</div>
          <div style={styles.betaTag}>BETA</div>

          <BusinessLineToggle
            value={businessLine}
            onChange={setBusinessLine}
          />
        </div>

        <div style={styles.headerCenter}>
          <div
            onDoubleClick={() => setDebugConsoleOpen(true)}
            title="(hidden) Double-click to open Debug Console"
            style={styles.saltTitle}
          >
            SALT Report
          </div>
        </div>

        <div style={styles.headerRight}>
          {headerMetaText && (
            <div style={styles.headerMetaGroup}>
              <span style={styles.headerMetaDot} />
              <span style={styles.headerMetaText}>{headerMetaText}</span>
            </div>
          )}

          <IconButton
            title="Definitions"
            onClick={() => openDefs(`view_${activePersona.toLowerCase()}`)}
          >
            Definitions
          </IconButton>
        </div>
      </header>

      <div
        ref={scrollAreaRef}
        style={{
          ...styles.scrollArea,
          opacity: personaTransitioning ? 0.94 : 1,
          transform: personaTransitioning ? "translateY(2px)" : "translateY(0)",
          transition: prefersReducedMotion ? "none" : "opacity 180ms ease, transform 180ms ease",
          animation: personaTransitioning || prefersReducedMotion ? "none" : "saltPersonaFadeIn 220ms ease",
        }}
      >
        {activePersona === "CFO" && hasCFO ? (
          <Surface padding={24}>
            <SurfaceHeader
              title="CFO TREEMAP"
              subtitle="Mix by product/category (size + optional color metric)"
              onInfo={() => openDefs("cfo_treemap")}
            />

            <InDevelopmentBanner text="Preview view. Core finance visuals are available while the broader CFO scorecard, supporting KPIs, and interaction patterns are still being defined." />

            <div style={{ height: 520, marginTop: 14 }}>
              <CFOTreemapSection rows={data?.cfo?.treemapRows ?? []} config={data?.cfo?.treemapConfig ?? {}} />
            </div>

            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setCfoDrillOpen(true)}
                style={{
                  appearance: "none",
                  border: "1px solid rgba(15,23,42,0.18)",
                  background: "white",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Open detail table
              </button>
            </div>
          </Surface>
        ) : activePersona === "WATERFALL" && hasWaterfall ? (
          <Surface padding={24}>
            <SurfaceHeader
              title="ACCUMULATED WATERFALL"
              subtitle="Pipeline dynamics and revenue flow"
              onInfo={() => openDefs("cro_waterfall")}
            />
            <div style={{ height: 450, marginTop: 20 }}>
              <WaterfallChart data={processedWaterfallData} onBarClick={(bar) => setDrillCategory(bar.name)} />
            </div>
          </Surface>
        ) : activePersona === "CRO" && hasCRO ? (
          <div id="revintel-territory-tree" style={{ scrollMarginTop: 90 }}>
            <Surface padding={24}>
              <SurfaceHeader title="Sales Forecast" subtitle="" onInfo={() => openDefs("cro_revintel_tree")} />
              <div style={{ marginTop: 14 }}>
                <RevintelTreeSection
                  rows={data?.cro?.revintelTreeRows ?? []}
                  onSelectNode={(node) => setSelectedRollupNodeId(node?.id ?? null)}
                />
              </div>
            </Surface>
          </div>
        ) : activePersona === "CMO" && hasCMO ? (
          <Surface padding={24}>
            <SurfaceHeader
              title="MARKETING SCORECARD"
              subtitle="Moving averages and lead generation"
              onInfo={() => openDefs("cmo")}
            />
            <CMOScorecardPlaceholder />
          </Surface>
        ) : activePersona === "CPO" && hasCPO ? (
          <CPOScorecardPlaceholder
            onInfo={() => openDefs("cpo")}
            calendarData={data?.calendarData || []}
            accountsRows={cpoAccountOptions}
            selectedAccount={cpoSelectedAccount}
            onSelectedAccountChange={setCpoSelectedAccount}
          />
        ) : activePersona === "CPCO" && hasCPCO ? (
          <CPCOScorecardPlaceholder onInfo={() => openDefs("cpco")} />
        ) : (
          <>
            <Surface>
              <SurfaceHeader title="COMPANY TOTALS" subtitle="" onInfo={() => openDefs("company_totals")} />
              <div style={styles.metricGrid}>
                <MetricCard 
                  label="Budget" 
                  value={fmtMoneyCompact(budgetValue)} 
                  headerRight={<MiniAcvPill />}
                  subValue="• All Business Lines"
                  //subLabel="• All Business Lines"
                />
                <MetricCard
                  label="Forecast"
                  value={fmtMoneyCompact(forecastValue)}
                  onValueClick={() => {
                    setActivePersona("CRO");
                    setPendingScrollId("revintel-territory-tree");
                  }}
                  onClick={undefined}
                  title="Click the number to jump to CRO • Expand for breakdown"
                  subValue="• All Business Lines"
                expandRows={[
                  {
                    key: "forecast",
                    label: "FORECAST",
                    value: fmtMoneyCompact(forecastValue),
                    delta: (toNumber(forecastValue) ?? null) - (toNumber(commitValue) ?? 0),
                  },
                  {
                    key: "quota",
                    label: "QUOTA",
                    value: fmtMoneyCompact(quotaValue),
                    delta: (toNumber(quotaValue) ?? null) - (toNumber(commitValue) ?? 0),
                  },
                  {
                    key: "commit",
                    label: "COMMIT",
                    value: fmtMoneyCompact(commitValue),
                    delta: 0,
                  },
                  {
                    key: "best",
                    label: "BEST_CASE",
                    value: fmtMoneyCompact(bestCaseValue),
                    delta: (toNumber(bestCaseValue) ?? null) - (toNumber(commitValue) ?? 0),
                  },
                  {
                    key: "open",
                    label: "OPEN_PIPELINE",
                    value: fmtMoneyCompact(openPipelineValue),
                    delta: (toNumber(openPipelineValue) ?? null) - (toNumber(commitValue) ?? 0),
                  },
                ]}
                />

                <MetricCard
                  label="Closed (QTD)"
                  value={fmtMoneyCompact(companyClosedQTDValue)}
                  subValue={
                    companyClosedVsForecastDelta != null
                      ? `${companyClosedVsForecastDelta < 0 ? "▼" : "▲"} ${fmtMoneyCompact(Math.abs(companyClosedVsForecastDelta))}`
                      : null
                  }
                  subLabel={
                    companyClosedVsForecastDelta != null
                      ? companyClosedVsForecastDelta < 0
                        ? "behind Forecast"
                        : "ahead of Forecast"
                      : null
                  }
                  onClick={openClosedTrendFromMetric}
                  title="Click to expand Closed Trend"
                />

                <MetricCard
                  label="Pacing to Forecast"
                  value={fmtPct1(companyPacingToForecastValue)}
                  onClick={() => setShowForecastAttainmentModal(true)}
                  title="Closed Won / Forecast (QTD)"
                />

                <MetricCard
                  label="2Y CAGR (ACV)"
                  value={fmtPct1(companyCagrValue)}
                  onClick={() => setCagrDrillOpen(true)}
                  title="Click to view CAGR inputs + formula"
                />

                <MetricCard label="Stage 4+ Coverage" value={fmtX(companyStage4Value)} />

                <MetricCard
                  label="Velocity"
                  value={fmtPct1(companyVelocityValue)}
                  onClick={() => setVelocityDrillOpen(true)}
                  title="Click to view Velocity inputs + formula"
                />

                <MetricCard
                  label="% Funded"
                  value={fmtPct1(companyFundedValue)}
                  onClick={() => setFundedDrillOpen(true)}
                  title="Click to view % Funded inputs + formula"
                />

{/*
                <MetricCard
                  label="Gap to Forecast"
                  value={fmtMoneyCompact(closedVsForecastDelta)}
                />
*/}

                <MetricCard
                  label="PG Attainment"
                  value={fmtPct1(pgSummary.quarterAttainment)}
                  onClick={() => setPgDrillOpen(true)}
                  title="Click to view Pipeline Generation pacing"
                />

              <ExecutiveInsightPopover
                headline={activeExecutiveInsight?.headline}
                supporting={activeExecutiveInsight?.supporting || []}
                scopeLabel={fieldScopeLabel}
                label="Executive Insight"
                cardMode
                teaser={activeExecutiveInsight?.teaser || "Scoped narrative"}
                onPauseRotation={setExecutiveInsightPaused}
                progress={executiveInsightProgress}
                currentIndex={executiveInsightIndex}
                totalCount={executiveInsightItems.length}
                onPrev={goToPrevExecutiveInsight}
                onNext={goToNextExecutiveInsight}
                onJumpTo={jumpToExecutiveInsight}
              />

              </div>

              <div style={{ marginTop: 14 }} ref={closedTrendRef}>
                <button
                  onClick={toggleClosedTrend}
                  onMouseEnter={() => setClosedTrendHover(true)}
                  onMouseLeave={() => setClosedTrendHover(false)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: closedTrendOpen ? "14px 14px 0 0" : 14,
                    background: closedTrendHover ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.65)",
                    border: `1px solid ${
                      closedTrendHover ? "rgba(15, 23, 42, 0.18)" : "rgba(15, 23, 42, 0.12)"
                    }`,
                    borderBottom: closedTrendOpen ? "none" : undefined,
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "background 160ms ease, border-color 160ms ease",
                  }}
                  aria-expanded={closedTrendOpen}
                  title={closedTrendOpen ? "Collapse" : "Expand"}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    style={{
                      transform: closedTrendOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 180ms ease",
                      opacity: 0.75,
                    }}
                    fill="none"
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="rgba(15, 23, 42, 0.80)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 950,
                      color: "rgba(15, 23, 42, 0.82)",
                      letterSpacing: 0.2,
                    }}
                  >
                    Closed Trend
                  </div>
                </button>

                {closedTrendOpen && (
                  <div
                    style={{
                      marginTop: 0,
                      padding: "10px 12px 12px",
                      borderRadius: "0 0 14px 14px",
                      background: "rgba(255,255,255,0.65)",
                      border: "1px solid rgba(15, 23, 42, 0.12)",
                      borderTop: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(15, 23, 42, 0.70)" }}>
                        Closed ACV Trend
                      </div>

                      <SegToggle
                        value={closedTrendMode}
                        onChange={setClosedTrendMode}
                        options={[
                          { label: "Quarter", value: "CQ" },
                          { label: "Rolling 12", value: "R12" },
                        ]}
                      />
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <ClosedTrendChart data={closedTrendData} />
                    </div>
                  </div>
                )}
              </div>
            </Surface>

            <Surface>
              <div style={{ display: "grid", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setEmployeeFiltersOpen((v) => !v)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: employeeFiltersOpen ? "14px 14px 0 0" : 14,
                    background: employeeFiltersOpen ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.64)",
                    border: "1px solid rgba(15, 23, 42, 0.10)",
                    borderBottom: employeeFiltersOpen ? "none" : "1px solid rgba(15, 23, 42, 0.10)",
                    cursor: "pointer",
                    transition: "background 160ms ease, border-color 160ms ease",
                    textAlign: "left",
                  }}
                  aria-expanded={employeeFiltersOpen}
                  title={employeeFiltersOpen ? "Collapse employee filters" : "Expand employee filters"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      style={{
                        transform: employeeFiltersOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 180ms ease",
                        opacity: 0.75,
                        flexShrink: 0,
                      }}
                      fill="none"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        stroke="rgba(15, 23, 42, 0.80)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 1000,
                          letterSpacing: 0.45,
                          textTransform: "uppercase",
                          color: "rgba(15, 23, 42, 0.78)",
                        }}
                      >
                        Employee Filters
                      </div>
                    </div>
                  </div>

                  {!fieldScopeBridge?.isGlobal && (
                    <div
                      style={{
                        padding: "7px 12px",
                        borderRadius: 999,
                        background: "rgba(15,23,42,0.05)",
                        border: "1px solid rgba(15,23,42,0.08)",
                        color: "rgba(15,23,42,0.88)",
                        fontSize: 12,
                        fontWeight: 950,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                      title={fieldScopeBridge?.selectedPath || ""}
                    >
                      Scoped to: {fieldScopeLabel}
                    </div>
                  )}
                </button>

                {employeeFiltersOpen && (
                  <div
                    style={{
                      marginTop: 0,
                      padding: "12px 12px 12px",
                      borderRadius: "0 0 14px 14px",
                      background: "rgba(255,255,255,0.64)",
                      border: "1px solid rgba(15, 23, 42, 0.10)",
                      borderTop: "none",
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        position: "relative",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 1000,
                            letterSpacing: 0.5,
                            textTransform: "uppercase",
                            color: "rgba(15, 23, 42, 0.72)",
                          }}
                        >
                          Field Scoped Views
                        </div>
                      </div>

                      <button
                        id="employee-filters-help-button"
                        type="button"
                        onClick={() => setEmployeeFiltersHelpOpen((v) => !v)}
                        aria-label="Employee filters help"
                        title="Employee filters help"
                        style={{
                          appearance: "none",
                          border: "1px solid rgba(15, 23, 42, 0.12)",
                          background: "#ffffff",
                          width: 32,
                          height: 28,
                          borderRadius: 10,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "rgba(15, 23, 42, 0.68)",
                          fontSize: 13,
                          fontWeight: 900,
                          lineHeight: 1,
                          padding: 0,
                          flexShrink: 0,
                          boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                        }}
                      >
                        ⓘ
                      </button>

                      {employeeFiltersHelpOpen && (
                        <div
                          id="employee-filters-help-popover"
                          style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            right: 0,
                            width: "min(520px, 92vw)",
                            zIndex: 40,
                            borderRadius: 14,
                            background: "rgba(255,255,255,0.98)",
                            border: "1px solid rgba(15, 23, 42, 0.10)",
                            boxShadow: "0 18px 40px rgba(0,0,0,0.14)",
                            padding: "14px 16px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 1000,
                              letterSpacing: 0.4,
                              textTransform: "uppercase",
                              color: "rgba(15, 23, 42, 0.72)",
                            }}
                          >
                            Employee Filters Help
                          </div>

                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                              fontWeight: 850,
                              color: "rgba(15, 23, 42, 0.72)",
                              lineHeight: 1.5,
                              display: "grid",
                              gap: 8,
                            }}
                          >
                            <div>
                              This section scopes <strong>Field Execution</strong>, <strong>Create &amp; Close</strong>,
                              <strong> $500K+ Deals</strong>, and <strong>AE Performance</strong> to a selected manager,
                              territory, or individual contributor.
                            </div>

                            <div>
                              <strong>Company Totals remain global</strong> so executive rollups stay stable while
                              operating views can be narrowed to a specific org slice.
                            </div>

                            <div>
                              <strong>Directs</strong> = immediate direct reports under the selected node.
                            </div>

                            <div>
                              <strong>Descendants</strong> = everyone below that node across all lower levels.
                            </div>

                            <div>
                              <strong>Territories</strong> = distinct territories represented in that selected branch
                              of the hierarchy.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <FieldScopeSelector
                      rows={data?.cro?.revintelTreeRows ?? []}
                      selectedPath={fieldScopePath}
                      onSelectNode={(option) => setFieldScopePath(option?.path ?? null)}
                      onClear={() => setFieldScopePath(null)}
                    />
                  </div>
                )}
              </div>
            </Surface>

            <div style={styles.splitRow}>
              <div style={{ minWidth: 0, height: "100%" }}>
                <Surface style={{ height: "100%" }}>
                <SurfaceHeader
                  title="Field Execution"
                  subtitle=""
                  rightNode={
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {!fieldScopeBridge?.isGlobal && <ScopeHeaderPill label={fieldScopeLabel} />}
                      <BusinessLineHeaderPill businessLine={businessLine} />
                    </div>
                  }
                  onInfo={() => openDefs("field_execution")}
                />
                <div style={styles.metricGrid}>
                  <MetricCard
                    label="Forecast"
                    value={fmtMoneyCompact(scopedFieldExecution.forecast)}
                    onClick={() => {
                      setActivePersona("CRO");
                      setPendingScrollId("revintel-territory-tree");
                    }}
                    title="Click to jump to CRO View"
                  />
                  <MetricCard
                    label="Open Pipe"
                    value={fmtMoneyCompact(scopedFieldExecution.pipe)}
                    onClick={() => openOpenPipelineDrillForRisk("all")}
                    title="Click to view open pipeline detail"
                  />
                  <MetricCard label="Closed" value={fmtMoneyCompact(scopedFieldExecution.closedFiltered)} />
                </div>

                {currentFieldExecutionInsight && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openOpenPipelineDrillForRisk(currentFieldExecutionInsight.key)}
                    onMouseEnter={() => setFieldExecutionInsightPaused(true)}
                    onMouseLeave={() => setFieldExecutionInsightPaused(false)}
                    title={`Open ${currentFieldExecutionInsight.label} pipeline deals`}
                    style={{
                      marginTop: 12,
                      width: "99%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      padding: "8px 4px",
                      borderRadius: 20,
                      border: "1px solid rgba(15,23,42,0.10)",
                      background: "rgba(255,255,255,0.72)",
                      cursor: "pointer",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "68px minmax(0, 1fr)",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 1000,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                          color: "rgba(15,23,42,0.55)",
                          paddingRight: 8,
                          borderRight: "1px solid rgba(15,23,42,0.08)",
                          lineHeight: 1.05,
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                          minWidth: 0,
                        }}
                      >
                        Open Pipe Health
                      </div>

                      <div
                        key={currentFieldExecutionInsight.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          minWidth: 0,
                          width: "100%",
                          overflow: "hidden",
                          animation: "fadeSlideIn 240ms ease",
                          flexWrap: "nowrap",
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: currentFieldExecutionInsight.color,
                            flexShrink: 0,
                          }}
                        />

                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 900,
                            color: currentFieldExecutionInsight.color,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {currentFieldExecutionInsight.label}
                        </span>

                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 900,
                            color: "rgba(15,23,42,0.88)",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {currentFieldExecutionInsight.count}
                        </span>

                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: "rgba(15,23,42,0.62)",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          • {fmtMoneyCompact(currentFieldExecutionInsight.amount)}
                        </span>

                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: "rgba(15,23,42,0.62)",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            flexShrink: 1,
                          }}
                        >
                          • {fmtPct1(currentFieldExecutionInsight.pct)} of Open Pipe
                        </span>
                      </div>


                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 6,
                        marginTop: 2,
                      }}
                    >
                      {fieldExecutionInsightItems.map((_, i) => (
                        <div
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            jumpToFieldExecutionInsight(i);
                            setFieldExecutionInsightPaused(true);
                          }}
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background:
                              i === fieldExecutionInsightIndex
                                ? "#1e293b"
                                : "rgba(15,23,42,0.25)",
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        />
                      ))}
                    </div>

                </div>
              )}
              </Surface>
              </div>

              <div style={{ minWidth: 0, height: "100%" }}>
              <Surface style={{ height: "100%" }}>
                <SurfaceHeader
                  title="Create & Close"
                  subtitle=""
                  rightNode={
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {!fieldScopeBridge?.isGlobal && <ScopeHeaderPill label={fieldScopeLabel} />}
                      <BusinessLineHeaderPill businessLine={businessLine} />
                    </div>
                  }
                  onInfo={() => openDefs("create_close")}
                />
                <div style={styles.metricGrid}>
                  <MetricCard
                    label="WON QTD"
                    value={fmtMoneyCompact(createCloseMetrics.wonQTD)}
                    onClick={() => openCreateCloseDrill("Won QTD")}
                    title="Click to view Create & Close raw drillthrough rows"
                  />
                  <MetricCard
                    label="Open Pipeline QTD"
                    value={fmtMoneyCompact(createCloseMetrics.openPipeQTD)}
                    onClick={() => openCreateCloseDrill("Open Pipe QTD")}
                    title="Click to view Create & Close raw drillthrough rows"
                  />
                  <MetricCard
                    label="Won QTD YoY"
                    value={fmtPct1(scopedCreateCloseSummary.wonQTDYoy)}
                    onClick={() => openCreateCloseDrill("Won QTD YoY")}
                    title="Click to view Create & Close raw drillthrough rows"
                    isWip
                  />
                  <MetricCard
                    label="Open Pipeline QTD YoY"
                    value={fmtPct1(scopedCreateCloseSummary.openPipeQTDYoy)}
                    onClick={() => openCreateCloseDrill("Open Pipeline QTD YoY")}
                    title="Click to view Create & Close raw drillthrough rows"
                    isWip
                  />
                </div>
              </Surface>
            </div>
            </div>
            
            <div style={styles.splitRow}>
              <div style={styles.stackCol}>
                <Surface>
                  <SurfaceHeader
                    title="$500K+ Deals"
                    subtitle=""
                    rightNode={
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {!fieldScopeBridge?.isGlobal && <ScopeHeaderPill label={fieldScopeLabel} />}
                      <BusinessLineHeaderPill businessLine={businessLine} />
                    </div>
                  }
                    onInfo={() => openDefs("deals_500k")}
                  />
                  <div style={styles.metricGrid}>
                    <MetricCard
                      label="Won QTD"
                      value={scopedLargeDealsSummary.wonQTD}
                      onClick={() => openLargeDealsDrill("Won QTD")}
                      title="Click to view underlying 500K+ won deals"
                    />

                    <MetricCard
                      label="Open Pipeline QTD"
                      value={scopedLargeDealsSummary.openPipeQTD}
                      onClick={() => openLargeDealsDrill("Open Pipeline QTD")}
                      title="Click to view underlying 500K+ open pipeline deals"
                    />
                    <MetricCard 
                      label="Open Pipeline QTD YoY" 
                      value={fmtPct1(scopedLargeDealsSummary.openPipeQTDYoy)} 
                      isWip={true}
                    />
                    <MetricCard
                      label="Prior Year"
                      value={scopedLargeDealsSummary.py}
                      onClick={() => openLargeDealsDrill("Prior Year")}
                      title="Click to view prior-year large deals"
                      isWip={false}
                    />
                  </div>
                </Surface>

                <HorsemanSection
                  config={config}
                  horsemanRows={horsemanRowsFromEso}
                  horsemanDetailRows={horsemanDetailRowsFromEso}
                  onInfo={() => openDefs("horseman")}
                  fieldScopeLabel={fieldScopeLabel}
                  fieldScopeIsGlobal={!!fieldScopeBridge?.isGlobal}
                  businessLine={businessLine}
                />
              </div>

              <div style={styles.stackCol}>
                <Surface>
                  <SurfaceHeader
                    title="AE Performance"
                    subtitle=""
                    rightNode={
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {!fieldScopeBridge?.isGlobal && <ScopeHeaderPill label={fieldScopeLabel} />}
                      <BusinessLineHeaderPill businessLine={businessLine} />
                    </div>
                  }
                    onInfo={() => openDefs("ae_performance")}
                  />
                  <div style={styles.metricGrid}>
                    <MetricCard
                      label="AEs > 3x Stage 4 Cov"
                      value={aePerfCounts.overThreshold}
                      onClick={() => openAeDrill("AEs > 3x Stage 4 Cov")}
                      title="Click to view AEs flagged above 3x Stage 4 coverage"
                    />
                    <MetricCard
                      label="AEs @ 0 ACV"
                      value={aePerfCounts.zeroAtAcv}
                      onClick={() => openAeDrill("AEs @ 0 ACV")}
                      title="Click to view AEs flagged at 0 ACV"
                    />
                  </div>
                </Surface>

                <Surface>
                  <SurfaceHeader
                    title="Hierarchy Roll-ups"
                    subtitle="Employee → +1 → +2 view"
                    onInfo={() => openDefs("cro_revintel_tree")}
                  />

                  <RollupTabs
                    selectedNode={ceoSelectedRollupNode}
                    plus1Node={ceoPlus1Node}
                    plus2Node={ceoPlus2Node}
                  />
                </Surface>
              </div>
            </div>
          </>
        )}
      </div>

      {leftNavOpen && !isPinned && (
        <div
          onClick={() => setLeftNavOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(15, 23, 42, 0.04)",
            backdropFilter: "blur(1px)",
          }}
          aria-hidden="true"
        />
      )}

      <div
        ref={sideNavRef}
        style={{
          ...styles.sideNavContainer,
          width: SIDEBAR_WIDTH,
          transform: leftNavOpen || isPinned ? "translateX(0)" : "translateX(-108%)",
          opacity: leftNavOpen || isPinned ? 1 : 0.98,
          background: isPinned ? "rgba(255, 255, 255, 0.25)" : "white",
          backdropFilter: isPinned ? "blur(14px)" : "none",
          borderRight: isPinned ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid rgba(15, 23, 42, 0.1)",
          boxShadow: isPinned ? "none" : "20px 0 50px rgba(0,0,0,0.15)",
        }}
      >
        <div
          style={{
            ...styles.drawerHeader,
            borderBottom: isPinned ? "1px solid rgba(15, 23, 42, 0.1)" : "1px solid rgba(15, 23, 42, 0.08)",
          }}
        >
          <div style={{ color: "rgba(15, 23, 42, 0.92)" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Views</div>
            <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 850 }}>Pick a persona view</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setIsPinned(!isPinned)}
              style={{
                ...styles.actionBtn,
                color: isPinned ? "#3B82F6" : "rgba(15, 23, 42, 0.4)",
                fontSize: 18,
              }}
              title={isPinned ? "Unpin Drawer" : "Pin Drawer"}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={isPinned ? "#3B82F6" : "currentColor"}
                style={{
                  transform: isPinned ? "rotate(0deg)" : "rotate(45deg)",
                  transition: "all 0.2s",
                }}
              >
                <path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
              </svg>
            </button>

            {!isPinned && (
              <button onClick={() => setLeftNavOpen(false)} style={styles.actionBtn}>
                ✕
              </button>
            )}
          </div>
        </div>

        <div style={styles.drawerContent}>
          <div style={styles.drawerSection}>
            <div style={styles.sectionLabel}>LIVE</div>

            {hasCEO && (
              <ViewCard
                title="CEO VIEW"
                desc="Full executive rollup."
                selected={activePersona === "CEO"}
                isPinned={isPinned}
                onSelect={() => handleViewSelect("CEO")}
                status="live"
              />
            )}

            {hasCRO && (
              <ViewCard
                title="CRO VIEW"
                desc="Sales forecast + territory tree."
                selected={activePersona === "CRO"}
                isPinned={isPinned}
                onSelect={() => handleViewSelect("CRO")}
                status="live"
              />
            )}

            {hasWaterfall && (
              <ViewCard
                title="WATERFALL VIEW"
                desc="Standalone waterfall deep-dive."
                selected={activePersona === "WATERFALL"}
                isPinned={isPinned}
                onSelect={() => handleViewSelect("WATERFALL")}
                status="live"
              />
            )}
          </div>

          {(hasCFO || hasCPO || hasCPCO || hasCMO) && (
            <div style={styles.drawerSection}>
              <div style={styles.sectionLabel}>IN DEVELOPMENT</div>

              {hasCFO && (
                <ViewCard
                  title="CFO VIEW"
                  desc="Finance-forward view."
                  selected={activePersona === "CFO"}
                  isPinned={isPinned}
                  onSelect={() => handleViewSelect("CFO")}
                  status="developing"
                />
              )}

              {hasCPO && (
                <ViewCard
                  title="CPO VIEW"
                  desc="Product operations & health."
                  selected={activePersona === "CPO"}
                  isPinned={isPinned}
                  onSelect={() => handleViewSelect("CPO")}
                  status="developing"
                />
              )}

              {hasCPCO && (
                <ViewCard
                  title="CPCO VIEW"
                  desc="People & organizational health."
                  selected={activePersona === "CPCO"}
                  isPinned={isPinned}
                  onSelect={() => handleViewSelect("CPCO")}
                  status="developing"
                />
              )}

              {hasCMO && (
                <ViewCard
                  title="CMO VIEW"
                  desc="Marketing scorecard."
                  selected={activePersona === "CMO"}
                  isPinned={isPinned}
                  onSelect={() => handleViewSelect("CMO")}
                  status="developing"
                />
              )}
            </div>
          )}
        </div>
      </div>

      <DefinitionsDrawer open={drawerOpen} sectionKey={defSection} onClose={() => setDrawerOpen(false)} />

      <DrillDownModal
        open={!!drillCategory}
        onClose={() => setDrillCategory(null)}
        title={`Waterfall Drill: ${drillCategory}`}
        rows={drillData.rows}
        total={drillData.total}
        config={config}
      />

      <OpenPipelineDrillModal
        open={openPipelineDrillOpen}
        onClose={() => setOpenPipelineDrillOpen(false)}
        title="Open Pipeline (Scoped)"
        rows={scopedOpenPipelineDrillRows}
        fieldScopeIsGlobal={fieldScopeBridge?.isGlobal ?? true}
        fieldScopeLabel={fieldScopeLabel}
        selectedRisk={openPipelineSelectedRisk}
      />

      <AEPerformanceDrillModal
        open={aeDrillOpen}
        onClose={() => setAeDrillOpen(false)}
        title={`AE Drill: ${aeDrillMetric}`}
        rows={aeDrillRowsScoped}
        columns={columns?.aePerformance}
        config={config}
        fieldScopeLabel={fieldScopeLabel}
        fieldScopeIsGlobal={!!fieldScopeBridge?.isGlobal}
      />

      <CFOTreemapDrillModal
        open={cfoDrillOpen}
        onClose={() => setCfoDrillOpen(false)}
        title="CFO Drill: Opportunity detail"
        rows={rows?.cfoTreemapDetail || []}
        columns={columns?.cfoTreemapDetail || []}
      />

      <PGPacingModal
        open={pgDrillOpen}
        onClose={() => setPgDrillOpen(false)}
        title="Pipeline Generation Attainment"
        rows={filteredPgRows}
        columns={columns?.pgPacing || []}
        config={config}
        summary={pgSummary}
      />

      <CAGRDrillModal
        open={cagrDrillOpen}
        onClose={() => setCagrDrillOpen(false)}
        title="2Y CAGR (ACV) — Drilldown"
        rows={drillCagrRows}
        columns={drillCagrCols}
        config={config}
        fallback={{
          fyq: data?.dr?.fyq ?? null,
          businessLine: data?.dr?.bl ?? null,
          nYears: data?.dr?.years ?? 2,
          cagrNotes: data?.dr?.cagrNotes ?? null,
          acvChangeQtr: data?.dr?.acvChangeQtr ?? null,
          sameQtrAcvChangeCagr2yRate: data?.dr?.sameQtrAcvChangeCagr2yRate ?? null,
          revenueSource: data?.dr?.revenueSource ?? null,
          closedQtr: {
            cagrRate: data?.dr?.closedQtr?.cagrRate ?? null,
            endingTtm: data?.dr?.closedQtr?.endingTtm ?? null,
            beginningTtm2y: data?.dr?.closedQtr?.beginningTtm2y ?? null,
            beginFyq: data?.dr?.closedQtr?.beginFyq ?? null,
            endFyq: data?.dr?.closedQtr?.endFyq ?? null,
          },
          rolling: {
            cagrRate: data?.dr?.rolling?.cagrRate ?? null,
            endingTtm: data?.dr?.rolling?.endingTtm ?? null,
            beginningTtm2y: data?.dr?.rolling?.beginningTtm2y ?? null,
            beginFyq: data?.dr?.rolling?.beginFyq ?? null,
            endFyq: data?.dr?.rolling?.endFyq ?? null,
          },
        }}
      />

      <VelocityDrillModal
        open={velocityDrillOpen}
        onClose={() => setVelocityDrillOpen(false)}
        data={{ ...data, dv: companyVelocityModalData }}
      />

      <PlanAttainmentDrillModal
        open={planAttainmentDrillOpen}
        onClose={() => setPlanAttainmentDrillOpen(false)}
        data={data}
      />

      <ForecastAttainmentDrillModal
        open={showForecastAttainmentModal}
        onClose={() => setShowForecastAttainmentModal(false)}
        data={data}
        modeDefault="QTD"
      />

      <FundedDrillModal
        open={fundedDrillOpen}
        onClose={() => setFundedDrillOpen(false)}
        data={{ ...data, df: companyFundedModalData }}
        rows={filteredFundedRows}
      />

      <LargeDealsDrillModal
        open={largeDealsDrillOpen}
        onClose={() => setLargeDealsDrillOpen(false)}
        title={`Large Deals — ${largeDealsDrillMetric}`}
        rows={
          String(largeDealsDrillMetric ?? "").trim().toLowerCase() === "prior year"
            ? scopedLargeDealsPyDrillRows
            : scopedLargeDealsDrillRows
        }
        columns={[]}
        config={config}
        metricName={largeDealsDrillMetric}
        fieldScopeIsGlobal={!!fieldScopeBridge?.isGlobal}
        fieldScopeLabel={fieldScopeLabel}
      />

      <CreateCloseDrillModal
        open={createCloseDrillOpen}
        onClose={() => setCreateCloseDrillOpen(false)}
        title={`Create & Close — ${createCloseDrillMetric}`}
        rows={scopedCreateCloseDrillRows}
        columns={[]}
        config={config}
        metricName={createCloseDrillMetric}
        fieldScopeIsGlobal={!!fieldScopeBridge?.isGlobal}
        fieldScopeLabel={fieldScopeLabel}
      />

      <DebugConsoleModal
        open={debugConsoleOpen}
        onClose={() => setDebugConsoleOpen(false)}
        activePersona={activePersona}
        config={config}
        data={data}
        rows={rows}
        columns={columns}
        debugInfo={debugInfo}
        processedWaterfallData={processedWaterfallData}
        debugLogs={debugLogs}
        debugLoggingEnabled={debugLoggingEnabled}
        onToggleDebugLogging={handleToggleDebugLogging}
        onClearDebugLogs={handleClearDebugLogs}
        onRefreshDebugLogs={handleRefreshDebugLogs}
      />

      {showArchitecture && (
        <div style={overlayStyles}>
          <button
            style={closeButtonStyles}
            onClick={() => setShowArchitecture(false)}
            aria-label="Close architecture view"
            title="Close"
          >
            ✕
          </button>

          <React.Suspense fallback={null}>
            <ArchitectureMapV2 />
          </React.Suspense>
        </div>
      )}

      <SaltRescueModal open={saltRescueOpen} onClose={() => setSaltRescueOpen(false)} />
    </div>
  );

}


function ViewCard({ title, desc, selected, onSelect, isPinned, status = "live" }) {
  const textColor = "rgba(15, 23, 42, 0.92)";
  const isDeveloping = status === "developing";

  const baseStyle = {
    ...styles.personaBtn,
    backgroundColor: selected
      ? "rgba(255, 255, 255, 0.95)"
      : isDeveloping
        ? "rgba(255, 255, 255, 0.82)"
        : isPinned
          ? "rgba(255, 255, 255, 0.5)"
          : "white",
    border: selected ? "2px solid #59C1A7" : "1px solid rgba(15, 23, 42, 0.1)",
    boxShadow: selected ? "0 4px 12px rgba(0,0,0,0.08)" : "none",
    color: textColor,
    opacity: !selected && isDeveloping ? 0.94 : 1,
  };

  return (
    <button onClick={onSelect} style={baseStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 950 }}>{title}</div>

          {isDeveloping && !selected && (
            <div
              style={{
                fontSize: 9,
                fontWeight: 950,
                letterSpacing: 0.25,
                textTransform: "uppercase",
                padding: "3px 6px",
                borderRadius: 999,
                background: "rgba(15, 23, 42, 0.06)",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                color: "rgba(15, 23, 42, 0.55)",
                whiteSpace: "nowrap",
              }}
            >
              In Development
            </div>
          )}
        </div>

        {selected && (
          <div style={{ fontSize: 11, fontWeight: 950, color: "#59C1A7", whiteSpace: "nowrap" }}>
            <span style={{ color: isPinned ? "#3B82F6" : "#59C1A7" }}>✓</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 6, fontSize: 11, fontWeight: 850, opacity: 0.7 }}>{desc}</div>
    </button>
  );
}

const styles = {
  appContainer: {
    width: "100vw",
    height: "100vh",
    padding: 12,
    background: "linear-gradient(135deg, #59C1A7 0%, #4fbba7 45%, #43b4ab 100%)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    fontFamily: "system-ui",
    overflow: "hidden",
    boxSizing: "border-box",
    position: "relative",
  },
  loadingScreen: {
    width: "100vw",
    height: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#59C1A7",
    color: "white",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 12,
    color: "white",
    zIndex: 10,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    flexWrap: "wrap",
  },
  headerCenter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: "flex-end",
    minWidth: 0,
    flexWrap: "wrap",
  },

  headerMetaGroup: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.18)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 10px 22px rgba(0,0,0,0.14)",
    minWidth: 0,
    maxWidth: "100%",
  },

  headerMetaText: {
    fontSize: 13.5,
    fontWeight: 900,
    letterSpacing: 0.2,
    color: "rgba(255,255,255,0.98)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  headerMetaDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#3B82F6", // clean modern blue
    boxShadow: "0 0 0 4px rgba(59,130,246,0.25), 0 0 8px rgba(59,130,246,0.6)",
    flexShrink: 0,
  },

  logo: {
    height: 20,
    width: "auto",
    display: "block",
    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))",
  },

  saltBubble: {
    padding: "0",
    borderRadius: 0,
    background: "transparent",
    border: "none",
    backdropFilter: "none",
    boxShadow: "none",
    userSelect: "none",
  },
  saltText: { fontSize: 26, fontWeight: 1000, letterSpacing: 0.4 },
  viewPill: {
    fontSize: 12,
    fontWeight: 950,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.94)",
    color: "rgba(15, 23, 42, 0.92)",
  },
  betaTag: {
    fontSize: 12,
    fontWeight: 950,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(253, 230, 138, 0.98)",
    color: "rgba(0,0,0,0.92)",
  },
  scrollArea: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    overflowY: "auto",
    paddingBottom: 20,
  },
  sideNavContainer: {
    position: "fixed",
    top: 0,
    left: 0,
    height: "100vh",
    zIndex: 100,
    transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease",
    willChange: "transform, opacity",
    display: "flex",
    flexDirection: "column",
  },
  drawerHeader: { padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" },
  drawerContent: { padding: 14, overflowY: "auto", flex: 1 },
  drawerSection: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 1000,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: "rgba(15, 23, 42, 0.62)",
  },
  actionBtn: {
    appearance: "none",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 950,
    padding: 4,
  },
  personaBtn: {
    padding: "12px",
    borderRadius: "12px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s ease",
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
  metricGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 },
  splitRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 14,
    alignItems: "stretch",
  },
  stackCol: { display: "flex", flexDirection: "column", gap: 14 },
  saltTitle: {
    fontSize: 26,
    fontWeight: 1000,
    letterSpacing: 0.8,
    color: "white",
    textShadow: "0 2px 10px rgba(0,0,0,0.20)", // ⬅️ slightly stronger
    userSelect: "none",
  },
  reviewChip: {
    appearance: "none",
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.8)",
    borderRadius: 10,
    padding: "8px 10px",
    width: "100%",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  reviewChipLeft: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  reviewChipText: {
    fontSize: 13,
    fontWeight: 800,
    color: "#1e293b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 120,
  },
  reviewChipIcon: {
    fontSize: 12,
    fontWeight: 950,
    color: "#0b5cab",
  },
  reviewWrap: {
    position: "relative",
    display: "inline-block",
    width: "100%",
  },
  reviewPopover: {
    overflow: "auto",
    background: "white",
    border: "1px solid rgba(15,23,42,0.14)",
    borderRadius: 14,
    boxShadow: "0 20px 50px rgba(0,0,0,0.22)",
    padding: 14,
  },
  reviewPopoverHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  reviewPopoverTitle: {
    fontWeight: 1000,
  },
  reviewPopoverClose: {
    cursor: "pointer",
  },
  reviewMetaRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  reviewMetaPill: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.05)",
  },
  reviewMetaLabel: {
    fontSize: 11,
    fontWeight: 950,
  },
  reviewMetaValue: {
    fontSize: 12,
    fontWeight: 900,
  },
  reviewPopoverBody: {
    fontSize: 12,
  },
    arrowControl: {
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 1000,
    color: "rgba(15,23,42,0.68)",
    background: "rgba(15,23,42,0.04)",
    border: "1px solid rgba(15,23,42,0.08)",
    flexShrink: 0,
    userSelect: "none",
  },
};