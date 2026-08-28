import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  Target,
  BarChart2,
  Telescope,
  LayoutGrid,
  Settings,
  BookOpen,
  LogOut,
} from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import Footer from "./Footer";

const topNavItems = [
  { path: "/overview", label: "Overview", icon: LayoutDashboard },
  { path: "/traffic", label: "Traffic", icon: TrendingUp },
  { path: "/spend", label: "Spend Optimizer", icon: DollarSign },
  { path: "/attribution", label: "Ad Attribution", icon: Target },
  { path: "/performance", label: "Performance Trends", icon: BarChart2 },
  { path: "/item-performance", label: "Item Performance", icon: LayoutGrid },
  { path: "/forecast", label: "Forecast", icon: Telescope },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps) {
  const [location] = useLocation();
  const { profile } = useProfile();
  const { user, logout } = useAuth();
  const { theme } = useTheme();

  const logoSrc = "/monarch-logo-light.jpg";
  const accentGradient = theme === "dark"
    ? "linear-gradient(135deg, #BFA1E3, #9BDBF3)"
    : "linear-gradient(135deg, #FFBC80, #FFE29A)";
  const sidebarBg = theme === "dark"
    ? "linear-gradient(#ffffff, #ffffff), linear-gradient(135deg, #BFA1E3, #9BDBF3)"
    : "linear-gradient(#FFF9F2, #FFF9F2), linear-gradient(135deg, #FFBC80, #FFE29A)";

  const isActive = (path: string) => location === path || location.startsWith(path + "/");
  const closeMobile = () => onMobileOpenChange(false);

  // Prefer real auth user name, fall back to profile
  const displayName = user?.name ?? profile.name;
  const displaySub  = user?.email ?? profile.title;

  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#FFBC80]/30 dark:border-[#9BDBF3]/30 shrink-0">
        <div className="flex items-center gap-2">
          <img src={logoSrc} alt="Monarch" className="w-7 h-7 rounded-md object-cover object-center" />
          <span className="font-black text-xl tracking-widest text-[#3A3A3A] dark:text-[#003349]">MONARCH</span>
        </div>
      </div>

      {/* Top navigation */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-0.5">
        {topNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link key={item.path} href={item.path} onClick={closeMobile} asChild>
              <button
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                  active
                    ? "text-[#3A3A3A] dark:text-[#003349]"
                    : "text-[#3A3A3A]/60 dark:text-[#003349]/50 hover:text-[#3A3A3A] dark:hover:text-[#003349] hover:bg-[#FFBC80]/10 dark:hover:bg-[#EFBAE1]/10"
                }`}
                style={active ? { background: accentGradient } : {}}
              >
                <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Bottom navigation */}
      <div className="px-2 pb-3 space-y-0.5 border-t border-[#FFBC80]/30 dark:border-[#9BDBF3]/30 pt-3 shrink-0">
        <Link href="/knowledge-hub" onClick={closeMobile} asChild>
          <button
            data-testid="nav-knowledge-hub"
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
              isActive("/knowledge-hub")
                ? "text-[#3A3A3A] dark:text-[#003349]"
                : "text-[#3A3A3A]/60 dark:text-[#003349]/50 hover:text-[#3A3A3A] dark:hover:text-[#003349] hover:bg-[#FFBC80]/10 dark:hover:bg-[#EFBAE1]/10"
            }`}
            style={isActive("/knowledge-hub") ? { background: accentGradient } : {}}
          >
            <BookOpen size={15} />
            Knowledge Hub
          </button>
        </Link>

        <Link href="/settings/profile" onClick={closeMobile} asChild>
          <button
            data-testid="nav-settings"
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
              isActive("/settings") || isActive("/integrations")
                ? "text-[#3A3A3A] dark:text-[#003349]"
                : "text-[#3A3A3A]/60 dark:text-[#003349]/50 hover:text-[#3A3A3A] dark:hover:text-[#003349] hover:bg-[#FFBC80]/10 dark:hover:bg-[#EFBAE1]/10"
            }`}
            style={isActive("/settings") || isActive("/integrations") ? { background: accentGradient } : {}}
          >
            <Settings size={15} />
            Settings
          </button>
        </Link>

        {/* User section */}
        <div className="mt-2 pt-3 border-t border-[#FFBC80]/30 dark:border-[#9BDBF3]/30">
          <div className="px-3 py-1 text-[10px] font-medium text-[#3A3A3A]/40 dark:text-[#003349]/30 uppercase tracking-wider">
            Signed in as
          </div>
          <Link href="/settings/profile" onClick={closeMobile} asChild>
            <button
              data-testid="user-section"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#FFBC80]/10 dark:hover:bg-[#EFBAE1]/10 transition-all duration-150 cursor-pointer"
            >
              {profile.picture ? (
                <img src={profile.picture} alt={profile.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-[#3A3A3A] shrink-0"
                  style={{ background: accentGradient }}
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0 text-left">
                <div className="text-xs font-semibold text-[#3A3A3A] dark:text-[#003349] truncate">{displayName}</div>
                <div className="text-[10px] text-[#3A3A3A]/50 dark:text-[#003349]/40 truncate">{displaySub}</div>
              </div>
            </button>
          </Link>
          <button
            data-testid="sign-out-button"
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-[#3A3A3A]/55 dark:text-[#003349]/45 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-150 mt-0.5"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>

        <Footer className="px-3 pb-3 pt-1" />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        data-testid="sidebar"
        className="hidden md:flex flex-col h-screen w-56 shrink-0 relative"
        style={{
          borderRight: "1px solid transparent",
          backgroundImage: sidebarBg,
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
        }}
      >
        {navContent}
      </aside>

      {/* Mobile nav drawer */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          data-testid="sidebar-mobile"
          side="left"
          className="p-0 border-r-0"
          style={{
            backgroundImage: sidebarBg,
            backgroundOrigin: "border-box",
            backgroundClip: "padding-box, border-box",
          }}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {navContent}
        </SheetContent>
      </Sheet>
    </>
  );
}
