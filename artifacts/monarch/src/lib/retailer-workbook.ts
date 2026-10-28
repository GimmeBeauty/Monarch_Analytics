import ExcelJS from "exceljs";

interface ExportSku {
  productName: string;
  sku: string;
  upc: string;
  totalRevenue: number;
  totalUnits: number;
  avgDpsw: number;
  dataSources: string[];
  byRetailer: {
    entityId: number;
    revenue: number;
    units: number;
    dpsw: number | null;
    itemNumber: string;
  }[];
}

export function createRetailerWorkbook(
  skus: ExportSku[],
  retailerOptions: { value: number; label: string }[],
) {
  const workbook = new ExcelJS.Workbook();
  const retailerIds = new Set(skus.flatMap(s => s.byRetailer.map(r => r.entityId)));

  for (const { value: entityId, label } of retailerOptions) {
    if (!retailerIds.has(entityId)) continue;
    const worksheet = workbook.addWorksheet(label.substring(0, 31));
    worksheet.addRow([
      "Product Name", "SKU", "UPC",
      `${label} Revenue`, `${label} Units`, `${label} DPSW`, `${label} Item #`,
      "Total Revenue (All)", "Total Units (All)", "Avg DPSW (All)", "Data Sources",
    ]);
    for (const sku of skus) {
      const retailer = sku.byRetailer.find(r => r.entityId === entityId);
      if (!retailer) continue;
      worksheet.addRow([
        sku.productName, sku.sku, sku.upc,
        retailer.revenue, retailer.units,
        retailer.dpsw != null ? +retailer.dpsw.toFixed(4) : "",
        retailer.itemNumber,
        sku.totalRevenue, sku.totalUnits, +sku.avgDpsw.toFixed(4),
        sku.dataSources.join("+"),
      ]);
    }
  }
  return workbook;
}
