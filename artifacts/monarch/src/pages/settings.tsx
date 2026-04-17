import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  UserCircle, Users, CreditCard, CalendarClock, KeyRound, Palette,
  Bell, Download, Plug, Camera, Check, Sun, Moon, Settings as SettingsIcon,
  Lock, Copy, Trash2, Eye, EyeOff, ShieldAlert, Plus, Tag,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useProfile } from "@/context/ProfileContext";
import { useTeam } from "@/context/TeamContext";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import ForecastSettings from "./settings/ForecastSettings";
import FinancialSettings from "./settings/FinancialSettings";
import TeamSettings from "./settings/TeamSettings";
import NotificationsPanel from "./settings/NotificationsPanel";
import IntegrationsPanel from "./settings/IntegrationsPanel";
import ExportsPanel from "./settings/ExportsPanel";
import PricingSettings from "./settings/PricingSettings";

const navItems = [
  { key: "profile", label: "Profile", icon: UserCircle },
  { key: "team", label: "Team", icon: Users },
  { key: "financial", label: "Financial Settings", icon: CreditCard },
  { key: "pricing", label: "Pricing & Valuation", icon: Tag },
  { key: "forecast", label: "Forecast Settings", icon: CalendarClock },
  { key: "api-keys", label: "API Keys", icon: KeyRound },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "exports", label: "Exports", icon: Download },
  { key: "integrations", label: "Integrations", icon: Plug },
];

