import { useEffect, useMemo, useRef, useState } from "react";
import "./SaltDataFlowViz.css";

const STAGES = [
  { id: "salesforce", label: "Salesforce", sublabel: "Source System", icon: "cloud" },
  { id: "fivetran", label: "Fivetran", sublabel: "Extract", icon: "bars" },
  { id: "snowflake_staging", label: "Snowflake", sublabel: "Staging", icon: "db" },
  { id: "dbt", label: "dbt", sublabel: "Transform", icon: "star" },
  { id: "snowflake_prod", label: "Snowflake", sublabel: "Curated", icon: "db" },
  { id: "sigma", label: "Sigma", sublabel: "Insights / Analytics", icon: "triangle" },
  { id: "salt", label: "SALT App", sublabel: "Executive Insights", icon: "chart" },
];

const TAGS = [
  { label: "Extract", className: "tag-extract" },
  { label: "Transform", className: "tag-transform" },
  { label: "Curated", className: "tag-curated" },
  { label: "Insights / Analytics", className: "tag-insights" },
];

const HANDOFF_DELAYS = [0.75, 2.0, 3.25, 4.5, 5.75, 7.0];
const CYCLE_SECONDS = 9.6;

function Icon({ type }) {
  switch (type) {
    case "cloud":
      return (
        <svg viewBox="0 0 64 48" className="stage-icon-svg">
          <path
            d="M20 38h24c8 0 14-5 14-12s-5-12-12-12h-1C42 7 36 4 30 4c-9 0-16 6-18 14C6 19 2 24 2 30c0 4 2 8 5 11 4 3 8 4 13 4z"
            fill="#1f9cf0"
          />
        </svg>
      );
    case "bars":
      return (
        <svg viewBox="0 0 64 48" className="stage-icon-svg">
          <rect x="8" y="8" width="10" height="28" rx="2" fill="#2a76ff" />
          <rect x="24" y="14" width="10" height="22" rx="2" fill="#2a76ff" />
          <rect x="40" y="4" width="10" height="32" rx="2" fill="#2a76ff" />
        </svg>
      );
    case "db":
      return (
        <svg viewBox="0 0 64 48" className="stage-icon-svg">
          <ellipse cx="32" cy="10" rx="18" ry="6" fill="#2378d7" />
          <rect x="14" y="10" width="36" height="22" fill="#2378d7" />
          <ellipse cx="32" cy="32" rx="18" ry="6" fill="#2378d7" />
          <ellipse cx="32" cy="21" rx="18" ry="6" fill="#2f8cef" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 64 48" className="stage-icon-svg">
          <path
            d="M32 6l4.5 9.5L47 17l-7.5 7 2 10L32 29l-9.5 5 2-10L17 17l10.5-1.5L32 6z"
            fill="#ff7b6b"
          />
        </svg>
      );
    case "triangle":
      return (
        <svg viewBox="0 0 64 48" className="stage-icon-svg">
          <polygon points="12,36 32,8 52,36" fill="#111827" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 64 48" className="stage-icon-svg">
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
    <svg viewBox="0 0 24 24" className="control-icon" aria-hidden="true">
      <path d="M8 6l10 6-10 6V6z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="control-icon" aria-hidden="true">
      <rect x="7" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
      <rect x="13.5" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

function Stage({ stage, active, isFinalActive, ringPaused }) {
  return (
    <div className={`stage-card ${active ? "active" : ""} ${isFinalActive ? "final-active" : ""}`}>
      {active && <div className={`stage-ring ${ringPaused ? "is-paused" : ""}`} />}
      <div className="stage-icon">
        <Icon type={stage.icon} />
      </div>
      <div className="stage-text">
        <div className="stage-label">{stage.label}</div>
        <div className="stage-sublabel">{stage.sublabel}</div>
      </div>
    </div>
  );
}

function HandoffBurst({ delay, left, paused }) {
  return (
    <div
      className={`handoff-burst ${paused ? "is-paused" : ""}`}
      style={{ animationDelay: `${delay}s`, left: `${left}px` }}
    />
  );
}

function MotionDot({ pathId }) {
  return (
    <circle r="8" fill="url(#v1PacketGradient)" opacity="0">
      <animate
        attributeName="opacity"
        dur={`${CYCLE_SECONDS}s`}
        repeatCount="indefinite"
        values="0;1;1;0"
        keyTimes="0;0.03;0.94;1"
      />
      <animateMotion dur={`${CYCLE_SECONDS}s`} repeatCount="indefinite" rotate="auto">
        <mpath href={`#${pathId}`} />
      </animateMotion>
    </circle>
  );
}

function MotionLayer({ svgRef, paused }) {
  return (
    <svg
      ref={svgRef}
      className={`motion-layer ${paused ? "is-paused" : ""}`}
      viewBox="0 0 1280 16"
      preserveAspectRatio="none"
    >
      <defs>
        <radialGradient id="v1PacketGradient">
          <stop offset="0%" stopColor="#d8f3ff" />
          <stop offset="60%" stopColor="#4ab1ff" />
          <stop offset="100%" stopColor="#0f7bdc" />
        </radialGradient>

        {/* exact handoff centers for v1 */}
        <path
          id="v1PacketPath"
          d="M 196 8
             L 404 8
             L 612 8
             L 820 8
             L 1028 8
             L 1236 8"
        />
      </defs>

      <g className="motion-dots">
        <MotionDot pathId="v1PacketPath" />
      </g>
    </svg>
  );
}

function MatrixPanel({ paused }) {
  const rows = [
    "LOAD SALESFORCE_OPPORTUNITY",
    "SYNC FIVETRAN_CONNECTOR OK",
    "dbt run --select salt_models",
    "BUILD CURATED_EXEC_LAYER",
    "SIGMA CACHE REFRESH READY",
    "PIPELINE STATUS: HEALTHY",
  ];

  return (
    <div className="matrix-panel">
      <div className="matrix-scanline" />
      <div className={`matrix-content ${paused ? "is-paused" : ""}`}>
        {rows.concat(rows).map((row, idx) => (
          <div key={`${row}-${idx}`} className="matrix-row">
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SaltDataFlowViz() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const motionSvgRef = useRef(null);

  useEffect(() => {
    if (isPaused) return undefined;
    const id = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STAGES.length);
    }, 1200);
    return () => clearInterval(id);
  }, [isPaused]);

  useEffect(() => {
    const svg = motionSvgRef.current;
    if (!svg) return;

    if (typeof svg.pauseAnimations === "function" && typeof svg.unpauseAnimations === "function") {
      if (isPaused) svg.pauseAnimations();
      else svg.unpauseAnimations();
    }
  }, [isPaused]);

  const stageStates = useMemo(() => STAGES.map((_, idx) => idx <= activeStep), [activeStep]);
  const isFinalActive = activeStep === STAGES.length - 1;
  const burstLeftPositions = [0, 208, 416, 624, 832, 1040];

  return (
    <div className="viz-shell">
      <div className="viz-header">
        <div>
          <h1>Dashboard Architecture</h1>
          <p>How data moves from Salesforce to executive insights.</p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="play-pause-button"
            onClick={() => setIsPaused((prev) => !prev)}
            aria-pressed={isPaused}
            aria-label={isPaused ? "Play animation" : "Pause animation"}
            title={isPaused ? "Play animation" : "Pause animation"}
          >
            {isPaused ? <PlayIcon /> : <PauseIcon />}
            <span>{isPaused ? "Play" : "Pause"}</span>
          </button>

          <div className="live-pill">Live pipeline view</div>
        </div>
      </div>

      <div className="top-utility-row">
        <div className="tag-row">
          {TAGS.map((tag) => (
            <span key={tag.label} className={`mini-tag ${tag.className}`}>
              {tag.label}
            </span>
          ))}
        </div>

        <MatrixPanel paused={isPaused} />
      </div>

      <div className="pipeline-board">
        <div className="business-lane">Business Systems</div>
        <div className="platform-lane">Data Platform</div>
        <div className="insights-lane">Insights &amp; Action</div>

        <div className="stage-row">
          {STAGES.map((stage, idx) => (
            <div className="stage-slot" key={stage.id}>
              <Stage
                stage={stage}
                active={idx === activeStep}
                isFinalActive={stage.id === "salt" && isFinalActive}
                ringPaused={isPaused}
              />

              {idx < STAGES.length - 1 && (
                <div className={`connector ${stageStates[idx] ? "active" : ""}`}>
                  <div className="connector-line" />
                  <div className="connector-arrow" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="packet-layer">
          <MotionLayer svgRef={motionSvgRef} paused={isPaused} />
          {HANDOFF_DELAYS.map((delay, idx) => (
            <HandoffBurst key={idx} delay={delay} left={burstLeftPositions[idx]} paused={isPaused} />
          ))}
        </div>

        <div className="output-stack">
          <div className="output-card">
            <div className="output-title">Executive KPI</div>
            <div className="bar-chart">
              <div style={{ height: "48%" }} />
              <div style={{ height: "64%" }} />
              <div style={{ height: "55%" }} />
              <div style={{ height: "74%" }} />
              <div style={{ height: "68%" }} />
              <div style={{ height: "84%" }} />
            </div>
          </div>

          <div className="output-card">
            <div className="output-title">Trend Signal</div>
            <svg viewBox="0 0 180 90" className="trend-svg">
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
      </div>
    </div>
  );
}