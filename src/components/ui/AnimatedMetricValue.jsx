// src/components/ui/AnimatedMetricValue.jsx
import React, { useEffect, useRef, useState } from "react";
import { fmtMoneyCompact } from "../../utils/formatters.jsx";

function countDecimalsFromString(s) {
  const m = String(s ?? "").match(/\.(\d+)/);
  return m ? m[1].length : 0;
}

export function parseAnimatedMetricValue(rawValue) {
  const raw = rawValue == null ? "" : String(rawValue).trim();

  if (!raw || raw === "—" || raw === "-") {
    return { ok: false, raw };
  }

  // Money compact: $563.8K / -$2.1M / $0
  const moneyMatch = raw.match(/^(-)?\$(\d+(?:\.\d+)?)([KMBT])?$/i);
  if (moneyMatch) {
    const negative = moneyMatch[1] === "-";
    const num = Number(moneyMatch[2]);
    const suffix = (moneyMatch[3] || "").toUpperCase();

    const mult =
      suffix === "K" ? 1e3 :
      suffix === "M" ? 1e6 :
      suffix === "B" ? 1e9 :
      suffix === "T" ? 1e12 :
      1;

    return {
      ok: true,
      kind: "money",
      numeric: (negative ? -1 : 1) * num * mult,
      raw,
    };
  }

  // Percent: -20.3%
  const pctMatch = raw.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (pctMatch) {
    return {
      ok: true,
      kind: "percent",
      numeric: Number(pctMatch[1]),
      decimals: countDecimalsFromString(raw),
      raw,
    };
  }

  // X multiple: 4.2x / 4x
  const xMatch = raw.match(/^(-?\d+(?:\.\d+)?)x$/i);
  if (xMatch) {
    return {
      ok: true,
      kind: "multiple",
      numeric: Number(xMatch[1]),
      decimals: countDecimalsFromString(raw),
      raw,
    };
  }

  // Plain number with optional commas
  const normalized = raw.replace(/,/g, "");
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return {
      ok: true,
      kind: "number",
      numeric: Number(normalized),
      decimals: countDecimalsFromString(raw),
      useGrouping: raw.includes(","),
      raw,
    };
  }

  return { ok: false, raw };
}

export function formatAnimatedMetricValue(parsed, numericValue) {
  if (!parsed?.ok) return parsed?.raw ?? "—";

  if (parsed.kind === "money") {
    return fmtMoneyCompact(numericValue);
  }

  if (parsed.kind === "percent") {
    const decimals = parsed.decimals ?? 0;
    return `${Number(numericValue).toFixed(decimals)}%`;
  }

  if (parsed.kind === "multiple") {
    const decimals = parsed.decimals ?? 0;
    return `${Number(numericValue).toFixed(decimals)}x`;
  }

  if (parsed.kind === "number") {
    const decimals = parsed.decimals ?? 0;
    return Number(numericValue).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: parsed.useGrouping ?? true,
    });
  }

  return parsed.raw ?? "—";
}

export default function AnimatedMetricValue({
  value,
  clickable = false,
  active = false,
  onClick,
  style = {},
  duration = 360,
}) {
  const prefersReducedMotionRef = useRef(false);
  const frameRef = useRef(null);
  const lastParsedRef = useRef(parseAnimatedMetricValue(value));
  const [displayValue, setDisplayValue] = useState(() => String(value ?? "—"));
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    prefersReducedMotionRef.current = Boolean(mq?.matches);

    if (!mq) return;

    const update = () => {
      prefersReducedMotionRef.current = Boolean(mq.matches);
    };

    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }

    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  useEffect(() => {
    const nextParsed = parseAnimatedMetricValue(value);
    const prevParsed = lastParsedRef.current;

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const nextRaw = String(value ?? "—");

    const canAnimate =
      !prefersReducedMotionRef.current &&
      prevParsed?.ok &&
      nextParsed?.ok &&
      prevParsed.kind === nextParsed.kind &&
      Number.isFinite(prevParsed.numeric) &&
      Number.isFinite(nextParsed.numeric) &&
      prevParsed.numeric !== nextParsed.numeric;

    if (!canAnimate) {
      setIsAnimating(false);
      setDisplayValue(nextRaw);
      lastParsedRef.current = nextParsed;
      return undefined;
    }

    setIsAnimating(true);

    const from = prevParsed.numeric;
    const to = nextParsed.numeric;
    const startedAt = performance.now();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const elapsed = now - startedAt;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      const current = from + (to - from) * eased;

      setDisplayValue(formatAnimatedMetricValue(nextParsed, current));

      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayValue(nextRaw);
        setIsAnimating(false);
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    lastParsedRef.current = nextParsed;

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [value, duration]);

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <div
      onClick={onClick}
      title={clickable ? "Click to navigate" : undefined}
      style={{
        fontSize: 22,
        fontWeight: 1000,
        color: "rgba(15, 23, 42, 0.92)",
        cursor: clickable ? "pointer" : "inherit",
        textDecoration: active && clickable ? "underline" : "none",
        textUnderlineOffset: 3,
        opacity: isAnimating ? 0.96 : 1,
        transform: isAnimating ? "translateY(-0.5px)" : "translateY(0)",
        transition: "opacity 120ms ease, transform 120ms ease",
        willChange: "contents, opacity, transform",
        ...style,
      }}
    >
      {displayValue ?? "—"}
    </div>
  );
}