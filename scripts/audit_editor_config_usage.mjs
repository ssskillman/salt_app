#!/usr/bin/env node
/**
 * audit_editor_config_usage.mjs
 *
 * Audits Sigma plugin editorConfig names against:
 *   1) current src/app/editorConfig.js
 *   2) optional Sigma debug-console export text
 *   3) local source-code references
 */

import fs from "fs";
import path from "path";

const DEFAULT_EDITOR_CONFIG = "src/app/editorConfig.js";
const DEFAULT_SCAN_DIR = "src";

const DEFAULT_EXCLUDE_PATTERNS = [
  /src\/app\/editorConfig(?:_[^/]*)?\.js$/,
  /src\/components\/DebugConsoleModal\.jsx$/,
  /src\/App_full_backup.*\.jsx$/,
  /src\/.*backup.*\.jsx$/i,
  /README/i,
  /node_modules/,
  /dist/,
  /\.git/,
];

function parseArgs(argv) {
  const args = {
    editorConfig: DEFAULT_EDITOR_CONFIG,
    scanDir: DEFAULT_SCAN_DIR,
    sigmaExport: null,
    csvOut: null,
    jsonOut: null,
    includeDebugConsole: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--editor-config") args.editorConfig = argv[++i];
    else if (arg === "--scan-dir") args.scanDir = argv[++i];
    else if (arg === "--sigma-export") args.sigmaExport = argv[++i];
    else if (arg === "--csv-out") args.csvOut = argv[++i];
    else if (arg === "--json-out") args.jsonOut = argv[++i];
    else if (arg === "--include-debug-console") args.includeDebugConsole = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/audit_editor_config_usage.mjs [options]

Options:
  --editor-config PATH       Default: src/app/editorConfig.js
  --scan-dir PATH            Default: src
  --sigma-export PATH        Optional Sigma debug-console export text
  --csv-out PATH             Optional CSV output path
  --json-out PATH            Optional JSON output path
  --include-debug-console    Include DebugConsoleModal.jsx in code reference counts
`);
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function shouldExclude(filePath, includeDebugConsole = false) {
  const normalized = normalizePath(filePath);

  return DEFAULT_EXCLUDE_PATTERNS.some((pattern) => {
    if (includeDebugConsole && String(pattern).includes("DebugConsoleModal")) {
      return false;
    }
    return pattern.test(normalized);
  });
}

function parseEditorConfig(editorConfigPath) {
  const text = fs.readFileSync(editorConfigPath, "utf8");

  const entries = [];
  const objectRegex = /\{[^{}]*name:\s*["']([^"']+)["'][^{}]*\}/gms;

  let match;
  while ((match = objectRegex.exec(text)) !== null) {
    const objectText = match[0];
    const name = match[1];

    const type = readProperty(objectText, "type");
    const source = readProperty(objectText, "source");
    const label = readProperty(objectText, "label");

    entries.push({
      name,
      type: type ?? "",
      source: source ?? "",
      label: label ?? "",
      rawLength: objectText.length,
    });
  }

  return entries;
}

function readProperty(objectText, propName) {
  const regex = new RegExp(`${propName}:\\s*["']([^"']*)["']`, "m");
  const match = regex.exec(objectText);
  return match ? match[1] : null;
}

function parseSigmaExport(exportPath) {
  if (!exportPath) {
    return {
      hasExport: false,
      mappings: {},
      workbookOnlyKeys: {},
      exportedAt: null,
    };
  }

  const text = fs.readFileSync(exportPath, "utf8").trim();

  // Format A: full Sigma iframe/plugin URL containing ?config=...
  if (/^https?:\/\//.test(text) && text.includes("config=")) {
    try {
      const url = new URL(text);
      const configRaw = url.searchParams.get("config");

      if (!configRaw) {
        throw new Error("URL has no config query param");
      }

      const config = JSON.parse(configRaw);

      return {
        hasExport: true,
        mappings: config ?? {},
        workbookOnlyKeys: {},
        exportedAt: null,
      };
    } catch (error) {
      throw new Error(`Could not parse full Sigma iframe URL config: ${error.message}`);
    }
  }

  // Format B: Debug Console export with Block 2 JSON.
  const marker = "# --- Block 2: JSON";
  const markerIndex = text.indexOf(marker);

  if (markerIndex >= 0) {
    const jsonStart = text.indexOf("{", markerIndex);
    if (jsonStart >= 0) {
      const jsonText = text.slice(jsonStart).trim();
      try {
        const parsed = JSON.parse(jsonText);
        return {
          hasExport: true,
          mappings: parsed.mappings ?? {},
          workbookOnlyKeys: parsed.workbookOnlyKeys ?? {},
          exportedAt: parsed.exportedAt ?? null,
        };
      } catch {
        // Fall through to TSV parse.
      }
    }
  }

  const mappings = {};
  const workbookOnlyKeys = {};
  let inWorkbookOnly = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith("# exportedAt") || line.startsWith("# Block")) continue;

    if (line.includes("Present in this workbook but not in editorConfig")) {
      inWorkbookOnly = true;
      continue;
    }

    if (line.startsWith("name\t")) continue;
    if (line.startsWith("#")) continue;
    if (line.trim().startsWith("{")) break;

    const parts = line.split("\t");
    const name = parts[0];
    const sigmaValue = parts[4] ?? "";

    if (!name) continue;

    const value = sigmaValue === "" ? null : sigmaValue;

    if (inWorkbookOnly) workbookOnlyKeys[name] = value;
    else mappings[name] = value;
  }

  return {
    hasExport: true,
    mappings,
    workbookOnlyKeys,
    exportedAt: null,
  };
}

function listSourceFiles(dir) {
  const results = [];

  function walk(current) {
    if (!fs.existsSync(current)) return;

    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(current)) {
        walk(path.join(current, child));
      }
      return;
    }

    if (!/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(current)) return;

    results.push(current);
  }

  walk(dir);
  return results;
}

function countReferences(entries, scanDir, includeDebugConsole) {
  const files = listSourceFiles(scanDir).filter((file) => !shouldExclude(file, includeDebugConsole));

  const counts = new Map();
  const refFiles = new Map();

  for (const entry of entries) {
    counts.set(entry.name, 0);
    refFiles.set(entry.name, new Set());
  }

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");

    for (const entry of entries) {
      const escaped = entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "g");
      const matches = text.match(regex);
      if (matches) {
        counts.set(entry.name, counts.get(entry.name) + matches.length);
        refFiles.get(entry.name).add(normalizePath(file));
      }
    }
  }

  return {
    filesScanned: files.map(normalizePath),
    counts,
    refFiles,
  };
}

function estimateConfigChars(key, value) {
  return JSON.stringify(key).length + 1 + JSON.stringify(value).length + 1;
}

function makeRecommendation({ entry, isMapped, isNull, codeRefs, isWorkbookOnly }) {
  if (isWorkbookOnly) return "REMOVE_FROM_SIGMA_WORKBOOK_CONFIG_STALE";

  if (entry.type === "element") {
    if (!isMapped || isNull) return "REVIEW_ELEMENT_UNMAPPED";
    if (codeRefs === 0) return "REVIEW_ELEMENT_NO_DIRECT_CODE_REF";
    return "KEEP_ELEMENT";
  }

  if (entry.type === "boolean") {
    if (codeRefs === 0) return "LIKELY_REMOVE_CONTROL_NO_CODE_REF";
    if (!isMapped || isNull) return "KEEP_IF_CONTROL_USED_IN_CODE";
    return "KEEP_CONTROL";
  }

  if (!isMapped) return "LIKELY_REMOVE_NOT_IN_SIGMA_CONFIG";
  if (isNull && codeRefs === 0) return "LIKELY_REMOVE_NULL_AND_NO_CODE_REF";
  if (isNull && codeRefs > 0) return "REVIEW_NULL_BUT_CODE_REFERENCES";
  if (codeRefs === 0) return "REVIEW_MAPPED_BUT_NO_DIRECT_CODE_REF";
  return "KEEP";
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const entries = parseEditorConfig(args.editorConfig);
  const sigma = parseSigmaExport(args.sigmaExport);
  const refs = countReferences(entries, args.scanDir, args.includeDebugConsole);

  const editorNameSet = new Set(entries.map((entry) => entry.name));

  const sigmaOnlyRows = Object.entries(sigma.mappings)
    .filter(([key]) => !editorNameSet.has(key))
    .map(([key, value]) => ({
      name: key,
      type: "",
      source: "",
      label: "",
      sigmaValue: value,
      sigmaStatus: value == null ? "SIGMA_ONLY_NULL" : "SIGMA_ONLY_POPULATED",
      codeRefs: 0,
      refFiles: "",
      rawLength: 0,
      estimatedConfigChars: estimateConfigChars(key, value),
      recommendation: "REMOVE_FROM_SIGMA_URL_CONFIG_STALE",
    }));

  const workbookOnlyRows = Object.entries(sigma.workbookOnlyKeys).map(([key, value]) => ({
    name: key,
    type: "",
    source: "",
    label: "",
    sigmaValue: value,
    sigmaStatus: value == null ? "STALE_NULL" : "STALE_POPULATED",
    codeRefs: 0,
    refFiles: "",
    rawLength: 0,
    estimatedConfigChars: estimateConfigChars(key, value),
    recommendation: "REMOVE_FROM_SIGMA_WORKBOOK_CONFIG_STALE",
  }));

  const rows = entries.map((entry) => {
    const hasMapping = Object.prototype.hasOwnProperty.call(sigma.mappings, entry.name);
    const sigmaValue = hasMapping ? sigma.mappings[entry.name] : undefined;
    const isNull = sigmaValue == null;
    const codeRefs = refs.counts.get(entry.name) ?? 0;
    const files = [...(refs.refFiles.get(entry.name) ?? new Set())].join("; ");

    let sigmaStatus = "NO_EXPORT";
    if (sigma.hasExport) {
      if (!hasMapping) sigmaStatus = "MISSING_FROM_SIGMA_CONFIG";
      else if (isNull) sigmaStatus = "MAPPED_NULL";
      else sigmaStatus = "MAPPED_POPULATED";
    }

    return {
      name: entry.name,
      type: entry.type,
      source: entry.source,
      label: entry.label,
      sigmaValue: sigmaValue === undefined ? "" : sigmaValue,
      sigmaStatus,
      codeRefs,
      refFiles: files,
      rawLength: entry.rawLength,
      estimatedConfigChars: hasMapping ? estimateConfigChars(entry.name, sigmaValue) : 0,
      recommendation: makeRecommendation({
        entry,
        isMapped: hasMapping,
        isNull,
        codeRefs,
        isWorkbookOnly: false,
      }),
    };
  });

  const allRows = [...rows, ...sigmaOnlyRows, ...workbookOnlyRows];

  const summary = {
    editorConfigEntries: entries.length,
    sourceFilesScanned: refs.filesScanned.length,
    sigmaExportLoaded: sigma.hasExport,
    sigmaExportedAt: sigma.exportedAt,
    sigmaMappings: Object.keys(sigma.mappings).length,
    workbookOnlyKeys: Object.keys(sigma.workbookOnlyKeys).length,
    sigmaOnlyKeys: sigmaOnlyRows.length,
    mappedPopulated: rows.filter((row) => row.sigmaStatus === "MAPPED_POPULATED").length,
    mappedNull: rows.filter((row) => row.sigmaStatus === "MAPPED_NULL").length,
    missingFromSigmaConfig: rows.filter((row) => row.sigmaStatus === "MISSING_FROM_SIGMA_CONFIG").length,
    noDirectCodeRefs: rows.filter((row) => row.codeRefs === 0).length,
    staleEstimatedConfigChars: [...sigmaOnlyRows, ...workbookOnlyRows].reduce((sum, row) => sum + row.estimatedConfigChars, 0),
  };

  console.log("\n=== editorConfig audit summary ===");
  for (const [key, value] of Object.entries(summary)) {
    console.log(`${key}: ${value}`);
  }

  console.log("\n=== Highest-confidence remove candidates ===");
  const removeCandidates = allRows.filter((row) =>
    row.recommendation.startsWith("LIKELY_REMOVE") ||
    row.recommendation === "REMOVE_FROM_SIGMA_WORKBOOK_CONFIG_STALE" ||
    row.recommendation === "REMOVE_FROM_SIGMA_URL_CONFIG_STALE"
  );

  for (const row of removeCandidates.slice(0, 100)) {
    console.log(`${row.recommendation}: ${row.name} (${row.sigmaStatus})`);
  }

  console.log("\n=== Review candidates ===");
  const reviewCandidates = allRows.filter((row) => row.recommendation.startsWith("REVIEW"));
  for (const row of reviewCandidates.slice(0, 100)) {
    console.log(`${row.recommendation}: ${row.name} (${row.sigmaStatus}, refs=${row.codeRefs})`);
  }

  if (args.csvOut) {
    const headers = [
      "name",
      "type",
      "source",
      "label",
      "sigmaValue",
      "sigmaStatus",
      "codeRefs",
      "refFiles",
      "rawLength",
      "estimatedConfigChars",
      "recommendation",
    ];

    const csv = [
      headers.join(","),
      ...allRows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
    ].join("\n");

    fs.writeFileSync(args.csvOut, csv);
    console.log(`\nCSV written to: ${args.csvOut}`);
  }

  if (args.jsonOut) {
    fs.writeFileSync(args.jsonOut, JSON.stringify({ summary, rows: allRows }, null, 2));
    console.log(`JSON written to: ${args.jsonOut}`);
  }

  console.log("\nDone.");
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
