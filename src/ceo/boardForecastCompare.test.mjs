/**
 * Node smoke tests for Board Forecast ACV/ARR + click-to-compare.
 * Run: node src/ceo/boardForecastCompare.test.mjs
 */
import {
  BOARD_COMPARE,
  BOARD_FORECAST_BASIS,
  reduceBoardComparePick,
  boardCompareGap,
  boardCompareTargetLabel,
  resolveBoardForecastArr,
  resolveBoardForecastAmount,
  fmtBoardForecastArr,
  normalizeBoardForecastBusinessLine,
  normalizeBoardForecastBasis,
  toggleBoardForecastBasis,
  mergeBoardForecastJsonRow,
} from "./boardForecastCompare.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Start compare: click Board
{
  const r = reduceBoardComparePick(null, BOARD_COMPARE.board);
  assert(r.pick1 === "board" && r.openModal == null, "board first pick");
}

// Toggle off Board
{
  const r = reduceBoardComparePick("board", BOARD_COMPARE.board);
  assert(r.pick1 == null && r.openModal == null, "board toggle off");
}

// Board then Budget → modal
{
  const r = reduceBoardComparePick("board", BOARD_COMPARE.budget);
  assert(r.openModal?.anchor === "board" && r.openModal?.target === "budget", "board+budget modal");
}

// Board then Sales → modal
{
  const r = reduceBoardComparePick("board", BOARD_COMPARE.sales);
  assert(r.openModal?.target === "sales", "board+sales modal");
}

// Budget without Board → no modal
{
  const r = reduceBoardComparePick(null, BOARD_COMPARE.budget);
  assert(r.openModal == null && r.pick1 == null, "budget alone no-op");
}

// Gap helpers
assert(boardCompareTargetLabel("budget") === "Budget", "label budget");
assert(boardCompareGap(null, 10) == null, "gap pending board");
assert(boardCompareGap(12, 10) === 2, "gap numeric");

// BL normalize
assert(normalizeBoardForecastBusinessLine("All") === "All", "bl all");
assert(normalizeBoardForecastBusinessLine("New Business") === "New Business", "bl nb");
assert(normalizeBoardForecastBusinessLine("Gross Expansion") === "Gross Expansion", "bl ge");
assert(normalizeBoardForecastBusinessLine("New Biz") === "New Business", "bl new biz label");
assert(normalizeBoardForecastBusinessLine("Expansion") === "Gross Expansion", "bl expansion label");

// Basis toggle (default ACV)
assert(normalizeBoardForecastBasis("ACV") === "ACV", "basis acv");
assert(normalizeBoardForecastBasis("ARR") === "ARR", "basis arr");
assert(normalizeBoardForecastBasis(null) === "ACV", "basis default acv");
assert(toggleBoardForecastBasis("ACV") === "ARR", "toggle acv→arr");
assert(toggleBoardForecastBasis("ARR") === "ACV", "toggle arr→acv");

const boardRows = [
  {
    fiscal_yearquarter: "2027-Q2",
    business_line: "New Business",
    user_access: true,
    secured_board_forecast_arr: "6000000.0000000000000000000",
    secured_board_forecast_acv: "6057000.0000000000000000000",
  },
  {
    fiscal_yearquarter: "2027-Q2",
    business_line: "Gross Expansion",
    user_access: true,
    secured_board_forecast_arr: "8000000.0000000000000000000",
    secured_board_forecast_acv: "7516000.0000000000000000000",
  },
  {
    fiscal_yearquarter: "2027-Q3",
    business_line: "New Business",
    user_access: true,
    secured_board_forecast_arr: "3550000.0000000000000000000",
    secured_board_forecast_acv: "3550000.0000000000000000000",
  },
  {
    fiscal_yearquarter: "2027-Q3",
    business_line: "Gross Expansion",
    user_access: true,
    secured_board_forecast_arr: "9840000.0000000000000000000",
    secured_board_forecast_acv: "8200000.0000000000000000000",
  },
  {
    fiscal_yearquarter: "2027-Q3",
    business_line: "Churn/Downgrade",
    user_access: true,
    secured_board_forecast_arr: "-9240000",
    secured_board_forecast_acv: "-7600000",
  },
  {
    fiscal_yearquarter: "2027-Q3",
    business_line: "All (Incl. Downgrades/Churn)",
    user_access: true,
    secured_board_forecast_arr: "4150000",
    secured_board_forecast_acv: "4150000",
  },
  {
    fiscal_yearquarter: "2027-Q4",
    business_line: "New Business",
    user_access: true,
    secured_board_forecast_arr: "6478000",
    secured_board_forecast_acv: "6078000",
  },
  {
    fiscal_yearquarter: "2027-Q4",
    business_line: "Gross Expansion",
    user_access: true,
    secured_board_forecast_arr: "8620000",
    secured_board_forecast_acv: "7600000",
  },
];

