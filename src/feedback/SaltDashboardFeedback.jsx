import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import {
  AlertTriangle,
  Bug,
  Camera,
  CheckCircle2,
  Flag,
  Loader2,
  MessageSquareWarning,
  Paperclip,
  Send,
  Sparkles,
  X,
} from "lucide-react";

/**
 * When false, the modal still captures/uploads a preview image, but the image is not sent to the
 * API (avoids Slack file-upload failures in production). Re-enable only after upload is verified.
 */
const SEND_SCREENSHOT_TO_SLACK = false;

const FEEDBACK_TYPES = [
  {
    id: "data_issue",
    label: "Data issue",
    description: "Numbers look wrong or don’t match what the dashboard implies.",
    icon: AlertTriangle,
  },
  {
    id: "ux_issue",
    label: "UX issue",
    description: "Something is confusing, cluttered, or harder than it should be.",
    icon: MessageSquareWarning,
  },
  {
    id: "drilldown_issue",
    label: "Drilldown mismatch",
    description: "Summary and detail do not line up.",
    icon: Bug,
  },
  {
    id: "feature_request",
    label: "Feature request",
    description: "A new view, metric, or workflow would help.",
    icon: Sparkles,
  },
  {
    id: "other",
    label: "Other",
    description: "Anything else the SALT team should see.",
    icon: Flag,
  },
];

const PRIORITIES = [
  {
    id: "fyi",
    label: "FYI",
    description: "Helpful signal, but not urgent.",
  },
  {
    id: "needs_review",
    label: "Needs review",
    description: "Should be looked at soon.",
  },
  {
    id: "blocking",
    label: "Blocking",
    description: "Getting in the way of decision-making or execution.",
  },
];

/** CEO / shared surfaces — proper case, alphabetized (Other always last). */
const FEATURE_SECTION_OTHER = "Other (specify below)";
const FEATURE_SECTION_OPTIONS = [
  ...[
    "$500K+ Deals",
    "AE Performance",
    "Accumulated Waterfall",
    "Closed Trend",
    "Company Totals",
    "Create & Close",
    "Employee Filters",
    "Field Execution",
    "Hierarchy Roll-ups",
    "Horseman",
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
  FEATURE_SECTION_OTHER,
];

/** Map “remember section” / SurfaceHeader strings → dropdown value. */
const LEGACY_SECTION_TO_OPTION = {
  "COMPANY TOTALS": "Company Totals",
  "EMPLOYEE FILTERS": "Employee Filters",
  "Field Execution": "Field Execution",
  "Create & Close": "Create & Close",
  "$500K+ Deals": "$500K+ Deals",
  "AE Performance": "AE Performance",
  "Hierarchy Roll-ups": "Hierarchy Roll-ups",
  "Closed Trend": "Closed Trend",
  "ACCUMULATED WATERFALL": "Accumulated Waterfall",
  "CFO TREEMAP": "CFO Treemap",
  "HORSEMAN": "Horseman",
};

function formatFeedbackSectionPill(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "—") return s || "—";
  if (Object.prototype.hasOwnProperty.call(LEGACY_SECTION_TO_OPTION, s)) {
    return LEGACY_SECTION_TO_OPTION[s];
  }
  const hit = FEATURE_SECTION_OPTIONS.find(
    (o) => o !== FEATURE_SECTION_OTHER && o.toLowerCase() === s.toLowerCase()
  );
  return hit || s;
}

function resolveFeatureSectionForSheet(section, otherText) {
  if (!section) return "";
  if (section === FEATURE_SECTION_OTHER) return String(otherText ?? "").trim();
  return String(section).trim();
}

/** Request Urgency column on the Feedback Google Sheet (star count). */
function priorityIdToSheetStarCount(priorityId) {
  if (priorityId === "fyi") return 1;
  if (priorityId === "needs_review") return 2;
  if (priorityId === "blocking") return 5;
  return 1;
}

function TypeCard({ item, selected, onClick }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`type-card ${selected ? "type-card--selected" : ""}`}
    >
      <div className="type-card__icon-wrap">
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="type-card__body">
        <div className="type-card__title">{item.label}</div>
        <div className="type-card__description">{item.description}</div>
      </div>
    </button>
  );
}

