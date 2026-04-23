import React from "react";

/**
 * IconButton Component
 * @param {string} title - Tooltip text
 * @param {function} onClick - Click handler
 * @param {ReactNode} children - Icon or Text inside the button
 * @param {boolean} selected - Active state styling
 */
export function IconButton({ title, onClick, children, selected = false }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        appearance: "none",
        border: selected
          ? "1px solid rgba(15, 23, 42, 0.22)"
          : "1px solid rgba(15, 23, 42, 0.12)",
        background: selected
          ? "rgba(255,255,255,0.92)"
          : "rgba(255,255,255,0.7)",
        borderRadius: 10,
        padding: "6px 10px",
        cursor: "pointer",
        color: "rgba(15,23,42,0.78)",
        fontSize: 13,
        fontWeight: 950,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        boxShadow: selected
          ? "0 10px 24px rgba(0,0,0,0.12)"
          : "0 8px 18px rgba(0,0,0,0.08)",
        whiteSpace: "nowrap",
        transform: selected ? "translateY(-0.5px)" : "none",
        transition: "all 0.15s ease",
      }}
      // Subtle hover effect
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.background = "rgba(255,255,255,0.9)";
          e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.1)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.background = "rgba(255,255,255,0.7)";
          e.currentTarget.style.boxShadow = "0 8px 18px rgba(0,0,0,0.08)";
        }
      }}
    >
      {children}
    </button>
  );
}

export default IconButton;