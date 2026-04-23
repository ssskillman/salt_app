import { runSlackFeedbackSubmit } from "../../server/slackFeedbackSubmit.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const result = await runSlackFeedbackSubmit(payload, {
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || "",
    googleSheetsWebAppUrl: process.env.GOOGLE_SHEETS_WEBAPP_URL || "",
    slackBotToken: process.env.SLACK_BOT_TOKEN || "",
    slackFeedbackChannelId: process.env.SLACK_FEEDBACK_CHANNEL_ID || "",
  });

  return {
    statusCode: result.statusCode,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify(result.json),
  };
}
