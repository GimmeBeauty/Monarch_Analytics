import { Router } from "express";

const router = Router();

function generateTimeSeries(days: number, baseValue: number, variance: number) {
  const points = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const value = baseValue + (Math.random() - 0.5) * variance;
    const compareValue = value * (0.85 + Math.random() * 0.3);
    points.push({
      date: date.toISOString().split("T")[0],
      value: Math.round(value * 100) / 100,
      compareValue: Math.round(compareValue * 100) / 100,
    });
  }
  return points;
}

router.get("/overview", (req, res) => {
  res.json({
    metrics: [
      { label: "Total Revenue", value: "$142,850", change: 12.4, changeLabel: "vs last period", trend: "up" },
      { label: "Total Sessions", value: "284,320", change: 8.7, changeLabel: "vs last period", trend: "up" },
      { label: "Conversion Rate", value: "3.24%", change: -0.8, changeLabel: "vs last period", trend: "down" },
      { label: "Total Ad Spend", value: "$38,450", change: 5.2, changeLabel: "vs last period", trend: "up" },
      { label: "ROAS", value: "3.71x", change: 6.9, changeLabel: "vs last period", trend: "up" },
      { label: "Avg. CPA", value: "$24.30", change: -3.1, changeLabel: "vs last period", trend: "up" },
    ],
    revenueTimeSeries: generateTimeSeries(30, 4500, 1800),
    conversionTimeSeries: generateTimeSeries(30, 3.2, 1.2),
    topChannels: [
      { channel: "Google Ads", revenue: 58400, share: 40.9 },
      { channel: "Meta Ads", revenue: 42100, share: 29.5 },
      { channel: "Email", revenue: 21300, share: 14.9 },
      { channel: "Organic", revenue: 14200, share: 9.9 },
      { channel: "Referral", revenue: 6850, share: 4.8 },
    ],
  });
});

router.get("/traffic", (req, res) => {
  res.json({
    metrics: [
      { label: "Total Sessions", value: "284,320", change: 8.7, changeLabel: "vs last period", trend: "up" },
      { label: "Unique Visitors", value: "198,450", change: 11.2, changeLabel: "vs last period", trend: "up" },
      { label: "Pageviews", value: "731,820", change: 7.4, changeLabel: "vs last period", trend: "up" },
      { label: "Bounce Rate", value: "42.3%", change: -2.1, changeLabel: "vs last period", trend: "up" },
      { label: "Avg. Session Duration", value: "3m 42s", change: 4.5, changeLabel: "vs last period", trend: "up" },
      { label: "Pages per Session", value: "2.57", change: -0.3, changeLabel: "vs last period", trend: "down" },
    ],
    sessionTimeSeries: generateTimeSeries(30, 9400, 3200),
    pageviewTimeSeries: generateTimeSeries(30, 24200, 8500),
    sourceBreakdown: [
      { source: "Organic Search", sessions: 98420, share: 34.6 },
      { source: "Paid Search", sessions: 71280, share: 25.1 },
      { source: "Direct", sessions: 52340, share: 18.4 },
      { source: "Social", sessions: 38650, share: 13.6 },
      { source: "Email", sessions: 14800, share: 5.2 },
      { source: "Referral", sessions: 8830, share: 3.1 },
    ],
    topPages: [
      { page: "/", views: 142300, avgTime: "1m 12s" },
      { page: "/products", views: 98400, avgTime: "3m 45s" },
      { page: "/pricing", views: 76200, avgTime: "4m 22s" },
      { page: "/blog", views: 54800, avgTime: "6m 08s" },
      { page: "/about", views: 32100, avgTime: "2m 34s" },
      { page: "/contact", views: 18400, avgTime: "1m 58s" },
      { page: "/checkout", views: 14200, avgTime: "5m 41s" },
    ],
  });
});

router.get("/spend", (req, res) => {
  res.json({
    metrics: [
      { label: "Total Spend", value: "$38,450", change: 5.2, changeLabel: "vs last period", trend: "up" },
      { label: "Overall ROAS", value: "3.71x", change: 6.9, changeLabel: "vs last period", trend: "up" },
      { label: "Avg. CPA", value: "$24.30", change: -3.1, changeLabel: "vs last period", trend: "up" },
      { label: "Revenue Generated", value: "$142,850", change: 12.4, changeLabel: "vs last period", trend: "up" },
    ],
    spendByChannel: [
      { channel: "Google Search", spend: 14200, roas: 4.12, cpa: 18.40, recommended: 16800 },
      { channel: "Google Display", spend: 5800, roas: 2.84, cpa: 28.60, recommended: 4200 },
      { channel: "Meta Feed", spend: 9600, roas: 3.94, cpa: 22.10, recommended: 11400 },
      { channel: "Meta Stories", spend: 3200, roas: 2.41, cpa: 34.80, recommended: 2400 },
      { channel: "TikTok", spend: 3850, roas: 3.18, cpa: 26.50, recommended: 4600 },
      { channel: "YouTube", spend: 1800, roas: 2.65, cpa: 32.40, recommended: 1200 },
    ],
    spendTimeSeries: generateTimeSeries(30, 1250, 480),
  });
});