// Q2 ARR by business line
assert(resolveBoardForecastArr(boardRows, "2027-Q2", "All") === 14_000_000, "Q2 All $14M ARR");
assert(resolveBoardForecastArr(boardRows, "FY27 Q2", "New Business") === 6_000_000, "Q2 New $6M ARR");
assert(resolveBoardForecastArr(boardRows, "2027-Q2", "Gross Expansion") === 8_000_000, "Q2 Expansion $8M ARR");

// Q2 ACV by business line (default basis)
assert(resolveBoardForecastAmount(boardRows, "2027-Q2", "All") === 13_573_000, "Q2 All ACV default");
assert(
  resolveBoardForecastAmount(boardRows, "2027-Q2", "All", BOARD_FORECAST_BASIS.acv) === 13_573_000,
  "Q2 All ACV"
);
assert(
  resolveBoardForecastAmount(boardRows, "2027-Q2", "New Business", "ACV") === 6_057_000,
  "Q2 New ACV"
);
assert(
  resolveBoardForecastAmount(boardRows, "2027-Q2", "Gross Expansion", "ACV") === 7_516_000,
  "Q2 Expansion ACV"
);
assert(
  resolveBoardForecastAmount(boardRows, "2027-Q2", "All", "ARR") === 14_000_000,
  "Q2 All ARR via amount"
);

// Q3 uses the secured NB + Gross Expansion rows, not churn or the inclusive rollup.
assert(resolveBoardForecastArr(boardRows, "2027-Q3", "All") === 13_390_000, "Q3 All ARR");
assert(resolveBoardForecastArr(boardRows, "2027-Q3", "New Business") === 3_550_000, "Q3 NB ARR");
assert(resolveBoardForecastAmount(boardRows, "2027-Q3", "Gross Expansion", "ACV") === 8_200_000, "Q3 GE ACV");
assert(resolveBoardForecastAmount(boardRows, "2027-Q3", "All", "ACV") === 11_750_000, "Q3 All ACV");
assert(resolveBoardForecastArr(boardRows, "2027-Q1") == null, "Q1 unset");
assert(resolveBoardForecastArr([], "2027-Q3", "All") == null, "empty rows pending");
assert(resolveBoardForecastAmount(boardRows, "2027-Q4", "All", "ACV") === 13_678_000, "Q4 All ACV");
assert(resolveBoardForecastArr(boardRows, "2027-Q4", "All") === 15_098_000, "Q4 All ARR");

const blockedRows = boardRows.map((row) => ({ ...row, user_access: false }));
assert(resolveBoardForecastAmount(blockedRows, "2027-Q3", "All", "ACV") == null, "inaccessible rows ignored");

const fallbackRows = [{
  fiscal_yearquarter: "2027-Q4",
  business_line: "New Business",
  user_access: "TRUE",
  secured_board_forecast_acv: null,
  board_forecast_acv: "6078000",
}];
assert(
  resolveBoardForecastAmount(fallbackRows, "2027-Q4", "New Business", "ACV") === 6_078_000,
  "unsecured value is fallback only"
);

