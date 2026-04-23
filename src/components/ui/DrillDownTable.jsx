import React from 'react';
import { fmtMoneyCompact } from '../../utils/formatters';

export default function DrillDownTable({ rows, config }) {
  if (!rows || rows.length === 0) return <div style={{ padding: 20, opacity: 0.6 }}>No details found.</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid rgba(15,23,42,0.1)' }}>
            <th style={styles.th}>Opportunity Name</th>
            <th style={styles.th}>Owner</th>
            <th style={styles.th}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
              <td style={styles.td}>{row[config?.wf_name] || 'N/A'}</td>
              <td style={styles.td}>{row[config?.wf_owner] || 'N/A'}</td>
              <td style={styles.td}>
                <span style={{ fontWeight: 900, color: '#0b3251' }}>
                  {fmtMoneyCompact(row[config?.wf_amount])}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  th: { padding: '12px 8px', fontSize: '11px', fontWeight: 950, textTransform: 'uppercase', opacity: 0.6 },
  td: { padding: '12px 8px', fontSize: '13px', fontWeight: 850, color: 'rgba(15,23,42,0.9)' }
};