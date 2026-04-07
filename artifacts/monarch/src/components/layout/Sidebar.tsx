import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  Target,
  BarChart2,
  Telescope,
  Settings,
  Users,
  CreditCard,
  CalendarClock,
  KeyRound,
  Palette,
  Bell,
  Download,
  BookOpen,
  Plug,
  LogOut,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const topNavItems = [
  { path: "/overview", label: "Overview", icon: LayoutDashboard },
  { path: "/traffic", label: "Traffic", icon: TrendingUp },
  { path: "/spend", label: "Spend Optimizer", icon: DollarSign },
  { path: "/attribution", label: "Ad Attribution", icon: Target },
  { path: "/performance", label: "Performance Trends", icon: BarChart2 },
  { path: "/forecast", label: "Forecast", icon: Telescope },
];

const settingsSubItems = [
  { path: "/settings/team", label: "Team", icon: Users },
  { path: "/settings/financial", label: "Financial Settings", icon: CreditCard },
  { path: "/settings/forecast", label: "Forecast Settings", icon: CalendarClock },
  { path: "/settings/api-keys", label: "API Keys", icon: KeyRound },
  { path: "/settings/appearance", label: "Appearance", icon: Palette },
  { path: "/settings/notifications", label: "Notifications", icon: Bell },
  { path: "/settings/exports", label: "Exports", icon: Download },
];

export default function Sidebar() {
  const [location] = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const isActive = (path: string) => location === path || location.startsWith(path + "/");

  return (
    <aside
      data-testid="sidebar"
      className="
        flex flex-col h-screen w-64 shrink-0
        bg-[#FFF9F2] dark:bg-[#1a1208]
        border-r border-transparent
        relative
      "
      style={{
        borderRight: "1px solid transparent",
        backgroundImage: "linear-gradient(#FFF9F2, #FFF9F2), linear-gradient(135deg, #FFBC80, #FFE29A)",
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
      }}
    >
      <style>{`
        .dark aside[data-testid="sidebar"] {
          background-image: linear-gradient(#1a1208, #1a1208), linear-gradient(135deg, #FFBC80, #FFE29A) !important;
        }
      `}</style>

      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#FFBC80]/30 dark:border-[#FFBC80]/20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
            <span className="text-[#3A3A3A] font-black text-sm">M</span>
          </div>
          <span className="font-black text-xl tracking-widest text-[#3A3A3A] dark:text-[#FFF9F2]">MONARCH</span>
        </div>
      </div>

      {/* Top navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {topNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link key={item.path} href={item.path} asChild>
              <button
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer
                  ${active
                    ? "text-[#3A3A3A] dark:text-[#1a1208]"
                    : "text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] hover:bg-[#FFBC80]/10"
                  }
                `}
                style={active ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Bottom navigation */}
      <div className="px-3 pb-3 space-y-0.5 border-t border-[#FFBC80]/30 dark:border-[#FFBC80]/20 pt-3">
        {/* Settings with sub-items */}
        <button
          data-testid="nav-settings"
          onClick={() => setSettingsOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] hover:bg-[#FFBC80]/10 transition-all duration-150"
        >
          <Settings size={16} />
          <span className="flex-1 text-left">Settings</span>
          {settingsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {settingsOpen && (
          <div className="pl-4 space-y-0.5">
            {settingsSubItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path} asChild>
                  <button
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] hover:bg-[#FFBC80]/10 transition-all duration-150 cursor-pointer"
                  >
                    <Icon size={14} />
                    {item.label}
                  </button>
                </Link>
              );
            })}
          </div>
        )}

        <Link href="/knowledge-hub" asChild>
          <button
            data-testid="nav-knowledge-hub"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] hover:bg-[#FFBC80]/10 transition-all duration-150 cursor-pointer"
          >
            <BookOpen size={16} />
            Knowledge Hub
          </button>
        </Link>

        <Link href="/integrations" asChild>
          <button
            data-testid="nav-integrations"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] hover:bg-[#FFBC80]/10 transition-all duration-150 cursor-pointer"
          >
            <Plug size={16} />
            Integrations
          </button>
        </Link>

        {/* Theme toggle */}
        <button
          data-testid="theme-toggle"
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] hover:bg-[#FFBC80]/10 transition-all duration-150"
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          {theme === "light" ? "Dark Mode" : "Light Mode"}
        </button>

        {/* User section */}
        <div className="mt-2 pt-3 border-t border-[#FFBC80]/30 dark:border-[#FFBC80]/20">
          <div
            data-testid="user-section"
            className="px-3 py-2 text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-1"
          >
            Signed in as
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[#3A3A3A] shrink-0"
              style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
            >
              AM
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] truncate">Alex Morgan</div>
              <div className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 truncate">Growth Analyst</div>
            </div>
          </div>
          <button
            data-testid="sign-out-button"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-150 mt-0.5"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
