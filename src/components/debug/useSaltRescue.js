import { useEffect, useRef, useState } from "react";

const DEFAULT_TIMEOUT_MS = 15000;

export default function useSaltRescue({
  isAppReady,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isAppReady) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      setIsOpen(true);
    }, timeoutMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isAppReady, timeoutMs]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const key = String(e.key || "").toLowerCase();
      const isShortcut =
        (e.shiftKey && e.metaKey && key === "s") ||
        (e.shiftKey && e.ctrlKey && key === "s");

      if (isShortcut) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    markResolved: () => setIsOpen(false),
  };
}