// src/utils/definitions.js

/**
 * VIEW_SUMMARIES:
 * - used when opening a VIEW key (e.g., "view_ceo") from the top-right Definitions button
 * - also supports legacy persona keys as aliases if desired
 */
export const VIEW_SUMMARIES = {
  view_ceo: {
    title: "CEO View",
    body:
      "Snapshot of company performance vs quarterly forecast, pipeline quality, field execution, large-deal concentration, and AI-win attachment (beta). Definitions cover every metric card plus drill-downs opened from the CEO surface.",
    bullets: [
      "Are we on track to hit forecast?",
      "Where are the biggest risks?",
      "Do we have enough pipeline to close the gap?",
      "How dependent are we on large deals and in-quarter create & close?",
      "Best used: weekly exec review / forecast calls",
    ],
  },

  view_cfo: {
    title: "CFO View",
    body:
      "Finance-forward lens on growth, pacing, and mix. Use this view to sanity-check trajectory and understand what’s driving variance at a glance.",
    bullets: [
      "Primary use: plan / forecast validation",
      "Best for: growth signals + mix context",
      "Mental model: “Are we on a financially credible path?”",
    ],
  },

  view_cro: {
    title: "CRO View",
    body:
      "Sales execution lens focused on pipeline dynamics. The waterfall explains how the period changes from Start to Total (new, expansion, contraction, closed outcomes).",
    bullets: [
      "Primary use: pipeline movement narrative",
      "Best for: diagnosing what’s driving changes",
      "Mental model: “What changed since the start, and why?”",
    ],
  },

  view_cmo: {
    title: "CMO View",
    body:
      "Marketing scorecard lens for demand generation and funnel health. Definitions will expand as the CMO module is built out.",
    bullets: ["Primary use: marketing performance pulse", "Best for: lead flow + efficiency signals"],
  },

  view_cpo: {
    title: "CPO View",
    body:
      "Product operations lens for adoption/usage health and product-side pacing. Use this view to spot trends and anomalies over time.",
    bullets: [
      "Primary use: usage/adoption monitoring",
      "Best for: trend detection + anomaly spotting",
      "Mental model: “Is the product behaving as expected?”",
    ],
  },

  view_cpco: {
    title: "CPCO View",
    body:
      "People & org health lens for headcount, tenure, hiring activity, and location mix. Use this view to sanity-check capacity and detect org-level change signals early.",
    bullets: [
      "Primary use: org health pulse + capacity planning",
      "Best for: hiring/retention context + location mix",
      "Mental model: “Do we have the right capacity, in the right places, with healthy stability?”",
    ],
  },

  // Optional legacy aliases (safe if something still passes "ceo" etc.)
  ceo: null,
  cfo: null,
  cro: null,
  cmo: null,
  cpo: null,
  cpco: null,
};

/**
 * DEFINITIONS:
 * - used for SECTION keys (opened from (i) icons)
 * - each section can include:
 *   - title (required)
 *   - summary (optional but recommended)
 *   - metrics: [{ term, def }]
 */
