import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  UserCircle, Users, CreditCard, CalendarClock, KeyRound, Palette,
  Bell, Download, Plug, Camera, Check, Sun, Moon, Settings as SettingsIcon,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useProfile } from "@/context/ProfileContext";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import ForecastSettings from "./settings/ForecastSettings";
import FinancialSettings from "./settings/FinancialSettings";

const navItems = [
  { key: "profile", label: "Profile", icon: UserCircle },
  { key: "team", label: "Team", icon: Users },
  { key: "financial", label: "Financial Settings", icon: CreditCard },
  { key: "forecast", label: "Forecast Settings", icon: CalendarClock },
  { key: "api-keys", label: "API Keys", icon: KeyRound },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "exports", label: "Exports", icon: Download },
  { key: "integrations", label: "Integrations", icon: Plug },
];

function ProfilePanel() {
  const { profile, updateProfile } = useProfile();
  const [name, setName] = useState(profile.name);
  const [title, setTitle] = useState(profile.title);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const handleSave = () => {
    updateProfile({ name, title });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateProfile({ picture: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Profile</h2>
        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">Update your personal details and profile picture.</p>
      </div>

      <div className="p-5 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30">
        <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-4">Profile Picture</p>
        <div className="flex items-center gap-5">
          <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            {profile.picture ? (
              <img src={profile.picture} alt={profile.name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-[#3A3A3A]"
                style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
                {initials}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={16} className="text-white" />
            </div>
          </div>
          <div>
            <button onClick={() => fileRef.current?.click()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#3A3A3A] hover:opacity-85 transition-opacity"
              style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
              Upload Photo
            </button>
            {profile.picture && (
              <button onClick={() => updateProfile({ picture: "" })}
                className="ml-2 px-3 py-1.5 rounded-lg text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:bg-[#FFBC80]/10 transition-colors">
                Remove
              </button>
            )}
            <p className="mt-1.5 text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">JPG, PNG or GIF. Max 5MB.</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30">
        <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-4">Personal Details</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-1">Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-3 py-2 rounded-lg text-sm bg-[#FFF9F2] dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2] border border-[#FFBC80]/50 focus:border-[#FFBC80] outline-none transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-1">Title / Role</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Growth Analyst"
              className="w-full px-3 py-2 rounded-lg text-sm bg-[#FFF9F2] dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2] border border-[#FFBC80]/50 focus:border-[#FFBC80] outline-none transition-colors" />
          </div>
        </div>
        <button onClick={handleSave}
          className="mt-4 flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A] hover:opacity-90 transition-all"
          style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
          {saved && <Check size={13} />}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="p-5 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30">
        <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-3">Sidebar Preview</p>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#FFBC80]/8">
          {profile.picture ? (
            <img src={profile.picture} alt={profile.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[#3A3A3A] shrink-0"
              style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
              {initials}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{name || "Your Name"}</div>
            <div className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">{title || "Your Title"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearancePanel() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Appearance</h2>
        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">Choose your preferred color theme.</p>
      </div>

      <div className="p-5 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30">
        <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-4">Color Theme</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => theme === "dark" && toggleTheme()}
            className="relative p-4 rounded-xl border-2 transition-all text-left"
            style={{
              borderColor: theme === "light" ? "#FFBC80" : "transparent",
              background: theme === "light"
                ? "linear-gradient(135deg, rgba(255,188,128,0.18), rgba(255,226,154,0.18))"
                : "rgba(255,188,128,0.05)",
            }}
          >
            {theme === "light" && <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#FFBC80]" />}
            <div className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #FFF9F2, #FFE29A)" }}>
              <Sun size={16} className="text-[#3A3A3A]" />
            </div>
            <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Light</p>
            <div className="mt-2 space-y-1.5">
              <div className="h-1.5 rounded-full bg-[#FFBC80]/60 w-full" />
              <div className="h-1.5 rounded-full bg-[#FFBC80]/35 w-3/4" />
            </div>
          </button>

          <button
            onClick={() => theme === "light" && toggleTheme()}
            className="relative p-4 rounded-xl border-2 transition-all text-left"
            style={{
              borderColor: theme === "dark" ? "#FFBC80" : "transparent",
              background: theme === "dark"
                ? "linear-gradient(135deg, rgba(255,188,128,0.18), rgba(255,226,154,0.18))"
                : "rgba(255,188,128,0.05)",
            }}
          >
            {theme === "dark" && <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#FFBC80]" />}
            <div className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center bg-[#1a1208]">
              <Moon size={16} className="text-[#FFBC80]" />
            </div>
            <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Dark</p>
            <div className="mt-2 space-y-1.5">
              <div className="h-1.5 rounded-full bg-[#FFBC80]/60 w-full" />
              <div className="h-1.5 rounded-full bg-[#FFBC80]/35 w-3/4" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPanel({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">{label}</h2>
        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">{desc}</p>
      </div>
      <div className="p-10 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30 flex flex-col items-center justify-center gap-3">
        <SettingsIcon size={28} className="text-[#FFBC80]/50" />
        <p className="text-sm text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">{label} configuration coming soon.</p>
      </div>
    </div>
  );
}

const panelMeta: Record<string, string> = {
  team: "Manage team members and permissions.",
  financial: "Configure billing, invoicing, and financial preferences.",
  forecast: "Tune forecast model parameters and seasonality.",
  "api-keys": "Generate and manage API access keys.",
  notifications: "Set up alerts and notification preferences.",
  exports: "Configure data export formats and schedules.",
  integrations: "Connect ad platforms, analytics tools, and data sources.",
};

function PanelContent({ section }: { section: string }) {
  if (section === "profile") return <ProfilePanel />;
  if (section === "appearance") return <AppearancePanel />;
  if (section === "forecast") return <ForecastSettings />;
  if (section === "financial") return <FinancialSettings />;
  return (
    <PlaceholderPanel
      label={navItems.find((n) => n.key === section)?.label ?? section}
      desc={panelMeta[section] ?? ""}
    />
  );
}

export default function Settings({ params }: { params?: { section?: string } }) {
  const [, setLocation] = useLocation();
  const section = params?.section ?? "profile";

  return (
    <div className="flex h-screen overflow-hidden bg-[#FFF9F2] dark:bg-[#120d06]">
      {/* Main sidebar */}
      <Sidebar />

      {/* Settings sub-nav */}
      <div className="w-52 shrink-0 border-r border-[#FFBC80]/25 dark:border-[#FFBC80]/15 pt-6 pb-4 px-2 bg-[#FFF9F2] dark:bg-[#1a1208] overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-bold tracking-widest text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 uppercase">Settings</p>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setLocation(`/settings/${item.key}`)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                  active
                    ? "text-[#3A3A3A]"
                    : "text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] hover:bg-[#FFBC80]/10"
                }`}
                style={active ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
              >
                <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar title="Settings" description="Configure your MONARCH workspace, team, and integrations." />
        <main className="flex-1 overflow-y-auto px-8 py-6 max-w-2xl">
          <PanelContent section={section} />
        </main>
      </div>
    </div>
  );
}
