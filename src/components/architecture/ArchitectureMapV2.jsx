import { useEffect, useMemo, useRef, useState } from "react";
import "./ArchitectureMapV2.css";

const CYCLE_SECONDS = 9.6;
const CYCLE_MS = CYCLE_SECONDS * 1000;

/*
  Auto-scroll choreography:
  - start all the way left
  - when the right-side dot activity is getting close, pan to the far right
  - near cycle end, return to the far left for the restart
*/
const SCROLL_RIGHT_AT_MS = 7000;
const SCROLL_RESET_AT_MS = 9500;

const PATH_ORDER = [
  "salesforce",
  "fivetran",
  "snowflake_staging",
  "dbt",
  "snowflake_curated",
  "sigma",
  "salt",
];

const STAGE_BADGES = [
  { label: "Extract", className: "badge-extract" },
  { label: "Ingest", className: "badge-ingest" },
  { label: "Transform", className: "badge-transform" },
  { label: "Curated", className: "badge-curated" },
  { label: "rETL", className: "badge-retl" },
  { label: "Insights / Analytics", className: "badge-insights" },
];

const NODES = [
  {
    id: "salesforce",
    label: "Salesforce",
    sublabel: "CRM / Pipeline",
    kind: "source",
    x: 70,
    y: 230,
    icon: "cloud",
  },
  {
    id: "iterable",
    label: "Iterable",
    sublabel: "Messaging Data",
    kind: "source",
    x: 70,
    y: 310,
    icon: "diamond",
  },
  {
    id: "zendesk",
    label: "Zendesk",
    sublabel: "Support",
    kind: "source",
    x: 70,
    y: 390,
    icon: "z",
  },
  {
    id: "adp",
    label: "ADP",
    sublabel: "People Data",
    kind: "source",
    x: 70,
    y: 470,
    icon: "adp",
  },
  {
    id: "apis",
    label: "APIs",
    sublabel: "External Inputs",
    kind: "source",
    x: 70,
    y: 550,
    icon: "api",
  },

  {
    id: "fivetran",
    label: "Fivetran",
    sublabel: "Managed Ingest",
    kind: "ingest",
    x: 350,
    y: 255,
    icon: "bars",
  },
  {
    id: "python",
    label: "Python",
    sublabel: "Custom Pipelines",
    kind: "ingest",
    x: 350,
    y: 395,
    icon: "py",
  },
  {
    id: "airflow",
    label: "Airflow",
    sublabel: "Orchestration",
    kind: "ingest",
    x: 350,
    y: 505,
    icon: "air",
  },

  {
    id: "snowflake_staging",
    label: "Snowflake",
    sublabel: "Staging",
    kind: "warehouse",
    x: 650,
    y: 330,
    icon: "db",
  },
  {
    id: "dbt",
    label: "dbt",
    sublabel: "Transform",
    kind: "transform",
    x: 915,
    y: 330,
    icon: "star",
  },
  {
    id: "snowflake_curated",
    label: "Snowflake",
    sublabel: "Curated",
    kind: "warehouse",
    x: 1200,
    y: 330,
    icon: "db",
  },

  {
    id: "montecarlo",
    label: "Monte Carlo",
    sublabel: "Observability",
    kind: "tool",
    x: 915,
    y: 145,
    icon: "mc",
  },
  {
    id: "workato",
    label: "Workato",
    sublabel: "Automation",
    kind: "tool",
    x: 430,
    y: 120,
    icon: "w",
  },
  {
    id: "netsuite",
    label: "NetSuite",
    sublabel: "Finance System",
    kind: "tool",
    x: 720,
    y: 120,
    icon: "ns",
  },
  {
    id: "hightouch",
    label: "Hightouch",
    sublabel: "Reverse ETL",
    kind: "tool",
    x: 1535,
    y: 185,
    icon: "ht",
  },

  {
    id: "sigma",
    label: "Sigma",
    sublabel: "BI / Exploration",
    kind: "insight",
    x: 1535,
    y: 350,
    icon: "triangle",
  },
  {
    id: "r_salesforce",
    label: "Salesforce",
    sublabel: "Sync Back",
    kind: "return",
    x: 1845,
    y: 95,
    icon: "cloud",
  },
  {
    id: "r_iterable",
    label: "Iterable",
    sublabel: "Audience Sync",
    kind: "return",
    x: 1845,
    y: 190,
    icon: "diamond",
  },
  {
    id: "salt",
    label: "SALT App",
    sublabel: "Executive Insights",
    kind: "insight",
    x: 1845,
    y: 350,
    icon: "chart",
  },
];

