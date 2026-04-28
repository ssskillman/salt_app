/**
 * Horseman drill detail: one JSON column (`hmd_row_payload` in editorConfig) replaces
 * many per-field Sigma mappings to keep plugin launch URLs under 414 limits.
 *
 * Expected JSON keys (snake_case from SQL OBJECT_CONSTRUCT):
 * opp_id, opp_name, owner, stage, close_date, arr, source, created_by,
 * outcome, deal_review, deal_review_short, acv_change (optional).
 * Drill modal “ACV” uses acv_change when numeric, otherwise arr.
 *
 * Snowflake example (add to your SELECT list):
 *
 * OBJECT_CONSTRUCT(
 *   'opp_id', OPP_ID,
 *   'opp_name', OPP_NAME,
 *   'owner', OPP_OWNER_NAME,
 *   'stage', STAGE_NAME,
 *   'close_date', CLOSE_DATE,
 *   'arr', BASE_ARR_GROWTH,
 *   'source', OPPORTUNITY_SOURCE,
 *   'created_by', OPP_CREATOR_NAME,
 *   'outcome', <won|lost|open or stage bucket>,
 *   'deal_review', DEAL_REVIEW_C,
 *   'deal_review_short', DEAL_REVIEW_SHORT_VERSION_C,
 *   'acv_change', ACV_CHANGE
 * ) AS HMD_ROW_JSON
 */

import { toNumber } from "./formatters.jsx";

/** Flat row keys written by mergeHorsemanDetailPayloadOntoRow (no Sigma name collisions). */
export const HMD_FLAT = {
  oppId: "hmd__opp_id",
  oppName: "hmd__opp_name",
  owner: "hmd__owner",
  stage: "hmd__stage",
  close: "hmd__close",
  arr: "hmd__arr",
  source: "hmd__source",
  createdBy: "hmd__created_by",
  outcome: "hmd__outcome",
  dealReview: "hmd__deal_review",
  dealReviewShort: "hmd__deal_review_short",
  acvChange: "hmd__acv_change",
  /** Same dollars the stacked bar uses when drill rows come from the JSON payload element. */
  horsemanStack: "hmd__horseman_stack",
  horsemanBasis: "hmd__horseman_basis",
  /** Drill “ACV” column: `acv_change` when numeric, else `arr` (e.g. base arr growth). */
  drillModalAcv: "hmd__drill_modal_acv",
};

export function parseHorsemanDetailPayload(raw) {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }
  return null;
}

function pick(p, ...keys) {
  for (const k of keys) {
    if (!p || !Object.prototype.hasOwnProperty.call(p, k)) continue;
    const v = p[k];
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

/**
 * Copies parsed JSON fields onto the row under stable `hmd__*` keys for existing drill UI.
 * @param {Record<string, unknown>} row
 * @param {string} payloadColKey resolved Sigma column id/name for the JSON cell
 * @returns {Record<string, unknown>}
 */
export function mergeHorsemanDetailPayloadOntoRow(row, payloadColKey) {
  if (!payloadColKey || !row || typeof row !== "object") return row;
  const p = parseHorsemanDetailPayload(row[payloadColKey]);
  if (!p || typeof p !== "object") return row;

  const oppId = pick(p, "opp_id", "oppId");
  const oppName = pick(p, "opp_name", "oppName");
  const owner = pick(p, "owner", "opp_owner", "opp_owner_name");
  const stage = pick(p, "stage", "stage_name");
  const close = pick(p, "close_date", "close", "closeDate");
  const arr = pick(p, "arr", "base_arr_growth");
  const acvChange = pick(p, "acv_change", "acvChange");
  const source = pick(p, "source", "opportunity_source");
  const createdBy = pick(p, "created_by", "createdBy", "opp_creator_name");
  let outcome = pick(p, "outcome", "outcome_bucket");
  if (outcome != null && String(outcome).trim() === "") outcome = null;
  if (outcome == null) outcome = stage;
  const dealReview = pick(p, "deal_review", "dealReview");
  const dealReviewShort = pick(p, "deal_review_short", "dealReviewShort");

  const nArr = toNumber(arr);
  const nAcv = toNumber(acvChange);
  const drillModalAcv = nAcv != null ? acvChange : arr;
  const stackNum = (nArr != null ? nArr : null) ?? (nAcv != null ? nAcv : null) ?? 0;
  let basisLabel = "JSON payload — arr / acv_change missing";
  if (nArr != null) {
    basisLabel = "JSON · arr (e.g. BASE_ARR_GROWTH)";
  } else if (nAcv != null) {
    basisLabel = "JSON · acv_change";
  }

  return {
    ...row,
    [HMD_FLAT.oppId]: oppId,
    [HMD_FLAT.oppName]: oppName,
    [HMD_FLAT.owner]: owner,
    [HMD_FLAT.stage]: stage,
    [HMD_FLAT.close]: close,
    [HMD_FLAT.arr]: arr,
    [HMD_FLAT.source]: source,
    [HMD_FLAT.createdBy]: createdBy,
    [HMD_FLAT.outcome]: outcome,
    [HMD_FLAT.dealReview]: dealReview,
    [HMD_FLAT.dealReviewShort]: dealReviewShort,
    [HMD_FLAT.acvChange]: acvChange,
    [HMD_FLAT.drillModalAcv]: drillModalAcv,
    [HMD_FLAT.horsemanStack]: stackNum,
    [HMD_FLAT.horsemanBasis]: basisLabel,
  };
}

export function mergeHorsemanDetailPayloadRows(rows, payloadColKey) {
  if (!Array.isArray(rows)) return rows;
  if (!payloadColKey) return rows;
  return rows.map((r) => mergeHorsemanDetailPayloadOntoRow(r, payloadColKey));
}
