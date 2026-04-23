// src/components/cpo/AccountSelect.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

function norm(x) {
  return String(x ?? "").trim().toLowerCase();
}

export default function AccountSelect({
  options = [], // [{ account_name, account_id, iterable_org_id_c, account_manager }]
  value = null, // selected option object
  onChange, // (option|null) => void
  disabled = false,
  placeholder = "Type an account name…",
  maxResults = 10,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value?.account_name ?? "");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // keep input text synced when parent changes selection
  useEffect(() => {
    setQ(value?.account_name ?? "");
  }, [value?.account_name]);

  // close on outside click
  useEffect(() => {
    const onDown = (e) => {
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const filtered = useMemo(() => {
    const query = norm(q);
    const base = Array.isArray(options) ? options : [];
    if (!query) return base.slice(0, maxResults);

    return base
      .filter((o) => norm(o?.account_name).includes(query))
      .slice(0, maxResults);
  }, [options, q, maxResults]);

  const select = (opt) => {
    onChange?.(opt);
    setOpen(false);
  };

  const clear = () => {
    onChange?.(null);
    setQ("");
    setOpen(false);
    inputRef.current?.focus?.();
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", minWidth: 320, maxWidth: 420 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.70)",
          border: "1px solid rgba(15,23,42,0.12)",
          backdropFilter: "blur(10px)",
          boxShadow: open ? "0 14px 30px rgba(0,0,0,0.10)" : "0 10px 22px rgba(0,0,0,0.06)",
          transition: "box-shadow 160ms ease, border-color 160ms ease",
          opacity: disabled ? 0.9 : 1,
        }}
      >
        {/* icon */}
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: "rgba(59,130,246,0.10)",
            border: "1px solid rgba(59,130,246,0.18)",
            color: "rgba(59,130,246,0.95)",
            fontWeight: 950,
          }}
          title="Account filter"
        >
          A
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 950, color: "rgba(15,23,42,0.60)", letterSpacing: 0.2 }}>
            Account
          </div>

          <input
            ref={inputRef}
            value={q}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => {
              if (disabled) return;
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (disabled) return;
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter") {
                if (filtered?.[0]) select(filtered[0]);
              }
            }}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              padding: 0,
              marginTop: 2,
              fontSize: 13,
              fontWeight: 900,
              color: "rgba(15,23,42,0.88)",
              textOverflow: "ellipsis",
              cursor: disabled ? "not-allowed" : "text",
            }}
          />
        </div>

        {!disabled && value ? (
          <button
            onClick={clear}
            style={{
              appearance: "none",
              border: "1px solid rgba(15,23,42,0.12)",
              background: "rgba(255,255,255,0.8)",
              borderRadius: 10,
              padding: "6px 8px",
              fontSize: 12,
              fontWeight: 950,
              cursor: "pointer",
              color: "rgba(15,23,42,0.70)",
            }}
            title="Clear selection"
          >
            Clear
          </button>
        ) : null}

        <button
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
          }}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            cursor: disabled ? "not-allowed" : "pointer",
            padding: 4,
            opacity: disabled ? 0.35 : 0.75,
          }}
          title={disabled ? "Controlled by Sigma filter" : open ? "Close" : "Open"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="rgba(15,23,42,0.85)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* dropdown */}
      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(15,23,42,0.12)",
            borderRadius: 14,
            boxShadow: "0 18px 50px rgba(0,0,0,0.14)",
            overflow: "hidden",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, fontWeight: 850, color: "rgba(15,23,42,0.60)" }}>
                No matches
              </div>
            ) : (
              filtered.map((opt) => {
                const selected = value?.account_id && opt?.account_id === value.account_id;
                return (
                  <button
                    key={`${opt?.account_id ?? opt?.account_name}`}
                    onClick={() => select(opt)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      background: selected ? "rgba(59,130,246,0.08)" : "transparent",
                      cursor: "pointer",
                      display: "grid",
                      gap: 2,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 950,
                          color: "rgba(15,23,42,0.90)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {opt?.account_name ?? "Unnamed account"}
                      </div>
                      {selected ? (
                        <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(59,130,246,0.95)" }}>✓</div>
                      ) : null}
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 850, color: "rgba(15,23,42,0.58)" }}>
                      {opt?.account_manager ? `AM: ${opt.account_manager}` : "AM: —"}
                      {opt?.iterable_org_id || opt?.iterable_org_id_c
                        ? ` • Org: ${opt?.iterable_org_id ?? opt?.iterable_org_id_c}`
                        : ""}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}