// src/components/DefinitionsDrawer.jsx

import React, { useMemo } from "react";
import { DEFINITIONS as DEFINITIONS_SRC, VIEW_SUMMARIES } from "../utils/definitions.js";

/**
 * PERSONA_MAP defines which sections are visible for each VIEW.
 * - VIEW keys are used by the top-right Definitions button (e.g., "view_ceo")
 * - Section keys are used by (i) icons (e.g., "create_close", "deals_500k")
 */
const PERSONA_MAP = {
  view_ceo: [
    "company_totals",
    "field_execution",
    "execution_health",
    "deals_500k",
    "create_close",
    "ae_performance",
    "horseman",
    "cro_revintel_tree",
    "product_mix",
  ],
  view_cfo: ["cfo_treemap"],
  view_cro: ["cro_waterfall"],
  view_cmo: ["cmo"],
  view_cpo: ["cpo"],
  view_cpco: ["cpco"],

  // ✅ NEW: standalone waterfall view
  view_waterfall: ["cro_waterfall"],

  // Optional legacy persona aliases (safe if anything still calls openDefs("ceo"))
  ceo: [
    "company_totals",
    "field_execution",
    "execution_health",
    "deals_500k",
    "create_close",
    "ae_performance",
    "horseman",
    "cro_revintel_tree",
    "product_mix",
  ],
  cfo: ["cfo_treemap"],
  cro: ["cro_waterfall"],
  cmo: ["cmo"],
  cpo: ["cpo"],
  cpco: ["cpco"],

  // ✅ NEW: legacy alias
  waterfall: ["cro_waterfall"],
};

/* -----------------------------
   Internal UI Components
----------------------------- */

function DefinitionItem({ term, body, def }) {
  const text = body ?? def ?? "";
  if (!term && !text) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 950, color: "rgba(15,23,42,0.92)" }}>{term}</div>
      <div style={{ marginTop: 4, fontSize: 12, lineHeight: "18px", color: "rgba(15,23,42,0.78)" }}>{text}</div>
    </div>
  );
}

function DefinitionsSectionCard({ title, subtitle, items }) {
  if (!title) return null;

  return (
    <div
      style={{
        borderRadius: 14,
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(15,23,42,0.10)",
        boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 950,
            letterSpacing: 0.5,
            color: "#475569",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 850, opacity: 0.6, lineHeight: "14px" }}>
            {subtitle}
          </div>
        )}
      </div>

      {(items || []).map((it) => (
        <DefinitionItem key={it.term || `${Math.random()}`} term={it.term} body={it.body} def={it.def} />
      ))}
    </div>
  );
}

