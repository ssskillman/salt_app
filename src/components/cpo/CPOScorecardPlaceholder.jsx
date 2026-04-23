// src/components/cpo/CPOScorecardPlaceholder.jsx
import React, { useEffect, useMemo, useState } from "react";

import Surface from "../ui/Surface";
import SurfaceHeader from "../ui/SurfaceHeader";
import CalendarUsage from "../charts/CalendarUsage";
import AccountSelect from "./AccountSelect";

function normStr(x) {
  return String(x ?? "").trim();
}

function normKey(x) {
  return String(x ?? "").trim().toLowerCase();
}

function pick(row, keys) {
  if (!row || !keys?.length) return null;
  for (const k of keys) {
    const v = row?.[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}

function buildAccountOptions(accountsRows) {
  const seen = new Set();
  const out = [];

  for (const r of accountsRows || []) {
    const account_name = normStr(r?.account_name ?? r?.ACCOUNT_NAME);
    if (!account_name) continue;

    const opt = {
      account_name,
      account_id: r?.account_id ?? r?.ACCOUNT_ID ?? r?.sf_account_id ?? r?.SF_ACCOUNT_ID ?? null,
      iterable_org_id:
        r?.iterable_org_id ??
        r?.ITERABLE_ORG_ID ??
        r?.iterable_org_id_c ??
        r?.ITERABLE_ORG_ID_C ??
        null,
      account_manager: r?.account_manager ?? r?.ACCOUNT_MANAGER ?? null,
    };

    const k = account_name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);

    out.push(opt);
  }

  out.sort((a, b) => a.account_name.localeCompare(b.account_name));
  return out;
}

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
        Early product preview. The account experience and usage visualization are live while downstream scorecard sections are still being defined.
      </div>
    </div>
  );
}

function PlannedPanel({ title, subtitle }) {
  return (
    <div
      style={{
        height: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px dashed rgba(15, 23, 42, 0.15)",
        borderRadius: 12,
        color: "rgba(15, 23, 42, 0.50)",
        textAlign: "center",
        padding: 16,
        background: "linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.22) 100%)",
      }}
    >
      <div>
        <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: 0.2 }}>{title}</div>
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 850, opacity: 0.78 }}>{subtitle}</div>
      </div>
    </div>
  );
}

export default function CPOScorecardPlaceholder({
  onInfo,
  calendarData = [],
  accountsRows = [],
  selectedAccount: selectedAccountProp,
  onSelectedAccountChange,
}) {
  const accountOptions = useMemo(() => buildAccountOptions(accountsRows), [accountsRows]);

  const [selectedAccountLocal, setSelectedAccountLocal] = useState(null);
  const selectedAccount = selectedAccountProp !== undefined ? selectedAccountProp : selectedAccountLocal;

  const setSelectedAccount = (next) => {
    if (selectedAccountProp !== undefined) {
      onSelectedAccountChange?.(next);
    } else {
      setSelectedAccountLocal(next);
    }
  };

  const [showApplied, setShowApplied] = useState(false);
  useEffect(() => {
    if (!showApplied) return;
    const t = setTimeout(() => setShowApplied(false), 1200);
    return () => clearTimeout(t);
  }, [showApplied]);

  const handleAccountChange = (next) => {
    setSelectedAccount(next);
    setShowApplied(true);
  };

  const filteredCalendarData = useMemo(() => {
    const rows = Array.isArray(calendarData) ? calendarData : [];
    if (!selectedAccount) return rows;

    const selOrg = normStr(selectedAccount?.iterable_org_id);
    const selAcct = normStr(selectedAccount?.account_id);

    const orgKeys = [
      "iterable_org_id",
      "ITERABLE_ORG_ID",
      "iterable_org_id_c",
      "ITERABLE_ORG_ID_C",
      "org_id",
      "ORG_ID",
    ];
    const acctKeys = ["account_id", "ACCOUNT_ID", "sf_account_id", "SF_ACCOUNT_ID"];

    return rows.filter((r) => {
      const rOrg = normStr(pick(r, orgKeys));
      const rAcct = normStr(pick(r, acctKeys));

      if (selOrg && rOrg) return normKey(rOrg) === normKey(selOrg);
      if (selAcct && rAcct) return normKey(rAcct) === normKey(selAcct);

      return false;
    });
  }, [calendarData, selectedAccount?.iterable_org_id, selectedAccount?.account_id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`
        @keyframes saltAppliedIn {
          0%   { transform: translateY(-6px); opacity: 0; }
          12%  { transform: translateY(0); opacity: 1; }
          80%  { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-4px); opacity: 0; }
        }
      `}</style>

      <Surface padding={24}>
        <SurfaceHeader title="PRODUCT SCORECARD" subtitle="" onInfo={onInfo} />

        <InDevelopmentBanner />

        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <AccountSelect options={accountOptions} value={selectedAccount} onChange={handleAccountChange} />

            <div
              style={{
                pointerEvents: "none",
                display: showApplied ? "inline-flex" : "none",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.78)",
                border: "1px solid rgba(15,23,42,0.12)",
                fontSize: 12,
                fontWeight: 950,
                color: "rgba(15,23,42,0.72)",
                animation: "saltAppliedIn 1200ms ease forwards",
              }}
              aria-hidden="true"
              title="Selection applied"
            >
              <span style={{ color: "rgba(89,193,167,1)", fontWeight: 1000 }}>✓</span>
              Applied
            </div>
          </div>

          <div
            style={{
              padding: "8px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.70)",
              border: "1px solid rgba(15,23,42,0.12)",
              fontSize: 12,
              fontWeight: 950,
              color: "rgba(15,23,42,0.70)",
              whiteSpace: "nowrap",
            }}
            title="Account selection"
          >
            {selectedAccount ? `Selected: ${selectedAccount.account_name}` : "No account selected"}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 950, color: "rgba(15, 23, 42, 0.65)" }}>SENDS DAILY USAGE</div>
          <div style={{ marginTop: 10 }}>
            <CalendarUsage data={filteredCalendarData} />
          </div>
        </div>
      </Surface>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Surface padding={24}>
          <PlannedPanel
            title="Feature Velocity & R&D Spend Efficiency"
            subtitle="Reserved for future product delivery and investment metrics."
          />
        </Surface>

        <Surface padding={24}>
          <PlannedPanel
            title="Product-Led Growth (PLG) Funnel Metrics"
            subtitle="Reserved for future self-serve activation and conversion reporting."
          />
        </Surface>
      </div>
    </div>
  );
}