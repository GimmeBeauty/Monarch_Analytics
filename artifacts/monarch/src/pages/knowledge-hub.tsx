import { Link } from "wouter";
import { ArrowLeft, BookOpen, Search, ChevronRight } from "lucide-react";

const articles = [
  {
    category: "Getting Started",
    items: [
      { title: "Setting up your first campaign", desc: "Connect your ad accounts and run your first analysis" },
      { title: "Understanding attribution models", desc: "Learn the difference between last-click, first-click, and linear attribution" },
      { title: "Configuring date ranges and comparisons", desc: "How to use date filters and comparison periods effectively" },
    ],
  },
  {
    category: "Spend Optimization",
    items: [
      { title: "How MONARCH calculates ROAS", desc: "The methodology behind return on ad spend calculations" },
      { title: "Reading channel recommendations", desc: "Acting on spend recommendations from the optimizer" },
      { title: "Budget pacing and forecasting", desc: "Using forecasts to guide budget decisions" },
    ],
  },
  {
    category: "Attribution",
    items: [
      { title: "Multi-touch attribution explained", desc: "Understanding conversion paths and touchpoint credit" },
      { title: "Setting up conversion tracking", desc: "Ensure your conversions are tracked accurately across channels" },
    ],
  },
  {
    category: "Integrations",
    items: [
      { title: "Connecting Google Ads", desc: "Step-by-step guide to linking your Google Ads account" },
      { title: "Connecting Meta Ads", desc: "Step-by-step guide to linking your Meta Ads account" },
      { title: "API access and webhooks", desc: "Use the MONARCH API to build custom integrations" },
    ],
  },
];

export default function KnowledgeHub() {
  return (
    <div className="min-h-screen bg-[#FFF9F2] dark:bg-[#120d06]">
      {/* Top nav bar */}
      <div className="border-b border-[#FFBC80]/30 dark:border-[#FFBC80]/20 px-8 py-4 bg-[#FFF9F2]/80 dark:bg-[#1a1208]/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/overview" asChild>
            <button className="flex items-center gap-2 text-sm text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors font-medium">
              <ArrowLeft size={16} />
              Back to Dashboard
            </button>
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
              <span className="text-[#3A3A3A] font-black text-xs">M</span>
            </div>
            <span className="font-black text-sm tracking-widest text-[#3A3A3A] dark:text-[#FFF9F2]">MONARCH</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6" style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
            <BookOpen size={24} className="text-[#3A3A3A]" />
          </div>
          <h1 className="text-3xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-3">Knowledge Hub</h1>
          <p className="text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 max-w-md mx-auto">
            Everything you need to get the most out of MONARCH — guides, explanations, and best practices.
          </p>

          {/* Search */}
          <div className="mt-6 relative max-w-md mx-auto">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30" />
            <input
              type="search"
              placeholder="Search articles..."
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white dark:bg-[#231a0e] text-[#3A3A3A] dark:text-[#FFF9F2] placeholder-[#3A3A3A]/40 dark:placeholder-[#FFF9F2]/30 outline-none"
              style={{ border: "1px solid #FFBC80" }}
            />
          </div>
        </div>

        {/* Article categories */}
        <div className="space-y-8">
          {articles.map((cat) => (
            <div key={cat.category}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#FFBC80] mb-3">{cat.category}</h2>
              <div className="space-y-2">
                {cat.items.map((article) => (
                  <button
                    key={article.title}
                    className="w-full text-left p-4 rounded-xl monarch-card-settings group transition-all hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] group-hover:text-[#FFBC80] transition-colors">{article.title}</p>
                        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">{article.desc}</p>
                      </div>
                      <ChevronRight size={16} className="text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25 shrink-0 group-hover:text-[#FFBC80] transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
