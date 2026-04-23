import React from "react";

const SECTIONS = [
  {
    title: "Self Serve Business Health",
    metrics: [
      { label: "Free Signups M.A.", value: "12,402", trend: [60, 40, 70, 65, 80, 50, 45], color: "#3B82F6" },
      { label: "New Paid Accounts M.A.", value: "842", trend: [40, 45, 42, 50, 48, 40, 35], color: "#F59E0B" },
      { label: "Free > Paid % M.A.", value: "6.8%", trend: [30, 35, 33, 40, 42, 45, 44], color: "#EF4444" },
      { label: "New Business Bookings M.A.", value: "$1.2M", trend: [50, 55, 45, 60, 58, 55, 40], color: "#10B981" },
    ],
  },
  {
    title: "Organic / Web",
    metrics: [
      { label: "Impressions M.A.", value: "789,680", trend: [80, 82, 85, 80, 88, 90, 85], color: "#3B82F6" },
      { label: "Clicks M.A.", value: "18,768", trend: [40, 42, 45, 43, 40, 38, 30], color: "#F59E0B" },
      { label: "% Click Thru M.A.", value: "2.52%", trend: [20, 22, 25, 24, 26, 28, 30], color: "#8B5CF6" },
    ],
  },
  {
    title: "Marketing Sales Assisted",
    metrics: [
      { label: "MQL M.A.", value: "4,200", trend: [30, 50, 45, 60, 55, 70, 65], color: "#3B82F6" },
      { label: "SQL M.A.", value: "1,150", trend: [20, 30, 28, 40, 35, 45, 42], color: "#F59E0B" },
      { label: "Pipeline M.A.", value: "$2.4M", trend: [40, 45, 42, 55, 50, 60, 58], color: "#10B981" },
    ],
  },
];

const Sparkline = ({ data, color }) => {
  const width = 140;
  const height = 40;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
};

function InDevelopmentBanner() {
  return (
    <div
      style={{
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
        Early preview. Scorecard visuals are in place while final KPI definitions, filters, and downstream marketing workflows are being refined.
      </div>
    </div>
  );
}

export default function CMOScorecardPlaceholder() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <InDevelopmentBanner />

      <div style={cmoStyles.gridContainer}>
        {SECTIONS.map((section) => (
          <div key={section.title} style={cmoStyles.section}>
            <h3 style={cmoStyles.sectionTitle}>{section.title}</h3>
            <div style={cmoStyles.metricList}>
              {section.metrics.map((m) => (
                <div key={m.label} style={cmoStyles.metricRow}>
                  <div style={cmoStyles.labelGroup}>
                    <span style={cmoStyles.metricLabel}>{m.label}</span>
                    <span style={cmoStyles.metricValue}>{m.value}</span>
                  </div>
                  <div style={cmoStyles.sparklineWrapper}>
                    <Sparkline data={m.trend} color={m.color} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const cmoStyles = {
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 24,
  },
  section: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    color: "#64748b",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
    paddingBottom: 8,
    marginBottom: 12,
  },
  metricList: { display: "flex", flexDirection: "column", gap: 12 },
  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px dashed rgba(0,0,0,0.05)",
  },
  labelGroup: { display: "flex", flexDirection: "column" },
  metricLabel: { fontSize: 12, fontWeight: 800, color: "#475569" },
  metricValue: { fontSize: 16, fontWeight: 950, color: "#0f172a" },
  sparklineWrapper: { padding: "0 8px" },
};