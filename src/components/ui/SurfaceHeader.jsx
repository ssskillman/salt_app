import React from "react";
import IconButton from "./IconButton"; 

export function SurfaceHeader({ title, subtitle, rightNode = null, onInfo = null }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div
          style={{ fontSize: 16, fontWeight: 950, letterSpacing: 0.2, color: "var(--salt-text-strong)" }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              opacity: 0.85,
              color: "var(--salt-text-muted)",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {rightNode}
        {onInfo && (
          /* Swapping <button> for your new <IconButton> */
          <IconButton title="Section definitions" onClick={onInfo}>
            ⓘ
          </IconButton>
        )}
      </div>
    </div>
  );
}

export default SurfaceHeader;