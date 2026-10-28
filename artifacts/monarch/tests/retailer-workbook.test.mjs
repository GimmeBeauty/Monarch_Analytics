import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { createRetailerWorkbook } from "../src/lib/retailer-workbook.ts";

test("Excel export preserves retailer order, headers, numeric cells and identifiers", async () => {
  const workbook = createRetailerWorkbook([{
    productName: "=Not a formula", sku: "00123", upc: "000123456789",
    totalRevenue: 300, totalUnits: 10, avgDpsw: 1.234567,
    dataSources: ["pos", "netsuite"],
    byRetailer: [
      { entityId: 2, revenue: 100, units: 4, dpsw: null, itemNumber: "00042" },
      { entityId: 1, revenue: 200, units: 6, dpsw: 2.345678, itemNumber: "123" },
    ],
  }], [
    { value: 1, label: "First retailer" },
    { value: 3, label: "Absent retailer" },
    { value: 2, label: "Second retailer" },
  ]);
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.deepEqual(reloaded.worksheets.map(sheet => sheet.name), ["First retailer", "Second retailer"]);
  const first = reloaded.worksheets[0];
  assert.equal(first.rowCount, 2);
  assert.equal(first.getCell("D1").value, "First retailer Revenue");
  assert.equal(first.getCell("A2").value, "=Not a formula");
  assert.equal(first.getCell("B2").value, "00123");
  assert.equal(first.getCell("C2").value, "000123456789");
  assert.equal(first.getCell("D2").value, 200);
  assert.equal(first.getCell("F2").value, 2.3457);
  assert.equal(first.getCell("J2").value, 1.2346);
  assert.equal(first.getCell("K2").value, "pos+netsuite");
  assert.equal(reloaded.worksheets[1].getCell("F2").value, "");
  assert.equal(reloaded.worksheets[1].getCell("G2").value, "00042");
});

test("Excel export filters rows by retailer and truncates worksheet names", () => {
  const workbook = createRetailerWorkbook([{
    productName: "Brush", sku: "A", upc: "1",
    totalRevenue: 1, totalUnits: 1, avgDpsw: 0,
    dataSources: [], byRetailer: [
      { entityId: 1, revenue: 1, units: 1, dpsw: 0, itemNumber: "" },
    ],
  }], [{ value: 1, label: "A retailer name longer than thirty one characters" }]);
  assert.equal(workbook.worksheets[0].name.length, 31);
  assert.equal(workbook.worksheets[0].rowCount, 2);
  assert.equal(workbook.worksheets[0].getCell("F2").value, 0);
});
