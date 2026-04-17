import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, BookOpen, Search, ChevronRight, ChevronDown,
  LayoutDashboard, Zap, BarChart2, TrendingUp, CalendarClock, Plug, Tag,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Block { type: "para" | "bullets"; text?: string; items?: string[] }
interface Article { title: string; desc: string; content: Block[] }
interface Category { category: string; Icon: React.ComponentType<{ size?: number; className?: string }>; items: Article[] }

// ─── Content ──────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    category: "Getting Started",
    Icon: LayoutDashboard,
    items: [
      {
        title: "Platform overview",
        desc: "What MONARCH is, who it's for, and how it fits into your workflow.",
        content: [
          { type: "para", text: "MONARCH is a marketing analytics and spend optimization platform built for DTC and omnichannel brands. It centralises performance data from all your ad channels and eCommerce stores into a single workspace, then applies Marketing Mix Modeling (MMM) to reveal which spending is actually driving incremental revenue — not just clicks." },
          { type: "para", text: "The platform is structured around six main areas:" },
          { type: "bullets", items: [
            "Overview — your daily command center: blended revenue, spend, MER, and channel health at a glance.",
            "Traffic — product-level and geographic performance, including a US state heat map.",
            "Spend Optimizer — MMM-powered budget allocation recommendations and a scenario simulator.",
            "Ad Attribution — channel-by-channel efficiency, signal detection, and funnel analysis.",
            "Performance Trends — daily trends, day-of-week seasonality, and anomaly detection.",
            "Forecast — projected revenue and spend with confidence intervals and scenario comparisons.",
          ]},
          { type: "para", text: "All views respect the global date range and store filter in the top bar, so every number you see is scoped to exactly the context you choose." },
        ],
      },
      {
        title: "Navigating the dashboards",
        desc: "A tour of each section and when to use it.",
        content: [
          { type: "para", text: "Use the left sidebar to move between dashboards. Each one answers a different question:" },
          { type: "bullets", items: [
            "Overview — 'How is the business performing right now?' Start here every morning. It surfaces MER, ROAS, and revenue trends so you can spot anything unusual before diving deeper.",
            "Traffic — 'Where are my customers coming from and what are they buying?' Use this for product strategy and geographic expansion decisions.",
            "Spend Optimizer — 'Am I spending in the right places?' Use this weekly to act on MMM recommendations and model hypothetical budget shifts.",
            "Ad Attribution — 'Which channels are working and which are showing warning signs?' Use this to investigate a specific channel or respond to a Signal alert.",
            "Performance Trends — 'Is this week actually better than last week, or is it just a seasonal spike?' Use this to separate signal from noise.",
            "Forecast — 'What revenue should I expect, and what happens if I increase spend?' Use this before budget planning cycles.",
          ]},
          { type: "para", text: "Settings → Integrations is where you connect new data sources. Settings → Financial lets you configure pricing mode (retail vs wholesale) which scales all revenue figures accordingly." },
        ],
      },
      {
        title: "Date ranges and store filters",
        desc: "How to scope every dashboard to the right time window and stores.",
        content: [
          { type: "para", text: "The date range picker and store selector in the top bar control every chart and table across the entire platform. Changes apply instantly without a page reload." },
          { type: "para", text: "Date range options include preset windows (last 7 / 14 / 30 / 90 days) and a custom date picker. You can also enable a comparison period — MONARCH will show prior-period metrics side-by-side and calculate the percentage change between the two windows." },
          { type: "para", text: "The store filter lets you select one or more stores. Leave it blank to see all stores aggregated. Selecting a subset is useful when you want to isolate performance for a specific brand or region without changing anything else." },
          { type: "para", text: "Tip: when investigating an anomaly, narrow the date range to the affected window and filter to the relevant store first — this keeps all downstream charts in sync automatically." },
        ],
      },
      {
        title: "Pricing mode: retail vs wholesale",
        desc: "How the pricing toggle affects all revenue figures across the platform.",
        content: [
          { type: "para", text: "MONARCH supports two revenue views: retail (consumer-facing price) and wholesale (cost to the retailer). You can switch between them in Settings → Financial → Pricing Mode, or via the toggle in the top bar." },
          { type: "para", text: "When wholesale mode is active, all revenue figures are scaled by your configured wholesale multiplier. This lets teams report on contribution margin-aligned metrics rather than gross revenue, which can produce a more accurate picture of ROAS and MER for B2B or retail-distributed products." },
          { type: "para", text: "Every chart, table, and KPI card respects the active pricing mode — you never need to manually adjust numbers. The mode indicator is always visible in the top bar so there is no ambiguity about which view you are looking at." },
        ],
      },
    ],
  },

  {
    category: "Metrics Glossary",
    Icon: Tag,
    items: [
      {
        title: "Revenue, ROAS, and MER",
        desc: "The three top-line efficiency metrics you'll see everywhere.",
        content: [
          { type: "para", text: "Revenue is the total transaction value from your connected stores within the selected date range. Depending on pricing mode it reflects either retail or wholesale value." },
          { type: "para", text: "ROAS (Return On Ad Spend) = Revenue ÷ Ad Spend. A ROAS of 4× means every $1 of ad spend generated $4 in revenue. ROAS is channel-level: each channel (Google Ads, Meta, TikTok, etc.) has its own ROAS calculated from its attributed revenue." },
          { type: "para", text: "MER (Marketing Efficiency Ratio) = Total Revenue ÷ Total Ad Spend across all channels. MER is your blended portfolio number — it tells you how efficient the entire marketing program is, regardless of how individual channels are attributed. Because it requires no attribution model, MER is considered a more trustworthy top-line efficiency signal than any individual channel's ROAS." },
          { type: "para", text: "A rising MER with flat or declining spend means your marketing is becoming more efficient. A falling MER while spend is increasing is the first warning sign of saturation or creative fatigue." },
        ],
      },
      {
        title: "CTR, CVR, CPC, CPM, CPA, and CAC",
        desc: "Engagement and conversion metrics explained.",
        content: [
          { type: "para", text: "These six metrics describe the customer journey from impression to purchase:" },
          { type: "bullets", items: [
            "CTR (Click-Through Rate) = Clicks ÷ Impressions × 100. Measures ad engagement. A falling CTR on the same creative usually signals ad fatigue — the audience has seen it too many times.",
            "CVR (Conversion Rate) = Conversions ÷ Clicks × 100. Measures landing page and checkout effectiveness. If CTR is healthy but CVR is declining, the problem is on-site, not in the ad.",
            "CPC (Cost Per Click) = Spend ÷ Clicks. Rising CPC on a stable CTR means auction competition is increasing (others are bidding more aggressively).",
            "CPM (Cost Per Mille) = Spend ÷ (Impressions ÷ 1,000). The cost to reach 1,000 people. Use CPM to compare audience reach cost across channels.",
            "CPA (Cost Per Acquisition) = Spend ÷ Conversions. How much you paid for each converted customer. CPA rising while spend is flat means conversion rates are declining.",
            "CAC (Customer Acquisition Cost) is used interchangeably with CPA in MONARCH — it represents the total spend divided by total conversions across a period.",
          ]},
        ],
      },
      {
        title: "Incrementality and iROAS",
        desc: "Understanding which revenue your ads actually caused.",
        content: [
          { type: "para", text: "Incrementality answers the question: 'Would this sale have happened even without the ad?' Conventional attribution models (last-click, first-click, linear) assign credit to whichever ad touched the customer — but they can't distinguish between ads that caused a purchase and ads that merely appeared in front of someone who was already going to buy." },
          { type: "para", text: "MONARCH's MMM separates revenue into two components:" },
          { type: "bullets", items: [
            "Baseline revenue — organic revenue that would occur with zero advertising (repeat customers, direct traffic, brand equity).",
            "Incremental revenue — the additional revenue causally attributable to ad spend.",
          ]},
          { type: "para", text: "iROAS (Incremental ROAS) = Incremental Revenue ÷ Ad Spend. A channel can have a high reported ROAS (lots of last-click credit) but a low iROAS (most of those customers would have converted anyway). Channels with high iROAS and low conventional ROAS are often undervalued — they drive genuine uplift that attribution dashboards miss." },
          { type: "para", text: "iROAS is shown with 95% confidence intervals in the Channel Deep Dive table on the Spend Optimizer. A wide interval means the model has low certainty — usually due to insufficient data or high spend volatility. Narrow intervals indicate the estimate is reliable." },
        ],
      },
      {
        title: "Adstock and carryover effects",
        desc: "Why last week's spend still matters today.",
        content: [
          { type: "para", text: "Adstock (also called carryover) describes the phenomenon where advertising spend in one period continues to influence consumer behaviour in future periods. Someone who saw your ad on Monday may not buy until Thursday. TV and video formats have longer adstock windows than search, which is transactional and nearly immediate." },
          { type: "para", text: "MONARCH's MMM models adstock for each channel using two parameters:" },
          { type: "bullets", items: [
            "Adstock Decay (0–1) — the fraction of the prior period's adstock retained each week. A decay of 0.5 means half of last week's advertising effect carries forward. Lower decay = shorter memory (search, shopping). Higher decay = longer memory (video, display, influencer).",
            "Peak Lag Days — how many days after the spend the maximum revenue effect is realised. Search often peaks at 0–1 days. Brand campaigns can peak 7–14 days later.",
          ]},
          { type: "para", text: "Understanding adstock prevents a common mistake: cutting a channel's budget and then crediting that channel for a drop in revenue that was actually just the carryover from previous weeks wearing off. MONARCH accounts for adstock when calculating incrementality, so budget decisions are based on true causal impact rather than coincidental timing." },
        ],
      },
      {
        title: "Saturation, diminishing returns, and marginal ROAS",
        desc: "Why spending more doesn't always return more.",
        content: [
          { type: "para", text: "Every advertising channel has a saturation point beyond which each additional dollar generates progressively less revenue. This is the law of diminishing returns. MONARCH models each channel's saturation curve using the Hill function — a standard S-curve model in econometrics." },
          { type: "para", text: "The Saturation Status field in the Channel Deep Dive table summarises where a channel sits on its curve:" },
          { type: "bullets", items: [
            "Under-invested — spend is in the steep part of the curve; incremental revenue per dollar is high. Strong case for increasing budget.",
            "Efficient — spend is near the optimal point where marginal returns are still strong but the curve is beginning to flatten.",
            "Saturated — spend is past the inflection point; marginal returns are noticeably declining but still positive.",
            "Over-invested — deep into the flat portion of the curve; the next dollar of spend is returning very little incremental revenue.",
          ]},
          { type: "para", text: "Marginal ROAS is the iROAS of the next incremental dollar at current spend levels. It is more actionable than average iROAS because it tells you what you will get from increasing spend today — not what you have historically gotten overall. A channel showing a 6× average iROAS but a 1.2× marginal ROAS is a channel you should not be adding budget to." },
        ],
      },
      {
        title: "Model quality: R², MAPE, and confidence levels",
        desc: "How to read model reliability indicators.",
        content: [
          { type: "para", text: "Every MMM result in the Channel Deep Dive table carries model quality indicators. These tell you how much to trust the numbers:" },
          { type: "bullets", items: [
            "R² (R-Squared, 0–1) — the proportion of revenue variance explained by the model. R² of 0.90 means 90% of the revenue variation over the period is accounted for by the modelled factors. Below 0.75 suggests the model may be missing important variables.",
            "MAPE (Mean Absolute Percentage Error) — the average percentage difference between model predictions and actual revenue. MAPE below 10% is generally considered a high-quality fit. Above 20% indicates the model's predictions should be treated cautiously.",
            "Confidence Level (High / Medium / Low) — a human-readable summary based on R², MAPE, and data volume. Low confidence usually means a channel has too few weeks of data or extremely volatile spend patterns.",
          ]},
          { type: "para", text: "A Low confidence rating does not mean you should ignore the channel — it means you should run more controlled spend experiments to generate cleaner data for the next model update." },
        ],
      },
    ],
  },

  {
    category: "Spend Optimizer",
    Icon: Zap,
    items: [
      {
        title: "How Marketing Mix Modeling works in MONARCH",
        desc: "The methodology behind the budget recommendations.",
        content: [
          { type: "para", text: "Marketing Mix Modeling (MMM) is a statistical technique that uses your historical spend and revenue data to quantify the causal contribution of each channel. Unlike click-based attribution, MMM doesn't rely on tracking pixels or cookies — it uses econometric regression to separate the effect of advertising from organic trends, seasonality, and external factors." },
          { type: "para", text: "MONARCH's MMM pipeline works as follows:" },
          { type: "bullets", items: [
            "Data ingestion — daily spend per channel and daily revenue per store are pulled from your connected integrations.",
            "Transformations — spend is transformed by each channel's adstock decay and saturation (Hill) curve before entering the regression.",
            "Decomposition — the regression allocates total revenue into a baseline component (what would happen with zero ads) and incremental components (one per channel).",
            "Optimisation — given the fitted curves, MONARCH finds the budget allocation that maximises projected revenue at your current or specified total spend budget.",
          ]},
          { type: "para", text: "The model is re-estimated as new data comes in. Model quality is assessed by R² and MAPE — you can see both in the Channel Deep Dive table. The scenario simulator uses the fitted curves to project outcomes in real time as you adjust spend sliders." },
        ],
      },
      {
        title: "Reading budget allocation recommendations",
        desc: "What the current vs recommended view is telling you.",
        content: [
          { type: "para", text: "The Budget Allocation panel shows two sets of bars side by side: your current spend distribution across channels and the MMM-recommended distribution that would maximise revenue at the same total spend level." },
          { type: "para", text: "The Revenue Decomposition chart beneath it breaks total revenue into the baseline (organic) portion and the incremental contribution from each channel. This is the most direct visualisation of which channels are actually causing revenue." },
          { type: "para", text: "The Reallocation Upside figure at the top is MONARCH's estimate of the additional revenue you would generate simply by shifting budget from over-invested channels to under-invested ones — without spending any more in total." },
          { type: "para", text: "Each channel's recommendation card shows the direction (increase / decrease / maintain), the expected revenue delta in dollars, and the expected efficiency delta in ROAS points. Prioritise acting on recommendations that combine a large revenue upside with a High confidence rating." },
        ],
      },
      {
        title: "Using the scenario simulator",
        desc: "How to model what-if budget changes before committing.",
        content: [
          { type: "para", text: "The Scenario Simulator lets you drag spend sliders for each channel and see the projected revenue and MER impact in real time, using the fitted saturation curves from the MMM." },
          { type: "para", text: "Each channel slider adjusts spend between 50% and 200% of the current level. The total budget is shown at the top and updates dynamically as you move sliders — this helps you check that reallocation scenarios stay within your overall budget constraint." },
          { type: "para", text: "Lock individual channels by clicking the lock icon before running an optimisation. Locked channels are held at their current spend and the optimizer only redistributes budget among the remaining unlocked channels. This is useful when a channel has a contractual minimum or when you want to model 'what if I double Meta spend?' without changing everything else." },
          { type: "para", text: "The simulator is forward-looking: it uses the current saturation curve parameters. If the model was last run on older data, the curves may not fully capture recent market shifts. Use it for directional guidance rather than precise revenue guarantees." },
        ],
      },
      {
        title: "Channel saturation status",
        desc: "Under-invested, Efficient, Saturated, Over-invested — what each means.",
        content: [
          { type: "para", text: "The Saturation Status column in the Channel Deep Dive table classifies each channel based on where its current spend sits on the fitted Hill response curve:" },
          { type: "bullets", items: [
            "Under-invested (green) — the channel is in the steep linear phase of its curve. Marginal ROAS is high. This is a strong signal to allocate more budget here.",
            "Efficient (blue) — the channel is near the optimal point. Marginal returns are still solid but the curve is beginning to flatten. Maintain or modestly increase.",
            "Saturated (yellow) — spend has passed the inflection point. Each additional dollar returns noticeably less. Consider holding spend flat and improving creative quality to shift the curve.",
            "Over-invested (red) — spend is deep into the flat region. Marginal ROAS may be below 1×. A reduction in spend here frees up budget for under-invested channels without a proportional revenue loss.",
          ]},
          { type: "para", text: "Saturation Level (0–100%) provides a more granular reading: 0% is at the very bottom of the curve, 100% is at the theoretical ceiling. A channel at 85%+ saturation level is a strong candidate for budget reduction unless you are deliberately investing for brand equity rather than short-term ROAS." },
        ],
      },
    ],
  },

  {
    category: "Ad Attribution",
    Icon: BarChart2,
    items: [
      {
        title: "The attribution dashboard: channel table and KPIs",
        desc: "How to read the efficiency table and blended metric cards.",
        content: [
          { type: "para", text: "The Ad Attribution page surfaces paid media performance across every connected channel. The four KPI cards at the top — Total Spend, Total Revenue, CTR, and Conversion Rate — give you a blended portfolio view for the selected period, with a percentage change vs the comparison period shown beneath each." },
          { type: "para", text: "The Core Efficiency Table lists each channel as a row with the following default columns: Spend, Revenue, Conversions, CTR, CVR, ROAS, and CPA. Additional columns (Clicks, CPC, CPM, Frequency, Impressions) can be toggled on using the column selector. All columns are sortable." },
          { type: "para", text: "Use the channel selector above the table to focus on specific channels. Selecting a subset also filters the Funnel Analysis and the Daily ROAS Trend chart so everything stays in context." },
          { type: "para", text: "The Advanced Intelligence table (below the core table) adds deeper metrics: Elasticity (0–1, how scalable the channel is), Incremental Lift % (fraction of revenue truly driven by the channel's ads), Impressions Per Click (engagement efficiency), and Efficiency Decay % (how fast saturation is degrading performance)." },
        ],
      },
      {
        title: "Signal detection: understanding alerts",
        desc: "What ad fatigue, CTR decline, rising CPA, and ROAS decline mean and how to respond.",
        content: [
          { type: "para", text: "The Signal Detector automatically scans your channel data for early warning patterns and surfaces alerts with a severity level (Warning or Critical). Responding to signals early prevents small problems from becoming expensive ones." },
          { type: "bullets", items: [
            "Ad Fatigue — triggered when Frequency is rising faster than CTR can keep up. Audiences have been overexposed to the same creative. Action: rotate in new creative variants immediately.",
            "CTR Decline — triggered when click-through rate is trending down over multiple consecutive days. May indicate creative staleness, audience mismatch, or increased auction competition. Action: audit creative freshness and audience targeting.",
            "Rising CPA — triggered when cost per acquisition is increasing trend. Could be driven by worsening CVR, rising CPCs, or both. Action: check landing page performance and bid strategy.",
            "ROAS Decline — triggered when channel ROAS is trending down over the analysis window. A broad signal that can have multiple causes. Use the Funnel view and Efficiency Decay metric to narrow down the root cause.",
          ]},
          { type: "para", text: "Each alert card includes a plain-language explanation of what was detected, a severity badge, and a suggested action. Critical alerts should be investigated on the same day; Warning alerts should be reviewed within 48 hours." },
        ],
      },
      {
        title: "Funnel analysis",
        desc: "Reading the impression → click → conversion waterfall by channel.",
        content: [
          { type: "para", text: "The Funnel view shows the conversion waterfall for each selected channel: Impressions → Clicks → Conversions. Each stage displays both the absolute volume and the rate (CTR for the first drop-off, CVR for the second)." },
          { type: "para", text: "The funnel also highlights the 'largest drop-off stage' — the step where the biggest proportional audience is lost. This is actionable: if impressions are high but CTR is the primary drop-off, the ad creative is the bottleneck. If CTR is strong but CVR is the primary drop-off, the landing page or checkout is the bottleneck." },
          { type: "para", text: "Compare funnels across channels to understand structural differences. Search channels typically show narrow funnels (high CTR, moderate CVR) because intent is high. Awareness channels like video show wide funnels (low CTR, variable CVR) because you are reaching audiences earlier in the buying journey." },
        ],
      },
    ],
  },

  {
    category: "Performance & Forecasting",
    Icon: TrendingUp,
    items: [
      {
        title: "Reading performance trends and moving averages",
        desc: "How to separate real trend changes from daily noise.",
        content: [
          { type: "para", text: "The Performance Trends page shows daily time series for revenue vs spend and for per-channel efficiency metrics (ROAS, CPC, CTR, CVR, CPM, CPA, CAC, AOV). The date range selector controls the window." },
          { type: "para", text: "Raw daily data is noisy — a single high-revenue Saturday can visually dominate a chart and make it look like performance improved when it was simply a day-of-week effect. Two optional moving average overlays help cut through this:" },
          { type: "bullets", items: [
            "MA7 (7-day moving average) — smooths out weekly cycles. Use this as your primary trend signal. If MA7 is trending up, performance is genuinely improving.",
            "MA30 (30-day moving average) — smooths out most seasonal variation. Use this to judge longer-term trajectory and to see whether recent MA7 changes represent a true break from the longer trend.",
          ]},
          { type: "para", text: "Channel signal badges (Improving / Declining / Stable) in the chart legend are calculated from the slope of the MA7 line over the visible window. They update automatically as you change the date range." },
        ],
      },
      {
        title: "Day-of-week seasonality",
        desc: "Understanding which days consistently perform best and worst.",
        content: [
          { type: "para", text: "The Day-of-Week Seasonality panel shows average daily revenue and spend indexed by weekday across the full selected period. This surfaces recurring patterns that are invisible in daily charts." },
          { type: "para", text: "MONARCH labels the best day and slowest day automatically. Common patterns in DTC:" },
          { type: "bullets", items: [
            "Weekend revenue peaks (Saturday/Sunday) are typical for lifestyle and fashion brands as consumers browse and shop in leisure time.",
            "Mid-week peaks (Tuesday/Wednesday) are common for B2B-adjacent products or subscription-driven categories where purchase decisions are made during the work week.",
            "Monday dips are nearly universal — consumers are re-entering the work week and purchase intent is typically lower.",
          ]},
          { type: "para", text: "Use day-of-week patterns when evaluating period-over-period comparisons. A 7-day comparison aligns the same weekdays; a 28-day (4-week) comparison is even more reliable. Avoid comparing a Monday–Sunday period to a Wednesday–Tuesday period — the day-mix difference alone will distort the numbers." },
        ],
      },
      {
        title: "Anomaly detection and signal intelligence",
        desc: "How MONARCH flags statistical outliers in your performance data.",
        content: [
          { type: "para", text: "The Signal Intelligence panel on the Performance Trends page identifies days where ROAS deviated more than 40% from the period average for a given channel. These are the days worth investigating." },
          { type: "para", text: "Each anomaly entry shows: the date, the channel, the actual ROAS that day, the period average ROAS, and the deviation percentage. Anomalies are sorted by magnitude so the most extreme events are at the top." },
          { type: "para", text: "Positive anomalies (ROAS spike) and negative anomalies (ROAS crash) are both worth understanding. Common causes:" },
          { type: "bullets", items: [
            "Positive spike — a viral post, PR mention, or a competitor's outage driving demand to you; a highly effective creative launching; a flash sale.",
            "Negative crash — an ad account getting flagged or paused; a landing page going down; a sudden CPM spike in the auction; a creative that resonated negatively.",
          ]},
          { type: "para", text: "Cross-referencing the anomaly date with the Activity Feed in the Overview dashboard will often surface a connected event (campaign change, product launch, etc.)." },
        ],
      },
      {
        title: "Forecasts and scenario planning",
        desc: "Understanding projected revenue, confidence intervals, and the three spend scenarios.",
        content: [
          { type: "para", text: "The Forecast page projects revenue and spend forward based on historical trends, day-of-week seasonality, and the MMM saturation curves. The shaded band around the projection line represents the 80% confidence interval — the range within which actual revenue is expected to fall in 4 out of 5 cases." },
          { type: "para", text: "A wide confidence band means the model has high uncertainty, usually because revenue has been volatile or the forecast window is long. A narrow band indicates the model has high conviction based on consistent historical patterns." },
          { type: "para", text: "Three pre-built scenarios are shown for comparison:" },
          { type: "bullets", items: [
            "Conservative — assumes spend stays flat or decreases modestly. Lower revenue ceiling, lower risk.",
            "Recommended — applies the MMM-optimal budget allocation. Best expected revenue at current total spend.",
            "Aggressive — assumes a meaningful spend increase with budget reallocation toward under-invested channels. Higher ceiling, higher spend requirement.",
          ]},
          { type: "para", text: "The Confidence % KPI card at the top summarises the overall model reliability for the forecast period. Use forecasts directionally for budget planning — treat the recommended scenario as the best estimate, not a guarantee." },
        ],
      },
    ],
  },

  {
    category: "Integrations",
    Icon: Plug,
    items: [
      {
        title: "Connecting Google Ads",
        desc: "How to link your Google Ads account via OAuth.",
        content: [
          { type: "para", text: "Google Ads is connected via OAuth — MONARCH uses your Google account permissions to pull campaign and spend data without ever storing your login credentials." },
          { type: "para", text: "Steps to connect:" },
          { type: "bullets", items: [
            "Go to Settings → Integrations and find the Google Ads card under Advertising.",
            "Click 'Connect with Google'. You will be redirected to Google's consent screen.",
            "Sign in with the Google account that has access to your Google Ads account and approve the requested permissions (read-only access to your ad data).",
            "You will be redirected back to MONARCH with a success confirmation.",
            "Back on the Google Ads card, enter your Developer Token and Customer ID in the fields provided, then click Save.",
          ]},
          { type: "para", text: "Developer Token: found in your Google Ads account under Tools & Settings → API Center. Customer ID: the 10-digit account ID shown at the top of your Google Ads dashboard (format: 123-456-7890)." },
          { type: "para", text: "Once connected, Google Ads spend and conversion data will begin populating within 24 hours as MONARCH ingests the historical data window." },
        ],
      },
      {
        title: "Connecting Meta Ads",
        desc: "How to link your Facebook and Instagram ad account.",
        content: [
          { type: "para", text: "Meta Ads is connected via Facebook OAuth. MONARCH requests read-only access to your ad account data — it cannot create, modify, or delete campaigns." },
          { type: "para", text: "Steps to connect:" },
          { type: "bullets", items: [
            "Go to Settings → Integrations and find the Meta Ads card under Advertising.",
            "Click 'Connect with Meta'. You will be redirected to Facebook's permission screen.",
            "Log in with the Facebook account that is an Admin on your Business Manager and approve ads_read and ads_management permissions.",
            "You will be redirected back to MONARCH. MONARCH automatically exchanges the short-lived token for a long-lived token (valid for 60 days) and stores it securely.",
            "Enter your Ad Account ID in the field on the card (format: act_xxxx) and click Save.",
          ]},
          { type: "para", text: "Ad Account ID: found in Meta Business Suite → Business Settings → Ad Accounts, or in the URL of Ads Manager (the number after act_)." },
          { type: "para", text: "The Meta token expires after 60 days. MONARCH will show a reconnection prompt when it detects an expired token — simply click Reconnect on the card to repeat the OAuth flow." },
        ],
      },
      {
        title: "Connecting Shopify",
        desc: "How to link your Shopify store for revenue and order data.",
        content: [
          { type: "para", text: "Shopify is connected via Shopify's official OAuth flow. MONARCH requests read-only scopes: orders, products, analytics, inventory, and customers." },
          { type: "para", text: "Steps to connect:" },
          { type: "bullets", items: [
            "Go to Settings → Integrations and find the Shopify card under eCommerce.",
            "Click 'Connect Shopify'. A modal will ask for your store URL.",
            "Enter your store URL in the format mystore.myshopify.com and click Authorize with Shopify.",
            "You will be redirected to Shopify to review and approve the permissions, then returned to MONARCH.",
          ]},
          { type: "para", text: "Once connected, MONARCH begins pulling order and session data. Revenue figures across all dashboards will reflect Shopify orders within the selected date range. If you have multiple Shopify stores, connect each one separately — they will appear as individual store options in the store filter." },
        ],
      },
      {
        title: "Other integrations: TikTok, Pinterest, Walmart, and more",
        desc: "What else you can connect and how.",
        content: [
          { type: "para", text: "MONARCH supports connections to a wide range of ad platforms and data sources beyond Google and Meta. All are accessible from Settings → Integrations." },
          { type: "bullets", items: [
            "TikTok Ads — connect with an Access Token and Advertiser ID from your TikTok for Business account.",
            "Pinterest Ads — connect with an Access Token and Ad Account ID from Pinterest Business.",
            "TikTok Shop — connect your TikTok storefront for eCommerce revenue tracking alongside ad performance.",
            "Walmart Marketplace — connect with Client ID and Client Secret from your Walmart Seller Centre.",
            "Target Roundel — connect with an API Key and Advertiser ID for Target media network data.",
            "Criteo — connect with Client ID and Client Secret for retargeting campaign data.",
            "Axon by AppLovin — connect with an API Key for mobile and CTV advertising data.",
            "Google Analytics — connect for traffic, session, and behaviour data to complement ad platform metrics.",
            "Google Sheets — link one or more Google Sheets as manual data export destinations.",
            "Stay.AI — connect for subscription retention analytics.",
            "Yotpo — connect for reviews, loyalty, and SMS data.",
          ]},
          { type: "para", text: "For integrations that require manual API keys rather than OAuth, enter the credentials directly in the fields on each card. Credentials are stored encrypted. You can disconnect any integration at any time from the same card." },
        ],
      },
    ],
  },

  {
    category: "Settings & Administration",
    Icon: CalendarClock,
    items: [
      {
        title: "Team management and access roles",
        desc: "How roles control what team members can see and change.",
        content: [
          { type: "para", text: "MONARCH has three access roles:" },
          { type: "bullets", items: [
            "Owner — full access to all dashboards, settings, integrations, and team management. Can invite and remove team members and change roles.",
            "Admin — full access to dashboards and integrations. Can invite members but cannot remove the Owner.",
            "User — read-only access to all dashboards. Cannot change settings, connect integrations, or invite team members. All settings pages show a read-only banner.",
          ]},
          { type: "para", text: "To invite a team member: Settings → Team → Invite Member. Enter their email address and select a role. They will receive an email invitation and can set their own password on first login." },
          { type: "para", text: "Role changes take effect immediately. If you need to temporarily restrict access (e.g. during a security review), changing a user to User role is the fastest way to prevent any data modification without removing them entirely." },
        ],
      },
      {
        title: "Forecast settings and model parameters",
        desc: "How to tune the forecast model for your business.",
        content: [
          { type: "para", text: "Settings → Forecast Settings lets Admins and Owners adjust the parameters that control how MONARCH's forecast model behaves:" },
          { type: "bullets", items: [
            "Forecast horizon — how many days forward to project. Longer horizons produce wider confidence bands.",
            "Seasonality strength — how much weight the model places on recurring seasonal patterns vs recent trend. Increase for businesses with strong seasonal cycles (holiday, back-to-school). Decrease for businesses with highly unpredictable demand.",
            "Training window — how many days of historical data to include in the model fit. Longer windows capture more seasonality but may underweight recent market changes.",
          ]},
          { type: "para", text: "Changes to forecast settings do not apply retroactively to historical data — they affect the next forecast run only. After changing settings, allow up to 24 hours for the updated forecast to appear on the Forecast page." },
        ],
      },
      {
        title: "Notification preferences",
        desc: "Setting up alerts for signals and performance thresholds.",
        content: [
          { type: "para", text: "Settings → Notifications lets you configure which events trigger email or in-app alerts. Available notification types include:" },
          { type: "bullets", items: [
            "Signal alerts — notified when the Signal Detector identifies a new Critical or Warning condition (Ad Fatigue, CTR Decline, Rising CPA, ROAS Decline).",
            "Weekly performance summary — a digest of the prior week's key metrics and any notable changes.",
            "Forecast updates — notified when a new forecast run completes.",
            "Integration status — notified when an integration connection expires or fails (e.g. a Meta token expiry).",
          ]},
          { type: "para", text: "Signal alerts are the highest-value notification to enable. Getting a Critical signal alert on the same day it is detected — rather than discovering it during a weekly review — can save significant wasted spend." },
        ],
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function KnowledgeHub() {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/monarch-logo.jpg" : "/monarch-logo-light.jpg";

  const [query,    setQuery]    = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (key: string) => setExpanded(prev => prev === key ? null : key);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.map(cat => ({
      ...cat,
      items: cat.items.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.desc.toLowerCase().includes(q) ||
        a.content.some(b =>
          b.text?.toLowerCase().includes(q) ||
          b.items?.some(i => i.toLowerCase().includes(q))
        )
      ),
    })).filter(cat => cat.items.length > 0);
  }, [query]);

  const totalArticles = CATEGORIES.reduce((n, c) => n + c.items.length, 0);

  return (
    <div className="min-h-screen bg-[#FFF9F2] dark:bg-[#120d06]">
      {/* Top nav */}
      <div className="border-b border-[#FFBC80]/30 dark:border-[#FFBC80]/20 px-8 py-4 bg-[#FFF9F2]/80 dark:bg-[#1a1208]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/overview" asChild>
            <button className="flex items-center gap-2 text-sm text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors font-medium">
              <ArrowLeft size={16} />Back to Dashboard
            </button>
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="Monarch" className="w-7 h-7 rounded-md object-cover object-center" />
            <span className="font-black text-sm tracking-widest text-[#3A3A3A] dark:text-[#FFF9F2]">MONARCH</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5" style={{ background: "linear-gradient(135deg,#FFBC80,#FFE29A)" }}>
            <BookOpen size={24} className="text-[#3A3A3A]" />
          </div>
          <h1 className="text-3xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">Knowledge Hub</h1>
          <p className="text-sm text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 max-w-md mx-auto">
            {totalArticles} articles covering every feature, metric, and workflow in MONARCH.
          </p>
          <div className="mt-5 relative max-w-md mx-auto">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={e => { setQuery(e.target.value); setExpanded(null); }}
              placeholder="Search articles…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-[#231a0e] text-[#3A3A3A] dark:text-[#FFF9F2] placeholder-[#3A3A3A]/40 dark:placeholder-[#FFF9F2]/30 outline-none border border-[#FFBC80]/60 focus:border-[#FFBC80] transition-colors"
            />
          </div>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 text-sm">
            No articles match "{query}".
          </div>
        ) : (
          <div className="space-y-10">
            {filtered.map(cat => {
              const CatIcon = cat.Icon;
              return (
                <div key={cat.category}>
                  <div className="flex items-center gap-2 mb-3">
                    <CatIcon size={13} className="text-[#FFBC80]" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#FFBC80]">{cat.category}</h2>
                    <span className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">{cat.items.length} articles</span>
                  </div>
                  <div className="space-y-1.5">
                    {cat.items.map(article => {
                      const key   = `${cat.category}::${article.title}`;
                      const open  = expanded === key;
                      return (
                        <div key={key} className="rounded-xl monarch-card-settings overflow-hidden">
                          <button
                            onClick={() => toggle(key)}
                            className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-4 group"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] group-hover:text-[#FFBC80] transition-colors leading-snug">{article.title}</p>
                              {!open && <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5 leading-snug">{article.desc}</p>}
                            </div>
                            <div className="shrink-0 text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25 group-hover:text-[#FFBC80] transition-colors">
                              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>
                          </button>

                          {open && (
                            <div className="px-4 pb-5 border-t border-[#FFBC80]/15 dark:border-[#FFBC80]/10 pt-4 space-y-3">
                              {article.content.map((block, i) =>
                                block.type === "para" ? (
                                  <p key={i} className="text-sm text-[#3A3A3A]/75 dark:text-[#FFF9F2]/65 leading-relaxed">{block.text}</p>
                                ) : (
                                  <ul key={i} className="space-y-1.5 pl-1">
                                    {block.items!.map((item, j) => (
                                      <li key={j} className="flex gap-2.5 text-sm text-[#3A3A3A]/75 dark:text-[#FFF9F2]/65 leading-relaxed">
                                        <span className="text-[#FFBC80] font-bold mt-0.5 shrink-0">·</span>
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
