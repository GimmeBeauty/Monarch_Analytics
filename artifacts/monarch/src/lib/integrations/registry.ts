/**
 * Integration Registry
 *
 * This is the single source of truth for all supported integrations.
 * To add a new integration: add one object to INTEGRATION_REGISTRY.
 * No other file needs to change.
 *
 * Field groups:
 *   "setup"          — user fills in before initiating auth
 *   "oauth_callback" — populated automatically after OAuth redirect
 *   (none)           — always shown
 *
 * OAuth redirect URI (register this in each platform's developer console):
 *   {your_app_origin}/oauth/callback
 */

import type { IntegrationDef } from "./types";

export const INTEGRATION_REGISTRY: IntegrationDef[] = [

  // ══════════════════════════════════════════════════════════════════════════
  //  ADVERTISING
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: "meta_ads",
    name: "Meta Ads",
    description: "Sync Facebook and Instagram campaign performance including spend, ROAS, reach, frequency, and audience-level metrics across all ad account types.",
    category: "advertising",
    authType: "oauth",
    oauthButtonLabel: "Connect with Facebook",
    credentials: [
      { key: "app_id", label: "App ID", type: "text", placeholder: "123456789012345", required: true, group: "setup", hint: "Found in your Meta for Developers dashboard under App Settings." },
      { key: "app_secret", label: "App Secret", type: "password", placeholder: "••••••••", required: true, group: "setup", sensitive: true },
      { key: "ad_account_ids", label: "Ad Account IDs", type: "text", placeholder: "act_123456789, act_987654321", required: false, group: "setup", hint: "Comma-separated. Leave blank to pull all accessible accounts." },
      { key: "access_token", label: "Access Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
    ],
    dataCapabilities: ["spend", "impressions", "clicks", "conversions", "roas", "reach", "frequency", "ctr", "cpm", "video_views"],
    iconColor: "#0082FB",
    iconBg: "#E8F4FF",
    defaultSyncSchedule: "daily",
    oauthConfig: {
      authorizationUrl: "https://www.facebook.com/dialog/oauth",
      scopes: ["ads_management", "ads_read", "business_management"],
      clientIdField: "app_id",
      extraParams: { response_type: "code" },
    },
  },

  {
    id: "google_ads",
    name: "Google Ads",
    description: "Import campaign spend, keyword-level performance, conversion tracking, and attribution data from Google Ads and Google Manager accounts.",
    category: "advertising",
    authType: "oauth",
    oauthButtonLabel: "Connect with Google",
    credentials: [
      { key: "developer_token", label: "Developer Token", type: "password", placeholder: "••••••••", required: true, group: "setup", sensitive: true, hint: "Required for all Google Ads API access. Apply at developers.google.com/google-ads." },
      { key: "client_id", label: "OAuth Client ID", type: "text", placeholder: "123456789-xxxx.apps.googleusercontent.com", required: true, group: "setup" },
      { key: "client_secret", label: "OAuth Client Secret", type: "password", placeholder: "••••••••", required: true, group: "setup", sensitive: true },
      { key: "manager_customer_id", label: "Manager Customer ID", type: "text", placeholder: "123-456-7890", required: false, group: "setup", hint: "MCC ID if using a manager account. Leave blank for standard accounts." },
      { key: "customer_ids", label: "Customer IDs", type: "text", placeholder: "123-456-7890, 098-765-4321", required: false, group: "setup", hint: "Comma-separated child account IDs to sync." },
      { key: "access_token", label: "Access Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
      { key: "refresh_token", label: "Refresh Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
    ],
    dataCapabilities: ["spend", "impressions", "clicks", "conversions", "roas", "ctr", "cpc"],
    iconColor: "#4285F4",
    iconBg: "#E8F0FE",
    defaultSyncSchedule: "daily",
    oauthConfig: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      scopes: ["https://www.googleapis.com/auth/adwords"],
      clientIdField: "client_id",
      extraParams: { response_type: "code", access_type: "offline", prompt: "consent" },
    },
  },

  {
    id: "tiktok_ads",
    name: "TikTok Ads",
    description: "Connect TikTok for Business to pull ad performance, video engagement metrics, and audience insights across all advertiser accounts.",
    category: "advertising",
    authType: "oauth",
    oauthButtonLabel: "Connect with TikTok",
    credentials: [
      { key: "app_id", label: "App ID", type: "text", placeholder: "Your TikTok App ID", required: true, group: "setup" },
      { key: "app_secret", label: "App Secret", type: "password", placeholder: "••••••••", required: true, group: "setup", sensitive: true },
      { key: "advertiser_ids", label: "Advertiser IDs", type: "text", placeholder: "123456789012345", required: false, group: "setup", hint: "Leave blank to import all accessible advertisers." },
      { key: "access_token", label: "Access Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
    ],
    dataCapabilities: ["spend", "impressions", "clicks", "conversions", "ctr", "cpm", "video_views", "reach"],
    iconColor: "#010101",
    iconBg: "#F0F0F0",
    defaultSyncSchedule: "daily",
    oauthConfig: {
      authorizationUrl: "https://business-api.tiktok.com/portal/auth",
      scopes: [],
      clientIdField: "app_id",
      extraParams: { response_type: "code" },
    },
  },

  {
    id: "pinterest_ads",
    name: "Pinterest Ads",
    description: "Sync Pinterest campaign data including promoted pins, audience insights, and conversion metrics from Pinterest Ads Manager.",
    category: "advertising",
    authType: "oauth",
    oauthButtonLabel: "Connect with Pinterest",
    credentials: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Your Pinterest App Client ID", required: true, group: "setup" },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "••••••••", required: true, group: "setup", sensitive: true },
      { key: "ad_account_id", label: "Ad Account ID", type: "text", placeholder: "549755813", required: false, group: "setup" },
      { key: "access_token", label: "Access Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
      { key: "refresh_token", label: "Refresh Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
    ],
    dataCapabilities: ["spend", "impressions", "clicks", "conversions", "ctr", "cpm", "engagement"],
    iconColor: "#E60023",
    iconBg: "#FFEEF0",
    defaultSyncSchedule: "daily",
    oauthConfig: {
      authorizationUrl: "https://www.pinterest.com/oauth/",
      scopes: ["ads:read", "ads:write"],
      clientIdField: "client_id",
      extraParams: { response_type: "code" },
    },
  },

  {
    id: "criteo",
    name: "Criteo",
    description: "Import retargeting and upper-funnel campaign data including product-level ad performance and multi-touch attribution from Criteo.",
    category: "advertising",
    authType: "client_credentials",
    credentials: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Your Criteo Client ID", required: true },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "••••••••", required: true, sensitive: true },
      { key: "advertiser_id", label: "Advertiser ID", type: "text", placeholder: "123456", required: false },
    ],
    dataCapabilities: ["spend", "impressions", "clicks", "conversions", "roas", "ctr"],
    iconColor: "#F05022",
    iconBg: "#FFF0EC",
    defaultSyncSchedule: "daily",
  },

  {
    id: "applovin_axon",
    name: "Axon by AppLovin",
    shortName: "Axon / AppLovin",
    description: "Pull Axon performance marketing data including spend, ROAS, and incrementality lift signals from AppLovin's attribution platform.",
    category: "advertising",
    authType: "api_key",
    credentials: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "••••••••", required: true, sensitive: true, hint: "Found in AppLovin account → Reporting → Keys." },
      { key: "report_key", label: "Report Key", type: "text", placeholder: "Your AppLovin Report Key", required: false, hint: "Required for scheduled report access." },
    ],
    dataCapabilities: ["spend", "impressions", "clicks", "conversions", "roas", "ctr"],
    iconColor: "#FF5C00",
    iconBg: "#FFF3EE",
    defaultSyncSchedule: "daily",
  },

  {
    id: "amazon_ads",
    name: "Amazon Ads",
    description: "Sync Sponsored Products, Sponsored Brands, Sponsored Display, and DSP campaign data including keyword-level attribution.",
    category: "advertising",
    authType: "oauth",
    oauthButtonLabel: "Connect with Amazon",
    credentials: [
      { key: "client_id", label: "LWA Client ID", type: "text", placeholder: "amzn1.application-oa2-client.xxx", required: true, group: "setup", hint: "Login with Amazon client ID from your Amazon Developer account." },
      { key: "client_secret", label: "LWA Client Secret", type: "password", placeholder: "••••••••", required: true, group: "setup", sensitive: true },
      { key: "profile_ids", label: "Profile IDs", type: "text", placeholder: "123456789012, 987654321098", required: false, group: "setup", hint: "Comma-separated. Leave blank to import all accessible profiles." },
      { key: "access_token", label: "Access Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
      { key: "refresh_token", label: "Refresh Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
    ],
    dataCapabilities: ["spend", "impressions", "clicks", "conversions", "roas", "ctr", "cpc"],
    iconColor: "#FF9900",
    iconBg: "#FFF8EC",
    defaultSyncSchedule: "daily",
    oauthConfig: {
      authorizationUrl: "https://www.amazon.com/ap/oa",
      scopes: ["advertising::campaign_management"],
      clientIdField: "client_id",
      extraParams: { response_type: "code" },
    },
  },

  {
    id: "walmart_connect",
    name: "Walmart Connect",
    description: "Import Walmart sponsored search and display advertising performance data including on-site and off-site placements.",
    category: "advertising",
    authType: "client_credentials",
    credentials: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Your Walmart Connect Client ID", required: true },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "••••••••", required: true, sensitive: true },
      { key: "advertiser_id", label: "Advertiser ID", type: "text", placeholder: "12345", required: false },
    ],
    dataCapabilities: ["spend", "impressions", "clicks", "conversions", "roas"],
    iconColor: "#0071CE",
    iconBg: "#E8F4FF",
    defaultSyncSchedule: "daily",
  },

  {
    id: "target_roundel",
    name: "Target Roundel",
    description: "Pull Target Roundel media performance including on-site search, display, and off-site programmatic placement metrics.",
    category: "advertising",
    authType: "custom",
    credentials: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "••••••••", required: true, sensitive: true },
      { key: "partner_id", label: "Partner ID", type: "text", placeholder: "Your Roundel Partner ID", required: true },
      { key: "advertiser_id", label: "Advertiser ID", type: "text", placeholder: "12345", required: false },
    ],
    dataCapabilities: ["spend", "impressions", "clicks", "conversions", "roas"],
    iconColor: "#CC0000",
    iconBg: "#FFEEF0",
    defaultSyncSchedule: "daily",
  },

  {
    id: "ctv_programmatic",
    name: "CTV / Programmatic",
    description: "Connect your CTV or programmatic DSP (e.g. Trade Desk, Roku, Xandr) to track reach, frequency, brand lift, and cross-channel attribution.",
    category: "advertising",
    authType: "custom",
    badge: "Flexible",
    credentials: [
      { key: "platform_name", label: "Platform / DSP Name", type: "text", placeholder: "e.g. The Trade Desk, Roku OneView, Xandr", required: true, hint: "Name of the platform this connection represents." },
      { key: "api_key", label: "API Key", type: "password", placeholder: "••••••••", required: true, sensitive: true },
      { key: "seat_id", label: "Seat / Account ID", type: "text", placeholder: "Your seat or account identifier", required: false },
      { key: "api_endpoint", label: "API Base URL", type: "url", placeholder: "https://api.platform.com/v1", required: false, hint: "Custom base URL if required by your DSP." },
    ],
    dataCapabilities: ["spend", "impressions", "reach", "frequency", "video_views", "cpm"],
    iconColor: "#6D28D9",
    iconBg: "#F3F0FF",
    defaultSyncSchedule: "daily",
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ECOMMERCE / MARKETPLACE
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: "shopify",
    name: "Shopify",
    description: "Sync orders, revenue, products, customer profiles, refunds, and discount usage from your Shopify store in near real-time.",
    category: "ecommerce",
    authType: "oauth",
    oauthButtonLabel: "Connect with Shopify",
    credentials: [
      { key: "store_domain", label: "Store Domain", type: "text", placeholder: "yourstore.myshopify.com", required: true, group: "setup", hint: "Your Shopify store subdomain (do not include https://)." },
      { key: "api_key", label: "Client ID (API Key)", type: "text", placeholder: "your_shopify_client_id", required: true, group: "setup", hint: "From your Shopify Partners dashboard → App → Client credentials. Used as client_id in OAuth." },
      { key: "api_secret_key", label: "Client Secret (API Secret)", type: "password", placeholder: "••••••••", required: true, group: "setup", sensitive: true, hint: "From your Shopify Partners dashboard → App → Client credentials." },
      { key: "access_token", label: "Access Token", type: "password", placeholder: "shpat_xxxxxxxxxxxxxxx", required: false, group: "oauth_callback", sensitive: true },
    ],
    dataCapabilities: ["revenue", "orders", "products", "inventory", "conversions"],
    iconColor: "#96BF48",
    iconBg: "#F0F8E8",
    defaultSyncSchedule: "hourly",
    oauthConfig: {
      authorizationUrl: "https://{store_domain}/admin/oauth/authorize",
      scopes: ["read_orders", "write_orders", "read_products", "read_analytics", "read_inventory"],
      clientIdField: "api_key",
      dynamicUrlField: "store_domain",
      scopeSeparator: ",",
    },
  },

  {
    id: "amazon_seller",
    name: "Amazon Seller Central",
    shortName: "Amazon Seller",
    description: "Import Amazon marketplace sales, inventory levels, Buy Box performance, and FBA fulfillment data via the Selling Partner API (SP-API).",
    category: "ecommerce",
    authType: "oauth",
    oauthButtonLabel: "Connect with Seller Central",
    credentials: [
      { key: "client_id", label: "LWA Client ID", type: "text", placeholder: "amzn1.application-oa2-client.xxx", required: true, group: "setup" },
      { key: "client_secret", label: "LWA Client Secret", type: "password", placeholder: "••••••••", required: true, group: "setup", sensitive: true },
      { key: "seller_id", label: "Seller ID", type: "text", placeholder: "AXXXXXXXXXXXXXXXXX", required: true, group: "setup" },
      { key: "marketplace_ids", label: "Marketplace IDs", type: "text", placeholder: "ATVPDKIKX0DER", required: false, group: "setup", hint: "US marketplace: ATVPDKIKX0DER. Comma-separate for multiple." },
      { key: "refresh_token", label: "Refresh Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
    ],
    dataCapabilities: ["revenue", "orders", "products", "inventory"],
    iconColor: "#FF9900",
    iconBg: "#FFF8EC",
    defaultSyncSchedule: "daily",
    oauthConfig: {
      authorizationUrl: "https://sellercentral.amazon.com/apps/authorize/consent",
      scopes: [],
      clientIdField: "client_id",
      extraParams: { response_type: "code", version: "beta" },
    },
  },

  {
    id: "walmart_marketplace",
    name: "Walmart Marketplace",
    shortName: "Walmart Seller",
    description: "Sync Walmart Marketplace order data, inventory levels, seller performance metrics, and fulfillment status.",
    category: "ecommerce",
    authType: "client_credentials",
    credentials: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Your Walmart Developer Client ID", required: true },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "••••••••", required: true, sensitive: true },
    ],
    dataCapabilities: ["revenue", "orders", "inventory"],
    iconColor: "#0071CE",
    iconBg: "#E8F4FF",
    defaultSyncSchedule: "daily",
  },

  {
    id: "tiktok_shop",
    name: "TikTok Shop",
    description: "Import TikTok Shop order performance, product catalog, affiliate creator data, and live shopping metrics.",
    category: "ecommerce",
    authType: "oauth",
    oauthButtonLabel: "Connect with TikTok Shop",
    badge: "Beta",
    credentials: [
      { key: "app_key", label: "App Key", type: "text", placeholder: "Your TikTok Shop App Key", required: true, group: "setup" },
      { key: "app_secret", label: "App Secret", type: "password", placeholder: "••••••••", required: true, group: "setup", sensitive: true },
      { key: "access_token", label: "Access Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
      { key: "refresh_token", label: "Refresh Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
    ],
    dataCapabilities: ["revenue", "orders", "products", "conversions"],
    iconColor: "#010101",
    iconBg: "#F0F0F0",
    defaultSyncSchedule: "daily",
    oauthConfig: {
      authorizationUrl: "https://auth.tiktok-shops.com/oauth/authorize",
      scopes: ["seller.read.order", "seller.read.product", "seller.read.shop"],
      clientIdField: "app_key",
      extraParams: { response_type: "code" },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ANALYTICS / ATTRIBUTION
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: "google_analytics",
    name: "Google Analytics",
    shortName: "GA4",
    description: "Pull sessions, users, pageviews, events, conversions, and audience segments from Google Analytics 4 properties.",
    category: "analytics",
    authType: "oauth",
    oauthButtonLabel: "Connect with Google",
    credentials: [
      { key: "client_id", label: "OAuth Client ID", type: "text", placeholder: "123456789-xxxx.apps.googleusercontent.com", required: true, group: "setup" },
      { key: "client_secret", label: "OAuth Client Secret", type: "password", placeholder: "••••••••", required: true, group: "setup", sensitive: true },
      { key: "property_id", label: "GA4 Property ID", type: "text", placeholder: "123456789", required: true, group: "setup", hint: "Found in GA4 admin under Property Settings → Property Details." },
      { key: "access_token", label: "Access Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
      { key: "refresh_token", label: "Refresh Token", type: "password", placeholder: "Populated via OAuth", required: false, group: "oauth_callback", sensitive: true },
    ],
    dataCapabilities: ["sessions", "users", "pageviews", "bounce_rate", "conversions", "engagement"],
    iconColor: "#E37400",
    iconBg: "#FFF5E8",
    defaultSyncSchedule: "daily",
    oauthConfig: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
      clientIdField: "client_id",
      extraParams: { response_type: "code", access_type: "offline", prompt: "consent" },
    },
  },

  {
    id: "pattern_predict",
    name: "Pattern Predict",
    description: "Import Pattern's retail intelligence and demand forecasting signals including market share, share-of-search, and brand health metrics.",
    category: "analytics",
    authType: "api_key",
    credentials: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "••••••••", required: true, sensitive: true, hint: "Available in your Pattern Predict account settings." },
      { key: "org_id", label: "Organization ID", type: "text", placeholder: "Your Pattern org ID", required: false },
    ],
    dataCapabilities: ["revenue", "custom_data"],
    iconColor: "#3B82F6",
    iconBg: "#EFF6FF",
    defaultSyncSchedule: "daily",
  },

  {
    id: "alloy_ai",
    name: "Alloy AI",
    description: "Sync retail analytics and demand forecasting data including replenishment signals, POS sell-through, and out-of-stock alerts from Alloy AI.",
    category: "analytics",
    authType: "api_key",
    credentials: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "••••••••", required: true, sensitive: true },
      { key: "workspace_id", label: "Workspace ID", type: "text", placeholder: "Your Alloy workspace ID", required: false },
    ],
    dataCapabilities: ["revenue", "inventory", "custom_data"],
    iconColor: "#10B981",
    iconBg: "#ECFDF5",
    defaultSyncSchedule: "daily",
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  CRM / RETENTION / REVIEWS
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: "attentive",
    name: "Attentive Email",
    shortName: "Attentive",
    description: "Import SMS and email campaign performance, subscriber growth, revenue attribution, and list health metrics from Attentive.",
    category: "crm",
    authType: "api_key",
    credentials: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "••••••••", required: true, sensitive: true, hint: "Found in Attentive → Account → Integrations → API Keys." },
    ],
    dataCapabilities: ["subscribers", "open_rate", "click_rate", "revenue", "sms"],
    iconColor: "#5C2D91",
    iconBg: "#F5F0FF",
    defaultSyncSchedule: "daily",
  },

  {
    id: "stay_ai",
    name: "Stay.AI Subscriptions",
    shortName: "Stay.AI",
    description: "Sync subscription orders, active subscriber counts, churn rates, LTV cohorts, and cancellation reasons from Stay.AI.",
    category: "crm",
    authType: "api_key",
    credentials: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "••••••••", required: true, sensitive: true },
      { key: "shop_domain", label: "Shopify Shop Domain", type: "text", placeholder: "yourstore.myshopify.com", required: false },
    ],
    dataCapabilities: ["subscriptions", "revenue", "ltv", "orders"],
    iconColor: "#0EA5E9",
    iconBg: "#F0F9FF",
    defaultSyncSchedule: "daily",
  },

  {
    id: "yotpo",
    name: "Yotpo Reviews",
    shortName: "Yotpo",
    description: "Pull product reviews, star ratings, Q&A, UGC photos, loyalty points activity, and referral data from Yotpo.",
    category: "crm",
    authType: "api_key",
    credentials: [
      { key: "app_key", label: "App Key", type: "text", placeholder: "Your Yotpo App Key", required: true, hint: "Found in Yotpo → Account Settings → Store Configuration." },
      { key: "secret_key", label: "Secret Key", type: "password", placeholder: "••••••••", required: true, sensitive: true },
      { key: "store_id", label: "Store ID", type: "text", placeholder: "Optional if you have multiple stores", required: false },
    ],
    dataCapabilities: ["reviews", "ratings", "engagement"],
    iconColor: "#FF4500",
    iconBg: "#FFF2EE",
    defaultSyncSchedule: "daily",
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ERP / BACKEND SYSTEMS
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: "netsuite",
    name: "NetSuite",
    description: "Import financial statements, journal entries, COGS, inventory valuations, and operational metrics directly from your NetSuite ERP using Token-Based Authentication (TBA).",
    category: "erp",
    authType: "custom",
    credentials: [
      { key: "account_id", label: "Account ID", type: "text", placeholder: "1234567 or 1234567-SB1", required: true, hint: "Found in Setup → Company → Company Information. Sandbox accounts end in -SB1." },
      { key: "consumer_key", label: "Consumer Key", type: "text", placeholder: "Integration Consumer Key", required: true, hint: "From Setup → Integration → Manage Integrations." },
      { key: "consumer_secret", label: "Consumer Secret", type: "password", placeholder: "••••••••", required: true, sensitive: true },
      { key: "token_id", label: "Token ID", type: "text", placeholder: "Access Token ID", required: true, hint: "From Setup → Users/Roles → Access Tokens." },
      { key: "token_secret", label: "Token Secret", type: "password", placeholder: "••••••••", required: true, sensitive: true },
      { key: "subsidiary_id", label: "Subsidiary ID", type: "text", placeholder: "1", required: false, hint: "Required for multi-subsidiary OneWorld accounts." },
    ],
    dataCapabilities: ["financials", "journal_entries", "revenue", "orders", "inventory"],
    iconColor: "#1F8DD6",
    iconBg: "#E8F4FF",
    defaultSyncSchedule: "daily",
  },
];

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

export const REGISTRY_MAP = Object.fromEntries(
  INTEGRATION_REGISTRY.map((d) => [d.id, d]),
) as Record<string, IntegrationDef>;

export function getIntegration(id: string): IntegrationDef | undefined {
  return REGISTRY_MAP[id];
}

export function getByCategory(category: string): IntegrationDef[] {
  return INTEGRATION_REGISTRY.filter((d) => d.category === category);
}
