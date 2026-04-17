import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  Target,
  BarChart2,
  Telescope,
  Settings,
  BookOpen,
  LogOut,
} from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { useAuth } from "@/context/AuthContext";

const topNavItems = [
  { path: "/overview", label: "Overview", icon: LayoutDashboard },
  { path: "/traffic", label: "Traffic", icon: TrendingUp },
  { path: "/spend", label: "Spend Optimizer", icon: DollarSign },
  { path: "/attribution", label: "Ad Attribution", icon: Target },
  { path: "/performance", label: "Performance Trends", icon: BarChart2 },
  { path: "/forecast", label: "Forecast", icon: Telescope },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { profile } = useProfile();
  const { user, logout } = useAuth();

  const isActive = (path: string) => location === path || location.startsWith(path + "/");

  // Prefer real auth user name, fall back to profile
  const displayName = user?.name ?? profile.name;
  const displaySub  = user?.email ?? profile.title;

  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside
      data-testid="sidebar"
      className="flex flex-col h-screen w-56 shrink-0 bg-[#FFF9F2] dark:bg-[#1a1208] relative"
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
      <div className="px-5 py-5 border-b border-[#FFBC80]/30 dark:border-[#FFBC80]/20 shrink-0">
        <div className="flex items-center gap-2">
          <img src="/monarch-logo.jpg" alt="Monarch" className="w-7 h-7 rounded-md object-cover object-center" />
          <span className="font-black text-xl tracking-widest text-[#3A3A3A] dark:text-[#FFF9F2]">MONARCH</span>
        </div>
      </div>

      {/* Top navigation */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-0.5">
        {topNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link key={item.path} href={item.path} asChild>
              <button
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                  active
                    ? "text-[#3A3A3A] dark:text-[#1a1208]"
                    : "text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] hover:bg-[#FFBC80]/10"
                }`}
                style={active ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
              >
                <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Bottom navigation */}
      <div className="px-2 pb-3 space-y-0.5 border-t border-[#FFBC80]/30 dark:border-[#FFBC80]/20 pt-3 shrink-0">
        <Link href="/knowledge-hub" asChild>
          <button
            data-testid="nav-knowledge-hub"
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
              isActive("/knowledge-hub")
                ? "text-[#3A3A3A] dark:text-[#1a1208]"
                : "text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] hover:bg-[#FFBC80]/10"
            }`}
            style={isActive("/knowledge-hub") ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
          >
            <BookOpen size={15} />
            Knowledge Hub
          </button>
        </Link>

        <Link href="/settings/profile" asChild>
          <button
            data-testid="nav-settings"
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
              isActive("/settings") || isActive("/integrations")
                ? "text-[#3A3A3A] dark:text-[#1a1208]"
                : "text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] hover:bg-[#FFBC80]/10"
            }`}
            style={isActive("/settings") || isActive("/integrations") ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
          >
            <Settings size={15} />
            Settings
          </button>
        </Link>

        {/* User section */}
        <div className="mt-2 pt-3 border-t border-[#FFBC80]/30 dark:border-[#FFBC80]/20">
          <div className="px-3 py-1 text-[10px] font-medium text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 uppercase tracking-wider">
            Signed in as
          </div>
          <Link href="/settings/profile" asChild>
            <button
              data-testid="user-section"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#FFBC80]/10 transition-all duration-150 cursor-pointer"
            >
              {profile.picture ? (
                <img src={profile.picture} alt={profile.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-[#3A3A3A] shrink-0"
                  style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0 text-left">
                <div className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] truncate">{displayName}</div>
                <div className="text-[10px] text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 truncate">{displaySub}</div>
              </div>
            </button>
          </Link>
          <button
            data-testid="sign-out-button"
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-150 mt-0.5"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
