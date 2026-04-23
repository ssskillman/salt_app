import React, { useEffect } from "react";

export default function SlideInDrawer({ open, onClose, title, subtitle, children, side = "left", width = 350 }) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const isLeft = side === "left";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          transition: "opacity 0.3s ease-in-out",
          zIndex: 1000,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Drawer Body */}
      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          [isLeft ? "left" : "right"]: 0,
          width: width,
          backgroundColor: "white",
          boxShadow: isLeft ? "4px 0 15px rgba(0,0,0,0.1)" : "-4px 0 15px rgba(0,0,0,0.1)",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          // The Slide Effect
          transform: open ? "translateX(0)" : `translateX(${isLeft ? "-100%" : "100%"})`,
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          fontFamily: "system-ui",
        }}
      >
        <div style={{ padding: "20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 900 }}>{title}</h2>
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#666", fontWeight: 700 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: "20px", cursor: "pointer", fontWeight: 900 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {children}
        </div>
      </div>
    </>
  );
}