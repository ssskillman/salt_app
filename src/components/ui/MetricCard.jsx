// src/components/ui/MetricCard.jsx
import React, { useMemo, useState } from "react";
import { toNumber } from "../../utils/formatters.jsx";
import AnimatedMetricValue from "./AnimatedMetricValue.jsx";

function ChevronIcon({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        opacity: 0.9,
      }}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="var(--salt-text-icon)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LaunchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17L17 7"
        stroke="var(--salt-text-icon)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M10 7h7v7"
        stroke="var(--salt-text-icon)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function deltaTone(delta) {
  const d = toNumber(delta);
  if (d == null || d === 0) return "neutral";
  return d > 0 ? "pos" : "neg";
}

// muted SALT-y tones (not salesy)
function deltaStyle(tone) {
  if (tone === "pos")
    return { color: "var(--salt-delta-pos-color)", background: "var(--salt-delta-pos-bg)" };
  if (tone === "neg")
    return { color: "var(--salt-delta-neg-color)", background: "var(--salt-delta-neg-bg)" };
  return {
    color: "var(--salt-delta-neutral-color)",
    background: "var(--salt-delta-neutral-bg)",
  };
}

function normKey(x) {
  return String(x ?? "").trim().toLowerCase();
}

// Commit-specific ordering: strongest "so what" first (Forecast vs Commit usually leads)
function rankCommitRow(row) {
  const k = normKey(row?.key || row?.label);
  const order = [
    "forecast",
    "quota",
    "best_case",
    "bestcase",
    "most_likely",
    "mostlikely",
    "commit",
    "open_pipeline",
    "openpipeline",
    "open pipe",
    "open pipeline",
  ];
  const idx = order.findIndex((t) => k === t);
  return idx === -1 ? 999 : idx;
}