function ViewSummaryCard({ summary }) {
  if (!summary) return null;

  return (
    <div
      style={{
        borderRadius: 14,
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(15,23,42,0.10)",
        boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 950,
          letterSpacing: 0.5,
          color: "#475569",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        View Summary
      </div>

      {summary.title && (
        <div style={{ fontSize: 13, fontWeight: 950, color: "rgba(15,23,42,0.92)", marginBottom: 8 }}>
          {summary.title}
        </div>
      )}

      {summary.body && (
        <div style={{ fontSize: 12, lineHeight: "18px", color: "rgba(15,23,42,0.78)", marginBottom: 10 }}>
          {summary.body}
        </div>
      )}

      {Array.isArray(summary.bullets) && summary.bullets.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(15,23,42,0.78)", fontSize: 12, lineHeight: "18px" }}>
          {summary.bullets.map((b, i) => (
            <li key={`${i}-${b}`}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionSummaryCard({ title, summary }) {
  if (!summary) return null;

  return (
    <div
      style={{
        borderRadius: 14,
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(15,23,42,0.10)",
        boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 950,
          letterSpacing: 0.5,
          color: "#475569",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Section Summary
      </div>

      {title && <div style={{ fontSize: 13, fontWeight: 950, color: "rgba(15,23,42,0.92)", marginBottom: 8 }}>{title}</div>}

      <div style={{ fontSize: 12, lineHeight: "18px", color: "rgba(15,23,42,0.78)" }}>{summary}</div>
    </div>
  );
}

function SlideInDrawer({ open, title, subtitle, onClose, children }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.22)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 220ms ease",
          zIndex: 12000,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: 420,
          maxWidth: "92vw",
          background: "rgba(255,255,255,0.98)",
          borderLeft: "1px solid rgba(15,23,42,0.10)",
          boxShadow: "-20px 0 50px rgba(0,0,0,0.18)",
          transform: open ? "translateX(0)" : "translateX(110%)",
          transition: "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          zIndex: 12001,
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui",
        }}
      >
        <div
          style={{
            padding: 14,
            borderBottom: "1px solid rgba(15,23,42,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 950, color: "rgba(15,23,42,0.92)" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, fontWeight: 850, opacity: 0.65 }}>{subtitle}</div>}
          </div>

          <button
            onClick={onClose}
            style={{
              appearance: "none",
              border: "1px solid rgba(15,23,42,0.14)",
              background: "white",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 950,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 14, overflow: "auto", flex: 1 }}>{children}</div>
      </div>
    </>
  );
}

function prettyViewLabel(key) {
  if (!key) return "";
  const k = String(key).toLowerCase();
  const base = k.startsWith("view_") ? k.slice(5) : k;
  return base.toUpperCase();
}

/* -----------------------------
   Exported Component
----------------------------- */

export default function DefinitionsDrawer({ open, sectionKey, onClose }) {
  const sectionKeyLc = sectionKey ? String(sectionKey).toLowerCase() : null;

  const isView = useMemo(() => !!sectionKeyLc && !!PERSONA_MAP[sectionKeyLc], [sectionKeyLc]);

  const keysToRender = useMemo(() => {
    if (!sectionKeyLc) return [];

    // If VIEW key (view_ceo/view_cfo/...) or legacy alias (ceo/cfo/...)
    if (PERSONA_MAP[sectionKeyLc]) return PERSONA_MAP[sectionKeyLc];

    // Otherwise render a specific section if it exists
    if (DEFINITIONS_SRC?.[sectionKeyLc]) return [sectionKeyLc];

    return [];
  }, [sectionKeyLc]);

  const viewSummary = useMemo(() => {
    if (!isView) return null;

    // prefer exact key; if missing, try view_ prefix form
    const direct = VIEW_SUMMARIES?.[sectionKeyLc] ?? null;
    if (direct) return direct;

    const asViewKey = sectionKeyLc?.startsWith("view_") ? sectionKeyLc : `view_${sectionKeyLc}`;
    return VIEW_SUMMARIES?.[asViewKey] ?? null;
  }, [isView, sectionKeyLc]);

  const sectionSummary = useMemo(() => {
    if (!sectionKeyLc || isView) return null;
    const sec = DEFINITIONS_SRC?.[sectionKeyLc];
    if (!sec?.summary) return null;
    return { title: sec?.title ?? null, summary: sec.summary };
  }, [sectionKeyLc, isView]);

  const subtitle = useMemo(() => {
    if (!sectionKeyLc) return "Section Context";
    if (isView) return `Full guide for ${prettyViewLabel(sectionKeyLc)} View`;
    return "Section Context";
  }, [sectionKeyLc, isView]);

  const hasAnyContent =
    (isView && viewSummary && (viewSummary.title || viewSummary.body)) ||
    (!isView && sectionSummary && sectionSummary.summary) ||
    keysToRender.length > 0;

  return (
    <SlideInDrawer open={open} title="Definitions" subtitle={subtitle} onClose={onClose}>
      {/* ✅ NEW: view-level summary (top-right Definitions button) */}
      {isView ? <ViewSummaryCard summary={viewSummary} /> : <SectionSummaryCard title={sectionSummary?.title} summary={sectionSummary?.summary} />}

      {!hasAnyContent ? (
        <div style={{ fontSize: 12, fontWeight: 850, color: "rgba(15,23,42,0.65)" }}>
          No definitions found for <span style={{ fontWeight: 950 }}>{sectionKeyLc || "unknown"}</span>.
        </div>
      ) : keysToRender.length === 0 ? (
        <div style={{ fontSize: 12, fontWeight: 850, color: "rgba(15,23,42,0.65)" }}>
          No metric definitions are configured yet for <span style={{ fontWeight: 950 }}>{sectionKeyLc?.toUpperCase() || "unknown"}</span>.
        </div>
      ) : (
        keysToRender.map((key) => {
          const section = DEFINITIONS_SRC[key];
          if (!section) return null;

          const items = (section.metrics || []).map((m) => ({
            term: m.term,
            def: m.def,
          }));

          return <DefinitionsSectionCard key={key} title={section.title} subtitle={section.subtitle} items={items} />;
        })
      )}
    </SlideInDrawer>
  );
}