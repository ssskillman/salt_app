import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { slackWebhookProxyPlugin } from "./vite-plugins/slack-webhook-proxy-plugin.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const slackWebhookUrl = env.SLACK_WEBHOOK_URL ?? "";
  const googleSheetsWebAppUrl = env.GOOGLE_SHEETS_WEBAPP_URL ?? "";
  const slackBotToken = env.SLACK_BOT_TOKEN ?? "";
  const slackFeedbackChannelId = env.SLACK_FEEDBACK_CHANNEL_ID ?? "";

  return {
    plugins: [
      react(),
      slackWebhookProxyPlugin(slackWebhookUrl, googleSheetsWebAppUrl, {
        slackBotToken,
        slackFeedbackChannelId,
      }),
    ],
    server: {
      port: 3052,
      strictPort: true,
    },
  };
});
