// src/app/editorConfig.js
/**
 * SALT editorConfig
 *
 * IMPORTANT:
 * This file directly impacts URL size when Sigma launches the plugin.
 *
 * If this grows too large, Netlify can return:
 *    414 URI Too Long
 *
 * Guidelines:
 * - Avoid adding unused config fields
 * - Remove legacy mappings immediately
 * - Prefer reusing existing sources
 * - Be cautious adding new drill detail sources
 */

export const editorConfig = [
  // ------------------------------------------------------------
  // GLOBAL / CORE SOURCES
  // ------------------------------------------------------------
  { name: "source_detail", type: "element", label: "CORE · Detail Data" },
  { name: "source_company", type: "element", label: "CORE · Company Data" },
  { name: "source_horseman", type: "element", label: "CORE · Horseman Chart Data" },
  { name: "source_horseman_detail", type: "element", label: "CORE · Horseman Detail Data (Opps)" },
  { name: "source_drill_cagr", type: "element", label: "CORE · Drill: 2Y CAGR Detail" },

  // ✅ NEW: Velocity Drill Source
  { name: "source_drill_velocity", type: "element", label: "CORE · Drill: Velocity Detail" },

  // ------------------------------------------------------------
  // CORE: PIPELINE GENERATION PACING (MONTHLY ROWS)
  // ------------------------------------------------------------
  { name: "source_pg_pacing", type: "element", label: "CORE · Pipeline Gen Pacing Source" },

  { name: "pg_fiscal_yearquarter", type: "column", source: "source_pg_pacing", label: "CORE · PG PACING · FISCAL YEARQUARTER" },
  { name: "pg_business_line", type: "column", source: "source_pg_pacing", label: "CORE · PG PACING · BUSINESS LINE" },

  { name: "pg_month_sort", type: "column", source: "source_pg_pacing", label: "CORE · PG PACING · MONTH SORT (DATE)" },
  { name: "pg_month_name", type: "column", source: "source_pg_pacing", label: "CORE · PG PACING · MONTH NAME (LABEL)" },
  { name: "pg_month_in_qtr", type: "column", source: "source_pg_pacing", label: "CORE · PG PACING · MONTH IN QTR (1/2/3)" },

  { name: "pg_month_goals", type: "column", source: "source_pg_pacing", label: "CORE · PG PACING · MONTH GOALS ($)" },
  { name: "pg_month_created", type: "column", source: "source_pg_pacing", label: "CORE · PG PACING · MONTH CREATED ($)" },
  

  // ------------------------------------------------------------
  // CRO VIEW: WATERFALL
  // ------------------------------------------------------------
  { name: "source_waterfall", type: "element", label: "CRO · Waterfall Data Source" },

  { name: "wf_name", label: "CRO · Waterfall · Category Name", type: "column", source: "source_waterfall" },
  { name: "wf_amount", label: "CRO · Waterfall · Amount", type: "column", source: "source_waterfall" },

  { name: "wf_opp_name", label: "CRO · Waterfall · Opportunity Name", type: "column", source: "source_waterfall" },
  { name: "wf_opp_owner", label: "CRO · Waterfall · Opportunity Owner", type: "column", source: "source_waterfall" },
  { name: "wf_business_line", label: "CRO · Waterfall · Business Line", type: "column", source: "source_waterfall" },
  { name: "wf_created_qtr", label: "CRO · Waterfall · Created Quarter", type: "column", source: "source_waterfall" },
  { name: "wf_record_type", label: "CRO · Waterfall · Record Type", type: "column", source: "source_waterfall" },

  // ------------------------------------------------------------
  // CEO VIEW: AE PERFORMANCE
  // PIN (RevOps, 2026): May standardize this block to New Business only — confirm before changing filters/BL.
  // ------------------------------------------------------------
  { name: "source_ae_performance", type: "element", label: "CEO · AE Performance · Data Source" },

  // Primary metric flags used in App/useSigmaData
  { name: "ae_deals_closed", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Closed Won Opp Count" },
  { name: "ae_above_threshold", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Is AE Over Stage 4 Coverage Threshold 3x (0/1)" },

  // Additional AE flags
  { name: "ae_is_at_0_acv", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Is AE At 0 ACV (0/1)" },
  { name: "ae_is_at_0_arr", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Is AE At 0 ARR (0/1)" },
  { name: "ae_is_over_stage4_cov_threshold_3x", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Is AE Over Stage 4 Coverage Threshold 3x (0/1)" },

  // Row identity / context
  { name: "ae_user_id", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · AE User Id" },
  { name: "ae_name", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · AE Name" },
  { name: "ae_title", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · AE Title" },
  { name: "ae_territory_name", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Territory Name" },
  { name: "ae_fiscal_yearquarter", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Fiscal YearQuarter" },
  { name: "ae_business_line", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Business Line" },

  // Detail metrics for drill modal
  { name: "ae_quota", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Quota" },
  { name: "ae_stage4_pipeline_non_negative", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Stage 4 Plus Pipeline Non Negative" },
  { name: "ae_stage4_coverage_non_negative", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Stage 4 Plus Coverage Non Negative" },
  { name: "ae_booked_acv", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Booked ACV" },
  { name: "ae_closed_won_opp_count", type: "column", source: "source_ae_performance", label: "CEO · AE Performance · Closed Won Opp Count" },

  // ------------------------------------------------------------
  // CORE Detail Data: FIELD MAPPINGS (Detail)
  // ------------------------------------------------------------
  { name: "forecast_amount", type: "column", source: "source_detail", label: "CORE · Forecast ($)" },
  { name: "best_case_amount", type: "column", source: "source_detail", label: "CORE · Best Case ($)" },
  { name: "open_pipe", type: "column", source: "source_detail", label: "CORE · Open Pipe ($) — Filtered" },
  { name: "sigma_username", type: "column", source: "source_detail", label: "CORE · Current User Full Name" },
  { name: "current_user_email", type: "column", source: "source_detail", label: "CORE · Current User Email" },

  // ------------------------------------------------------------
  // CORE FIELD MAPPINGS (Company)
  // ------------------------------------------------------------
  { name: "stage4_cvg", type: "column", source: "source_company", label: "CORE · Stage 4+ Coverage (x)" },

  // ------------------------------------------------------------
  // Closed Trend (Monthly ACV)
  // Rolling 18 in-app uses all rows from this element: no LIMIT 12, and the warehouse must emit 18 months
  // (dense calendar spine with $0 months — not only months that had closed won).
  // ------------------------------------------------------------ 
  { name: "source_closed_trend", type: "element", label: "CORE · Closed Trend Source" },
  { name: "ct_business_line", type: "column", source: "source_closed_trend", label: "CORE · Closed Trend · Business Line" },
  { name: "ct_month_name", type: "column", source: "source_closed_trend", label: "CORE · Closed Trend · Month Name" },
  { name: "ct_month_sort", type: "column", source: "source_closed_trend", label: "CORE · Closed Trend · Month Sort" },
  { name: "ct_monthly_acv_change", type: "column", source: "source_closed_trend", label: "CORE · Closed Trend · Monthly ACV Change ($)" },
  { name: "ct_fiscal_yearquarter", type: "column", source: "source_closed_trend", label: "CORE · Closed Trend · Fiscal YearQuarter" },


  // ------------------------------------------------------------
  // HORSEMAN MAPPINGS
  // ------------------------------------------------------------
  { name: "hm_source", type: "column", source: "source_horseman", label: "CORE · HM: Source (string)" },
  { name: "hm_created_by", type: "column", source: "source_horseman", label: "CORE · HM: Created By (string)" },
  { name: "hm_outcome", type: "column", source: "source_horseman", label: "CORE · HM: Outcome Bucket (string)" },
  { name: "hm_value", type: "column", source: "source_horseman", label: "CORE · HM: Value ($)" },

  { name: "hmd_opp_id", type: "column", source: "source_horseman_detail", label: "CORE · HMD: opportunity_id" },
  { name: "hmd_opp_name", type: "column", source: "source_horseman_detail", label: "CORE · HMD: opportunity_name" },
  { name: "hmd_owner", type: "column", source: "source_horseman_detail", label: "CORE · HMD: opportunity_owner" },
  { name: "hmd_stage", type: "column", source: "source_horseman_detail", label: "CORE · HMD: opportunity_stage" },
  { name: "hmd_close", type: "column", source: "source_horseman_detail", label: "CORE · HMD: opportunity_close_date" },
  { name: "hmd_arr", type: "column", source: "source_horseman_detail", label: "CORE · HMD: ARR/Revenue ($)" },
  { name: "hmd_source", type: "column", source: "source_horseman_detail", label: "HMD: source (SDR/Marketing/AE)" },
  { name: "hmd_created_by", type: "column", source: "source_horseman_detail", label: "CORE · HMD: Created By (name)" },
  { name: "hmd_outcome", type: "column", source: "source_horseman_detail", label: "HMD: outcome bucket (won/lost/open)" },
  { name: "hmd_deal_review", type: "column", source: "source_horseman_detail", label: "CORE · HMD: Deal Review (full text)" },
  { name: "hmd_deal_review_short", type: "column", source: "source_horseman_detail", label: "CORE · HMD: Deal Review Short Version" },

  // ------------------------------------------------------------
  // DRILL: CAGR
  // ------------------------------------------------------------
  { name: "dr_fiscal_yearquarter", type: "column", source: "source_drill_cagr", label: "CORE · DR: Fiscal Yearquarter" },
  { name: "dr_business_line", type: "column", source: "source_drill_cagr", label: "CORE · DR: Business Line" },
  { name: "dr_beginning_date", type: "column", source: "source_drill_cagr", label: "CORE · DR: Beginning Date" },
  { name: "dr_ending_date", type: "column", source: "source_drill_cagr", label: "CORE · DR: Ending Date" },
  { name: "dr_closed_qtr_total_acv_cagr_2y_rate", type: "column", source: "source_drill_cagr", label: "CORE · DR: 2Y CAGR Rate" },
  { name: "dr_closed_qtr_total_acv_cagr_beginning_ttm_2y", type: "column", source: "source_drill_cagr", label: "CORE · DR: Beginning TTM ACV" },
  { name: "dr_closed_qtr_total_acv_cagr_ending_ttm", type: "column", source: "source_drill_cagr", label: "CORE · DR: Ending TTM ACV" },

  // ------------------------------------------------------------
  // DRILL: VELOCITY
  // ------------------------------------------------------------
  { name: "dv_fiscal_yearquarter", type: "column", source: "source_drill_velocity", label: "CORE · DV: Fiscal Yearquarter" },
  { name: "dv_business_line", type: "column", source: "source_drill_velocity", label: "CORE · DV: Business Line" },
  { name: "dv_as_of_date", type: "column", source: "source_drill_velocity", label: "CORE · DV: As-Of Date" },
  { name: "dv_velocity_pct", type: "column", source: "source_drill_velocity", label: "CORE · DV: Velocity % (decimal)" },
  { name: "dv_closed_won", type: "column", source: "source_drill_velocity", label: "CORE · DV: Closed Won (QTD) ($)" },
  { name: "dv_commit_amt", type: "column", source: "source_drill_velocity", label: "CORE · DV: Commit ($)" },
  { name: "dv_days_elapsed", type: "column", source: "source_drill_velocity", label: "CORE · DV: Days Elapsed" },
  { name: "dv_days_total", type: "column", source: "source_drill_velocity", label: "CORE · DV: Days in Period" },
  { name: "dv_time_elapsed_pct", type: "column", source: "source_drill_velocity", label: "CORE · DV: Time Elapsed % (decimal)" },
  { name: "dv_numerator", type: "column", source: "source_drill_velocity", label: "CORE · DV: Numerator" },
  { name: "dv_denominator", type: "column", source: "source_drill_velocity", label: "CORE · DV: Denominator" },

  // ------------------------------------------------------------
  // DRILL: FORECAST ATTAINMENT
  // ------------------------------------------------------------
  { name: "source_drill_forecast_attainment_payload", type: "element", label: "CORE · Drill: Forecast Attainment Payload (Pacing to Forecast)" },
  { name: "fa_payload", type: "column", source: "source_drill_forecast_attainment_payload", label: "CORE · FA: Payload JSON" },

  // ------------------------------------------------------------
  // DRILL: % FUNDED (ROW-LEVEL DETAIL SOURCE)
  // ------------------------------------------------------------
  { name: "source_drill_funded", type: "element", label: "CORE · Drill: % Funded Detail" },

  { name: "df_fiscal_yearquarter", type: "column", source: "source_drill_funded", label: "CORE · DF: Fiscal Yearquarter" },
  { name: "df_fiscal_year", type: "column", source: "source_drill_funded", label: "CORE · DF: Fiscal Year" },
  { name: "df_business_line", type: "column", source: "source_drill_funded", label: "CORE · DF: Business Line" },

  { name: "df_opp_id", type: "column", source: "source_drill_funded", label: "CORE · DF: Opp Id" },
  { name: "df_opp_name", type: "column", source: "source_drill_funded", label: "CORE · DF: Opp Name" },
  { name: "df_owner_name", type: "column", source: "source_drill_funded", label: "CORE · DF: Owner Name" },
  { name: "df_close_date", type: "column", source: "source_drill_funded", label: "CORE · DF: Close Date" },

  { name: "df_stage_name", type: "column", source: "source_drill_funded", label: "CORE · DF: Opp Status / Stage Name" },
  { name: "df_manager_judgment", type: "column", source: "source_drill_funded", label: "CORE · DF: Manager Judgment" },

  { name: "df_acv_change", type: "column", source: "source_drill_funded", label: "CORE · DF: ACV Change" },
  { name: "df_is_closed_won", type: "column", source: "source_drill_funded", label: "CORE · DF: Is Closed Won (0/1)" },
  { name: "df_is_in_category_open", type: "column", source: "source_drill_funded", label: "CORE · DF: Is In Category Open (0/1)" },

  { name: "df_closed_won_acv", type: "column", source: "source_drill_funded", label: "CORE · DF: Closed Won ACV" },
  { name: "df_in_category_open_acv", type: "column", source: "source_drill_funded", label: "CORE · DF: In Category Open ACV" },
  { name: "df_funded_commit_acv", type: "column", source: "source_drill_funded", label: "CORE · DF: Funded Commit ACV" },
  { name: "df_funded_bucket", type: "column", source: "source_drill_funded", label: "CORE · DF: Funded Bucket" },

  { name: "df_formula_role", type: "column", source: "source_drill_funded", label: "CORE · DF: Formula Role" },
  { name: "df_contributes_to_numerator", type: "column", source: "source_drill_funded", label: "CORE · DF: Contributes To Numerator (0/1)" },
  { name: "df_contributes_to_denominator", type: "column", source: "source_drill_funded", label: "CORE · DF: Contributes To Denominator (0/1)" },
  { name: "df_funded_pct", type: "column", source: "source_drill_funded", label: "CORE · DF: % Funded (decimal preferred)" },
  { name: "df_source", type: "column", source: "source_drill_funded", label: "CORE · DF: Source" },
  
  // ------------------------------------------------------------
  // APP CONTROLS
  // ------------------------------------------------------------
  { name: "debug", type: "boolean", label: "App · Debug Mode" },

  // ------------------------------------------------------------
  // CRO VIEW: REVINTEL TERRITORY TREE
  // ------------------------------------------------------------
  { name: "source_revintel_tree", type: "element", label: "CRO · Revintel Territory Tree Source" },
  { name: "rt_fyq", type: "column", source: "source_revintel_tree", label: "CRO · Tree · Fiscal YearQuarter (optional)" },
  { name: "rt_lvl0", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Lvl 0" },
  { name: "rt_lvl1", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Lvl 1" },
  { name: "rt_lvl2", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Lvl 2" },
  { name: "rt_lvl3", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Lvl 3" },
  { name: "rt_lvl4", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Lvl 4" },
  { name: "rt_rollup_level", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Rollup Level" },
  { name: "rt_node_label", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Node Label (optional)" },
  { name: "rt_parent_label", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Parent Label (optional)" },
  { name: "rt_user_name", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · User Name (optional)" },
  { name: "rt_territory_name", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Territory Name (optional)" },
  { name: "rt_quota", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Quota" },
  { name: "rt_commit", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Commit" },
  { name: "rt_forecast", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Forecast" },
  { name: "rt_best_case", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Best Case" },
  { name: "rt_open_pipeline", type: "column", source: "source_revintel_tree", label: "CRO · Revintel Tree · Open Pipeline" },

  // ------------------------------------------------------------
  // CORE: COMMIT CARD BREAKDOWN
  // ------------------------------------------------------------
  { name: "source_commit_card", type: "element", label: "CORE · Commit Card Breakdown Source" },
  { name: "cc_territory_name", type: "column", source: "source_commit_card", label: "CORE · Commit Card · Territory Name" },
  { name: "cc_forecast", type: "column", source: "source_commit_card", label: "CORE · Commit Card · Forecast ($)" },
  { name: "cc_quota", type: "column", source: "source_commit_card", label: "CORE · Commit Card · Quota ($)" },
  { name: "cc_commit", type: "column", source: "source_commit_card", label: "CORE · Commit Card · Commit ($) (optional)" },
  { name: "cc_best_case", type: "column", source: "source_commit_card", label: "CORE · Commit Card · Best Case ($)" },
  { name: "cc_open_pipeline", type: "column", source: "source_commit_card", label: "CORE · Commit Card · Open Pipeline ($)" },

  // ------------------------------------------------------------
  // CORE: BUDGET (NEW SOURCE — DO NOT REUSE OLD)
  // ------------------------------------------------------------
  { name: "source_budget", type: "element", label: "CORE · Budget Data" },
  { name: "budget_manager", type: "column", source: "source_budget", label: "CORE · Budget: Manager" },
  { name: "budget_fiscal_yearquarter", type: "column", source: "source_budget", label: "CORE · Budget: Fiscal Yearquarter" },
  { name: "budget_month_name", type: "column", source: "source_budget", label: "CORE · Budget: Month Name" },
  { name: "budget_amount", type: "column", source: "source_budget", label: "CORE · Budget: Budget Amount" },
  { name: "budget_prompted_row", type: "column", source: "source_budget", label: "CORE · Budget: Prompted Row" },

  // ------------------------------------------------------------
  // CORE: EMPLOYEE SCOPE OPPORTUNITY SPINE
  // ------------------------------------------------------------
  { name: "source_employee_scope_opportunity_spine", type: "element", label: "CORE · Employee Scope Opportunity Spine" },
  { name: "eso_opp_owner_name", type: "column", source: "source_employee_scope_opportunity_spine", label: "CORE · ESO: Opp Owner Name" },
  { name: "eso_open_pipeline_acv", type: "column", source: "source_employee_scope_opportunity_spine", label: "CORE · ESO: Open Pipeline ACV" },
  { name: "eso_closed_acv", type: "column", source: "source_employee_scope_opportunity_spine", label: "CORE · ESO: Closed Won ACV" },
  { name: "eso_closed_lost_acv", type: "column", source: "source_employee_scope_opportunity_spine", label: "CORE · ESO: Closed Lost ACV" },
  { name: "eso_is_create_and_close", type: "column", source: "source_employee_scope_opportunity_spine", label: "CORE · ESO: Is Create And Close" },
  { name: "eso_ccop", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · CC Open" },
  { name: "eso_acct", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Acct" },
  { name: "eso_opp", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Opp Name" },
  { name: "eso_opp_id", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Opp ID" },
  { name: "eso_stage", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Stage" },
  { name: "eso_close", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Close" },
  { name: "eso_bl", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Business Line" },
  { name: "eso_ld_bucket", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Large Deal Bucket" },
  { name: "eso_deal_review", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Deal Review Short" },
  { name: "eso_deal_review_details", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Deal Review details" },
  { name: "eso_opp_source", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Opportunity Source" },
  { name: "eso_opp_created_by", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Opportunity Created By (name)" },
  { name: "eso_horseman_outcome", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Horseman Outcome" },
  { name: "eso_fyq", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Close Fiscal Yearquarter" },
  { name: "eso_lost_reason", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Lost Reason" },
  { name: "eso_lost_reason_description", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Lost Reason Description" },
  { name: "eso_competition", type: "column", source: "source_employee_scope_opportunity_spine", label: "ESO · Competition" },

  // ------------------------------------------------------------
  // Large Deal Drill Through: Previous Year
  // ------------------------------------------------------------

  { name: "source_large_deals_py_payload", type: "element", label: "CORE · Large Deals PY Payload" },
  { name: "ldpy_payload", type: "column", source: "source_large_deals_py_payload", label: "LDPY · Payload JSON" },

  // ------------------------------------------------------------
  // Product Mix
  // ------------------------------------------------------------

  { name: "source_product_mix_payload", type: "element", label: "CORE · Product Mix Payload" },
  { name: "product_mix_payload", type: "column", source: "source_product_mix_payload", label: "Product Mix · Payload JSON" },

];