const EDGES = [
  { from: "salesforce", to: "fivetran", type: "primary" },
  { from: "iterable", to: "fivetran", type: "secondary" },
  { from: "zendesk", to: "fivetran", type: "secondary" },
  { from: "adp", to: "fivetran", type: "secondary" },

  { from: "apis", to: "python", type: "secondary" },
  { from: "python", to: "snowflake_staging", type: "secondary" },
  { from: "airflow", to: "snowflake_staging", type: "secondary" },
  { from: "fivetran", to: "snowflake_staging", type: "primary" },

  { from: "salesforce", to: "workato", type: "secondary" },
  { from: "workato", to: "netsuite", type: "secondary" },

  { from: "snowflake_staging", to: "dbt", type: "primary" },
  { from: "snowflake_staging", to: "montecarlo", type: "secondary-dashed" },
  { from: "dbt", to: "snowflake_curated", type: "primary" },
  { from: "montecarlo", to: "snowflake_curated", type: "secondary-dashed" },

  { from: "snowflake_curated", to: "sigma", type: "primary" },
  { from: "snowflake_curated", to: "hightouch", type: "secondary" },
  { from: "sigma", to: "salt", type: "primary" },

  { from: "hightouch", to: "r_salesforce", type: "secondary" },
  { from: "hightouch", to: "r_iterable", type: "secondary" },
];

const MOTION_SEGMENTS = [
  { id: "motion-salesforce-fivetran", from: "salesforce", to: "fivetran", start: 0.0, end: 0.18 },
  { id: "motion-iterable-fivetran", from: "iterable", to: "fivetran", start: 0.0, end: 0.18 },
  { id: "motion-zendesk-fivetran", from: "zendesk", to: "fivetran", start: 0.0, end: 0.18 },
  { id: "motion-adp-fivetran", from: "adp", to: "fivetran", start: 0.0, end: 0.18 },
  { id: "motion-apis-python", from: "apis", to: "python", start: 0.0, end: 0.18 },

  { id: "motion-salesforce-workato", from: "salesforce", to: "workato", start: 0.0, end: 0.18 },
  { id: "motion-workato-netsuite", from: "workato", to: "netsuite", start: 0.18, end: 0.32 },

  { id: "motion-fivetran-staging", from: "fivetran", to: "snowflake_staging", start: 0.18, end: 0.32 },
  { id: "motion-python-staging", from: "python", to: "snowflake_staging", start: 0.18, end: 0.32 },
  { id: "motion-airflow-staging", from: "airflow", to: "snowflake_staging", start: 0.18, end: 0.32 },

  { id: "motion-staging-dbt", from: "snowflake_staging", to: "dbt", start: 0.32, end: 0.44 },
  { id: "motion-staging-mc", from: "snowflake_staging", to: "montecarlo", start: 0.32, end: 0.44 },

  { id: "motion-dbt-curated", from: "dbt", to: "snowflake_curated", start: 0.44, end: 0.56 },
  { id: "motion-mc-curated", from: "montecarlo", to: "snowflake_curated", start: 0.44, end: 0.56 },

  { id: "motion-curated-sigma", from: "snowflake_curated", to: "sigma", start: 0.56, end: 0.70 },
  { id: "motion-curated-hightouch", from: "snowflake_curated", to: "hightouch", start: 0.56, end: 0.70 },

  { id: "motion-sigma-salt", from: "sigma", to: "salt", start: 0.70, end: 0.84 },
  { id: "motion-hightouch-salesforce", from: "hightouch", to: "r_salesforce", start: 0.70, end: 0.82 },
  { id: "motion-hightouch-iterable", from: "hightouch", to: "r_iterable", start: 0.72, end: 0.84 },
];

