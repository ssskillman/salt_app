/**
 * Shared handler: Slack incoming webhook (text) + optional Google Sheet + optional screenshot upload
 * (upload gated by SLACK_SCREENSHOT_UPLOAD=true; client may omit screenshot payload).
 * Used by Vite dev middleware and Netlify serverless.
 */

const SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024;

/** Screenshot file upload to Slack is off unless explicitly enabled (set SLACK_SCREENSHOT_UPLOAD=true). */
const SLACK_SCREENSHOT_UPLOAD_ENABLED =
  String(process.env.SLACK_SCREENSHOT_UPLOAD ?? "").trim().toLowerCase() === "true";

function dataUrlToBuffer(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return { error: "screenshot.dataUrl must be a data: URL" };
  }
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return { error: "Invalid data URL" };
  const meta = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1).replace(/\s/g, "");
  if (!/^data:[^;]+;base64$/i.test(meta)) {
    return { error: "Expected data:*;base64,…" };
  }
  let buf;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    return { error: "Invalid base64 in screenshot" };
  }
  if (!buf.length) return { error: "Empty screenshot" };
  if (buf.length > SCREENSHOT_MAX_BYTES) {
    return {
      error: `Screenshot too large (${buf.length} bytes; max ${SCREENSHOT_MAX_BYTES} bytes)`,
    };
  }
  return { buffer: buf };
}

function safeFilename(name) {
  const s = String(name || "salt-feedback.png").trim() || "salt-feedback.png";
  const cleaned = s.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120);
  return cleaned || "salt-feedback.png";
}

async function slackUploadImageExternal(botToken, channelId, buffer, filename) {
  const fname = safeFilename(filename);

  const step1Body = new URLSearchParams();
  step1Body.set("filename", fname);
  step1Body.set("length", String(buffer.length));

  const step1 = await fetch("https://slack.com/api/files.getUploadURLExternal", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: step1Body.toString(),
  });
  const j1 = await step1.json();
  if (!j1.ok) {
    return { ok: false, error: j1.error || `getUploadURLExternal HTTP ${step1.status}` };
  }
  const uploadUrl = j1.upload_url;
  const fileId = j1.file_id;
  if (!uploadUrl || !fileId) {
    return { ok: false, error: "Slack response missing upload_url or file_id" };
  }

  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: buffer,
  });
  if (!up.ok) {
    const t = await up.text().catch(() => "");
    return { ok: false, error: `Slack storage upload failed (${up.status}): ${t.slice(0, 200)}` };
  }

  const completeBody = new URLSearchParams();
  completeBody.set("files", JSON.stringify([{ id: fileId, title: fname }]));
  completeBody.set("channel_id", channelId);
  completeBody.set("initial_comment", "Feedback screenshot");

  const step3 = await fetch("https://slack.com/api/files.completeUploadExternal", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: completeBody.toString(),
  });
  const j3 = await step3.json();
  if (!j3.ok) {
    return { ok: false, error: j3.error || `completeUploadExternal HTTP ${step3.status}` };
  }
  return { ok: true };
}

/**
 * @param {object} payload
 * @param {{ slackWebhookUrl: string, googleSheetsWebAppUrl?: string, slackBotToken?: string, slackFeedbackChannelId?: string }} env
 * @returns {Promise<{ statusCode: number, json: object }>}
 */