function ProfilePanel() {
  const { profile, saveProfile, saveAvatar } = useProfile();
  const [name,      setName]      = useState(profile.name);
  const [title,     setTitle]     = useState(profile.title);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = (name || profile.name || "?")
    .split(/[\s@]/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile({ name, title });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try { await saveAvatar(ev.target?.result as string); } finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#3A3A3A] hover:opacity-85 transition-opacity disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
              {uploading ? "Saving…" : "Upload Photo"}
            </button>
            {profile.picture && (
              <button onClick={() => saveAvatar(null)} disabled={uploading}
                className="ml-2 px-3 py-1.5 rounded-lg text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:bg-[#FFBC80]/10 transition-colors disabled:opacity-50">
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
        <button onClick={handleSave} disabled={saving}
          className="mt-4 flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A] hover:opacity-90 transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
          {saved && <Check size={13} />}
          {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
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

type ApiKey = {
  id: string;
  label: string;
  key: string;
  createdAt: string;
  isNew?: boolean;
};

function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "mk_live_";
  for (let i = 0; i < 32; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const handleGenerate = () => {
    if (!label.trim()) return;
    const newKey: ApiKey = {
      id: crypto.randomUUID(),
      label: label.trim(),
      key: generateApiKey(),
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      isNew: true,
    };
    setKeys((prev) => [newKey, ...prev]);
    setRevealed((prev) => ({ ...prev, [newKey.id]: true }));
    setLabel("");
  };

  const handleRevoke = (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
    setRevealed((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleCopy = (id: string, key: string) => {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const maskKey = (key: string) => key.slice(0, 12) + "••••••••••••••••••••" + key.slice(-4);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">API Keys</h2>
        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">Generate and manage API keys for programmatic access to your organization's data.</p>
      </div>

      {/* Generate Key */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30">
        <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-4">Generate New Key</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            placeholder="Key label (e.g. Production App)"
            className="flex-1 px-3 py-2 rounded-lg text-sm bg-[#FFF9F2] dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2] border border-[#FFBC80]/50 focus:border-[#FFBC80] outline-none transition-colors placeholder-[#3A3A3A]/35 dark:placeholder-[#FFF9F2]/25"
          />
          <button
            onClick={handleGenerate}
            disabled={!label.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A] transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
          >
            <Plus size={14} />
            Generate Key
          </button>
        </div>
      </div>

      {/* Active Keys */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30">
        <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-4">Active Keys</p>
        {keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <KeyRound size={24} className="text-[#FFBC80]/40" />
            <p className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">No API keys yet. Generate one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className="rounded-lg border border-[#FFBC80]/20 bg-[#FFF9F2] dark:bg-[#1a1208] p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{k.label}</span>
                    {k.isNew && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#3A3A3A]"
                        style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
                        NEW
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">Created {k.createdAt}</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-[#3A3A3A]/70 dark:text-[#FFF9F2]/55 truncate">
                    {revealed[k.id] ? k.key : maskKey(k.key)}
                  </code>
                  <button
                    onClick={() => setRevealed((prev) => ({ ...prev, [k.id]: !prev[k.id] }))}
                    className="p-1.5 rounded-md text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 hover:text-[#FFBC80] hover:bg-[#FFBC80]/10 transition-colors"
                    title={revealed[k.id] ? "Hide key" : "Reveal key"}
                  >
                    {revealed[k.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    onClick={() => handleCopy(k.id, k.key)}
                    className="p-1.5 rounded-md text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 hover:text-[#FFBC80] hover:bg-[#FFBC80]/10 transition-colors"
                    title="Copy key"
                  >
                    {copied === k.id ? <Check size={13} className="text-[#FFBC80]" /> : <Copy size={13} />}
                  </button>
                  <button
                    onClick={() => handleRevoke(k.id)}
                    className="p-1.5 rounded-md text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Revoke key"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Guide */}
      <div className="p-5 rounded-xl border border-[#FFBC80]/40 bg-[#FFBC80]/5 dark:bg-[#FFBC80]/8">
        <div className="flex items-center gap-2 mb-2.5">
          <ShieldAlert size={15} className="text-[#FFBC80] shrink-0" />
          <p className="text-xs font-bold text-[#3A3A3A] dark:text-[#FFF9F2] uppercase tracking-wider">API Key Security</p>
        </div>
        <p className="text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 leading-relaxed">
          API keys grant full read access to your organization's marketing data. Keep them secret and never share them publicly. If a key is compromised, revoke it immediately and create a new one.
        </p>
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
  pricing: "Set MSRP or wholesale pricing mode and manage NetSuite mappings.",
  forecast: "Tune forecast model parameters and seasonality.",
  "api-keys": "Generate and manage API access keys.",
  notifications: "Set up alerts and notification preferences.",
  exports: "Configure data export formats and schedules.",
  integrations: "Connect ad platforms, analytics tools, and data sources.",
};

function ReadOnlyBanner() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFBC80]/10 border border-[#FFBC80]/30 mb-5">
      <Lock size={13} className="text-[#FFBC80] shrink-0" />
      <p className="text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/45">
        You have <span className="font-semibold">User</span> access — settings are view-only. Contact an Admin to make changes.
      </p>
    </div>
  );
}

function PanelContent({ section }: { section: string }) {
  const { currentUserRole } = useTeam();
  const canEdit = currentUserRole === "owner" || currentUserRole === "admin";

  if (section === "profile") return <ProfilePanel />;
  if (section === "appearance") return <AppearancePanel />;
  if (section === "api-keys") return <ApiKeysPanel />;
  if (section === "notifications") return <NotificationsPanel />;
  if (section === "exports") return (
    <>
      {!canEdit && <ReadOnlyBanner />}
      <ExportsPanel readOnly={!canEdit} />
    </>
  );
  if (section === "integrations") return (
    <>
      {!canEdit && <ReadOnlyBanner />}
      <IntegrationsPanel readOnly={!canEdit} />
    </>
  );
  if (section === "team") return <TeamSettings />;
  if (section === "forecast") return (
    <>
      {!canEdit && <ReadOnlyBanner />}
      <ForecastSettings readOnly={!canEdit} />
    </>
  );
  if (section === "financial") return (
    <>
      {!canEdit && <ReadOnlyBanner />}
      <FinancialSettings readOnly={!canEdit} />
    </>
  );
  if (section === "pricing") return <PricingSettings />;
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
        <main className={`flex-1 overflow-y-auto px-8 py-6 ${section === "integrations" ? "w-full" : "max-w-2xl"}`}>
          <PanelContent section={section} />
        </main>
      </div>
    </div>
  );
}