export default function MetricCard({
  label,
  value,
  title,

  // existing behavior
  onClick,
  onDoubleClick,

  // split click targets
  onValueClick,

  // expandable breakdown
  expandRows, // [{ key, label, value, delta }]  (delta optional)
  defaultExpanded = false,

  subValue,
  subLabel,
  headerRight = null,
  /** Extra controls (e.g. slider); clicks do not trigger card drill. */
  footer = null,
  isWip = false,
}) {
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(!!defaultExpanded);
  const [chevHover, setChevHover] = useState(false);

  const hasExpand = Array.isArray(expandRows) && expandRows.length > 0;

  // Drillable means: card click OR value click OR expand breakdown
  const hasDrill =
    typeof onClick === "function" ||
    typeof onDoubleClick === "function" ||
    typeof onValueClick === "function" ||
    hasExpand;

  const stopFooterBubble = (e) => {
    e.stopPropagation();
  };

  const isCommitCard = /commit/i.test(String(label ?? ""));

  // ✅ Commit delta ordering (only affects commit card)
  const orderedExpandRows = useMemo(() => {
    const rows = Array.isArray(expandRows) ? [...expandRows] : [];
    if (!isCommitCard) return rows;

    // primary: preferred semantic order (forecast first)
    rows.sort((a, b) => rankCommitRow(a) - rankCommitRow(b));

    return rows;
  }, [expandRows, isCommitCard]);

  const containerStyle = useMemo(
    () => ({
      position: "relative",
      background: "var(--salt-card-bg)",
      border: "var(--salt-card-border)",
      borderRadius: 14,
      padding: 14,
      paddingBottom: 14,

      boxShadow:
        hover && hasDrill ? "var(--salt-card-shadow-hover)" : "var(--salt-card-shadow)",
      transform: hover && hasDrill ? "translateY(-1px)" : "translateY(0)",
      transition: "all 180ms ease",
      cursor: hasDrill ? "pointer" : "default",
      userSelect: "none",
      outline: "none",
      minHeight: 72,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      overflow: "visible",
      zIndex: expanded ? 60 : 1,
    }),
    [hover, hasDrill, expanded]
  );

  const launchStyle = useMemo(
    () => ({
      position: "absolute",
      top: 10,
      right: 10,
      width: 26,
      height: 26,
      borderRadius: 10,
      display: "grid",
      placeItems: "center",
      opacity: hover && hasDrill ? 0.85 : 0,
      transform: hover && hasDrill ? "translateY(0)" : "translateY(-2px)",
      transition: "opacity 160ms ease, transform 160ms ease",
      pointerEvents: "none",
    }),
    [hover, hasDrill]
  );

  const scrimStyle = useMemo(
    () => ({
      display: expanded ? "block" : "none",
      position: "fixed",
      inset: 0,
      background: "var(--salt-card-scrim)",
      zIndex: 45,
      pointerEvents: expanded ? "auto" : "none",
    }),
    [expanded]
  );

  const panelStyle = useMemo(
    () => ({
      position: "absolute",
      left: 12,
      top: 58,
      width: "min(520px, calc(200% + 12px))",
      background: "var(--salt-card-panel-bg)",
      border: "var(--salt-card-panel-border)",
      borderRadius: 14,
      padding: 12,
      boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
      zIndex: 70,
      opacity: expanded ? 1 : 0,
      transform: expanded ? "translateY(0)" : "translateY(-6px)",
      transition: "opacity 160ms ease, transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      pointerEvents: expanded ? "auto" : "none",
    }),
    [expanded]
  );

  const bottomEdgeStyle = useMemo(
    () => ({
      display: hasExpand ? "block" : "none",
      position: "absolute",
      left: 10,
      right: 10,
      bottom: 0,
      height: 1,
      borderRadius: 999,
      background: "var(--salt-card-edge)",
      opacity: 0.9,
      pointerEvents: "none",
    }),
    [hasExpand]
  );

  const bottomChevronWrapStyle = useMemo(
    () => ({
      display: hasExpand ? "flex" : "none",
      position: "absolute",
      left: "50%",
      bottom: -10,
      transform: "translateX(-50%)",
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.75,
      zIndex: 65,
    }),
    [hasExpand]
  );

  const bottomChevronBtnStyle = useMemo(
    () => ({
      appearance: "none",
      border: "var(--salt-card-chev-border)",
      background: "var(--salt-card-chev-bg)",
      cursor: "pointer",
      padding: "2px 10px",
      borderRadius: 999,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 0,
      boxShadow: chevHover ? "0 8px 18px rgba(0,0,0,0.12)" : "0 4px 10px rgba(0,0,0,0.06)",
      transform: chevHover ? "scale(1.05)" : "scale(1)",
      transition: "transform 140ms ease, box-shadow 160ms ease",
    }),
    [chevHover]
  );

  const handleCardClick = () => {
    onClick?.();
  };

  const handleValueClick = (e) => {
    if (typeof onValueClick !== "function") return;
    e.stopPropagation();
    onValueClick();
  };

  const toggleExpanded = (e) => {
    e?.stopPropagation?.();
    if (!hasExpand) return;
    setExpanded((v) => !v);
  };

  const closeExpanded = (e) => {
    e?.stopPropagation?.();
    setExpanded(false);
  };

  const onKeyDown = (e) => {
    if (!hasDrill) return;

    if (e.key === "Enter") {
      e.preventDefault();
      if (typeof onValueClick === "function") onValueClick();
      else onClick?.();
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      if (hasExpand) setExpanded((v) => !v);
      return;
    }
  };

  return (
    <>
      {hasExpand && expanded && <div style={scrimStyle} onClick={closeExpanded} aria-hidden="true" />}

      <div
        title={title}
        style={containerStyle}
        role={hasDrill ? "button" : undefined}
        tabIndex={hasDrill ? 0 : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={handleCardClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <div style={launchStyle}>
          <LaunchIcon />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 950,
              letterSpacing: 0.6,
              opacity: 0.65,
              textTransform: "uppercase",
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>

          {headerRight}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}
          >
            <AnimatedMetricValue
              value={value}
              clickable={typeof onValueClick === "function"}
              active={hover}
              onClick={handleValueClick}
            />
          </div>

          {subValue != null && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.2,
                opacity: 0.75,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{subValue}</span>

              {subLabel && <span style={{ opacity: 0.6 }}>{subLabel}</span>}
            </div>
          )}
        </div>

        {footer ? (
          <div
            role="presentation"
            onClick={stopFooterBubble}
            onMouseDown={stopFooterBubble}
            onKeyDown={stopFooterBubble}
            style={{ marginTop: 8, minWidth: 0 }}
          >
            {footer}
          </div>
        ) : null}

        {hasExpand && (
          <div style={panelStyle} role="region" aria-label={`${label} breakdown`}>
            <div style={{ display: "grid", gap: 8 }}>
              {(orderedExpandRows || []).map((r) => {
                const tone = deltaTone(r?.delta);
                deltaStyle(tone); // retained for future use
                return (
                  <div
                    key={r?.key ?? r?.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 950, opacity: 0.7, letterSpacing: 0.3 }}>
                      {r?.label}
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(15, 23, 42, 0.88)" }}>
                      {r?.value ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasExpand && (
          <>
            <div style={bottomEdgeStyle} />
            <div style={bottomChevronWrapStyle}>
              <button
                onClick={toggleExpanded}
                style={bottomChevronBtnStyle}
                onMouseEnter={() => setChevHover(true)}
                onMouseLeave={() => setChevHover(false)}
                aria-label={expanded ? "Collapse breakdown" : "Expand breakdown"}
                title={expanded ? "Collapse" : "Expand"}
              >
                <ChevronIcon open={expanded} />
              </button>
            </div>
          </>
        )}

        {isWip && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontSize: 45,
                fontWeight: 1000,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "rgba(15, 23, 42, 0.22)",
                transform: "rotate(-12deg)",
              }}
            >
              WIP
            </div>
          </div>
        )}
      </div>
    </>
  );
}