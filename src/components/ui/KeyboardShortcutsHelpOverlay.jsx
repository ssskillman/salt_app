import React, { useMemo } from "react";
import { DEFINITIONS, VIEW_SUMMARIES } from "../../utils/definitions.js";

/** Same section order as `DefinitionsDrawer` → `PERSONA_MAP.view_ceo`. */
const CEO_VIEW_SECTION_KEYS = [
  "company_totals",
  "field_execution",
  "execution_health",
  "deals_500k",
  "create_close",
  "ae_performance",
  "horseman",
  "cro_revintel_tree",
  "product_mix",
];

const OTHER_VIEW_KEYS = ["view_cfo", "view_cro", "view_cmo", "view_cpo", "view_cpco"];

const SHORTCUT_GROUPS = [
  {
    title: "Help",
    items: [
      {
        keys: "Shift + ?",
        desc: "Show or hide this keyboard shortcuts list.",
      },
    ],
  },
  {
    title: "Developer & tools",
    items: [
      {
        keys: "⌘ / Ctrl + Shift + D",
        desc: "Open or close the debug console.",
      },
      {
        keys: "⌘ / Ctrl + Shift + S",
        desc: "Open the Salt troubleshooting guide (Chrome DevTools steps).",
      },
      {
        keys: "⌘ / Ctrl + Shift + Y",
        desc: "Open the Salt dashboard architecture map.",
      },
    ],
  },
];

function briefFromSummary(summary, maxLen = 200) {
  if (!summary || typeof summary !== "string") return "";
  const firstBlock = summary.split(/\n\n/)[0] ?? summary;
  const flat = firstBlock.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLen) return flat;
  return `${flat.slice(0, maxLen - 1)}…`;
}

function firstSentence(text, maxLen = 220) {
  if (!text || typeof text !== "string") return "";
  const flat = text.replace(/\s+/g, " ").trim();
  const end = flat.search(/[.!?](\s|$)/);
  const chunk = end >= 0 ? flat.slice(0, end + 1) : flat;
  if (chunk.length <= maxLen) return chunk;
  return `${chunk.slice(0, maxLen - 1)}…`;
}

