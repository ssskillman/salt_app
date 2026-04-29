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
          style={{
            fontFamily: "var(--salt-font-sans)",
            fontSize: "var(--salt-type-h1-size)",
            fontWeight: "var(--salt-type-h1-weight)",
            letterSpacing: 0.02,
            color: "var(--salt-text-strong)",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontFamily: "var(--salt-font-sans)",
              fontSize: "var(--salt-type-subtitle-size)",
              fontWeight: "var(--salt-type-subtitle-weight)",
              lineHeight: 1.45,
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