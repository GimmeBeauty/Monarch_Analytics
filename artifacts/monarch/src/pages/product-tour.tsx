import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  LayoutDashboard,
  TrendingUp,
  Megaphone,
  Wallet,
  LineChart as LineChartIcon,
  Building2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/context/ThemeContext";
import { brandGradient } from "@/lib/brandGradient";
import Footer from "@/components/layout/Footer";

// ─── Illustrative sample data only — not connected to any live account or API ──
// Every figure on this page is fabricated for demonstration purposes so that
// reviewers and prospective users can see how MONARCH presents data without
// requiring a login or exposing real business data.

const SAMPLE_TREND = [
  { date: "Jul 1", revenue: 18400, spend: 4200 },
  { date: "Jul 8", revenue: 21100, spend: 4600 },
  { date: "Jul 15", revenue: 19800, spend: 4300 },
  { date: "Jul 22", revenue: 24300, spend: 5100 },
  { date: "Jul 29", revenue: 27600, spend: 5400 },
  { date: "Aug 5", revenue: 26200, spend: 5000 },
  { date: "Aug 12", revenue: 29900, spend: 5700 },
  { date: "Aug 19", revenue: 32100, spend: 6100 },
];

const SAMPLE_KPIS = [
  { label: "Blended Revenue", value: "$182.4K", change: "+12.3%", positive: true },
  { label: "Ad Spend", value: "$41.2K", change: "+6.8%", positive: true },
  { label: "Blended ROAS", value: "4.4x", change: "+0.3x", positive: true },
  { label: "Orders", value: "6,204", change: "+9.1%", positive: true },
];

const SAMPLE_CHANNELS = [
  { name: "Meta Ads", spend: "$14,820", revenue: "$68,940", roas: "4.65x", color: "#60A5FA" },
  { name: "Google Ads", spend: "$11,340", revenue: "$52,110", roas: "4.60x", color: "#F59E0B" },
  { name: "TikTok Ads", spend: "$7,260", revenue: "$29,880", roas: "4.12x", color: "#F472B6" },
  { name: "TikTok Shop", spend: "$3,940", revenue: "$17,205", roas: "4.37x", color: "#34D399" },
  { name: "Pinterest", spend: "$2,180", revenue: "$8,640", roas: "3.96x", color: "#EF4444" },
  { name: "Organic / Direct", spend: "$0", revenue: "$26,430", roas: "—", color: "#A78BFA" },
];

function fmtY(v: number) {
  return `$${(v / 1000).toFixed(0)}K`;
}

function SampleTag() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3A3A3A]/5 dark:bg-[#003349]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#3A3A3A]/50 dark:text-[#003349]/50">
      Sample data
    </span>
  );
}

function MockCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl monarch-card p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#FFBC80]/15 dark:bg-[#BFA1E3]/10">
            <Icon className="w-4 h-4 text-[#FFBC80] dark:text-[#9BDBF3]" />
          </div>
          <h2 className="text-lg font-bold text-[#3A3A3A] dark:text-[#003349]">{title}</h2>
        </div>
        <SampleTag />
      </div>
      <p className="text-sm text-[#3A3A3A]/60 dark:text-[#003349]/55 leading-relaxed mb-6 ml-12">
        {description}
      </p>
      {children}
    </div>
  );
}

