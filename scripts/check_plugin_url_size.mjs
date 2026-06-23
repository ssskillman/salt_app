import fs from "fs";

const filesToCheck = [
  "plugin.json",
  "src/app/editorConfig.js",
  "src/app/editorConfig.jsx",
  "src/app/editorConfig.ts",
];

for (const file of filesToCheck) {
  if (!fs.existsSync(file)) continue;

  const content = fs.readFileSync(file, "utf8");
  console.log(`${file}: ${content.length.toLocaleString()} raw chars`);
}

console.log("\nKnown Firebase practical ceiling from test: ~8,170 total URL chars");
console.log("Recommended target: keep Sigma full iframe URL < 7,500 chars");
console.log("Recommended config target: < 5,000 chars");