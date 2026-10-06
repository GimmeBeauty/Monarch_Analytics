#!/usr/bin/env node
// Regenerates src/lib/sku-categories.ts from the Gimme Beauty retail mastersheet CSV.
//
// Usage (when the user supplies an updated mastersheet):
//   From the repo root:
//     node artifacts/api-server/scripts/generate-sku-categories.mjs <path-to-mastersheet.csv>
//   Or via the package script (path is resolved relative to artifacts/api-server):
//     pnpm --filter @workspace/api-server run generate:sku-categories -- <path-to-mastersheet.csv>
//
// The CSV must have a header row with at least "SKU" and "Product Type" columns
// (the shipped mastersheet also has "Title" and "UPC", which are ignored here).
//
// Rules applied, matching the original hand-built sku-categories.ts:
//   - Rows whose SKU is not a plain integer (e.g. "#REF!", blank) are skipped.
//   - Product Type values are trimmed of surrounding whitespace.
//   - Known typos/variants are normalized to the canonical category name
//     (e.g. "Claw  Clip" -> "Claw Clips"). Add new entries to NORMALIZE
//     below if the next mastersheet introduces another variant.
//   - If the same SKU appears more than once, the last row in the file wins
//     (matches a plain object literal being built in file order).
//
// After running, review the diff in src/lib/sku-categories.ts before committing -
// in particular, check SKU_CATEGORIES still lists every category that appears in
// SKU_CATEGORY_MAP, and that no new unexpected category slipped in.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../src/lib/sku-categories.ts");

// Canonical name overrides for known mastersheet typos/variants.
const NORMALIZE = {
  "Claw  Clip": "Claw Clips",
};

function parseCsv(text) {
  // Minimal RFC4180 parser: handles quoted fields, embedded commas, embedded
  // newlines inside quotes, and "" as an escaped quote.
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  // Flush trailing field/row (file may or may not end with a newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error(
      "Usage: node artifacts/api-server/scripts/generate-sku-categories.mjs <path-to-mastersheet.csv>",
    );
    process.exit(1);
  }

  const text = readFileSync(resolve(csvPath), "utf-8");
  const rows = parseCsv(text);
  if (rows.length === 0) {
    console.error("CSV appears to be empty.");
    process.exit(1);
  }

  const header = rows[0].map((h) => h.trim());
  const skuIdx = header.indexOf("SKU");
  const typeIdx = header.indexOf("Product Type");
  const titleIdx = header.indexOf("Title");
  if (skuIdx === -1 || typeIdx === -1) {
    console.error(
      `CSV header must include "SKU" and "Product Type" columns. Found: ${header.join(", ")}`,
    );
    process.exit(1);
  }

  const categoryMap = {};
  const titleMap = {};
  let skippedInvalidSku = 0;

  for (const row of rows.slice(1)) {
    const rawSku = (row[skuIdx] ?? "").trim();
    const rawType = (row[typeIdx] ?? "").trim();
    const rawTitle = titleIdx === -1 ? "" : (row[titleIdx] ?? "").trim();

    if (!/^\d+$/.test(rawSku)) {
      skippedInvalidSku += 1;
      continue;
    }
    if (!rawType) continue;

    const category = NORMALIZE[rawType] ?? rawType;
    categoryMap[rawSku] = category;
    if (rawTitle) titleMap[rawSku] = rawTitle;
  }

  const categories = Array.from(new Set(Object.values(categoryMap))).sort();
  const skus = Object.keys(categoryMap).sort();

  const csvRelPath = resolve(csvPath).includes(resolve(__dirname, "../../.."))
    ? resolve(csvPath).slice(resolve(__dirname, "../../..").length + 1)
    : csvPath;

  const lines = [];
  lines.push(`// Auto-generated from ${csvRelPath}`);
  lines.push(
    "// Maps each known SKU to its product category per the Gimme Beauty mastersheet.",
  );
  lines.push(
    "// Regenerate with: node artifacts/api-server/scripts/generate-sku-categories.mjs <path-to-updated-mastersheet.csv>",
  );
  lines.push("//");
  lines.push(
    "// Categories present in the mapping (every visible SKU must map to one of these;",
  );
  lines.push(
    "// SKUs absent from this map are hidden from Item Performance rather than guessed):",
  );
  lines.push("export const SKU_CATEGORIES = [");
  for (const category of categories) {
    lines.push(`  ${JSON.stringify(category)},`);
  }
  lines.push("] as const;");
  lines.push("");
  lines.push("export type SkuCategory = typeof SKU_CATEGORIES[number];");
  lines.push("");
  lines.push(
    "export const SKU_CATEGORY_MAP: Record<string, SkuCategory> = {",
  );
  for (const sku of skus) {
    lines.push(`  ${JSON.stringify(sku)}: ${JSON.stringify(categoryMap[sku])},`);
  }
  lines.push("};");
  lines.push("");
  lines.push(
    "// Product title per SKU, straight from the mastersheet's \"Title\" column.",
  );
  lines.push(
    "// This is the source of truth for display titles in Item Performance —",
  );
  lines.push(
    "// retailer POS titles are only a fallback for a SKU missing here.",
  );
  lines.push("export const SKU_TITLE_MAP: Record<string, string> = {");
  for (const sku of skus) {
    if (titleMap[sku]) {
      lines.push(`  ${JSON.stringify(sku)}: ${JSON.stringify(titleMap[sku])},`);
    }
  }
  lines.push("};");
  lines.push("");

  writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf-8");

  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`  SKUs mapped: ${skus.length}`);
  console.log(`  Categories: ${categories.join(", ")}`);
  if (skippedInvalidSku > 0) {
    console.log(
      `  Skipped ${skippedInvalidSku} row(s) with a non-numeric SKU (e.g. "#REF!").`,
    );
  }
}

main();
