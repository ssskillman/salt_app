// src/components/ui/DrillModalContextBar.jsx
import React from "react";

const wrap = {
  marginBottom: 12,
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(15,23,42,0.04)",
  border: "1px solid rgba(15,23,42,0.08)",
};

const helperStyle = {
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 650,
  color: "rgba(15,23,42,0.78)",
};

const linkBtn = {
  marginTop: 8,
  padding: 0,
  border: "none",
  background: "none",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 850,
  color: "#0f766e",
  textDecoration: "underline",
  fontFamily: "inherit",
};

/**
 * Short drill context + optional link to the Definitions drawer (same keys as `openDefs` in App).
 */
export default function DrillModalContextBar({ helperText, definitionsSection, onOpenDefinitions }) {
  const showLink = definitionsSection && typeof onOpenDefinitions === "function";

  if (!helperText && !showLink) return null;

  return (
    <div style={wrap}>
      {helperText ? <div style={helperStyle}>{helperText}</div> : null}
      {showLink ? (
        <button
          type="button"
          style={linkBtn}
          onClick={() => onOpenDefinitions(definitionsSection)}
        >
          View definitions →
        </button>
      ) : null}
    </div>
  );
}