router.get("/attribution", (req, res) => {
  res.json({
    metrics: [
      { label: "Total Conversions", value: "5,842", change: 9.3, changeLabel: "vs last period", trend: "up" },
      { label: "Attributed Revenue", value: "$138,200", change: 11.8, changeLabel: "vs last period", trend: "up" },
      { label: "Avg. Touchpoints", value: "4.2", change: 0.3, changeLabel: "vs last period", trend: "neutral" },
      { label: "Avg. Path Length", value: "8.4 days", change: -1.2, changeLabel: "vs last period", trend: "up" },
    ],
    touchpointBreakdown: [
      { touchpoint: "Google Search", conversions: 2140, revenue: 52800, model: "Last Click" },
      { touchpoint: "Meta Feed", conversions: 1380, revenue: 38400, model: "Last Click" },
      { touchpoint: "Email", conversions: 980, revenue: 24200, model: "Last Click" },
      { touchpoint: "Organic Search", conversions: 740, revenue: 14800, model: "Last Click" },
      { touchpoint: "Direct", conversions: 380, revenue: 6400, model: "Last Click" },
      { touchpoint: "TikTok", conversions: 222, revenue: 1600, model: "Last Click" },
    ],
    conversionPaths: [
      { path: "Google Search → Direct", count: 1240, conversionRate: 4.82 },
      { path: "Meta Ad → Email → Direct", count: 890, conversionRate: 6.14 },
      { path: "Organic → Google Search → Direct", count: 720, conversionRate: 5.37 },
      { path: "TikTok → Meta → Direct", count: 540, conversionRate: 3.91 },
      { path: "Email → Direct", count: 480, conversionRate: 7.24 },
      { path: "Google Display → Search → Direct", count: 380, conversionRate: 4.12 },
    ],
  });
});

router.get("/performance", (req, res) => {
  res.json({
    metrics: [
      { label: "Total Impressions", value: "18.4M", change: 14.2, changeLabel: "vs last period", trend: "up" },
      { label: "Total Clicks", value: "284,600", change: 9.8, changeLabel: "vs last period", trend: "up" },
      { label: "Avg. CTR", value: "1.55%", change: -0.4, changeLabel: "vs last period", trend: "down" },
      { label: "Avg. CPC", value: "$1.34", change: -4.2, changeLabel: "vs last period", trend: "up" },
      { label: "Total Conversions", value: "5,842", change: 9.3, changeLabel: "vs last period", trend: "up" },
      { label: "Cost per Conv.", value: "$24.30", change: -3.1, changeLabel: "vs last period", trend: "up" },
    ],
    kpiTimeSeries: generateTimeSeries(30, 1.55, 0.6),
    channelPerformance: [
      { channel: "Google Search", impressions: 4200000, clicks: 98400, ctr: 2.34, conversions: 2140, cpc: 1.44 },
      { channel: "Google Display", impressions: 8400000, clicks: 42000, ctr: 0.50, conversions: 620, cpc: 1.38 },
      { channel: "Meta Feed", impressions: 3100000, clicks: 78400, ctr: 2.53, conversions: 1380, cpc: 1.22 },
      { channel: "Meta Stories", impressions: 1800000, clicks: 36000, ctr: 2.00, conversions: 480, cpc: 0.89 },
      { channel: "TikTok", impressions: 620000, clicks: 24200, ctr: 3.90, conversions: 222, cpc: 1.59 },
      { channel: "YouTube", impressions: 280000, clicks: 5600, ctr: 2.00, conversions: 80, cpc: 2.14 },
    ],
  });
});

router.get("/forecast", (req, res) => {
  const now = new Date();
  const forecastTimeSeries = [];
  for (let i = -15; i <= 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const isHistory = i <= 0;
    const baseProjected = 4800 + i * 80 + (Math.random() - 0.5) * 600;
    forecastTimeSeries.push({
      date: date.toISOString().split("T")[0],
      projected: Math.round(baseProjected),
      lower: Math.round(baseProjected * 0.82),
      upper: Math.round(baseProjected * 1.18),
      actual: isHistory ? Math.round(baseProjected * (0.92 + Math.random() * 0.16)) : undefined,
    });
  }

  res.json({
    projectedRevenue: 182400,
    projectedSpend: 46200,
    projectedROAS: 3.95,
    confidence: 87,
    forecastTimeSeries,
    scenarioComparison: [
      { scenario: "Conservative", revenue: 162000, spend: 42000, roas: 3.86 },
      { scenario: "Base Case", revenue: 182400, spend: 46200, roas: 3.95 },
      { scenario: "Optimistic", revenue: 208000, spend: 50800, roas: 4.09 },
    ],
  });
});

export default router;
