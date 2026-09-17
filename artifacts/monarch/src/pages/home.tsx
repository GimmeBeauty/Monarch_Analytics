import { Link } from "wouter";
import { LayoutDashboard, Users, Plug, Building2, ShoppingBag, Megaphone, Store, ArrowRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { brandGradient } from "@/lib/brandGradient";
import Footer from "@/components/layout/Footer";

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative rounded-2xl monarch-card p-6 md:p-8 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#FFBC80]/10 dark:hover:shadow-[#BFA1E3]/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#FFBC80]/15 dark:bg-[#BFA1E3]/10 transition-colors duration-300 group-hover:bg-[#FFBC80]/25 dark:group-hover:bg-[#BFA1E3]/20">
          <Icon className="w-4 h-4 text-[#FFBC80] dark:text-[#9BDBF3]" />
        </div>
        <h2 className="text-lg font-bold text-[#3A3A3A] dark:text-[#003349]">{title}</h2>
      </div>
      <div className="space-y-3 text-sm text-[#3A3A3A]/65 dark:text-[#003349]/55 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Pill({ icon: Icon, label }: { icon: React.FC<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[#FFBC80]/30 dark:border-[#BFA1E3]/25 bg-white/60 dark:bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
      <Icon className="w-3.5 h-3.5 text-[#FFBC80] dark:text-[#9BDBF3]" />
      <span className="text-xs font-semibold tracking-wide text-[#3A3A3A]/75 dark:text-[#003349]/70">
        {label}
      </span>
    </div>
  );
}

export default function Home() {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/monarch-logo.jpg" : "/monarch-logo-light.jpg";

  return (
    <div className="min-h-screen bg-[#FFF9F2] dark:bg-[#FFFFFF] flex flex-col">
      {/* Sticky top nav */}
      <div className="sticky top-0 z-20 border-b border-[#FFBC80]/30 dark:border-[#BFA1E3]/20 bg-[#FFF9F2]/80 dark:bg-[#FFFFFF]/80 backdrop-blur-sm px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="Monarch" className="w-7 h-7 rounded-md object-cover object-center" />
            <span className="font-black text-sm tracking-widest text-[#3A3A3A] dark:text-[#003349]">MONARCH</span>
          </div>
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

      {/* Hero banner */}
      <div className="relative overflow-hidden border-b border-[#FFBC80]/25 dark:border-[#BFA1E3]/20">
        {/* Soft gradient wash */}
        <div
          className="absolute inset-0 opacity-[0.14] dark:opacity-[0.12]"
          style={{ background: brandGradient(theme) }}
        />
        {/* Fine grid texture */}
        <div
          className="absolute inset-0 opacity-[0.5] dark:opacity-[0.35] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            color: theme === "dark" ? "#BFA1E3" : "#FFBC80",
            opacity: 0.06,
            maskImage: "radial-gradient(ellipse 60% 60% at 50% 30%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 30%, black, transparent)",
          }}
        />
        {/* Glow orbs */}
        <div
          className="absolute -left-24 top-8 w-72 h-72 rounded-full blur-3xl opacity-30 dark:opacity-25 pointer-events-none"
          style={{ background: theme === "dark" ? "#9BDBF3" : "#FFE29A" }}
        />
        <div
          className="absolute -right-16 top-24 w-64 h-64 rounded-full blur-3xl opacity-25 dark:opacity-20 pointer-events-none"
          style={{ background: theme === "dark" ? "#BFA1E3" : "#FFBC80" }}
        />
        <img
          src={logoSrc}
          alt=""
          aria-hidden="true"
          className="absolute -right-10 -top-10 w-56 h-56 object-cover opacity-[0.14] dark:opacity-[0.12] pointer-events-none select-none"
          style={{
            maskImage: "radial-gradient(closest-side, black, transparent)",
            WebkitMaskImage: "radial-gradient(closest-side, black, transparent)",
          }}
        />

        <div className="relative max-w-5xl mx-auto w-full px-8 pt-24 pb-20 text-center">
          <h1
            className="text-6xl md:text-7xl font-black tracking-tight mb-5 bg-clip-text text-transparent"
            style={{ backgroundImage: brandGradient(theme) }}
          >
            Monarch
          </h1>
          <p className="text-2xl md:text-[26px] font-bold text-[#3A3A3A] dark:text-[#003349] mb-4">
            Internal Business Intelligence
          </p>
          <p className="text-base md:text-lg text-[#3A3A3A]/60 dark:text-[#003349]/50 leading-relaxed max-w-xl mx-auto mb-10">
            Centralizing retail, e-commerce, and advertising data into one platform.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-11">
            <Pill icon={Store} label="Retail" />
            <Pill icon={ShoppingBag} label="E-commerce" />
            <Pill icon={Megaphone} label="Advertising" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/login">
              <span
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-[#3A3A3A] cursor-pointer transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.98] shadow-lg shadow-[#FFBC80]/20 dark:shadow-[#BFA1E3]/20"
                style={{ background: brandGradient(theme) }}
              >
                Sign in to Monarch
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
            <Link href="/product-tour">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-[#3A3A3A] dark:text-[#003349] border border-[#FFBC80]/40 dark:border-[#BFA1E3]/30 bg-white/50 dark:bg-white/[0.05] cursor-pointer transition-all hover:bg-white/80 dark:hover:bg-white/[0.1] hover:-translate-y-0.5 active:scale-[0.98] backdrop-blur-sm">
                See how it works
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Content sections */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-8 py-14 space-y-6">
        <Section icon={LayoutDashboard} title="About Monarch">
          <p>
            Monarch is an internal analytics and business intelligence platform built and operated by
            Durham Brands for our consumer brand, Gimme Beauty.
          </p>
          <p>
            Monarch brings together sales, retail performance, and advertising data from the retailers
            and platforms we work with — including Target, Walmart, Amazon, Ulta Beauty, and our own
            direct-to-consumer channels — into a single, unified dashboard.
          </p>
          <p>
            This allows our team to make faster, more informed decisions across marketing, sales,
            forecasting, and operations, without manually piecing together reports from a dozen
            different sources.
          </p>
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Section icon={Users} title="Who Uses Monarch">
            <p>
              Monarch is a private, internal tool used exclusively by Durham Brands and Gimme Beauty
              team members. It is not a consumer-facing product or service.
            </p>
          </Section>

          <Section icon={Plug} title="Why We Connect to Advertising & Retail Platforms">
            <p>
              Monarch integrates with advertising and retail media platforms (including Meta, Google,
              Amazon Ads, TikTok, and others) solely to aggregate our own company's advertising
              performance data for internal reporting and analysis. These connections are read-only and
              used to help our team understand and optimize our own marketing performance across
              channels.
            </p>
          </Section>

          <Section icon={Building2} title="About Durham Brands">
            <p>
              Durham Brands is the parent company of Gimme Beauty, a consumer packaged goods (CPG)
              brand specializing in hair accessories, sold through major retailers nationwide and
              direct-to-consumer at gimmebeauty.com.
            </p>
          </Section>
        </div>
      </div>

      {/* Footer, separated with a top border */}
      <div className="border-t border-[#FFBC80]/20 dark:border-[#BFA1E3]/20 pt-8 pb-10">
        <Footer />
      </div>
    </div>
  );
}