function getNode(id) {
  return NODES.find((n) => n.id === id);
}

function getNodeDims(node) {
  const width = node.kind === "tool" || node.kind === "return" ? 170 : 190;
  const height = node.kind === "tool" || node.kind === "return" ? 60 : 68;
  return { width, height };
}

function nodeCenter(node) {
  const { width, height } = getNodeDims(node);
  return {
    x: node.x + width / 2,
    y: node.y + height / 2,
  };
}

function edgePath(fromNode, toNode) {
  const a = nodeCenter(fromNode);
  const b = nodeCenter(toNode);
  const dx = b.x - a.x;
  const c1x = a.x + Math.max(60, dx * 0.35);
  const c2x = b.x - Math.max(60, dx * 0.35);
  return `M ${a.x} ${a.y} C ${c1x} ${a.y}, ${c2x} ${b.y}, ${b.x} ${b.y}`;
}

function Icon({ type }) {
  switch (type) {
    case "cloud":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <path
            d="M20 38h24c8 0 14-5 14-12s-5-12-12-12h-1C42 7 36 4 30 4c-9 0-16 6-18 14C6 19 2 24 2 30c0 4 2 8 5 11 4 3 8 4 13 4z"
            fill="#1f9cf0"
          />
        </svg>
      );
    case "diamond":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <rect x="14" y="8" width="12" height="12" transform="rotate(45 20 14)" fill="#14b8a6" />
          <rect x="30" y="20" width="12" height="12" transform="rotate(45 36 26)" fill="#ec4899" />
          <rect x="22" y="28" width="10" height="10" transform="rotate(45 27 33)" fill="#38bdf8" />
        </svg>
      );
    case "z":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <path d="M16 12h30l-20 24h22" stroke="#10b981" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "adp":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <text x="8" y="33" fontSize="24" fontWeight="800" fill="#ef4444">ADP</text>
        </svg>
      );
    case "api":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <circle cx="20" cy="18" r="6" fill="#64748b" />
          <circle cx="40" cy="18" r="6" fill="#64748b" />
          <circle cx="30" cy="32" r="6" fill="#64748b" />
          <path d="M20 18 L40 18 L30 32 Z" stroke="#64748b" strokeWidth="3" fill="none" />
        </svg>
      );
    case "bars":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <rect x="10" y="10" width="9" height="24" rx="2" fill="#2a76ff" />
          <rect x="25" y="16" width="9" height="18" rx="2" fill="#2a76ff" />
          <rect x="40" y="6" width="9" height="28" rx="2" fill="#2a76ff" />
        </svg>
      );
    case "py":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <path d="M18 10h15c5 0 7 2 7 7v5H24c-5 0-8 3-8 8v2c0 4 3 6 7 6h14c5 0 8-3 8-7V14c0-2-1-4-2-4H18z" fill="#4f8cc9" />
          <path d="M46 38H31c-5 0-7-2-7-7v-5h16c5 0 8-3 8-8v-2c0-4-3-6-7-6H27c-5 0-8 3-8 7v17c0 2 1 4 2 4h25z" fill="#ffd24d" opacity="0.92" />
        </svg>
      );
    case "air":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <path d="M32 8l6 10-6 4-6-4 6-10zM18 24l10-4 4 6-4 6-10-8zM46 24l-10-4-4 6 4 6 10-8zM32 40l-6-10 6-4 6 4-6 10z" fill="#38bdf8" />
          <circle cx="32" cy="24" r="5" fill="#f97316" />
        </svg>
      );
    case "db":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <ellipse cx="32" cy="10" rx="18" ry="6" fill="#2378d7" />
          <rect x="14" y="10" width="36" height="22" fill="#2378d7" />
          <ellipse cx="32" cy="32" rx="18" ry="6" fill="#2378d7" />
          <ellipse cx="32" cy="21" rx="18" ry="6" fill="#2f8cef" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <path
            d="M32 6l4.5 9.5L47 17l-7.5 7 2 10L32 29l-9.5 5 2-10L17 17l10.5-1.5L32 6z"
            fill="#ff7b6b"
          />
        </svg>
      );
    case "mc":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <rect x="10" y="9" width="18" height="22" fill="#2563eb" />
          <text x="15" y="26" fontSize="12" fontWeight="800" fill="#ffffff">MC</text>
        </svg>
      );
    case "w":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <path d="M8 14l6 20 8-12 8 10 6-18" stroke="#5eead4" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "ns":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <path d="M16 10h10l12 16V10h10v28H38L26 22v16H16z" fill="#0f172a" />
          <rect x="36" y="10" width="12" height="12" fill="#94a3b8" opacity="0.8" />
        </svg>
      );
    case "ht":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <rect x="10" y="18" width="10" height="10" fill="#a3e635" />
          <rect x="24" y="12" width="10" height="16" fill="#84cc16" />
          <rect x="38" y="20" width="10" height="8" fill="#65a30d" />
        </svg>
      );
    case "triangle":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <polygon points="12,36 32,8 52,36" fill="#111827" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 64 48" className="v2-icon-svg">
          <rect x="10" y="24" width="8" height="14" rx="2" fill="#2a76ff" />
          <rect x="24" y="16" width="8" height="22" rx="2" fill="#2a76ff" />
          <rect x="38" y="8" width="8" height="30" rx="2" fill="#2a76ff" />
          <path d="M8 40h48" stroke="#334155" strokeWidth="2" />
        </svg>
      );
    default:
      return null;
  }
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="v2-control-icon" aria-hidden="true">
      <path d="M8 6l10 6-10 6V6z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="v2-control-icon" aria-hidden="true">
      <rect x="7" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
      <rect x="13.5" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

