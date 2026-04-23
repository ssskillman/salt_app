/**
 * Dev / preview: POST /api/slack-feedback → shared handler in server/slackFeedbackSubmit.mjs
 */

import { runSlackFeedbackSubmit } from "../server/slackFeedbackSubmit.mjs";

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export function slackWebhookProxyPlugin(webhookUrl, googleSheetsWebAppUrl = "", slackFileOptions = {}) {
  const sheetsUrl = typeof googleSheetsWebAppUrl === "string" ? googleSheetsWebAppUrl.trim() : "";
  const slackBotToken =
    typeof slackFileOptions.slackBotToken === "string" ? slackFileOptions.slackBotToken.trim() : "";
  const slackFeedbackChannelId =
    typeof slackFileOptions.slackFeedbackChannelId === "string"
      ? slackFileOptions.slackFeedbackChannelId.trim()
      : "";

  async function handlePost(req, res) {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    const result = await runSlackFeedbackSubmit(payload, {
      slackWebhookUrl: webhookUrl,
      googleSheetsWebAppUrl: sheetsUrl,
      slackBotToken,
      slackFeedbackChannelId,
    });

    res.statusCode = result.statusCode;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify(result.json));
  }

  function mount(server) {
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split("?")[0] ?? "";
      if (path !== "/api/slack-feedback") {
        next();
        return;
      }
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.end();
        return;
      }
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      res.setHeader("Access-Control-Allow-Origin", "*");
      void handlePost(req, res);
    });
  }

  return {
    name: "slack-webhook-proxy",
    configureServer: mount,
    configurePreviewServer: mount,
  };
}
