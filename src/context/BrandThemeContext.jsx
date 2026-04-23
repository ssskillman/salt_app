import React, { createContext, useContext, useLayoutEffect, useMemo } from "react";

/** Iterable ’26 brand shell only (legacy “status quo” toggle removed). */
export const SALT_BRAND_THEME_STORAGE = "salt-brand-theme";

const BrandThemeContext = createContext(null);

function applyIterableTheme() {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-salt-brand-theme", "iterable");
  try {
    localStorage.setItem(SALT_BRAND_THEME_STORAGE, "iterable");
  } catch {
    /* ignore */
  }
}

export function BrandThemeProvider({ children }) {
  useLayoutEffect(() => {
    applyIterableTheme();
  }, []);

  const value = useMemo(
    () => ({
      themeId: "iterable",
      setThemeId: () => {},
      isIterable: true,
    }),
    []
  );

  return <BrandThemeContext.Provider value={value}>{children}</BrandThemeContext.Provider>;
}

export function useBrandTheme() {
  const ctx = useContext(BrandThemeContext);
  if (!ctx) throw new Error("useBrandTheme must be used within BrandThemeProvider");
  return ctx;
}
