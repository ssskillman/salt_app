import React, { useState, useMemo } from "react";
import { fmtMoney } from "../../utils/formatters";

export default function SimpleTable({ 
  rows = [], 
  columns = [], 
  arrColumnKey, 
  dateColumnKey,
  outcomeColumnKey
}) {
  const [sortState, setSortState] = useState({ key: null, direction: 'desc' });
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  const handleSort = (key) => {
    setSortState((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Updated to toggle on single click
  const toggleGroup = (groupName) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const groupedData = useMemo(() => {
    const groups = {};
    rows.forEach(row => {
      const groupVal = row[outcomeColumnKey] || "Other";
      if (!groups[groupVal]) groups[groupVal] = [];
      groups[groupVal].push(row);
    });
    return groups;
  }, [rows, outcomeColumnKey]);

  const grandTotal = useMemo(() => {
    if (!arrColumnKey) return 0;
    return rows.reduce((sum, row) => sum + (Number(row[arrColumnKey]) || 0), 0);
  }, [rows, arrColumnKey]);

  return (
    <div style={styles.tableWrapper}>
      <div style={{ overflow: "auto", maxHeight: "62vh" }}>
        <table style={styles.table}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr style={styles.headerRow}>
              {columns.map((col) => (
                <th key={col.key} onClick={() => handleSort(col.key)} style={styles.th}>
                  {col.label}
                  {sortState.key === col.key && (
                    <span style={styles.sortIcon}>
                      {sortState.direction === 'asc' ? ' ▲' : ' ▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(groupedData).map((groupName) => {
              const groupRows = groupedData[groupName];
              const subTotal = groupRows.reduce((sum, r) => sum + (Number(r[arrColumnKey]) || 0), 0);
              const isCollapsed = collapsedGroups.has(groupName);
              
              return (
                <React.Fragment key={groupName}>
                  {/* Single-click toggle enabled here */}
                  {Object.keys(groupedData).length > 1 && (
                    <tr 
                      style={styles.subTotalRow} 
                      onClick={() => toggleGroup(groupName)}
                      title="Click to collapse/expand"
                    >
                      <td colSpan={columns.length} style={styles.subTotalTd}>
                        <span style={styles.toggleIcon}>{isCollapsed ? "▶ " : "▼ "}</span>
                        {groupName.toUpperCase()} — Group Subtotal: {fmtMoney(subTotal)}
                      </td>
                    </tr>
                  )}
                  {!isCollapsed && groupRows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#e2e8f0" }}>
                      {columns.map((col) => {
                        const val = row[col.key];
                        return (
                          <td key={col.key} style={styles.td}>
                            {col.key === arrColumnKey ? fmtMoney(val) : 
                             col.key === dateColumnKey ? new Date(val).toLocaleDateString() : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot style={{ position: "sticky", bottom: 0, zIndex: 1 }}>
            <tr style={styles.footerRow}>
              {columns.map((col) => {
                const isLabel = col.label === "Opportunity";
                const isValue = col.key === arrColumnKey;
                return (
                  <td key={col.key} style={styles.footerTd}>
                    {isLabel ? "GRAND TOTAL" : isValue ? fmtMoney(grandTotal) : ""}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const styles = {
  tableWrapper: { width: "100%", borderRadius: "12px", border: "1px solid rgba(15,23,42,0.12)", background: "white", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse", fontFamily: "system-ui", fontSize: "12px" },
  headerRow: { background: "#334155" },
  th: { textAlign: "left", padding: "14px 10px", fontWeight: 950, color: "#ffffff", cursor: "pointer", whiteSpace: "nowrap" },
  td: { padding: "12px 10px", borderBottom: "1px solid rgba(15,23,42,0.06)", color: "rgba(15,23,42,0.80)", fontWeight: 850, whiteSpace: "nowrap" },
  subTotalRow: { background: "#cfece5", borderTop: "1.5px solid #43b4ab", borderBottom: "1.5px solid #43b4ab", cursor: "pointer", userSelect: "none" },
  subTotalTd: { padding: "10px 10px", fontWeight: 1000, color: "#1e4a42", fontSize: "12px", letterSpacing: "0.5px", textTransform: "uppercase" },
  toggleIcon: { display: "inline-block", width: "20px", fontSize: "10px" },
  footerRow: { background: "#2d6a5d", borderTop: "2px solid rgba(0,0,0,0.1)" },
  footerTd: { padding: "14px 10px", fontSize: "14px", fontWeight: 1000, color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.5px" },
  sortIcon: { fontSize: "10px", marginLeft: "4px" }
};