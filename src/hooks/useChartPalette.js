import { useMemo, useSyncExternalStore } from "react";

function subscribe(onStoreChange) {
  const el = document.documentElement;
  const mo = new MutationObserver(() => onStoreChange());
  mo.observe(el, { attributes: true, attributeFilter: ["data-salt-brand-theme"] });
  return () => mo.disconnect();
}

function getThemeSnapshot() {
  return document.documentElement.getAttribute("data-salt-brand-theme") === "iterable"
    ? "iterable"
    : "legacy";
}

function getServerSnapshot() {
  return "iterable";
}

function readCssColors() {
  const s = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => {
    const v = s.getPropertyValue(name).trim();
    return v || fallback;
  };
  return {
    won: pick("--salt-chart-won", "#60A5FA"),
    open: pick("--salt-chart-open", "#00C2B2"),
    lost: pick("--salt-chart-lost", "#FF6B6B"),
  };
}

/**
 * Recharts-friendly colors; updates when brand theme toggles (CSS variables on :root).
 */
export function useChartPalette() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);
  return useMemo(() => readCssColors(), [theme]);
}
