import React from "react";

function Card({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 10,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        {title}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function MiniChartRow({ label }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(0,0,0,0.72)" }}>{label}</div>
      <div
        style={{
          height: 54,
          borderRadius: 8,
          border: "1px solid rgba(0,0,0,0.10)",
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02), rgba(0,0,0,0.06))",
        }}
      />
    </div>
  );
}

function Filter({ label }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          height: 32,
          borderRadius: 8,
          border: "1px solid rgba(0,0,0,0.14)",
          background: "#fff",
        }}
      />
    </div>
  );
}

export default function CMOPlaceholder() {
  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#15803d" }}>
          Marketing Scorecard
        </div>
        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
          Placeholder (CMO view) — wiring-first, visuals next
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginTop: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {["Overall Trends", "Major Metrics Grid", "Repository", "Raw Data for Export", "Funnel", "Glossary"].map(
          (t, i) => (
            <div
              key={t}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.12)",
                background: i === 0 ? "rgba(59,130,246,0.10)" : "#fff",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {t}
            </div>
          )
        )}
      </div>

      {/* Body grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 0.55fr",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* Left column */}
        <div style={{ display: "grid", gap: 12 }}>
          <Card title="Self Serve Business Health">
            <MiniChartRow label="Free Signups M.A." />
            <MiniChartRow label="New Paid Accounts M.A." />
            <MiniChartRow label="Free → Paid % M.A." />
            <MiniChartRow label="New Business Bookings M.A." />
            <MiniChartRow label="AOV (Self Serve) M.A." />
          </Card>

          <Card title="Web">
            <div
              style={{
                height: 120,
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.10)",
                background: "rgba(0,0,0,0.03)",
              }}
            />
          </Card>
        </div>

        {/* Middle column */}
        <div style={{ display: "grid", gap: 12 }}>
          <Card title="Organic">
            <MiniChartRow label="Impressions (Organic) M.A." />
            <MiniChartRow label="Clicks (Organic) M.A." />
            <MiniChartRow label="% Click Thru (Organic) M.A." />
          </Card>

          <Card title="Paid">
            <MiniChartRow label="Spend M.A." />
            <MiniChartRow label="CAC M.A." />
          </Card>

          <Card title="Marketing Sales Assisted">
            <MiniChartRow label="MQL M.A." />
            <MiniChartRow label="SQL M.A." />
            <MiniChartRow label="Qualified M.A." />
            <MiniChartRow label="Pipeline M.A." />
          </Card>
        </div>

        {/* Right filters */}
        <div style={{ display: "grid", gap: 12 }}>
          <Card title="Filters">
            <Filter label="# of days for mov. avg." />
            <Filter label="Year" />
            <Filter label="Month" />
            <Filter label="End Page" />
            <Filter label="Channel Group" />
            <Filter label="Channel Detailed" />
            <Filter label="Country Tier" />
            <Filter label="Country Easy" />
            <Filter label="Country Clean" />
          </Card>
        </div>
      </div>
    </div>
  );
}
