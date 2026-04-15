/**
 * Integration Framework — Type Definitions
 *
 * Adding a new integration: define an IntegrationDef in registry.ts.
 * No changes required here or in the UI.
 */

// ─── Enumerations ─────────────────────────────────────────────────────────────

export type AuthType =
  | "oauth"               // OAuth 2.0 with redirect flow
  | "api_key"             // Single API key
  | "client_credentials"  // Server-to-server client_id + client_secret
  | "custom";             // Platform-specific field set

export type IntegrationCategory =
  | "advertising"
  | "ecommerce"
  | "analytics"
  | "crm"
  | "erp"
  | "custom";

export type DataCapability =
  // Advertising
  | "spend" | "impressions" | "clicks" | "conversions" | "roas"
  | "ctr" | "cpc" | "cpm" | "reach" | "frequency" | "video_views"
  // Commerce
  | "revenue" | "orders" | "products" | "inventory"
  // Web analytics
  | "sessions" | "users" | "pageviews" | "bounce_rate" | "engagement"
  // CRM / retention
  | "subscribers" | "open_rate" | "click_rate" | "sms"
  | "reviews" | "ratings" | "subscriptions" | "ltv"
  // ERP
  | "financials" | "journal_entries"
  // Misc
  | "custom_data";

export type SyncSchedule = "hourly" | "daily" | "weekly";

export type ConnectionStatus = "connected" | "disconnected" | "error" | "syncing";

export type SheetType = "sales_by_store" | "product_sales" | "product_units";

// ─── Registry Types (static blueprints) ──────────────────────────────────────

/** A single input field required to configure an integration */
export interface CredentialField {
  key: string;
  label: string;
  type: "text" | "password" | "email" | "url" | "textarea";
  placeholder?: string;
  required: boolean;
  hint?: string;
  /** "setup" = user enters before OAuth; "oauth_callback" = populated post-redirect */
  group?: "setup" | "oauth_callback";
  sensitive?: boolean;
}

/** The static configuration object for an integration — lives in registry.ts */
export interface IntegrationDef {
  id: string;
  name: string;
  shortName?: string;         // compact display name if name is long
  description: string;
  category: IntegrationCategory;
  authType: AuthType;
  credentials: CredentialField[];
  dataCapabilities: DataCapability[];
  iconColor: string;          // brand color for icon/badge
  iconBg: string;             // light background color
  defaultSyncSchedule: SyncSchedule;
  oauthButtonLabel?: string;  // e.g. "Connect with Google"
  badge?: string;             // e.g. "Beta", "New"
  docsUrl?: string;
}

// ─── Runtime Types (stored per user) ─────────────────────────────────────────

/** Live connection state for one integration */
export interface ConnectionState {
  integrationId: string;
  status: ConnectionStatus;
  /** Base64-encoded in demo; properly encrypted in production */
  credentials: Record<string, string>;
  syncEnabled: boolean;
  syncSchedule: SyncSchedule;
  lastSyncAt: string | null;
  connectedAt: string | null;
  errorMessage: string | null;
  /** ISO string — for OAuth token refresh scheduling */
  tokenExpiresAt: string | null;
}

/** One Google Sheets data dump configuration */
export interface GoogleSheetConfig {
  id: string;
  name: string;
  sheetType: SheetType;
  spreadsheetId: string;
  sheetName: string;
  serviceAccountEmail: string;
  privateKey: string;
  status: ConnectionStatus;
  connectedAt: string;
  lastSyncAt: string | null;
  syncEnabled: boolean;
  errorMessage: string | null;
}