function MatrixPanel({ paused, activeStep }) {
  const rows = [
    "LOAD SALESFORCE_OPPORTUNITY",
    "INGEST ITERABLE_EVENTS",
    "MERGE SUPPORT / PEOPLE / API DATA",
    "dbt run --select salt_exec_models",
    "BUILD CURATED_EXEC_LAYER",
    "MONTE CARLO HEALTHY",
    "REVERSE ETL SYNC READY",
    "SIGMA CACHE REFRESHED",
    `ACTIVE STAGE: ${PATH_ORDER[activeStep].toUpperCase()}`,
  ];

  return (
    <div className="v2-matrix-panel">
      <div className="v2-matrix-scanline" />
      <div className={`v2-matrix-content ${paused ? "is-paused" : ""}`}>
        {rows.concat(rows).map((row, idx) => (
          <div key={`${row}-${idx}`} className="v2-matrix-row">
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}

function NodeCard({ node, active, finalActive, paused }) {
  return (
    <div
      className={[
        "v2-node",
        `kind-${node.kind}`,
        active ? "active" : "",
        finalActive ? "final-active" : "",
      ].join(" ")}
      style={{ left: node.x, top: node.y }}
    >
      {active && <div className={`v2-node-ring ${paused ? "is-paused" : ""}`} />}
      <div className="v2-node-icon">
        <Icon type={node.icon} />
      </div>
      <div className="v2-node-text">
        <div className="v2-node-label">{node.label}</div>
        <div className="v2-node-sublabel">{node.sublabel}</div>
      </div>
    </div>
  );
}

function HandoffBurst({ x, y, delay, paused }) {
  return (
    <div
      className={`v2-handoff-burst ${paused ? "is-paused" : ""}`}
      style={{
        left: x,
        top: y,
        animationDelay: `${delay}s`,
      }}
    />
  );
}

function MotionDot({ pathId, start, end }) {
  const startSafe = start === 0 ? 0.0001 : start;
  const fadeOut = Math.min(end + 0.01, 0.999);

  return (
    <circle r="8" fill="url(#v2PacketGradient)" opacity="0">
      <animate
        attributeName="opacity"
        dur={`${CYCLE_SECONDS}s`}
        repeatCount="indefinite"
        values="0;1;1;0;0"
        keyTimes={`0;${startSafe};${end};${fadeOut};1`}
      />
      <animateMotion
        dur={`${CYCLE_SECONDS}s`}
        repeatCount="indefinite"
        keyTimes={`0;${startSafe};${end};1`}
        keyPoints="0;0;1;1"
        calcMode="linear"
      >
        <mpath href={`#${pathId}`} />
      </animateMotion>
    </circle>
  );
}

function MotionLayer({ svgRef, paused }) {
  return (
    <svg
      ref={svgRef}
      className={`v2-motion-layer ${paused ? "is-paused" : ""}`}
      viewBox="0 0 2280 980"
      preserveAspectRatio="none"
    >
      <defs>
        <radialGradient id="v2PacketGradient">
          <stop offset="0%" stopColor="#d8f3ff" />
          <stop offset="60%" stopColor="#4ab1ff" />
          <stop offset="100%" stopColor="#0f7bdc" />
        </radialGradient>

        {MOTION_SEGMENTS.map((segment) => {
          const fromNode = getNode(segment.from);
          const toNode = getNode(segment.to);
          return (
            <path
              key={segment.id}
              id={segment.id}
              d={edgePath(fromNode, toNode)}
            />
          );
        })}
      </defs>

      <g className="v2-motion-dots">
        {MOTION_SEGMENTS.map((segment) => (
          <MotionDot
            key={segment.id}
            pathId={segment.id}
            start={segment.start}
            end={segment.end}
          />
        ))}
      </g>
    </svg>
  );
}

export default function ArchitectureMapV2() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const motionSvgRef = useRef(null);
  const boardWrapRef = useRef(null);

  useEffect(() => {
    if (isPaused) return undefined;

    const id = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % PATH_ORDER.length);
    }, 1200);

    return () => clearInterval(id);
  }, [isPaused]);

  useEffect(() => {
    const svg = motionSvgRef.current;
    if (!svg) return;

    if (typeof svg.pauseAnimations === "function" && typeof svg.unpauseAnimations === "function") {
      if (isPaused) {
        svg.pauseAnimations();
      } else {
        svg.unpauseAnimations();
      }
    }
  }, [isPaused]);

  useEffect(() => {
    const wrap = boardWrapRef.current;
    if (!wrap) return;

    let rightTimeout;
    let resetTimeout;
    let loopInterval;

    const runCycle = () => {
      wrap.scrollTo({ left: 0, behavior: "auto" });

      rightTimeout = window.setTimeout(() => {
        const maxLeft = wrap.scrollWidth - wrap.clientWidth;
        wrap.scrollTo({
          left: maxLeft,
          behavior: "smooth",
        });
      }, SCROLL_RIGHT_AT_MS);

      resetTimeout = window.setTimeout(() => {
        wrap.scrollTo({
          left: 0,
          behavior: "smooth",
        });
      }, SCROLL_RESET_AT_MS);
    };

    if (!isPaused) {
      runCycle();
      loopInterval = window.setInterval(runCycle, CYCLE_MS);
    }

    return () => {
      if (rightTimeout) window.clearTimeout(rightTimeout);
      if (resetTimeout) window.clearTimeout(resetTimeout);
      if (loopInterval) window.clearInterval(loopInterval);
    };
  }, [isPaused]);

  const highlightedEdges = useMemo(() => {
    const currentIndex = activeStep;
    return EDGES.map((edge) => {
      const edgeIndex = PATH_ORDER.findIndex(
        (id, idx) =>
          idx < PATH_ORDER.length - 1 &&
          id === edge.from &&
          PATH_ORDER[idx + 1] === edge.to
      );

      return {
        ...edge,
        isActive: edgeIndex !== -1 && edgeIndex < currentIndex,
      };
    });
  }, [activeStep]);

  const burstPoints = [
    { x: 445, y: 289, delay: 1.15 },
    { x: 745, y: 364, delay: 2.95 },
    { x: 1295, y: 364, delay: 5.25 },
    { x: 1935, y: 384, delay: 8.0 },
    { x: 1930, y: 125, delay: 7.7 },
    { x: 1930, y: 220, delay: 7.9 },
    { x: 735, y: 155, delay: 2.2 },
  ];

  return (
    <div className="v2-shell">
      <div className="v2-header">
        <div>
          <h1>Dashboard Architecture</h1>
          <p>Expanded architecture map from source systems to executive insight.</p>
        </div>

        <div className="v2-header-actions">
          <button
            type="button"
            className="v2-play-pause"
            onClick={() => setIsPaused((prev) => !prev)}
            aria-pressed={isPaused}
            aria-label={isPaused ? "Play animation" : "Pause animation"}
            title={isPaused ? "Play animation" : "Pause animation"}
          >
            {isPaused ? <PlayIcon /> : <PauseIcon />}
            <span>{isPaused ? "Play" : "Pause"}</span>
          </button>
          <div className="v2-live-pill">Architecture map v2</div>
        </div>
      </div>

      <div className="v2-top-strip">
        <div className="v2-badge-row">
          {STAGE_BADGES.map((badge) => (
            <span key={badge.label} className={`v2-badge ${badge.className}`}>
              {badge.label}
            </span>
          ))}
        </div>
        <MatrixPanel paused={isPaused} activeStep={activeStep} />
      </div>

      <div ref={boardWrapRef} className="v2-board-wrap">
        <div className="v2-board">
          <div className="v2-left-rail">Data Sources</div>

          <svg className="v2-edge-layer" viewBox="0 0 2280 980" preserveAspectRatio="none">
            <defs>
              <marker
                id="arrow-muted"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#b8c5d6" />
              </marker>
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#4ab1ff" />
              </marker>
            </defs>

            {highlightedEdges.map((edge) => {
              const fromNode = getNode(edge.from);
              const toNode = getNode(edge.to);
              const path = edgePath(fromNode, toNode);

              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={path}
                  className={[
                    "v2-edge",
                    edge.type,
                    edge.isActive ? "active" : "",
                  ].join(" ")}
                  markerEnd={edge.isActive ? "url(#arrow-active)" : "url(#arrow-muted)"}
                />
              );
            })}
          </svg>

          {NODES.map((node) => {
            const isPathNode = PATH_ORDER[activeStep] === node.id;
            const finalActive = node.id === "salt" && PATH_ORDER[activeStep] === "salt";

            return (
              <NodeCard
                key={node.id}
                node={node}
                active={isPathNode}
                finalActive={finalActive}
                paused={isPaused}
              />
            );
          })}

          <div className="v2-packet-layer">
            <MotionLayer svgRef={motionSvgRef} paused={isPaused} />
            {burstPoints.map((burst, idx) => (
              <HandoffBurst
                key={idx}
                x={burst.x}
                y={burst.y}
                delay={burst.delay}
                paused={isPaused}
              />
            ))}
          </div>

          <div className="v2-output-stack">
            <div className="v2-output-card">
              <div className="v2-output-title">Executive KPI</div>
              <div className="v2-bar-chart">
                <div style={{ height: "44%" }} />
                <div style={{ height: "62%" }} />
                <div style={{ height: "51%" }} />
                <div style={{ height: "76%" }} />
                <div style={{ height: "68%" }} />
                <div style={{ height: "84%" }} />
              </div>
            </div>

            <div className="v2-output-card">
              <div className="v2-output-title">Trend Signal</div>
              <svg viewBox="0 0 180 90" className="v2-trend-svg">
                <polyline
                  fill="none"
                  stroke="#e05c54"
                  strokeWidth="4"
                  points="10,68 35,58 60,50 84,55 112,34 140,26 170,18"
                />
                <circle cx="10" cy="68" r="3" fill="#e05c54" />
                <circle cx="35" cy="58" r="3" fill="#e05c54" />
                <circle cx="60" cy="50" r="3" fill="#e05c54" />
                <circle cx="84" cy="55" r="3" fill="#e05c54" />
                <circle cx="112" cy="34" r="3" fill="#e05c54" />
                <circle cx="140" cy="26" r="3" fill="#e05c54" />
                <circle cx="170" cy="18" r="3" fill="#e05c54" />
              </svg>
            </div>
          </div>

          <div className="v2-lane lane-sources">Sources</div>
          <div className="v2-lane lane-platform">Data Platform</div>
          <div className="v2-lane lane-insights">Insights &amp; Action</div>
        </div>
      </div>
    </div>
  );
}