export default function KeyboardShortcutsHelpOverlay({ open, onClose }) {
  const ceoIntro = VIEW_SUMMARIES?.view_ceo;

  const ceoSectionCards = useMemo(() => {
    return CEO_VIEW_SECTION_KEYS.map((key) => {
      const sec = DEFINITIONS[key];
      if (!sec) return null;
      return {
        key,
        title: sec.title || key,
        blurb: briefFromSummary(sec.summary, 190),
      };
    }).filter(Boolean);
  }, []);

  const otherViewLines = useMemo(() => {
    return OTHER_VIEW_KEYS.map((vk) => {
      const v = VIEW_SUMMARIES[vk];
      if (!v?.title && !v?.body) return null;
      return {
        key: vk,
        title: v.title || vk.replace(/^view_/, "").toUpperCase(),
        blurb: firstSentence(v.body || "", 200),
      };
    }).filter(Boolean);
  }, []);

  if (!open) return null;

  const backdrop = {
    position: "fixed",
    inset: 0,
    zIndex: 200000,
    fontFamily: "var(--salt-font-sans, system-ui, sans-serif)",
    background:
      "linear-gradient(165deg, rgba(0, 58, 72, 0.94) 0%, rgba(22, 15, 41, 0.93) 48%, rgba(0, 72, 82, 0.94) 100%)",
    backdropFilter: "blur(3px)",
    WebkitBackdropFilter: "blur(3px)",
    display: "flex",
    flexDirection: "column",
    padding: "28px 28px 36px",
    boxSizing: "border-box",
    color: "rgba(255, 250, 246, 0.94)",
  };

  const panel = {
    flex: 1,
    minHeight: 0,
    maxWidth: 1180,
    width: "100%",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    borderRadius: 16,
    border: "1px solid rgba(89, 193, 167, 0.22)",
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
    padding: "22px 24px 20px",
    background: "rgba(8, 12, 18, 0.35)",
  };

  const headerRow = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 22,
    flexShrink: 0,
  };

  const titleStyle = {
    margin: 0,
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "0.02em",
    color: "rgba(255, 250, 246, 0.98)",
  };

  const closeLink = {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 950,
    color: "#7dd3c0",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  };

  const mainGrid = {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    display: "flex",
    flexWrap: "wrap",
    gap: "28px 36px",
    alignContent: "start",
  };

  const shortcutsCol = {
    flex: "1 1 260px",
    maxWidth: 320,
    minWidth: 0,
  };

  const dashboardCol = {
    flex: "1 1 320px",
    minWidth: 0,
  };

  const kbdSectionTitle = {
    margin: "0 0 10px",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#59C1A7",
  };

  const entry = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: "4px 6px",
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 1.5,
  };

  const keysStyle = {
    color: "#d5ff9f",
    fontWeight: 950,
    flex: "0 0 auto",
  };

  const colon = {
    color: "rgba(255, 250, 246, 0.45)",
    fontWeight: 600,
    flex: "0 0 auto",
  };

  const descStyle = {
    color: "rgba(255, 250, 246, 0.88)",
    fontWeight: 600,
    flex: "1 1 140px",
    minWidth: 0,
  };

  const dashHeader = {
    margin: "0 0 8px",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#59C1A7",
  };

  const dashIntroTitle = {
    margin: "0 0 6px",
    fontSize: 14,
    fontWeight: 950,
    color: "rgba(255, 250, 246, 0.96)",
  };

  const dashIntroBody = {
    margin: "0 0 16px",
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 600,
    color: "rgba(255, 250, 246, 0.78)",
  };

  const sectionCardGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 10,
    marginBottom: 18,
  };

  const sectionCard = {
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255, 250, 246, 0.06)",
    border: "1px solid rgba(0, 90, 114, 0.28)",
  };

  const sectionCardTitle = {
    margin: "0 0 6px",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#7dd3c0",
  };

  const sectionCardBody = {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 600,
    color: "rgba(255, 250, 246, 0.76)",
  };

  const otherBlockTitle = {
    margin: "0 0 8px",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#59C1A7",
  };

  const otherLine = {
    margin: "0 0 10px",
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 600,
    color: "rgba(255, 250, 246, 0.78)",
  };

  const otherStrong = {
    color: "rgba(255, 250, 246, 0.92)",
    fontWeight: 950,
  };

  const footnote = {
    marginTop: 16,
    fontSize: 11,
    lineHeight: 1.45,
    fontWeight: 600,
    color: "rgba(255, 250, 246, 0.52)",
    flexShrink: 0,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kbd-shortcuts-title"
      style={backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={panel}>
        <div style={headerRow}>
          <h1 id="kbd-shortcuts-title" style={titleStyle}>
            Keyboard shortcuts
          </h1>
          <button type="button" style={closeLink} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={mainGrid}>
          <div style={shortcutsCol}>
            {SHORTCUT_GROUPS.map((sec) => (
              <div key={sec.title} style={{ marginBottom: 18 }}>
                <h2 style={kbdSectionTitle}>{sec.title}</h2>
                {sec.items.map((item) => (
                  <div key={item.keys + item.desc} style={entry}>
                    <span style={keysStyle}>{item.keys}</span>
                    <span style={colon}>:</span>
                    <span style={descStyle}>{item.desc}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={dashboardCol}>
            <h2 style={dashHeader}>Dashboard sections</h2>
            <p style={{ margin: "0 0 10px", fontSize: 11, lineHeight: 1.45, fontWeight: 600, color: "rgba(255, 250, 246, 0.62)" }}>
              Section blurbs match the in-app <span style={{ color: "rgba(213, 255, 159, 0.9)", fontWeight: 950 }}>Definitions</span>{" "}
              drawer (same catalog as the ⓘ icons).
            </p>

            {ceoIntro?.title && <div style={dashIntroTitle}>{ceoIntro.title}</div>}
            {ceoIntro?.body && <p style={dashIntroBody}>{firstSentence(ceoIntro.body, 260)}</p>}

            <div style={sectionCardGrid}>
              {ceoSectionCards.map((card) => (
                <div key={card.key} style={sectionCard}>
                  <div style={sectionCardTitle}>{card.title}</div>
                  <p style={sectionCardBody}>{card.blurb || "—"}</p>
                </div>
              ))}
            </div>

            <h3 style={otherBlockTitle}>Other views</h3>
            {otherViewLines.map((line) => (
              <p key={line.key} style={otherLine}>
                <span style={otherStrong}>{line.title}:</span> {line.blurb}
              </p>
            ))}
          </div>
        </div>

        <p style={footnote}>
          On Windows and Linux, use Ctrl where this list shows ⌘ (Command). Typography and colors follow the Salt /
          Iterable in-app shell (mint accent, warm white body, Poppins when loaded).
        </p>
      </div>
    </div>
  );
}
