import React from "react";
import { Modal } from "./Modal";
import { fmtMoneyCompact } from "../../utils/formatters";
import {
  BOARD_FORECAST_BASIS,
  boardCompareGap,
  boardCompareTargetLabel,
  fmtBoardForecastArr,
  normalizeBoardForecastBasis,
} from "../../ceo/boardForecastCompare";

function CompareSide({ label, valueNode, hint }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: "rgba(15,23,42,0.55)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 950,
          color: "rgba(15,23,42,0.92)",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {valueNode}
      </div>
      {hint ? (
        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: "rgba(15,23,42,0.55)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Board Forecast (ACV|ARR as rendered on the CEO tile) vs Budget | Sales Forecast.
 */
export default function BoardForecastCompareModal({
  open,
  onClose,
  target,
  boardAmount = null,
  boardBasis = BOARD_FORECAST_BASIS.acv,
  budgetAmount = null,
  salesForecastAmount = null,
}) {
  const basis = normalizeBoardForecastBasis(boardBasis);
  const targetLabel = boardCompareTargetLabel(target);
  const targetAmount =
    target === "budget" ? budgetAmount : target === "sales" ? salesForecastAmount : null;
  const boardPending = boardAmount == null || !Number.isFinite(Number(boardAmount));
  const gap = boardCompareGap(boardAmount, targetAmount);

  // Frame gap from the target card's perspective: Board is always the compare anchor.
  // boardCompareGap = board − target → positive means target is behind Board.
  let gapCopy = "—";
  if (!boardPending && gap != null) {
    const abs = fmtMoneyCompact(Math.abs(gap));
    if (gap === 0) gapCopy = `${targetLabel} even with Board Forecast`;
    else if (gap > 0) gapCopy = `${targetLabel} ▼ ${abs} behind Board Forecast`;
    else gapCopy = `${targetLabel} ▲ ${abs} ahead of Board Forecast`;
  } else if (boardPending) {
    gapCopy = "— (board number not set for this quarter / basis)";
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compare"
      subtitle={`Board Forecast (${basis}) vs ${targetLabel}`}
      width={640}
    >
      <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
        <CompareSide
          label={`Board Forecast (${basis})`}
          valueNode={boardPending ? "—" : fmtBoardForecastArr(boardAmount)}
          hint={boardPending ? `No board ${basis} for this FYQ` : null}
        />
        <div
          style={{
            width: 1,
            alignSelf: "stretch",
            background: "rgba(15,23,42,0.10)",
            flexShrink: 0,
          }}
        />
        <CompareSide
          label={targetLabel}
          valueNode={
            targetAmount == null || !Number.isFinite(Number(targetAmount))
              ? "—"
              : fmtMoneyCompact(targetAmount)
          }
        />
      </div>

      <div
        style={{
          marginTop: 22,
          paddingTop: 16,
          borderTop: "1px solid rgba(15,23,42,0.08)",
          fontSize: 14,
          fontWeight: 850,
          color: "rgba(15,23,42,0.72)",
        }}
      >
        Gap: {gapCopy}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: "rgba(15,23,42,0.45)" }}>
        Tip: select Board Forecast, then Budget or Sales Forecast to compare. Board uses the ACV/ARR
        basis shown on the tile; Budget / Sales Forecast are ACV.
      </div>
    </Modal>
  );
}
