# SALT — Sigma plugin (React)

SALT is a **React** dashboard that runs as a **Sigma plugin** ([`@sigmacomputing/plugin`](https://www.npmjs.com/package/@sigmacomputing/plugin)). Sigma embeds the built app in an iframe and passes workbook data into it through a configurable editor panel.

This README is a **onboarding map** for someone new to the repo.

---

## Prerequisites

- **Node**: `^20.19.0` or `>=22.12.0` (see `package.json` → `engines`)
- **npm** (or compatible client) for installs

---

## Quick start (local UI)

From this directory (`salt_app`):

```bash
npm install
npm run dev
```

Vite serves the app on **port 3052** (`strictPort: true` in `vite.config.js`). Open the URL Vite prints (typically `http://localhost:3052`).

- **`npm run build`** — production bundle to `dist/`
- **`npm run preview`** — serve the built output locally
- **`npm run lint`** — ESLint

---

## Mental model: where everything lives

| Area | Role |
|------|------|
| **`src/App.jsx`** | Main shell: layout, persona navigation, metric cards, modals, and wiring from Sigma data into UI. This is the first file most people open when changing behavior or adding a surface. |
| **`src/app/editorConfig.js`** | Declares the **Sigma editor panel**: every `name` here becomes a **`config` key** authors map in Sigma (elements vs columns). This is the contract between the workbook and React. |
| **`src/hooks/useSigmaData.js`** | **Data layer**: registers the editor panel with Sigma, reads `useConfig()`, pulls element data/columns, normalizes shapes, and returns `{ config, data, rows, columns, isLoading, debugInfo }` for `App.jsx`. |
| **`plugin.json`** | Sigma plugin metadata (name, description, `iframe: true`, etc.). |
| **`src/main.jsx`** | React entry: mounts `<App />` inside `BrandThemeProvider`. |

Supporting pieces you will touch often:

- **`src/utils/data.jsx`** — row/column helpers, key resolution, merges used by the hook and App.
- **`src/utils/formatters.jsx`** — money, %, counts, etc.
- **`src/utils/sigmaHelpers.js`** — optional helpers for column keys and row normalization.
- **`src/context/BrandThemeContext.jsx`** — theme tokens for the UI.

---

## How Sigma maps data to React

1. **`editorConfig` defines the panel**  
   In `src/app/editorConfig.js`, each entry has a `name` and a `type`:

   - **`type: "element"`** — author attaches a **Sigma element / data source**; the plugin receives its id (and data is read via Sigma APIs).
   - **`type: "column"`** with **`source: "some_element_name"`** — author maps a **column** from that element; `useConfig()` exposes the selected column id under `config.some_column_name`.

   Human-readable `label` fields are for Sigma’s UI only.

2. **`useSigmaData` registers the panel on mount**  
   It calls `client.config.configureEditorPanel(...)` with a sanitized copy of `editorConfig` (see `useSigmaData.js`). That is what makes those controls appear in Sigma’s plugin editor.

3. **`App.jsx` consumes the hook**  
   The default export calls `useSigmaData({ ... })` with optional filters (CPO account, CEO business line, etc.) and then reads `data`, `rows`, `columns`, and `config` to drive components and modals.

**Important:** If `editorConfig` grows very large, Sigma may put a lot of configuration on the launch URL; the file header in `editorConfig.js` documents the risk of **414 URI Too Long** (e.g. behind Netlify). Prefer lean mappings and remove unused entries.

---

## Sigma vs pure local dev

- **Inside Sigma**: authors map elements/columns in the plugin panel; live data flows through `@sigmacomputing/plugin`.
- **Standalone `npm run dev`**: you still get a running React app, but without Sigma there is no real workbook wiring unless you mock config/data yourself (e.g. debug tooling in the repo).

---

## Optional: feedback proxy & env

Local feedback (Slack / optional Google Sheets) uses Vite env vars loaded in `vite.config.js`. Copy **`.env.example`** to **`.env.local`** and follow the comments there. Never commit secrets.

---

## Deploy notes

- **`firebase.json`** — SPA-style hosting: `public` is `dist`, rewrites to `index.html`.
- Production Slack feedback may use Netlify functions (see comments in `.env.example` if your monorepo includes that setup).

---

## Legacy / backups

You may see large backup copies of `App.jsx` or alternate `editorConfig_*` files in `src/`; treat them as **archives**, not the live source of truth. The active paths are **`src/App.jsx`** and **`src/app/editorConfig.js`**.

---

## Suggested first tasks for a new contributor

1. Run **`npm run dev`** and click through the main surfaces in `App.jsx`.
2. Skim **`editorConfig.js`** and grep a `name` (e.g. `source_detail`) in **`useSigmaData.js`** to see how it becomes `config` and row data.
3. Pick one small UI change in **`App.jsx`** or extract a subcomponent under **`src/components/`** to learn import patterns and styling (RSuite, PrimeReact, ECharts/Recharts, Framer Motion are all in play—follow existing usage).

Welcome aboard — LFG.