// Display as $X.XM (1 decimal, rounded)
assert(fmtBoardForecastArr(14_000_000) === "$14.0M", "fmt Q2 All ARR");
assert(fmtBoardForecastArr(6_000_000) === "$6.0M", "fmt Q2 New ARR");
assert(fmtBoardForecastArr(8_000_000) === "$8.0M", "fmt Q2 Expansion ARR");
assert(fmtBoardForecastArr(6_057_000) === "$6.1M", "fmt Q2 New ACV");
assert(fmtBoardForecastArr(7_516_000) === "$7.5M", "fmt Q2 Expansion ACV");
assert(fmtBoardForecastArr(13_573_000) === "$13.6M", "fmt Q2 All ACV");
assert(fmtBoardForecastArr(11_750_000) === "$11.8M", "fmt Q3 All ACV");
assert(fmtBoardForecastArr(13_390_000) === "$13.4M", "fmt Q3 All ARR");
assert(!String(fmtBoardForecastArr(14_000_000)).includes("K"), "no K suffix");

// Compare gap with Q2 All board ACV vs sample sales forecast
{
  const board = resolveBoardForecastAmount(boardRows, "2027-Q2", "All", "ACV");
  const sales = 10_100_000;
  const gap = boardCompareGap(board, sales);
  assert(gap === 13_573_000 - 10_100_000, "q2 all acv vs sales gap");
}

const jsonPayloadRows = [
  {
    BOARD_FORECAST_JSON: JSON.stringify({
      board_forecast_acv: 3550000,
      board_forecast_arr: 3550000,
      business_line: "New Business",
      fiscal_yearquarter: "2027-Q3",
    }),
  },
  {
    BOARD_FORECAST_JSON: JSON.stringify({
      board_forecast_acv: 8200000,
      board_forecast_arr: 9840000,
      business_line: "Gross Expansion",
      fiscal_yearquarter: "2027-Q3",
    }),
  },
  {
    BOARD_FORECAST_JSON: JSON.stringify({
      board_forecast_acv: -7600000,
      board_forecast_arr: -9240000,
      business_line: "Churn/Downgrade",
      fiscal_yearquarter: "2027-Q3",
    }),
  },
  {
    BOARD_FORECAST_JSON: JSON.stringify({
      board_forecast_acv: 4150000,
      board_forecast_arr: 4150000,
      business_line: "All (Incl. Downgrades/Churn)",
      fiscal_yearquarter: "2027-Q3",
    }),
  },
  {
    BOARD_FORECAST_JSON: JSON.stringify({
      board_forecast_acv: 13573000,
      board_forecast_arr: 14000000,
      business_line: "NB + Gross Expansion",
      fiscal_yearquarter: "2027-Q2",
    }),
  },
  {
    BOARD_FORECAST_JSON: JSON.stringify({
      board_forecast_acv: 6057000,
      board_forecast_arr: 6000000,
      business_line: "New Business",
      fiscal_yearquarter: "2027-Q2",
    }),
  },
  {
    BOARD_FORECAST_JSON: JSON.stringify({
      board_forecast_acv: 7516000,
      board_forecast_arr: 8000000,
      business_line: "Gross Expansion",
      fiscal_yearquarter: "2027-Q2",
    }),
  },
].map((row) => mergeBoardForecastJsonRow(row, "BOARD_FORECAST_JSON"));

assert(resolveBoardForecastAmount(jsonPayloadRows, "2027-Q3", "All", "ACV") === 11_750_000, "JSON Q3 All ACV");
assert(resolveBoardForecastArr(jsonPayloadRows, "2027-Q3", "All") === 13_390_000, "JSON Q3 All ARR");
assert(resolveBoardForecastAmount(jsonPayloadRows, "2027-Q2", "All", "ACV") === 13_573_000, "JSON Q2 ignores NB+GE rollup");

console.log("boardForecastCompare tests: ok");
