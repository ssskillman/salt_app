import React from "react";

export default function ExecutiveInsightCard({
  headline,
  supporting = [],
  title = "Insight",
  icon = "🧠",
}) {
  if (!headline) return null;

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(15,23,42,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.96))",
        boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
        padding: 18,
        display: "grid",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: "rgba(15,23,42,0.06)",
            border: "1px solid rgba(15,23,42,0.08)",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 1000,
            letterSpacing: 0.7,
            textTransform: "uppercase",
            color: "rgba(15,23,42,0.58)",
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          fontSize: 18,
          lineHeight: 1.45,
          fontWeight: 900,
          color: "rgba(15,23,42,0.92)",
        }}
      >
        {headline}
      </div>

      {!!supporting.length && (
        <div
          style={{
            display: "grid",
            gap: 8,
          }}
        >
          {supporting.map((item, idx) => (
            <div
              key={idx}
              style={{
                fontSize: 14,
                fontWeight: 800,
                lineHeight: 1.45,
                color: "rgba(15,23,42,0.72)",
              }}
            >
              • {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}