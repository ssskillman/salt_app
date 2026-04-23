// src/components/ui/CFOTreemapDrillModal.jsx
import React from "react";
import Modal from "./Modal";
import SimpleTable from "./SimpleTable";
import { ceoBusinessLineDisplayLabel } from "../../utils/formatters.jsx";
import DrillModalContextBar from "./DrillModalContextBar.jsx";

const CFO_DRILL_CONTEXT =
  "Underlying rows from the CFO Treemap Detail element for the tile you selected (tile filter may be limited—see Sigma workbook).";

function MetaPill({ label, value }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        borderRadius: 999,
        background: "rgba(15,23,42,0.05)",
        border: "1px solid rgba(15,23,42,0.08)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 950,
          color: "rgba(15,23,42,0.62)",
          textTransform: "uppercase",
          letterSpacing: 0.3,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12, fontWeight: 1000, color: "rgba(15,23,42,0.92)", maxWidth: 300 }}>
        {value}
      </span>
    </div>
  );
}

export default function CFOTreemapDrillModal({
  open,
  onClose,
  title,
  rows,
  columns,
  /** CEO toggle: "All" | "New Business" | "Gross Expansion" */
  businessLine = "All",
  contextHelper,
  definitionsSection = "cfo_treemap",
  onOpenDefinitions,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title || "CFO Detail"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <DrillModalContextBar
          helperText={contextHelper ?? CFO_DRILL_CONTEXT}
          definitionsSection={definitionsSection}
          onOpenDefinitions={onOpenDefinitions}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <MetaPill label="Business Line" value={ceoBusinessLineDisplayLabel(businessLine)} />
        </div>

        <div style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, overflow: "hidden" }}>
          <SimpleTable rows={rows || []} columns={columns || []} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              appearance: "none",
              border: "1px solid rgba(15,23,42,0.18)",
              background: "white",
              borderRadius: 10,
              padding: "8px 12px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}