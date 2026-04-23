import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function ExecutiveInsightPopover({
  headline,
  supporting = [],
  scopeLabel = "Global",
  label = "Executive Insight",
  cardMode = false,
  teaser = "Scoped narrative",
  onPauseRotation,
  progress = 0,
  currentIndex = 0,
  totalCount = 0,
  onPrev,
  onNext,
  onJumpTo,
}) {
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const openTimerRef = useRef(null);
  const closeTimerRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState(null);

    const sparkleStyle = {
        width: 22,
        height: 22,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(circle at 35% 35%, #ffffff 0%, #dbeafe 20%, #93c5fd 45%, #60a5fa 70%, #2563eb 100%)",
        boxShadow: "0 0 0 3px rgba(59,130,246,0.12), 0 4px 10px rgba(37,99,235,0.22)",
        color: "white",
        fontSize: 12,
        flexShrink: 0,
        animation: "executiveSparklePulse 2.6s ease-in-out infinite",
        transform: "translateZ(0)",
    };

  const clearTimers = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openSoon = () => {
    clearTimers();
    openTimerRef.current = setTimeout(() => setIsOpen(true), 120);
  };

  const closeSoon = () => {
    if (isPinned) return;
    clearTimers();
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 160);
  };

    const handleTogglePinned = () => {
    clearTimers();
    setIsPinned((prev) => {
        const next = !prev;
        setIsOpen(next ? true : false);
        onPauseRotation?.(next);
        return next;
    });
    };

    const isNavDisabled = totalCount <= 1;    

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const gap = 10;
      const preferredWidth = 520;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const maxWidth = Math.min(preferredWidth, viewportW - 32);

      let left = rect.left;
      let top = rect.bottom + gap;

      if (left + maxWidth > viewportW - 16) {
        left = Math.max(16, viewportW - maxWidth - 16);
      }

      let maxHeight = Math.min(360, viewportH - top - 16);

      if (maxHeight < 180) {
        top = Math.max(16, rect.top - 260 - gap);
        maxHeight = Math.min(360, viewportH - top - 16);
      }

      setPopoverStyle({
        position: "fixed",
        left,
        top,
        width: maxWidth,
        maxWidth,
        maxHeight: Math.max(180, maxHeight),
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      const insideTrigger = wrapRef.current?.contains(e.target);
      const insidePopover = popoverRef.current?.contains(e.target);

      if (!insideTrigger && !insidePopover) {
        setIsOpen(false);
        setIsPinned(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setIsPinned(false);
      }
      if (e.key === "ArrowRight") {
        onNext?.();
        onPauseRotation?.(true);
        }

        if (e.key === "ArrowLeft") {
        onPrev?.();
        onPauseRotation?.(true);
        }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const triggerStyle = cardMode
    ? {
        appearance: "none",
        border: "1px solid rgba(37,99,235,0.14)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.96))",
        borderRadius: 14,
        padding: "12px 14px",
        minHeight: 108,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 8,
        cursor: "pointer",
        boxShadow: isOpen
          ? "0 0 0 2px rgba(59,130,246,0.12), 0 10px 22px rgba(0,0,0,0.06)"
          : "0 4px 10px rgba(0,0,0,0.04)",
        textAlign: "left",
        transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
      }
    : {
        appearance: "none",
        border: "1px solid rgba(15,23,42,0.10)",
        background: "rgba(255,255,255,0.78)",
        borderRadius: 999,
        padding: "10px 14px",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        boxShadow: isOpen
          ? "0 0 0 2px rgba(59,130,246,0.12)"
          : "0 4px 10px rgba(0,0,0,0.04)",
        transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
      };

  const popoverNode =
    isOpen && popoverStyle
      ? createPortal(
          <div
            ref={popoverRef}
            style={{
              ...popoverStyle,
              overflow: "auto",
              background: "white",
              border: "1px solid rgba(15,23,42,0.14)",
              borderRadius: 16,
              boxShadow: "0 20px 50px rgba(0,0,0,0.22)",
              padding: 16,
            }}
            onMouseEnter={() => {
            openSoon();
            onPauseRotation?.(true);
            }}
            onMouseLeave={() => {
            closeSoon();
            if (!isPinned) onPauseRotation?.(false);
            }}
          >
            <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 10,
            }}
            >
            <div
                style={{
                fontSize: 13,
                fontWeight: 1000,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: "rgba(15,23,42,0.62)",
                }}
            >
                {label}
            </div>

            <div
                style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                }}
            >
                <button
                type="button"
                disabled={isNavDisabled}
                onClick={() => {
                    if (isNavDisabled) return;
                    onPrev?.();
                    onPauseRotation?.(true);
                }}
                onMouseDown={(e) => {
                if (isNavDisabled) return;
                e.currentTarget.style.transform = "scale(0.95)";
                }}
                onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                }}
                onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                }}
                title="Previous insight"
                style={{
                    appearance: "none",
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "#f8fafc",
                    borderRadius: 8,
                    width: 30,
                    height: 30,
                    cursor: isNavDisabled ? "default" : "pointer",
                    fontWeight: 900,
                    color: "#334155",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: isNavDisabled ? 0.4 : 1,
                }}
                >
                ←
                </button>

                <button
                type="button"
                disabled={isNavDisabled}
                onClick={() => {
                    if (isNavDisabled) return;
                    onNext?.();
                    onPauseRotation?.(true);
                }}
                onMouseDown={(e) => {
                if (isNavDisabled) return;
                e.currentTarget.style.transform = "scale(0.95)";
                }}
                onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                }}
                onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                }}
                title="Next insight"
                style={{
                    appearance: "none",
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "#f8fafc",
                    borderRadius: 8,
                    width: 30,
                    height: 30,
                    cursor: isNavDisabled ? "default" : "pointer",
                    fontWeight: 900,
                    color: "#334155",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: isNavDisabled ? 0.4 : 1,
                }}
                >
                →
                </button>

                <button
                type="button"
                onClick={() => {
                    setIsOpen(false);
                    setIsPinned(false);
                    onPauseRotation?.(false);
                }}
                title="Close"
                style={{
                    appearance: "none",
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "#f8fafc",
                    borderRadius: 8,
                    padding: "4px 8px",
                    cursor: "pointer",
                    fontWeight: 900,
                    color: "#334155",
                }}
                >
                ✕
                </button>
            </div>
            </div>

            <div
              style={{
                fontSize: 16,
                lineHeight: 1.4,
                fontWeight: 900,
                color: "rgba(15,23,42,0.92)",
              }}
            >
              {headline}
            </div>

            {!!supporting.length && (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {supporting.slice(0, 2).map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      lineHeight: 1.45,
                      color: "rgba(15,23,42,0.72)",
                    }}
                  >
                    • {item}
                  </div>
                ))}
              </div>
            )}
            {totalCount > 1 && (
            <div
                style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 14,
                }}
            >
                {Array.from({ length: totalCount }).map((_, idx) => {
                const isActive = idx === currentIndex;

                return (
                    <button
                    key={idx}
                    type="button"
                    onClick={() => {
                    onJumpTo?.(idx);
                    onPauseRotation?.(true);
                    }}
                    title={`Go to insight ${idx + 1}`}
                    style={{
                        appearance: "none",
                        border: "none",
                        padding: 0,
                        width: isActive ? 18 : 8,
                        height: 8,
                        borderRadius: 999,
                        background: isActive ? "rgba(37,99,235,0.92)" : "rgba(15,23,42,0.16)",
                        cursor: "pointer",
                        transition: "all 180ms ease",
                    }}
                    />
                );
                })}
            </div>
            )}
            <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 14,
            }}
            >
            <div
                style={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(15,23,42,0.05)",
                border: "1px solid rgba(15,23,42,0.08)",
                }}
            >
                <span
                style={{
                    fontSize: 11,
                    fontWeight: 950,
                    color: "rgba(15,23,42,0.62)",
                    textTransform: "uppercase",
                    letterSpacing: 0.3,
                }}
                >
                Scope
                </span>
                <span
                style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: "#0f172a",
                }}
                >
                {scopeLabel || "Global"}
                </span>
            </div>

            <div
                style={{
                fontSize: 12,
                fontWeight: 900,
                color: "rgba(15,23,42,0.58)",
                whiteSpace: "nowrap",
                marginLeft: "auto",
                }}
            >
                {totalCount > 0 ? `${currentIndex + 1} of ${totalCount}` : null}
            </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
        <div
        ref={wrapRef}
        style={{
            display: cardMode ? "block" : "inline-block",
            width: cardMode ? "100%" : "auto",
        }}
        onMouseEnter={() => {
            openSoon();
        }}
        onMouseLeave={() => {
            closeSoon();
        }}
        >
            <button
            ref={triggerRef}
            type="button"
            onClick={handleTogglePinned}
            style={triggerStyle}
            title="Hover for executive insight"
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                openSoon();
                onPauseRotation?.(true);
                }}
                onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                closeSoon();
                if (!isPinned) onPauseRotation?.(false);
            }}
            >
          {cardMode ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={sparkleStyle}>✦</div>

                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 1000,
                    letterSpacing: 0.7,
                    textTransform: "uppercase",
                    color: "rgba(15,23,42,0.55)",
                  }}
                >
                  Executive Insight
                </div>
              </div>

                <div
                key={teaser}
                style={{
                    fontSize: 18,
                    fontWeight: 900,
                    lineHeight: 1.2,
                    color: "rgba(15,23,42,0.92)",
                    opacity: isOpen ? 1 : 0.95,
                    transition: "opacity 300ms ease",
                    animation: "fadeSlideIn 240ms ease",
                }}
                >
                {teaser}
                </div>

              <div
                    style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: "rgba(15,23,42,0.58)",
                    }}
                    >
                    View insight →
                    </div>

                    <div
                    style={{
                        width: "100%",
                        height: 4,
                        borderRadius: 999,
                        background: "rgba(15,23,42,0.06)",
                        overflow: "hidden",
                        marginTop: 2,
                    }}
                    >
                    <div
                        style={{
                        height: "100%",
                        width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
                        borderRadius: 999,
                        background: "linear-gradient(90deg, #60a5fa 0%, #2563eb 100%)",
                        transition: isOpen || isPinned ? "none" : "width 40ms linear",
                        }}
                    />
                </div>
            </>
          ) : (
            <>
              <div style={sparkleStyle}>✦</div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 950,
                  color: "rgba(15,23,42,0.86)",
                  whiteSpace: "nowrap",
                  animation: "executiveSparklePulse 2.6s ease-in-out infinite",
                  transform: "translateZ(0)",
                }}
              >
                Executive Insight
              </span>
            </>
          )}
        </button>
      </div>

      {popoverNode}
    </>
  );
}