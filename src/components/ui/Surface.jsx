import React from "react";

export function Surface({ children, padding = 14, style }) {
  return (
    <div
      style={{
        borderRadius: 18,
        background: "var(--salt-surface-bg)",
        border: "var(--salt-surface-border)",
        boxShadow: "var(--salt-surface-shadow)",
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Surface;