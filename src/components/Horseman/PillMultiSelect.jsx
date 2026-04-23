import React from "react";

export default function PillMultiSelect({ valueSet, options, onToggle }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {options.map((opt) => {
        const isSelected = valueSet.has(opt.value);
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(15,23,42,0.1)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 800,
              backgroundColor: isSelected ? "rgba(15,23,42,0.9)" : "white",
              color: isSelected ? "white" : "rgba(15,23,42,0.7)",
              transition: "all 0.2s ease"
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}