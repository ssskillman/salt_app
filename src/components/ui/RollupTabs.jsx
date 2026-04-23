import React, { useState } from "react";
import { RollupCard } from "../cro/RevintelTreeSection";

export default function RollupTabs({ selectedNode, plus1Node, plus2Node }) {
  const [activeTab, setActiveTab] = useState("employee");

  const tabs = [
    { key: "employee", label: "Employee", node: selectedNode },
    { key: "plus1", label: "+1 Roll-up", node: plus1Node },
    { key: "plus2", label: "+2 Roll-up", node: plus2Node },
  ];

  const active = tabs.find((t) => t.key === activeTab);

  if (!selectedNode) {
  return (
    <div
      style={{
        padding: "8px 4px 2px",
        fontSize: 12,
        fontWeight: 850,
        color: "rgba(15,23,42,0.62)",
      }}
    >
      Select an employee in CRO View to see Employee, +1, and +2 hierarchy roll-ups here.
    </div>
  );
}

  return (
    <div
      style={{
        borderRadius: 16,
        background: "rgba(255,255,255,0.65)",
        border: "1px solid rgba(15,23,42,0.10)",
        padding: 10,
      }}
    >
      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              background: activeTab === t.key ? "white" : "transparent",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {active?.node ? (
        <RollupCard label={active.label} node={active.node} />
      ) : (
        <div style={{ fontSize: 12, opacity: 0.6 }}>No data</div>
      )}
    </div>
  );
}