export async function runSlackFeedbackSubmit(payload, env) {
  const webhookUrl = String(env?.slackWebhookUrl ?? "").trim();
  const sheetsUrl = String(env?.googleSheetsWebAppUrl ?? "").trim();
  const slackBotToken = String(env?.slackBotToken ?? "").trim();
  const slackFeedbackChannelId = String(env?.slackFeedbackChannelId ?? "").trim();

  if (!webhookUrl) {
    return {
      statusCode: 500,
      json: {
        error:
          "SLACK_WEBHOOK_URL is not set. For local dev add .env.local; on Netlify set Site env and redeploy.",
      },
    };
  }

  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return { statusCode: 400, json: { error: "Expected a JSON object" } };
  }

  const slackMessageText = typeof payload.text === "string" ? payload.text : "";
  const slackBody = { text: slackMessageText };

  const shot = payload.screenshot;
  const hasScreenshot =
    shot != null &&
    typeof shot === "object" &&
    !Array.isArray(shot) &&
    typeof shot.dataUrl === "string" &&
    shot.dataUrl.startsWith("data:");

  try {
    const slackRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackBody),
    });

    const slackResponseText = await slackRes.text();
    if (!slackRes.ok) {
      return {
        statusCode: 502,
        json: {
          error: "Slack returned an error",
          slackStatus: slackRes.status,
          slackBody: slackResponseText.slice(0, 800),
        },
      };
    }

    let sheetsWarning = null;
    let sheetRow = null;
    const fr = payload.featureRequestSheet;
    const isFeatureSheet =
      fr != null && typeof fr === "object" && !Array.isArray(fr) && Object.keys(fr).length > 0;

    if (isFeatureSheet) {
      if (!sheetsUrl) {
        sheetsWarning =
          "Feature request was not appended: set GOOGLE_SHEETS_WEBAPP_URL (local .env.local or Netlify env).";
      } else {
        const sheetBody = JSON.stringify({ featureRequestSheet: fr });
        try {
          const sheetRes = await fetch(sheetsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: sheetBody,
            redirect: "follow",
          });
          const sheetText = await sheetRes.text();
          const trimmed = sheetText.trim();

          if (!sheetRes.ok) {
            sheetsWarning = `Google Sheet append failed (HTTP ${sheetRes.status}): ${sheetText.slice(0, 240)}`;
          } else if (trimmed.startsWith("<")) {
            sheetsWarning =
              "Google Sheet returned HTML (not JSON). Use the deployed Web App URL ending in /exec, deployment “Anyone”, and authorize the script to access the spreadsheet.";
          } else {
            try {
              const parsed = JSON.parse(sheetText);
              if (parsed && parsed.ok === false && parsed.error) {
                sheetsWarning = `Google Sheet: ${String(parsed.error).slice(0, 280)}`;
              } else if (parsed && parsed.ok && typeof parsed.row === "number") {
                sheetRow = parsed.row;
              }
            } catch {
              sheetsWarning = `Google Sheet response was not JSON: ${sheetText.slice(0, 200)}`;
            }
          }
        } catch (err) {
          sheetsWarning =
            err instanceof Error ? `Google Sheet append failed: ${err.message}` : "Google Sheet append failed";
        }
      }
    }

    let screenshotWarning = null;
    let screenshotPosted = false;

    if (hasScreenshot && SLACK_SCREENSHOT_UPLOAD_ENABLED) {
      if (!slackBotToken || !slackFeedbackChannelId) {
        screenshotWarning =
          "Screenshot was not posted to Slack: set SLACK_BOT_TOKEN and SLACK_FEEDBACK_CHANNEL_ID (invite the bot; scope files:write).";
      } else {
        const parsed = dataUrlToBuffer(shot.dataUrl);
        if (parsed.error) {
          screenshotWarning = `Screenshot skipped: ${parsed.error}`;
        } else {
          const up = await slackUploadImageExternal(
            slackBotToken,
            slackFeedbackChannelId,
            parsed.buffer,
            typeof shot.filename === "string" ? shot.filename : "salt-feedback.png"
          );
          if (up.ok) {
            screenshotPosted = true;
          } else {
            screenshotWarning = `Screenshot upload failed: ${up.error || "unknown error"}`;
          }
        }
      }
    }

    return {
      statusCode: 200,
      json: {
        ok: true,
        ...(typeof sheetRow === "number" ? { sheetRow } : {}),
        ...(sheetsWarning ? { sheetsWarning } : {}),
        ...(screenshotWarning ? { screenshotWarning } : {}),
        ...(screenshotPosted ? { screenshotPosted: true } : {}),
      },
    };
  } catch (err) {
    return {
      statusCode: 502,
      json: {
        error: err instanceof Error ? err.message : "Failed to reach Slack",
      },
    };
  }
}
