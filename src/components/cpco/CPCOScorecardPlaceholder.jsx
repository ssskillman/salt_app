// src/components/cpco/CPCOScorecardPlaceholder.jsx
import React from "react";
import Surface from "../ui/Surface";
import SurfaceHeader from "../ui/SurfaceHeader";

const TEXT = "rgba(15, 23, 42, 0.88)";
const MUTED = "rgba(15, 23, 42, 0.65)";
const BORDER = "rgba(15, 23, 42, 0.10)";

function InDevelopmentBanner() {
  return (
    <div
      style={{
        marginTop: 14,
        padding: "12px 14px",
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.68) 100%)",
        border: "1px solid rgba(15, 23, 42, 0.10)",
        boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          background: "rgba(15, 23, 42, 0.06)",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          fontSize: 11,
          fontWeight: 1000,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: "rgba(15, 23, 42, 0.82)",
          whiteSpace: "nowrap",
        }}
      >
        In Development
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 850,
          color: "rgba(15, 23, 42, 0.70)",
          lineHeight: 1.35,
        }}
      >
        Preview view. Core people metrics are available while the broader organizational health framework and supporting drill paths are being finalized.
      </div>
    </div>
  );
}

function Tile({ children }) {
  return (
    <div
      style={{
        width: "100%",
        minHeight: 165,
        borderRadius: 16,
        padding: "18px 16px",
        background: "rgba(255,255,255,0.55)",
        border: `1px solid ${BORDER}`,
        boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

function Metric({ title, value, suffix, note, notes }) {
  return (
    <Tile>
      <div style={{ textAlign: "center", maxWidth: 280 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 1000,
            color: "rgba(15, 23, 42, 0.78)",
            letterSpacing: 0.2,
            whiteSpace: "pre-line",
            lineHeight: 1.12,
          }}
        >
          {title}
        </div>

        <div style={{ marginTop: 12, fontSize: 44, fontWeight: 950, color: TEXT, lineHeight: 1 }}>
          {value}
          {suffix ? (
            <span style={{ fontSize: 22, fontWeight: 900, marginLeft: 8, color: MUTED }}>
              {suffix}
            </span>
          ) : null}
        </div>

        {note ? (
          <div style={{ marginTop: 10, fontSize: 12, fontStyle: "italic", fontWeight: 850, color: MUTED }}>
            {note}
          </div>
        ) : null}

        {Array.isArray(notes) && notes.length ? (
          <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
            {notes.map((n, i) => (
              <div key={i} style={{ fontSize: 12, fontStyle: "italic", fontWeight: 850, color: MUTED }}>
                {n}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Tile>
  );
}

export default function CPCOScorecardPlaceholder({ onInfo }) {
  return (
    <Surface padding={24}>
      <SurfaceHeader
        title="PEOPLE (CPCO) SCORECARD"
        subtitle="Organizational health and headcount"
        onInfo={onInfo}
      />

      <InDevelopmentBanner />

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        <Metric title="Total Workforce" value="632" />
        <Metric title="Total Iterators" value="595" />
        <Metric title="Total Contractors" value="37" />
        <Metric title={"Median Tenure of\nIterators"} value="2.89" suffix="years" />

        <Metric title={"YoY Iterator\nChange (FY25 Q4)"} value="4.02%" note="FY25 Q4 Headcount = 572" />
        <Metric title={"QoQ Iterator\nChange (FY26 Q3)"} value="-3.25%" note="FY26 Q3 Headcount = 615" />
        <Metric
          title={"% Workforce in\nLow Cost Locations"}
          value="9.65%"
          notes={["Philippines – 29 (4.59%)", "Portugal – 32 (5.06%)"]}
        />
        <Metric title={"Starts in Current\nQuarter"} value="43" />
      </div>
    </Surface>
  );
}