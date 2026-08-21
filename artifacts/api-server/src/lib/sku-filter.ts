/**
 * Gimme assortment SKU exclusion.
 *
 * Business rule (confirmed by the Gimme team): the following NetSuite SKU
 * patterns are NOT part of the current Gimme assortment and must be excluded
 * from all sell-in reporting:
 *   - SKUs prefixed with "P" followed by 4 digits (e.g. "P3368", "P3368-OLD")
 *   - Item numbers (SKUs) below 7000 (e.g. "5925", "5925-OLD", "6859")
 * Both rules apply regardless of any trailing suffix (e.g. "-OLD").
 */

// Bare-column SQL fragment — use when the query selects directly from
// NETSUITE_SALES_BY_PRODUCT without a table alias (append after other WHERE clauses).
export const GIMME_ASSORTMENT_SKU_SQL_FILTER = `
  AND SKU NOT RLIKE '^[Pp][0-9]{4}.*'
  AND (
    REGEXP_SUBSTR(SKU, '^[0-9]+') IS NULL
    OR TRY_TO_NUMBER(REGEXP_SUBSTR(SKU, '^[0-9]+')) >= 7000
  )
`;

export function isGimmeAssortmentSku(sku: string): boolean {
  if (!sku) return true;
  if (/^P\d{4}/i.test(sku)) return false;
  const m = sku.match(/^(\d+)/);
  if (m && Number(m[1]) < 7000) return false;
  return true;
}