export default function ProductTour() {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/monarch-logo.jpg" : "/monarch-logo-light.jpg";
  const areaColor = theme === "dark" ? "#9BDBF3" : "#FFBC80";

  return (
    <div className="min-h-screen bg-[#FFF9F2] dark:bg-[#FFFFFF] flex flex-col">
      {/* Sticky top nav */}
      <div className="sticky top-0 z-20 border-b border-[#FFBC80]/30 dark:border-[#BFA1E3]/20 bg-[#FFF9F2]/80 dark:bg-[#FFFFFF]/80 backdrop-blur-sm px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <span className="flex items-center gap-2 cursor-pointer">
              <img src={logoSrc} alt="Monarch" className="w-7 h-7 rounded-md object-cover object-center" />
              <span className="font-black text-sm tracking-widest text-[#3A3A3A] dark:text-[#003349]">MONARCH</span>
            </span>
          </Link>
          <Link href="/login">
            <span
              className="px-4 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A] cursor-pointer transition-opacity hover:opacity-85 active:scale-[0.98]"
              style={{ background: brandGradient(theme) }}
            >
              Login
            </span>
          </Link>
        </div>
      </div>

      {/* Intro */}
      <div className="relative overflow-hidden border-b border-[#FFBC80]/25 dark:border-[#BFA1E3]/20">
        <div
          className="absolute inset-0 opacity-[0.10] dark:opacity-[0.10]"
          style={{ background: brandGradient(theme) }}
        />
        <div className="relative max-w-5xl mx-auto w-full px-8 pt-16 pb-14">
          <Link href="/">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3A3A3A]/60 dark:text-[#003349]/55 cursor-pointer hover:opacity-75 mb-6">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Monarch
            </span>
          </Link>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#3A3A3A] dark:text-[#003349] mb-4">
            How Monarch Works
          </h1>
          <p className="text-base md:text-lg text-[#3A3A3A]/65 dark:text-[#003349]/55 leading-relaxed max-w-2xl">
            Monarch is an internal business intelligence platform built and operated by Durham Brands
            for our consumer brand, Gimme Beauty. It centralizes retail, e-commerce, and advertising
            data — including Meta, Google, TikTok Ads, TikTok Shop, and Pinterest — into a single
            dashboard so our team can track performance without logging into a dozen separate
            platforms. This page walks through what the product does and how each connected data
            source is used, illustrated with sample data since the live dashboards require an
            internal team login.
          </p>
        </div>
      </div>

      {/* Company & product info */}
      <div className="max-w-5xl mx-auto w-full px-8 py-14 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl monarch-card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#FFBC80]/15 dark:bg-[#BFA1E3]/10">
                <Building2 className="w-4 h-4 text-[#FFBC80] dark:text-[#9BDBF3]" />
              </div>
              <h2 className="text-lg font-bold text-[#3A3A3A] dark:text-[#003349]">Who We Are</h2>
            </div>
            <p className="text-sm text-[#3A3A3A]/65 dark:text-[#003349]/55 leading-relaxed">
              Durham Brands is the parent company of Gimme Beauty, a consumer packaged goods (CPG)
              brand specializing in hair accessories, sold through major retailers nationwide
              (Target, Walmart, Ulta Beauty, and others) as well as direct-to-consumer at
              gimmebeauty.com. Monarch is a private internal tool built by Durham Brands to support
              our own marketing, sales, and operations teams — it is not sold or offered to outside
              customers.
            </p>
          </div>

          <div className="rounded-2xl monarch-card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#FFBC80]/15 dark:bg-[#BFA1E3]/10">
                <Megaphone className="w-4 h-4 text-[#FFBC80] dark:text-[#9BDBF3]" />
              </div>
              <h2 className="text-lg font-bold text-[#3A3A3A] dark:text-[#003349]">
                Why We Request Advertising API Access
              </h2>
            </div>
            <p className="text-sm text-[#3A3A3A]/65 dark:text-[#003349]/55 leading-relaxed">
              Monarch connects to advertising platforms — including the TikTok for Business
              Marketing API — solely to pull our own company's ad spend, impressions, clicks, and
              revenue data via read-only, authenticated API access. This data is combined with our
              retail and e-commerce sales data to build a blended view of marketing performance for
              internal reporting. We do not access, store, or act on any other advertiser's or
              user's data.
            </p>
          </div>
        </div>

        {/* Sample dashboard walkthrough */}
        <div>
          <h2 className="text-2xl font-black tracking-tight text-[#3A3A3A] dark:text-[#003349] mb-2">
            Inside the Dashboard
          </h2>
          <p className="text-sm text-[#3A3A3A]/60 dark:text-[#003349]/50 mb-8 max-w-2xl">
            Once a team member logs in, Monarch presents a blended view of performance across every
            connected channel. The examples below use fabricated sample numbers to illustrate the
            layout and functionality — no real account data is shown here.
          </p>

          <div className="space-y-6">
            <MockCard
              icon={LayoutDashboard}
              title="Overview KPIs"
              description="A snapshot of blended revenue, ad spend, ROAS, and orders across all connected retail, e-commerce, and advertising sources, with period-over-period comparisons."
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {SAMPLE_KPIS.map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-xl border border-[#FFBC80]/25 dark:border-[#BFA1E3]/20 p-4"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#3A3A3A]/45 dark:text-[#003349]/45 mb-1.5">
                      {kpi.label}
                    </div>
                    <div className="text-xl font-black text-[#3A3A3A] dark:text-[#003349]">{kpi.value}</div>
                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                      {kpi.change}
                    </div>
                  </div>
                ))}
              </div>
            </MockCard>

            <MockCard
              icon={LineChartIcon}
              title="Revenue &amp; Spend Trend"
              description="Daily blended revenue vs. advertising spend over time, used to spot trends and evaluate marketing efficiency."
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={SAMPLE_TREND} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tourRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={areaColor} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={areaColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-[#3A3A3A]/10 dark:text-[#003349]/10" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={fmtY} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Area type="monotone" dataKey="revenue" stroke={areaColor} strokeWidth={2} fill="url(#tourRevenue)" name="Revenue" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </MockCard>

            <MockCard
              icon={Wallet}
              title="Channel Breakdown (incl. TikTok Shop)"
              description="Spend, attributed revenue, and ROAS broken out by each connected advertising and sales channel, so our team can see which channels are performing best."
            >
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-[#3A3A3A]/45 dark:text-[#003349]/45">
                      <th className="px-2 py-2">Channel</th>
                      <th className="px-2 py-2">Spend</th>
                      <th className="px-2 py-2">Revenue</th>
                      <th className="px-2 py-2">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_CHANNELS.map((ch) => (
                      <tr key={ch.name} className="border-t border-[#FFBC80]/15 dark:border-[#BFA1E3]/15">
                        <td className="px-2 py-2.5 font-semibold text-[#3A3A3A] dark:text-[#003349]">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ch.color }} />
                            {ch.name}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-[#3A3A3A]/70 dark:text-[#003349]/60">{ch.spend}</td>
                        <td className="px-2 py-2.5 text-[#3A3A3A]/70 dark:text-[#003349]/60">{ch.revenue}</td>
                        <td className="px-2 py-2.5 text-[#3A3A3A]/70 dark:text-[#003349]/60">{ch.roas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </MockCard>

            <MockCard
              icon={TrendingUp}
              title="Spend Optimizer"
              description="A modeling view that suggests how to reallocate advertising budget across channels to improve overall return, based on historical performance trends."
            >
              <p className="text-sm text-[#3A3A3A]/60 dark:text-[#003349]/50 leading-relaxed">
                Example recommendation: "Shifting roughly $1,200/week of budget from Pinterest to
                TikTok Shop is projected to increase blended ROAS from 4.4x to approximately 4.6x,
                based on the trailing 8-week efficiency trend." Recommendations like this are
                generated from each channel's spend, revenue, and efficiency history — they are not
                predictions about any individual user or third party.
              </p>
            </MockCard>
          </div>
        </div>

        <div className="rounded-2xl monarch-card p-6 md:p-8">
          <h2 className="text-lg font-bold text-[#3A3A3A] dark:text-[#003349] mb-3">
            Data Use &amp; Access
          </h2>
          <div className="space-y-3 text-sm text-[#3A3A3A]/65 dark:text-[#003349]/55 leading-relaxed">
            <p>
              Monarch is used exclusively by Durham Brands and Gimme Beauty employees. Access
              requires an internal login; there is no public sign-up. Connections to advertising
              platforms (Meta, Google, TikTok for Business, Pinterest) are read-only and scoped to
              our own advertiser accounts — used only to aggregate our own campaign performance data
              for internal reporting, forecasting, and budget planning.
            </p>
            <p>
              No data belonging to other businesses, advertisers, or end consumers of those
              platforms is accessed, stored, or shared. For more detail see our{" "}
              <Link href="/privacy-policy">
                <span className="underline cursor-pointer hover:opacity-75">Privacy Policy</span>
              </Link>{" "}
              and{" "}
              <Link href="/knowledge-hub/data-security">
                <span className="underline cursor-pointer hover:opacity-75">Data Security overview</span>
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="text-center pt-4">
          <Link href="/login">
            <span
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-[#3A3A3A] cursor-pointer transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.98] shadow-lg shadow-[#FFBC80]/20 dark:shadow-[#BFA1E3]/20"
              style={{ background: brandGradient(theme) }}
            >
              Sign in to Monarch
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </div>

      <div className="border-t border-[#FFBC80]/20 dark:border-[#BFA1E3]/20 pt-8 pb-10">
        <Footer />
      </div>
    </div>
  );
}
