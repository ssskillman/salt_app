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

function getPathFromRevintelRow(row) {
  return [row?.lvl0, row?.lvl1, row?.lvl2, row?.lvl3, row?.lvl4]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(" > ");
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
          animation: "saltPulse 1.8s ease-in-out infinite",
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
        boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
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
      console.error("Failed to copy Salt rescue commands:", err);
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

export default function App() {
  const [cpoSelectedAccount, setCpoSelectedAccount] = useState(null);

  const { data, rows, columns, isLoading, config, debugInfo } = useSigmaData({
    cpoAccountId: cpoSelectedAccount?.account_id ?? null,
    cpoIterableOrgId: cpoSelectedAccount?.iterable_org_id ?? null,
    cpoAccountName: cpoSelectedAccount?.account_name ?? null,
  });

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

  const [employeeFiltersOpen, setEmployeeFiltersOpen] = useState(false);

  const [employeeFiltersHelpOpen, setEmployeeFiltersHelpOpen] = useState(false);

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

      // Cmd/Ctrl + number persona shortcuts
      if (meta && !e.shiftKey && !e.altKey) {
        const personaMap = {
          "1": "CEO",
          "2": "CRO",
          "3": "CFO",
          "4": "CPO",
          "5": "CPCO",
          "6": "CMO",
          "7": "WATERFALL",
        };

        const nextPersona = personaMap[key];
        if (nextPersona) {
          e.preventDefault();
          handleViewSelect(nextPersona);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leftNavOpen, isPinned, prefersReducedMotion, saltRescueOpen]);

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

    return sourceRows.map((r, i) => ({
      name:
        r?.name != null && String(r.name).trim() !== ""
          ? String(r.name).trim()
          : `M${i + 1}`,
      value: toNumber(r?.value) ?? 0,
      businessLine: r?.businessLine ?? null,
      fiscalYearquarter: r?.fiscalYearquarter ?? null,
      sort: toNumber(r?.sort),
    }));
  }, [data?.closedTrend, closedTrendMode]);

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

  const pgSummary = useMemo(() => {
    const r = rows?.pgPacing ?? [];
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

    const fyqKey = resolveColumnKey(config?.pg_fiscal_yearquarter);
    const blKey = resolveColumnKey(config?.pg_business_line);
    const monthSortKey = resolveColumnKey(config?.pg_month_sort);
    const monthNameKey = resolveColumnKey(config?.pg_month_name);
    const monthInQtrKey = resolveColumnKey(config?.pg_month_in_qtr);
    const monthGoalsKey = resolveColumnKey(config?.pg_month_goals);
    const monthCreatedKey = resolveColumnKey(config?.pg_month_created);
    const goalsQtrKey = resolveColumnKey(config?.pg_qtr_goals);
    const createdQtrKey = resolveColumnKey(config?.pg_qtr_created);
    const attainmentQtrKey = resolveColumnKey(config?.pg_qtr_attainment);

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

    const quarterGoal = qGoalRaw != null ? qGoalRaw : months.reduce((acc, m) => acc + (m.goal || 0), 0);
    const quarterCreated = qCreatedRaw != null ? qCreatedRaw : months.reduce((acc, m) => acc + (m.created || 0), 0);
    const quarterAttainment = qAttRaw != null ? qAttRaw : quarterGoal ? quarterCreated / quarterGoal : null;

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
    rows?.pgPacing,
    config?.pg_fiscal_yearquarter,
    config?.pg_business_line,
    config?.pg_month_sort,
    config?.pg_month_name,
    config?.pg_month_in_qtr,
    config?.pg_month_goals,
    config?.pg_month_created,
    config?.pg_qtr_goals,
    config?.pg_qtr_created,
    config?.pg_qtr_attainment,
  ]);

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

  const { co = {}, d = {} } = data;

  const commitValue = co.commit ?? null;
  const quotaValue = co.quota ?? null;
  const forecastValue = co.forecast ?? null;
  const bestCaseValue = co.best_case ?? null;
  const openPipelineValue = co.open_pipeline ?? null;
  const closedQTDValue = co.closedQTD ?? null;

  const gapToCommitValue = co.gap ?? safeSubtract(commitValue, closedQTDValue, null);
  const planAttainmentValue = co.finPlanQTD ?? safeDivide(closedQTDValue, quotaValue, null);

  const openDefs = (section) => {
    setDefSection(section);
    setDrawerOpen(true);
  };

  const SIDEBAR_WIDTH = 320;

  const revintelRows = data?.cro?.revintelTreeRows ?? [];

  const fieldScopeBridge = useMemo(() => {
    return buildFieldScopeBridge(revintelRows, fieldScopePath);
  }, [revintelRows, fieldScopePath]);

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

  const scopedLargeDealsKeys = useMemo(() => {
    return {
      owner:
        resolveColumnKey(config?.ld_opp_owner_name) ||
        findRowKeyByCandidates(rows?.largeDealsDetail || [], [
          "opp_owner_name",
          "Opportunity Owner",
          "owner_name",
          "user_name",
        ]),
      territory:
        resolveColumnKey(config?.ld_territory_name) ||
        findRowKeyByCandidates(rows?.largeDealsDetail || [], [
          "territory_name",
          "Territory Name",
          "territory",
        ]),
      metric:
        resolveColumnKey(config?.ld_metric_name) ||
        findRowKeyByCandidates(rows?.largeDealsDetail || [], [
          "metric_name",
          "Metric Name",
        ]),
      amount:
        resolveColumnKey(config?.ld_base_arr_growth) ||
        findRowKeyByCandidates(rows?.largeDealsDetail || [], [
          "base_arr_growth",
          "ACV / Base ARR Growth",
          "acv",
          "amount",
        ]),
    };
  }, [config, rows?.largeDealsDetail]);

  const scopedLargeDealsRows = useMemo(() => {
    return filterRowsByScope(rows?.largeDealsDetail || [], fieldScopeBridge, {
      ownerKey: scopedLargeDealsKeys.owner,
      territoryKey: scopedLargeDealsKeys.territory,
    });
  }, [rows?.largeDealsDetail, fieldScopeBridge, scopedLargeDealsKeys]);

  const scopedLargeDealsSummary = useMemo(() => {
    const metricKey = scopedLargeDealsKeys.metric;
    const amountKey = scopedLargeDealsKeys.amount;

    if (!metricKey || !amountKey || !Array.isArray(scopedLargeDealsRows) || scopedLargeDealsRows.length === 0) {
      return {
        wonQTD: co.deals500k_won_qtd,
        wonQTDYoy: co.deals500k_won_qtd_yoy,
        openPipeQTD: co.deals500k_open_pipe_qtd,
        openPipeQTDYoy: co.deals500k_open_pipe_yoy,
        py: co.deals500k_py,
      };
    }

    const sumMetric = (metricName) =>
      scopedLargeDealsRows
        .filter((r) => String(r?.[metricKey] ?? "").trim().toLowerCase() === metricName.toLowerCase())
        .reduce((sum, r) => sum + (toNumber(r?.[amountKey]) || 0), 0);

    const wonQTD = sumMetric("Won QTD");
    const openPipeQTD = sumMetric("Open Pipe QTD");
    const py = sumMetric("PY");

    return {
      wonQTD: wonQTD || co.deals500k_won_qtd,
      wonQTDYoy: py ? (wonQTD - py) / py : co.deals500k_won_qtd_yoy,
      openPipeQTD: openPipeQTD || co.deals500k_open_pipe_qtd,
      openPipeQTDYoy: co.deals500k_open_pipe_yoy,
      py: py || co.deals500k_py,
    };
  }, [scopedLargeDealsRows, scopedLargeDealsKeys, co]);

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
    };
  }, [config, rows?.aePerformance]);

  const scopedAeRows = useMemo(() => {
    return filterRowsByScope(rows?.aePerformance || [], fieldScopeBridge, {
      ownerKey: scopedAeKeys.name,
      territoryKey: scopedAeKeys.territory,
    });
  }, [rows?.aePerformance, fieldScopeBridge, scopedAeKeys]);

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

  const scopedFieldExecution = useMemo(() => {
    const canCompute =
      !!scopedDetailKeys.forecast &&
      !!scopedDetailKeys.openPipe &&
      !!scopedDetailKeys.closed &&
      scopedDetailRows.length > 0 &&
      (scopedDetailKeys.owner || scopedDetailKeys.territory);

    if (!canCompute) {
      return {
        forecast: d.forecast,
        pipe: d.pipe,
        closedFiltered: d.closedFiltered,
      };
    }

    return {
      forecast: scopedDetailRows.reduce((sum, r) => sum + (toNumber(r?.[scopedDetailKeys.forecast]) || 0), 0),
      pipe: scopedDetailRows.reduce((sum, r) => sum + (toNumber(r?.[scopedDetailKeys.openPipe]) || 0), 0),
      closedFiltered: scopedDetailRows.reduce((sum, r) => sum + (toNumber(r?.[scopedDetailKeys.closed]) || 0), 0),
    };
  }, [scopedDetailRows, scopedDetailKeys, d]);

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
      `}</style>

      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <img src="/iterable-logo.svg" alt="Logo" style={styles.logo} />
          {!isPinned && (
            <IconButton onClick={() => setLeftNavOpen(true)} selected={leftNavOpen}>
              ☰ Views
            </IconButton>
          )}
          <div style={styles.viewPill}>{activePersona} View</div>
          <div style={styles.betaTag}>BETA</div>
        </div>

        <div style={styles.headerCenter}>
          <div
            style={styles.saltBubble}
            onDoubleClick={() => setDebugConsoleOpen(true)}
            title="(hidden) Double-click to open Debug Console"
          >
            <span style={styles.saltText}>SALT Report</span>
          </div>
        </div>

        <div style={styles.headerRight}>
          {data.currentUserFullName && <div style={styles.welcomeText}>Welcome, {data.currentUserFullName}</div>}
          {activePersona === "CPCO" && <AsOfPill text="Data as of 28Feb26" />}
          <IconButton title="Definitions" onClick={() => openDefs(`view_${activePersona.toLowerCase()}`)}>
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
        {activePersona === "CFO" ? (
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
        ) : activePersona === "WATERFALL" ? (
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
        ) : activePersona === "CRO" ? (
          <div id="revintel-territory-tree" style={{ scrollMarginTop: 90 }}>
            <Surface padding={24}>
              <SurfaceHeader title="Sales Forecast" subtitle="" onInfo={() => openDefs("cro_revintel_tree")} />
              <div style={{ marginTop: 14 }}>
                <RevintelTreeSection rows={data?.cro?.revintelTreeRows ?? []} />
              </div>
            </Surface>
          </div>
        ) : activePersona === "CMO" ? (
          <Surface padding={24}>
            <SurfaceHeader
              title="MARKETING SCORECARD"
              subtitle="Moving averages and lead generation"
              onInfo={() => openDefs("cmo")}
            />
            <CMOScorecardPlaceholder />
          </Surface>
        ) : activePersona === "CPO" ? (
          <CPOScorecardPlaceholder
            onInfo={() => openDefs("cpo")}
            calendarData={data?.calendarData || []}
            accountsRows={cpoAccountOptions}
            selectedAccount={cpoSelectedAccount}
            onSelectedAccountChange={setCpoSelectedAccount}
          />
        ) : activePersona === "CPCO" ? (
          <CPCOScorecardPlaceholder onInfo={() => openDefs("cpco")} />
        ) : (
          <>
            <Surface>
              <SurfaceHeader title="COMPANY TOTALS" subtitle="" onInfo={() => openDefs("company_totals")} />
              <div style={styles.metricGrid}>
                <MetricCard
                  label="Commit"
                  value={fmtMoneyCompact(commitValue)}
                  onValueClick={() => {
                    setActivePersona("CRO");
                    setPendingScrollId("revintel-territory-tree");
                  }}
                  onClick={undefined}
                  title="Click the number to jump to CRO • Expand for breakdown"
                  expandRows={[
                    {
                      key: "quota",
                      label: "QUOTA",
                      value: fmtMoneyCompact(quotaValue),
                      delta: (toNumber(quotaValue) ?? null) - (toNumber(commitValue) ?? 0),
                    },
                    { key: "commit", label: "COMMIT", value: fmtMoneyCompact(commitValue), delta: 0 },
                    {
                      key: "forecast",
                      label: "FORECAST",
                      value: fmtMoneyCompact(forecastValue),
                      delta: (toNumber(forecastValue) ?? null) - (toNumber(commitValue) ?? 0),
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
                  label="Plan Attainment"
                  value={fmtPct1(planAttainmentValue)}
                  onClick={() => setPlanAttainmentDrillOpen(true)}
                  title="Click to view QTD / YTD plan attainment details"
                />
                <MetricCard
                  label="Closed (QTD)"
                  value={fmtMoneyCompact(closedQTDValue)}
                  onClick={openClosedTrendFromMetric}
                  title="Click to expand Closed Trend"
                />
                <MetricCard
                  label="2Y CAGR (ACV)"
                  value={fmtPct1(data?.dr?.closedQtr?.cagrRate)}
                  onClick={() => setCagrDrillOpen(true)}
                  title="Click to view CAGR inputs + formula"
                />
                <MetricCard label="Stage 4+ Cov" value={fmtX(co.stage4)} />
                <MetricCard
                  label="Velocity"
                  value={fmtPct1(co.velocity)}
                  onClick={() => setVelocityDrillOpen(true)}
                  title="Click to view Velocity inputs + formula"
                />
                <MetricCard
                  label="% Funded"
                  value={fmtPct1(co.funded)}
                  onClick={() => setFundedDrillOpen(true)}
                  title="Click to view % Funded inputs + formula"
                />
                <MetricCard label="Gap to Commit" value={fmtMoneyCompact(gapToCommitValue)} />
                <MetricCard
                  label="PG Attainment"
                  value={fmtPct1(pgSummary.quarterAttainment)}
                  onClick={() => setPgDrillOpen(true)}
                  title="Click to view Pipeline Generation pacing"
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
              <Surface>
                <SurfaceHeader
                  title="Field Execution"
                  subtitle="(Employee Filter)"
                  onInfo={() => openDefs("field_execution")}
                />
                <div style={styles.metricGrid}>
                  <MetricCard label="Forecast" value={fmtMoneyCompact(scopedFieldExecution.forecast)} />
                  <MetricCard label="Open Pipe" value={fmtMoneyCompact(scopedFieldExecution.pipe)} />
                  <MetricCard label="Closed" value={fmtMoneyCompact(scopedFieldExecution.closedFiltered)} />
                </div>
              </Surface>

              <Surface>
                <SurfaceHeader title="Create & Close" subtitle="" onInfo={() => openDefs("create_close")} />
                <div style={styles.metricGrid}>
                  <MetricCard
                    label="WON QTD"
                    value={fmtMoneyCompact(scopedCreateCloseSummary.wonQTD)}
                    onClick={() => openCreateCloseDrill("Won QTD")}
                    title="Click to view Create & Close raw drillthrough rows"
                  />
                  <MetricCard
                    label="OPEN PIPE QTD"
                    value={fmtMoneyCompact(scopedCreateCloseSummary.openPipeQTD)}
                    onClick={() => openCreateCloseDrill("Open Pipe QTD")}
                    title="Click to view Create & Close raw drillthrough rows"
                  />
                  <MetricCard
                    label="WON QTD Y/Y"
                    value={fmtPct1(scopedCreateCloseSummary.wonQTDYoy)}
                    onClick={() => openCreateCloseDrill("Won QTD Y/Y")}
                    title="Click to view Create & Close raw drillthrough rows"
                  />
                  <MetricCard
                    label="OPEN PIPE QTD Y/Y"
                    value={fmtPct1(scopedCreateCloseSummary.openPipeQTDYoy)}
                    onClick={() => openCreateCloseDrill("Open Pipe QTD Y/Y")}
                    title="Click to view Create & Close raw drillthrough rows"
                  />
                </div>
              </Surface>
            </div>

            <div style={styles.splitRow}>
              <div style={styles.stackCol}>
                <Surface>
                  <SurfaceHeader title="$500K+ Deals" subtitle="" onInfo={() => openDefs("deals_500k")} />
                  <div style={styles.metricGrid}>
                    <MetricCard
                      label="WON QTD"
                      value={fmtMoneyCompact(scopedLargeDealsSummary.wonQTD)}
                      onClick={() => openLargeDealsDrill("Won QTD")}
                      title="Click to view underlying large deals"
                    />
                    <MetricCard label="WON QTD Y/Y" value={fmtPct1(scopedLargeDealsSummary.wonQTDYoy)} />
                    <MetricCard
                      label="OPEN PIPE QTD"
                      value={fmtMoneyCompact(scopedLargeDealsSummary.openPipeQTD)}
                      onClick={() => openLargeDealsDrill("Open Pipe QTD")}
                      title="Click to view underlying large deals"
                    />
                    <MetricCard label="OPEN PIPE QTD Y/Y" value={fmtPct1(scopedLargeDealsSummary.openPipeQTDYoy)} />
                    <MetricCard
                      label="PY"
                      value={fmtMoneyCompact(scopedLargeDealsSummary.py)}
                      onClick={() => openLargeDealsDrill("PY")}
                      title="Click to view prior-year large deals"
                    />
                  </div>
                </Surface>

                <HorsemanSection
                  config={config}
                  horsemanRows={rows?.horseman || []}
                  horsemanDetailRows={rows?.horsemanDetail || []}
                  onInfo={() => openDefs("horseman")}
                />
              </div>

              <div style={styles.stackCol}>
                <Surface>
                  <SurfaceHeader title="AE Performance" subtitle="" onInfo={() => openDefs("ae_performance")} />
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

            <ViewCard
              title="CEO VIEW"
              desc="Full executive rollup."
              selected={activePersona === "CEO"}
              isPinned={isPinned}
              onSelect={() => handleViewSelect("CEO")}
              status="live"
            />

            <ViewCard
              title="CRO VIEW"
              desc="Sales forecast + territory tree."
              selected={activePersona === "CRO"}
              isPinned={isPinned}
              onSelect={() => handleViewSelect("CRO")}
              status="live"
            />

            <ViewCard
              title="WATERFALL VIEW"
              desc="Standalone waterfall deep-dive."
              selected={activePersona === "WATERFALL"}
              isPinned={isPinned}
              onSelect={() => handleViewSelect("WATERFALL")}
              status="live"
            />
          </div>

          <div style={styles.drawerSection}>
            <div style={styles.sectionLabel}>IN DEVELOPMENT</div>

            <ViewCard
              title="CFO VIEW"
              desc="Finance-forward view."
              selected={activePersona === "CFO"}
              isPinned={isPinned}
              onSelect={() => handleViewSelect("CFO")}
              status="developing"
            />

            <ViewCard
              title="CPO VIEW"
              desc="Product operations & health."
              selected={activePersona === "CPO"}
              isPinned={isPinned}
              onSelect={() => handleViewSelect("CPO")}
              status="developing"
            />

            <ViewCard
              title="CPCO VIEW"
              desc="People & organizational health."
              selected={activePersona === "CPCO"}
              isPinned={isPinned}
              onSelect={() => handleViewSelect("CPCO")}
              status="developing"
            />

            <ViewCard
              title="CMO VIEW"
              desc="Marketing scorecard."
              selected={activePersona === "CMO"}
              isPinned={isPinned}
              onSelect={() => handleViewSelect("CMO")}
              status="developing"
            />
          </div>
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

      <AEPerformanceDrillModal
        open={aeDrillOpen}
        onClose={() => setAeDrillOpen(false)}
        title={`AE Drill: ${aeDrillMetric}`}
        rows={aeDrillRowsScoped}
        columns={columns?.aePerformance}
        config={config}
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
        rows={rows?.pgPacing || []}
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

      <VelocityDrillModal open={velocityDrillOpen} onClose={() => setVelocityDrillOpen(false)} data={data} />

      <PlanAttainmentDrillModal
        open={planAttainmentDrillOpen}
        onClose={() => setPlanAttainmentDrillOpen(false)}
        data={data}
      />

      <FundedDrillModal
        open={fundedDrillOpen}
        onClose={() => setFundedDrillOpen(false)}
        data={data}
        rows={data?.df?.detailRows || rows?.drillFunded || []}
      />

      <LargeDealsDrillModal
        open={largeDealsDrillOpen}
        onClose={() => setLargeDealsDrillOpen(false)}
        title={`Large Deals — ${largeDealsDrillMetric}`}
        rows={scopedLargeDealsRows}
        columns={columns?.largeDealsDetail || []}
        config={config}
        metricName={largeDealsDrillMetric}
      />

      <CreateCloseDrillModal
        open={createCloseDrillOpen}
        onClose={() => setCreateCloseDrillOpen(false)}
        title={`Create & Close — ${createCloseDrillMetric}`}
        rows={scopedCreateCloseRows}
        columns={columns?.createCloseDetail || []}
        config={config}
        metricName={createCloseDrillMetric}
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
      />

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
  headerLeft: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  headerCenter: { justifySelf: "center" },
  headerRight: { display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" },
  logo: { height: 30, width: "auto", filter: "brightness(1.06)" },
  saltBubble: {
    padding: "10px 18px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.18)",
    border: "1px solid rgba(255,255,255,0.28)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
    userSelect: "none",
  },
  saltText: { fontSize: 26, fontWeight: 1000, letterSpacing: 0.6 },
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
  welcomeText: { fontSize: 12, fontWeight: 900, opacity: 0.92 },
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
  splitRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  stackCol: { display: "flex", flexDirection: "column", gap: 14 },
};