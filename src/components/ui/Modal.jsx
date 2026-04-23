// src/components/ui/Modal.jsx
import React, { useEffect } from "react";

export function Modal({ open, title, subtitle, onClose, children, width = 980 }) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }

    try {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {
      // no-op
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "auto";
    };
  }, [open, onClose]);

  if (!open) return null;

  const resolvedWidth = typeof width === "number" ? `${width}px` : String(width);

  return (
    <>
      <div onClick={onClose} style={styles.overlay} />
      <div
        style={{
          ...styles.contentContainer,
          width: `min(96vw, ${resolvedWidth})`,
          maxWidth: `min(96vw, ${resolvedWidth})`,
        }}
      >
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{title}</div>
            {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            ✕
          </button>
        </div>
        <div style={styles.body}>{children}</div>
      </div>
    </>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    zIndex: 100,
    backdropFilter: "blur(2px)",
  },
  contentContainer: {
    position: "fixed",
    top: "6%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(96vw, 980px)",
    maxHeight: "88%",
    background: "white",
    borderRadius: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    zIndex: 101,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontFamily: "system-ui",
  },
  header: {
    padding: 16,
    borderBottom: "1px solid #eee",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: { fontSize: 18, fontWeight: 900, color: "#0f172a" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 4, fontWeight: 600 },
  closeBtn: {
    appearance: "none",
    border: "1px solid #ddd",
    background: "#f8fafc",
    borderRadius: 8,
    padding: "4px 10px",
    cursor: "pointer",
  },
  body: { padding: 16, overflow: "auto" },
};

export default Modal;