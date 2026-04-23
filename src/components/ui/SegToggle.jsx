import React from "react";

export default function SegToggle({ value, options, onChange, direction = "row" }) {
  const isVertical = direction === "column";

  return (
    <div style={{
      ...styles.container,
      flexDirection: direction,
      borderRadius: isVertical ? "16px" : "999px",
      padding: isVertical ? "4px" : "3px",
    }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              ...styles.button,
              color: active ? "rgba(15,23,42,0.98)" : "rgba(15,23,42,0.60)",
              background: active ? "rgba(15,23,42,0.12)" : "transparent",
              boxShadow: active ? "0 2px 6px rgba(0,0,0,0.12)" : "none",
              width: isVertical ? "100%" : "auto",
              minWidth: isVertical ? "40px" : "50px",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  container: {
    display: "inline-flex",
    alignItems: "center",
    background: "rgba(255,255,255,0.65)",
    border: "1px solid rgba(15, 23, 42, 0.12)",
    overflow: "hidden",
    whiteSpace: "nowrap",
    transition: "all 0.2s ease-in-out",
  },
  button: {
    appearance: "none",
    border: "none",
    cursor: "pointer",
    padding: "6px 10px",
    fontSize: "11px",
    fontWeight: 950,
    letterSpacing: "0.3px",
    borderRadius: "999px",
    transition: "all 0.2s ease",
    lineHeight: "14px",
  },
};