export const DEFINITIONS = {
  company_totals: {
    title: "COMPANY TOTALS",
    summary:
      "Global company rollup for the selected fiscal quarter and business line (unless noted). Use this row to judge pacing vs plan, pipeline sufficiency, and a few forward-looking execution signals.\n\nACV (Annual Contract Value) is the common currency for booked and forecasted revenue in this row.",
    metrics: [
      {
        term: "Budget (ACV)",
        def: "The quarterly bookings plan / budget for all business lines (shown with an ACV chip).\nWhy it matters: Anchors “how much we planned to book” vs forecast and closed performance.",
      },
      {
        term: "Forecast",
        def: "Expected Closed Won ACV for the quarter (company-level). Expand the card to compare Forecast, Quota, Commit, Best Case, and Open Pipeline in one place.\nWhy it matters: This is the operating number execs manage to; clicking the value jumps to CRO territory context when configured.",
      },
      {
        term: "Closed (QTD)",
        def: "Closed Won ACV booked quarter-to-date.\nWhy it matters: Shows realized bookings vs the forecast line; the subtext compares closed $ to forecast (ahead / behind). Click opens the Closed Trend view.",
      },
      {
        term: "Pacing to Forecast",
        def: "Closed Won (QTD) ÷ Forecast, expressed as a percent.\nWhy it matters: Simple read on whether the quarter is on track. Rule of thumb: well under 50% late in the quarter usually signals risk.",
      },
      {
        term: "2Y CAGR (ACV)",
        def: "Compound annual growth rate of trailing-twelve-month ACV over a two-year window (inputs and formula are available in the CAGR drill).\nWhy it matters: Smooths quarter noise and shows whether underlying booking power is growing.",
      },
      {
        term: "Stage 4+ Coverage",
        def: "Late-stage qualified pipeline (Stage 4 and above) expressed as a multiple of quarterly forecast.\nWhy it matters: Indicates whether enough qualified deals exist to close the gap to plan. Very low multiples (<~1.5×) often precede forecast risk; ~2–3× is a common healthy band (org-dependent).",
      },
      {
        term: "Velocity",
        def: "Conversion-style signal: how efficiently pipeline is turning into Closed Won in the measured window (see Velocity drill for inputs).\nWhy it matters: Falling velocity with flat pipeline can mean slippage, stage hygiene issues, or competitive losses.",
      },
      {
        term: "% Funded",
        def: "Share of weighted forecast represented by deals in strong forecast categories (see % Funded drill for the exact rule used in your workbook).\nWhy it matters: Higher funded mix usually means less reliance on long-shot upside to make the number.",
      },
      {
        term: "PG Attainment",
        def: "Pipeline generation attainment vs the quarterly PG goal (quarter-to-date).\nWhy it matters: Shows whether the top of funnel is producing enough new pipe to support future quarters; click opens the PG pacing drill.",
      },
      {
        term: "AI WINS (BETA)",
        def: "Count of Closed Won opportunities in the current filters that include at least one AI-attached product line (heuristic on product name / code — beta, subject to refinement).\nThe subtitle shows total Closed Won wins in the same slice for context.\nWhy it matters: Fast read on how often AI SKUs show up on winning deals; click opens the product mix drill-down.",
      },
      {
        term: "Executive Insight",
        def: "Rotating short-form narrative for the current field scope and business line: headline, supporting bullets, and optional links.\nWhy it matters: Surfaces qualitative “so what” alongside the numbers; pause or step through when multiple insights are configured.",
      },
    ],
  },

  field_execution: {
    title: "FIELD EXECUTION",
    summary:
      "Employee-scoped slice of the business for the same fiscal quarter and business line as Company Totals. Metrics follow the Field Scope selector (Global, team under a node, or an individual).",
    metrics: [
      {
        term: "Forecast",
        def: "Forecasted Closed Won ACV for the selected scope.\nWhy it matters: Shows what that part of the org is expected to produce; click can jump to CRO territory detail when enabled.",
      },
      {
        term: "Open Pipeline",
        def: "Open pipeline ACV remaining in the quarter for the selected scope.\nWhy it matters: Future closable capacity for that slice; click opens open-pipeline drill.",
      },
      {
        term: "Closed Won",
        def: "Closed Won ACV in-period for the selected scope (same employee-scoped spine as other Field Execution cards).\nWhy it matters: Win execution for the scoped team or rep; click opens closed-won drill.",
      },
      {
        term: "Closed Lost",
        def: "Closed Lost ACV in-period for the selected scope.\nWhy it matters: Surfaces value lost from the funnel in the quarter; drill is available when the Closed Lost ACV column is mapped in config.",
      },
      {
        term: "Open Pipeline Health",
        def: "Summary strip under the four cards that highlights a risk segment of open pipeline (e.g. concentration in a stage or age band). Count and dollars are scoped; click opens the matching open-pipeline drill.\nWhy it matters: Converts a large Open Pipeline number into an actionable “where to look first” signal.",
      },
    ],
  },

  execution_health: {
    title: "EXECUTION HEALTH",
    summary:
      "Conceptual framing for forecast and pipeline roll-ups as you move from an individual to their +1 and +2 management layers. (Related UI may also appear under Hierarchy Roll-ups when CRO territory context is available.)",
    metrics: [
      {
        term: "Employee (context)",
        def: "The selected employee or rep as the base of the roll-up.\nWhy it matters: Ground-truth level where commits and coverage are most volatile.",
      },
      {
        term: "+1 Roll-up",
        def: "Roll-up that includes the employee’s immediate manager layer (first-line rollup).\nWhy it matters: Tests whether forecasts still hold once you aggregate across a manager’s team.",
      },
      {
        term: "+2 Roll-up",
        def: "Roll-up that extends two management layers above the selected employee.\nWhy it matters: Stress-tests forecast durability where pipeline quality and timing risk usually compound.",
      },
    ],
  },

  deals_500k: {
    title: "$500K+ DEALS",
    summary:
      "Concentration view for opportunities at or above the large-deal threshold in the current fiscal quarter and filters. Helps answer how dependent the quarter is on whale deals.",
    metrics: [
      {
        term: "Won QTD",
        def: "Closed Won ACV for $500K+ opportunities closed quarter-to-date (scoped).\nWhy it matters: Shows large-deal contribution to the quarter’s booked number.",
      },
      {
        term: "Open Pipeline QTD",
        def: "Open pipeline ACV for $500K+ opportunities still open in the quarter (scoped).\nWhy it matters: Future dependency on big deals to close the gap to plan.",
      },
      {
        term: "Open Pipeline QTD YoY",
        def: "Year-over-year percent change in the count (or configured comparison) of $500K+ open deals in this fiscal quarter vs the same fiscal quarter last year.\nWhy it matters: Shows whether the large-deal open funnel is building or eroding YoY. Subtitles may show “this FYQ vs same FYQ last year” counts from the drill.",
      },
      {
        term: "Prior Year",
        def: "Reference to prior-year large-deal performance or inventory for the same comparison window (see drill for row-level detail).\nWhy it matters: Puts current large-deal results in last-year context.",
      },
    ],
  },

  create_close: {
    title: "CREATE & CLOSE",
    summary:
      "In-quarter throughput: deals created in the fiscal quarter and either already won or still open. Isolates “fresh” pipeline and closes from carry-in.",
    metrics: [
      {
        term: "WON QTD",
        def: "Closed Won ACV for opportunities created in the same fiscal quarter and closed in that quarter (in-quarter create-and-close).\nWhy it matters: Shows velocity of brand-new opportunities that did not rely on starting pipeline.",
      },
      {
        term: "Open Pipeline QTD",
        def: "Open ACV for opportunities created in-quarter that remain open.\nWhy it matters: Remaining in-quarter upside that was sourced this quarter.",
      },
      {
        term: "Won QTD YoY",
        def: "Year-over-year change in in-quarter created-and-closed Won ACV.\nWhy it matters: Indicates whether the team is improving at same-quarter conversion vs last year (marked WIP when the underlying cut is still evolving).",
      },
      {
        term: "Open Pipeline QTD YoY",
        def: "Year-over-year change in in-quarter created-and-still-open pipeline.\nWhy it matters: Shows whether the org is generating more or less fresh open pipe YoY (may be WIP).",
      },
    ],
  },

  ae_performance: {
    title: "AE PERFORMANCE",
    summary:
      "Simple AE coverage flags for the scoped dataset: who is far above a Stage 4 coverage threshold and who has not booked ACV.",
    metrics: [
      {
        term: "AEs > 3x Stage 4 Cov",
        def: "Count of AEs whose Stage 4+ pipeline coverage exceeds three times the configured coverage threshold.\nWhy it matters: Highlights reps sitting on unusually deep late-stage inventory (quality and timing still need human review).",
      },
      {
        term: "AEs @ 0 ACV",
        def: "Count of AEs with zero Closed Won ACV in the selected window and filters.\nWhy it matters: Surfaces execution gaps or ramping pockets that may need manager attention.",
      },
    ],
  },

  horseman: {
    title: "HORSEMAN",
    summary:
      "Horizontal stacked bars that split ARR (or configured value) by outcome bucket—Closed Won, Closed Lost, and Open Pipeline—across either Opportunity Source or Opportunity Created By (Axis toggle when the extra column is mapped or when the spine supplies Created By). Use Active segments to include or exclude outcome slices in the bar totals.",
    metrics: [
      {
        term: "Axis: Source vs Created by",
        def: "Source = traditional opportunity source categories. Created by = Salesforce-style creator of the opportunity (name), when data and mappings are present.\nWhy it matters: Same outcome mix, different lens: channel/motion vs person who opened the record.",
      },
      {
        term: "Active segments",
        def: "Toggles for which outcome buckets contribute to the length of each bar.\nWhy it matters: Lets execs isolate won vs lost vs open pipe without leaving the chart.",
      },
      {
        term: "Closed Won (segment)",
        def: "Portion of the bar using Closed Won ACV from the configured spine or chart element.\nWhy it matters: Shows which sources or creators are producing booked revenue.",
      },
      {
        term: "Closed Lost (segment)",
        def: "Portion of the bar attributed to closed-lost outcomes (value rules follow your Sigma / spine mapping).\nWhy it matters: Surfaces where sourced demand is dying in-period.",
      },
      {
        term: "Open Pipeline (segment)",
        def: "Portion of the bar attributed to still-open pipeline for the quarter.\nWhy it matters: Shows which sources or creators are feeding future closes.",
      },
      {
        term: "Unknown / Uncategorized",
        def: "Buckets where source or creator is blank in the data.\nWhy it matters: Large unknown rows reduce confidence in the story—data hygiene follow-up.",
      },
    ],
  },

  cro_revintel_tree: {
    title: "HIERARCHY ROLL-UPS",
    summary:
      "Embedded view of territory / employee hierarchy from CRO RevIntel. After selecting a node in CRO View, use Employee, +1, and +2 tabs to compare forecast and pipeline roll-ups at that node and one or two layers above.",
    metrics: [
      {
        term: "Employee",
        def: "Metrics for the selected hierarchy node (typically a rep or manager).\nWhy it matters: Baseline before rolling up.",
      },
      {
        term: "+1 Roll-up",
        def: "Aggregated view including the node’s immediate manager context (first-line rollup).\nWhy it matters: Shows whether the node’s numbers still look reasonable at the first boss layer.",
      },
      {
        term: "+2 Roll-up",
        def: "Aggregated view two layers up from the selected node.\nWhy it matters: Stress-tests whether the branch still supports the forecast when more of the tree is included.",
      },
    ],
  },

  product_mix: {
    title: "AI WINS — PRODUCT MIX (DRILL)",
    summary:
      "Modal opened from AI WINS (BETA). Lists Closed Won opportunities with line-item detail from orders / CPQ. Use it to see which SKUs—including AI products—sit under each win.",
    metrics: [
      {
        term: "Line-item $ (sum)",
        def: "Sum of every product line’s order amount in the current drill result.\nOne deal often has many lines (products, split contract years, add-ons), so this is an order-detail total—not the same roll-up as quarterly closed booking on the main tiles, and not interchangeable with headline closed booking.",
      },
      {
        term: "Opp ACV (sum)",
        def: "Each opportunity’s funnel ACV counted once at the deal level, then summed across wins in the view.\nWhy it matters: Comparable to funnel ACV elsewhere; does not multiply by SKU count when the same ACV is stamped on multiple lines.",
      },
      {
        term: "All Products vs AI Only",
        def: "Filters the SKU table to every line or only lines that match the AI name/code heuristic.\nWhy it matters: AI Only focuses the list without changing deal-level ACV totals in the summary pills.",
      },
      {
        term: "Collapse all",
        def: "Collapses every expanded opportunity to its summary row.\nWhy it matters: Faster navigation on long SKU lists.",
      },
    ],
  },

  cfo_treemap: {
    title: "CFO TREEMAP",
    summary: "Mix view by product/category where tile size reflects magnitude and optional color reflects a secondary metric.",
    metrics: [
      { term: "Tile Size", def: "Area of each tile represents the primary value (e.g., $)." },
      { term: "Color Metric", def: "Optional secondary metric used to color tiles (if enabled)." },
      { term: "Drill", def: "Use the drill action to open the underlying detail table." },
    ],
  },

  cro_waterfall: {
    title: "CRO WATERFALL LOGIC",
    summary: "Explains how the period changes from Start to Total across movement categories.",
    metrics: [
      { term: "Start", def: "Starting baseline for the period." },
      { term: "New", def: "Revenue generated from completely new customer logos." },
      { term: "Expansion", def: "Increase in revenue from existing customer accounts through upsells or cross-sells." },
      { term: "Contraction", def: "Loss of revenue from existing customers who reduced spend but did not churn." },
      { term: "Closed Won", def: "Won outcomes contributing to the period movement." },
      { term: "Closed Lost", def: "Lost outcomes contributing to the period movement." },
      { term: "Total", def: "Ending total after accounting for all movement categories." },
    ],
  },

  // Placeholder section for now (so (i) doesn’t feel broken)
  cmo: {
    title: "MARKETING SCORECARD",
    summary: "Marketing scorecard view for demand gen and funnel health. Definitions will expand as this module is built out.",
    metrics: [],
  },

  cpo: {
    title: "PRODUCT SCORECARD",
    summary: "Product usage/adoption signals and operational health indicators.",
    metrics: [
      { term: "Product Scorecard", def: "Product velocity and investment health summary for the CPO view." },
      { term: "Sends Daily Usage", def: "Calendar heatmap of daily email sends volume over time." },
      { term: "How to read it", def: "Darker = higher relative usage; hover any day to see the daily sends value." },
      { term: "Emails Sent", def: "Total email sends per day (source: SQL:Daily_Total_Usage)." },
      { term: "Timezone", def: "Timezone is determined by the underlying Sigma dataset / warehouse settings used to generate the daily date." },
      { term: "Total", def: "Total = sum of the selected rows in the configured calendar source." },
    ],
  },

  cpco: {
    title: "PEOPLE (CPCO) METRICS",
    summary: "Org health and capacity indicators used for leadership context.",
    metrics: [
    { term: "Total Workforce", def: "Total people counted in the workforce snapshot (employees + contractors)." },
    { term: "Total Iterators", def: "Total employees in the workforce snapshot (Iterators only; excludes contractors)." },
    { term: "Total Contractors", def: "Total contractors in the workforce snapshot." },
    { term: "Median Tenure of Iterators", def: "Median employee tenure (in years) across Iterators in the snapshot." },

    {
      term: "YoY Iterator Change (FY25 Q4)",
      def: "Year-over-year % change in Iterators headcount vs the comparable prior-year quarter. The footnote shows the baseline headcount used for the comparison.",
    },
    {
      term: "QoQ Iterator Change (FY26 Q3)",
      def: "Quarter-over-quarter % change in Iterators headcount vs the prior quarter. The footnote shows the baseline headcount used for the comparison.",
    },

    {
      term: "% Workforce in Low Cost Locations",
      def: "Share of total workforce located in designated low-cost geographies. The breakdown underneath shows the main included locations and their counts/percentages.",
    },

    { term: "Starts in Current Quarter", def: "Count of new employee starts occurring within the current fiscal quarter (per the People data cut)." },

    {
      term: "Data as of",
      def: "Date of the most recent data snapshot used to compute metrics on this page (not necessarily ‘today’). Use this to sanity-check freshness vs expected refresh cadence.",
    },
    ],
  },
};