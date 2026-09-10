/**
 * Shared store-id mappings used to compute "Total Company Revenue" outside
 * the Overview page (e.g. Ad Attribution MER), without duplicating the
 * revenue-source logic Overview owns.
 */

/** Maps NetSuite `storeName` values to internal store ids. */
export const NS_STORE_ID: Record<string, string> = {
  "Target":            "target",
  "Walmart":           "walmart",
  "CVS":               "cvs",
  "Ulta Beauty":       "ulta",
  "Kroger":            "kroger",
  "Publix":            "publix",
  "Walgreens":         "walgreens",
  "Meijer":            "meijer",
  "Shopify":           "shopify",
  "Amazon (Pattern)":  "amazon",
};

/** Store ids covered by the Circana retail POS feed. */
export const CIRCANA_STORE_IDS = ["meijer", "cvs", "walgreens", "publix"];