function PriorityPill({ item, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`priority-pill ${selected ? "priority-pill--selected" : ""}`}
    >
      {item.label}
    </button>
  );
}

function ContextPill({ label, value }) {
  return (
    <div className="context-pill">
      <span>{label}</span>
      {value}
    </div>
  );
}

function formatScreenshotLine(attachment) {
  if (!attachment) {
    return "None attached";
  }
  const kb = Math.max(1, Math.round(attachment.blob.size / 1024));
  const source =
    attachment.kind === "capture"
      ? "auto-captured from dashboard"
      : attachment.kind === "paste"
        ? "pasted from clipboard"
        : "uploaded file";
  return `${attachment.name} (${source}, ~${kb} KB)`;
}

function buildSlackPreview({
  context,
  selectedType,
  selectedPriority,
  priorityId,
  summary,
  details,
  screenshotLine,
  featureSectionLine,
}) {
  const starN = priorityIdToSheetStarCount(priorityId);
  const starStr = "\u2605".repeat(starN);

  return [
    "SALT Feedback Submitted",
    "",
    `Type: ${selectedType?.label ?? "—"}`,
    `Priority: ${selectedPriority?.label ?? "—"}`,
    ...(selectedType?.id === "feature_request"
      ? [`Request urgency (sheet): ${starStr} (${starN} star${starN === 1 ? "" : "s"})`]
      : []),
    ...(selectedType?.id === "feature_request" && String(featureSectionLine ?? "").trim()
      ? [`Section to add the new feature: ${String(featureSectionLine).trim()}`]
      : []),
    "",
    `User: ${context.currentUser}`,
    `Email: ${context.userEmail}`,
    `Dashboard: ${context.dashboard}`,
    `Page: ${context.page}`,
    `Section: ${formatFeedbackSectionPill(context.reportSection)}`,
    `Metric: ${context.metric}`,
    `Business Line: ${context.businessLine}`,
    `Scope: ${context.employeeScope}`,
    `FYQ: ${context.fiscalQuarter}`,
    "",
    `Summary: ${summary || "—"}`,
    "",
    "Details:",
    details || "—",
    "",
    SEND_SCREENSHOT_TO_SLACK
      ? `Screenshot: ${screenshotLine}`
      : `Screenshot (preview only in this form, not uploaded to Slack): ${screenshotLine}`,
  ].join("\n");
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function parseResponseBody(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * Floating “Submit Feedback” + modal; POSTs structured text to same-origin API (e.g. dev proxy).
 */
export default function SaltDashboardFeedback({
  context,
  isOpen,
  onOpenChange,
  onPayloadChange,
  onScreenshotChange,
  captureRef,
  autoCaptureOnOpen = true,
  defaultFormValues,
  slackSubmitPath = "/api/slack-feedback",
  /** Shown in the auto-dismiss success toast (must match the Slack channel your webhook posts to). */
  successSlackChannelDisplay = "#bi-analytics-feedback",
  /** When true, omit the floating FAB (use header “Submit Feedback” control instead). */
  hideFloatingTrigger = false,
}) {
  const [toast, setToast] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [feedbackType, setFeedbackType] = useState(defaultFormValues?.feedbackType ?? "data_issue");
  const [priority, setPriority] = useState(defaultFormValues?.priority ?? "needs_review");
  const [summary, setSummary] = useState(defaultFormValues?.summary ?? "");
  const [details, setDetails] = useState(defaultFormValues?.details ?? "");
  const [featureTargetSection, setFeatureTargetSection] = useState(
    defaultFormValues?.featureTargetSection ?? ""
  );
  const [featureSectionOther, setFeatureSectionOther] = useState(
    defaultFormValues?.featureSectionOther ?? ""
  );

  const [attachment, setAttachment] = useState(null);
  const [capturePhase, setCapturePhase] = useState("idle");

  const fileInputRef = useRef(null);
  const modalRootRef = useRef(null);
  const openCycleRef = useRef(0);
  const prevFeedbackTypeRef = useRef(feedbackType);
  const [captureTargetReady, setCaptureTargetReady] = useState(false);

  useLayoutEffect(() => {
    setCaptureTargetReady(Boolean(captureRef?.current));
  }, [captureRef, isOpen]);

  const selectedType = FEEDBACK_TYPES.find((item) => item.id === feedbackType);
  const selectedPriority = PRIORITIES.find((item) => item.id === priority);

  const screenshotLine = useMemo(() => formatScreenshotLine(attachment), [attachment]);

  const featureSectionSlackLine = useMemo(() => {
    if (feedbackType !== "feature_request") return "";
    const resolved = resolveFeatureSectionForSheet(featureTargetSection, featureSectionOther);
    if (!resolved) return "";
    if (featureTargetSection === FEATURE_SECTION_OTHER && featureSectionOther.trim()) {
      return `Other — ${featureSectionOther.trim()}`;
    }
    return resolved;
  }, [feedbackType, featureSectionOther, featureTargetSection]);

  const slackPreview = useMemo(
    () =>
      buildSlackPreview({
        context,
        selectedType,
        selectedPriority,
        priorityId: priority,
        summary,
        details,
        screenshotLine,
        featureSectionLine: featureSectionSlackLine,
      }),
    [
      context,
      details,
      featureSectionSlackLine,
      screenshotLine,
      priority,
      selectedPriority,
      selectedType,
      summary,
    ]
  );

  useEffect(() => {
    if (feedbackType !== "feature_request") {
      setFeatureTargetSection("");
      setFeatureSectionOther("");
    }
  }, [feedbackType]);

  useEffect(() => {
    if (!isOpen) {
      setFeatureTargetSection("");
      setFeatureSectionOther("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (feedbackType === "feature_request" && prevFeedbackTypeRef.current !== "feature_request") {
      const rs = (context.reportSection || "").trim();
      if (rs && rs !== "—") {
        const mapped = LEGACY_SECTION_TO_OPTION[rs];
        const match =
          (mapped && FEATURE_SECTION_OPTIONS.includes(mapped) ? mapped : null) ||
          FEATURE_SECTION_OPTIONS.find(
            (o) => o !== FEATURE_SECTION_OTHER && o.toLowerCase() === rs.toLowerCase()
          );
        if (match) setFeatureTargetSection(match);
      }
    }
    prevFeedbackTypeRef.current = feedbackType;
  }, [context.reportSection, feedbackType]);

  useEffect(() => {
    onPayloadChange?.(slackPreview);
  }, [slackPreview, onPayloadChange]);

  useEffect(() => {
    onScreenshotChange?.(
      attachment
        ? { blob: attachment.blob, fileName: attachment.name, dataUrl: attachment.dataUrl }
        : null
    );
  }, [attachment, onScreenshotChange]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange?.(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!toast || toast.type !== "success") return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const runCapture = useCallback(async () => {
    const el = captureRef?.current;
    if (!el) {
      return;
    }

    setCapturePhase("working");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        logging: false,
        backgroundColor: null,
      });

      const dataUrl = canvas.toDataURL("image/png", 0.92);
      const blob = await (await fetch(dataUrl)).blob();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const name = `salt-dashboard-${stamp}.png`;

      setAttachment({ kind: "capture", name, dataUrl, blob });
      setCapturePhase("idle");
    } catch {
      setAttachment(null);
      setCapturePhase("error");
    }
  }, [captureRef]);

  const readFileAsAttachment = useCallback(async (file, kind) => {
    const dataUrl = await fileToDataUrl(file);
    const name = file.name?.trim() || `image-${Date.now()}.png`;
    setAttachment({ kind, name, dataUrl, blob: file });
    setCapturePhase("idle");
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    openCycleRef.current += 1;
    const cycle = openCycleRef.current;

    const focusTimer = window.setTimeout(() => {
      modalRootRef.current?.focus({ preventScroll: true });
    }, 160);

    let captureTimer = 0;
    if (autoCaptureOnOpen && captureTargetReady) {
      captureTimer = window.setTimeout(() => {
        if (openCycleRef.current !== cycle) {
          return;
        }
        void runCapture();
      }, 80);
    }

    return () => {
      window.clearTimeout(focusTimer);
      if (captureTimer) {
        window.clearTimeout(captureTimer);
      }
    };
  }, [isOpen, autoCaptureOnOpen, captureTargetReady, runCapture]);

  const handlePaste = useCallback(
    (event) => {
      const items = event.clipboardData?.items;
      if (!items?.length) {
        return;
      }

      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            void readFileAsAttachment(file, "paste");
          }
          return;
        }
      }
    },
    [readFileAsAttachment]
  );

  const handleSubmit = async () => {
    if (!slackSubmitPath) {
      setToast({
        type: "error",
        message: "Feedback submit URL is not configured.",
      });
      return;
    }

    const wasFeature = feedbackType === "feature_request";
    const sectionValue = wasFeature
      ? resolveFeatureSectionForSheet(featureTargetSection, featureSectionOther)
      : "";

    if (wasFeature) {
      if (!featureTargetSection) {
        setToast({
          type: "error",
          message: "Choose the section where this feature should appear.",
        });
        return;
      }
      if (!sectionValue) {
        setToast({
          type: "error",
          message: "Describe the section under “Other (specify below)”.",
        });
        return;
      }
      if (!summary.trim()) {
        setToast({
          type: "error",
          message: "Summary is required — it becomes the Description column in the Feedback sheet.",
        });
        return;
      }
    }
    const dateDisplay = new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    }).format(new Date());

    setIsSending(true);
    setToast(null);
    try {
      const body = { text: slackPreview };
      if (
        SEND_SCREENSHOT_TO_SLACK &&
        attachment?.dataUrl &&
        String(attachment.dataUrl).startsWith("data:")
      ) {
        body.screenshot = {
          filename: attachment.name || "salt-feedback.png",
          dataUrl: attachment.dataUrl,
        };
      }
      if (wasFeature) {
        body.featureRequestSheet = {
          dateDisplay,
          fullName: context.currentUser ?? "—",
          userEmail: context.userEmail && context.userEmail !== "—" ? context.userEmail : "",
          tabWidget: sectionValue,
          summary: summary.trim(),
          priorityStars: priorityIdToSheetStarCount(priority),
          details: details.trim(),
        };
      }

      const res = await fetch(slackSubmitPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseResponseBody(res);

      if (!res.ok) {
        const detail = [data.error, data.slackBody, data.raw].filter(Boolean).join(" — ");
        throw new Error(detail || res.statusText || "Request failed");
      }

      const sheetsWarning =
        typeof data.sheetsWarning === "string" && data.sheetsWarning.trim()
          ? data.sheetsWarning.trim()
          : null;
      const screenshotWarning =
        typeof data.screenshotWarning === "string" && data.screenshotWarning.trim()
          ? data.screenshotWarning.trim()
          : null;
      const sheetRow = typeof data.sheetRow === "number" ? data.sheetRow : null;
      setToast({
        type: "success",
        wasFeature,
        sheetsWarning,
        screenshotWarning,
        screenshotPosted: data.screenshotPosted === true,
        ...(sheetRow != null ? { sheetRow } : {}),
      });
      onOpenChange?.(false);
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Could not send feedback",
      });
    } finally {
      setIsSending(false);
    }
  };

  const setOpen = (next) => {
    onOpenChange?.(next);
  };

  const clearAttachment = () => {
    setAttachment(null);
    setCapturePhase("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="salt-dashboard-feedback-mount" aria-live="polite">
      <AnimatePresence>
        {isOpen ? (
          <>
            <Motion.button
              key="feedback-backdrop"
              type="button"
              className="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-label="Close feedback"
              onClick={() => setOpen(false)}
            />

            <Motion.div
              key="feedback-modal"
              ref={modalRootRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="feedback-modal-title"
              tabIndex={0}
              onPaste={handlePaste}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="feedback-modal"
            >
              <div className="modal-header">
                <div>
                  <div className="eyebrow">Forecast Dashboard Feedback</div>
                  <h3 id="feedback-modal-title">Tell us what needs attention</h3>
                  <p>
                    Fast feedback for data issues, drilldown mismatches, confusing UX, and feature
                    requests.
                  </p>
                </div>

                <button
                  type="button"
                  className="feedback-modal-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close feedback"
                >
                  <X size={16} strokeWidth={2.25} aria-hidden />
                  <span>Close</span>
                </button>
              </div>

              <div className="context-pill-groups">
                <div
                  className="context-pill-group context-pill-group--view-details"
                  role="group"
                  aria-labelledby="feedback-context-current-view-label"
                >
                  <div id="feedback-context-current-view-label" className="context-pill-group__label">
                    Current view
                  </div>
                  <div className="context-pill-group__pills">
                    <ContextPill label="Page" value={context.page} />
                    <ContextPill label="Section" value={formatFeedbackSectionPill(context.reportSection)} />
                    <ContextPill label="Metric" value={context.metric} />
                  </div>
                </div>
                <div
                  className="context-pill-group context-pill-group--filter-settings"
                  role="group"
                  aria-labelledby="feedback-context-filter-settings-label"
                >
                  <div id="feedback-context-filter-settings-label" className="context-pill-group__label">
                    Filter settings
                  </div>
                  <div className="context-pill-group__pills">
                    <ContextPill label="Business Line" value={context.businessLine} />
                    <ContextPill label="FYQ" value={context.fiscalQuarter} />
                    <ContextPill label="Scope" value={context.employeeScope} />
                  </div>
                </div>
              </div>

              <div className="form-section feedback-identity-readonly">
                <div className="feedback-identity-readonly__grid">
                  <div className="feedback-identity-readonly__field">
                    <label htmlFor="salt-feedback-readonly-name">Current user</label>
                    <input
                      id="salt-feedback-readonly-name"
                      readOnly
                      tabIndex={-1}
                      value={context.currentUser ?? "—"}
                      aria-readonly="true"
                    />
                  </div>
                  <div className="feedback-identity-readonly__field feedback-identity-readonly__field--email-value-only">
                    <label htmlFor="salt-feedback-readonly-email" className="sr-only">
                      Email
                    </label>
                    <input
                      id="salt-feedback-readonly-email"
                      readOnly
                      tabIndex={-1}
                      value={context.userEmail ?? "—"}
                      aria-readonly="true"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <label>What kind of feedback is this?</label>

                <div className="type-grid">
                  {FEEDBACK_TYPES.map((item) => (
                    <TypeCard
                      key={item.id}
                      item={item}
                      selected={feedbackType === item.id}
                      onClick={() => setFeedbackType(item.id)}
                    />
                  ))}
                </div>
              </div>

              {feedbackType === "feature_request" ? (
                <div className="form-section">
                  <label htmlFor="salt-feedback-feature-section">Section to add new feature</label>
                  <select
                    id="salt-feedback-feature-section"
                    value={featureTargetSection}
                    onChange={(e) => setFeatureTargetSection(e.target.value)}
                  >
                    <option value="">Choose a section…</option>
                    {FEATURE_SECTION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {featureTargetSection === FEATURE_SECTION_OTHER ? (
                    <>
                      <label
                        htmlFor="salt-feedback-feature-section-other"
                        className="feedback-section-other-label"
                      >
                        Describe the section
                      </label>
                      <input
                        id="salt-feedback-feature-section-other"
                        value={featureSectionOther}
                        onChange={(e) => setFeatureSectionOther(e.target.value)}
                        placeholder="e.g. New card under Company Totals, new tab on CEO view…"
                      />
                    </>
                  ) : null}
                </div>
              ) : null}

              <div className="form-grid">
                <div className="field-group field-group--full">
                  <label htmlFor="salt-feedback-summary">Summary</label>
                  <input
                    id="salt-feedback-summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="What happened?"
                  />
                </div>

                <div className="field-group field-group--full">
                  <label htmlFor="salt-feedback-details">Details</label>
                  <textarea
                    id="salt-feedback-details"
                    rows={6}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Expected vs actual, steps to reproduce, or extra context"
                  />
                </div>
              </div>

              <div className="action-grid">
                <div>
                  <label className="sub-label">Priority</label>

                  <div className="priority-row">
                    {PRIORITIES.map((item) => (
                      <PriorityPill
                        key={item.id}
                        item={item}
                        selected={priority === item.id}
                        onClick={() => setPriority(item.id)}
                      />
                    ))}
                  </div>

                  <div className="helper-text">{selectedPriority?.description}</div>
                  {feedbackType === "feature_request" ? (
                    <div className="helper-text feedback-priority-sheet-note">
                      On the Feedback sheet: FYI = 1 star, Needs review = 2 stars, Blocking = 5 stars.
                    </div>
                  ) : null}
                </div>

                <div className="attachment-area">
                  <label className="sub-label">Screenshot file</label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden-input"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void readFileAsAttachment(file, "file");
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip size={16} />
                    Upload image
                  </button>
                </div>
              </div>

              <div className="screenshot-panel">
                <div className="screenshot-panel__toolbar">
                  {captureTargetReady ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void runCapture()}
                      disabled={capturePhase === "working"}
                    >
                      <Camera size={16} />
                      Re-capture dashboard
                    </button>
                  ) : null}

                  {attachment ? (
                    <button type="button" className="ghost-button" onClick={clearAttachment}>
                      <X size={16} />
                      Remove image
                    </button>
                  ) : null}
                </div>

                {capturePhase === "working" ? (
                  <div className="screenshot-panel__status" role="status">
                    <Loader2 className="spinning" size={18} aria-hidden />
                    Capturing dashboard…
                  </div>
                ) : null}

                {capturePhase === "error" && captureTargetReady ? (
                  <p className="screenshot-panel__hint">
                    Could not capture automatically (cross-origin images or browser limits). Upload
                    a screenshot or paste from clipboard (⌘V / Ctrl+V) while this dialog is focused.
                  </p>
                ) : null}

                {!captureTargetReady && !attachment ? (
                  <p className="screenshot-panel__hint">
                    Pass a <code>captureRef</code> to the dashboard container for automatic
                    screenshots. You can still upload or paste an image.
                  </p>
                ) : null}

                {captureTargetReady && !attachment && capturePhase === "idle" ? (
                  <p className="screenshot-panel__hint">
                    Tip: click in this dialog and paste an image from your clipboard for a manual
                    clip.
                  </p>
                ) : null}

                {attachment ? (
                  <figure className="screenshot-preview">
                    <img src={attachment.dataUrl} alt="Screenshot attached to this feedback" />
                  </figure>
                ) : null}
              </div>

              <div className="modal-footer">
                <div className="footer-actions">
                  <button type="button" className="ghost-button" onClick={() => setOpen(false)}>
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleSubmit()}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="spinning" size={16} aria-hidden />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Send feedback
                      </>
                    )}
                  </button>
                </div>
              </div>
            </Motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {!hideFloatingTrigger ? (
        <Motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          className="floating-button"
          onClick={() => setOpen(true)}
        >
          <MessageSquareWarning size={16} />
          Submit Feedback
        </Motion.button>
      ) : null}

      <AnimatePresence>
        {toast ? (
          <Motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={`success-toast ${toast.type === "error" ? "success-toast--error" : ""}`}
            role="status"
          >
            <div className="success-toast__icon">
              {toast.type === "error" ? (
                <AlertTriangle size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
            </div>

            <div>
              <strong>
                {toast.type === "error" ? "Could not send feedback" : "Feedback sent"}
              </strong>
              <p>
                {toast.type === "error"
                  ? toast.message
                  : `Your message was sent to the ${successSlackChannelDisplay} Slack channel. The team will triage it there.`}
              </p>
              {toast.type === "success" && toast.screenshotPosted ? (
                <p className="success-toast__secondary">Screenshot posted in the same Slack channel.</p>
              ) : null}
              {toast.type === "success" && toast.screenshotWarning ? (
                <p className="success-toast__secondary">{toast.screenshotWarning}</p>
              ) : null}
              {toast.type === "success" && toast.wasFeature && !toast.sheetsWarning ? (
                <p className="success-toast__secondary">
                  {typeof toast.sheetRow === "number"
                    ? `Feature request logged on the Feedback sheet (row ${toast.sheetRow}).`
                    : "Feature request sent to the Feedback Google Sheet."}
                </p>
              ) : null}
              {toast.type === "success" && toast.sheetsWarning ? (
                <p className="success-toast__secondary">{toast.sheetsWarning}</p>
              ) : null}
              <button type="button" onClick={() => setToast(null)}>
                Dismiss
              </button>
            </div>
          </Motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
