import DashboardLayout from "@/components/layout/DashboardLayout";
import { UserCircle, Users, CreditCard, CalendarClock, KeyRound, Palette, Bell, Download, Plug } from "lucide-react";
import { Link } from "wouter";

const sections = [
  { icon: UserCircle, label: "Profile", desc: "Update your name, title, and profile picture", path: "/settings/profile" },
  { icon: Users, label: "Team", desc: "Manage team members and permissions", path: "/settings/team" },
  { icon: CreditCard, label: "Financial Settings", desc: "Configure billing, invoicing, and financial preferences", path: "/settings/financial" },
  { icon: CalendarClock, label: "Forecast Settings", desc: "Tune forecast model parameters and seasonality", path: "/settings/forecast" },
  { icon: KeyRound, label: "API Keys", desc: "Generate and manage API access keys", path: "/settings/api-keys" },
  { icon: Palette, label: "Appearance", desc: "Customize theme, colors, and display preferences", path: "/settings/appearance" },
  { icon: Bell, label: "Notifications", desc: "Set up alerts and notification preferences", path: "/settings/notifications" },
  { icon: Download, label: "Exports", desc: "Configure data export formats and schedules", path: "/settings/exports" },
  { icon: Plug, label: "Integrations", desc: "Connect ad platforms, analytics tools, and data sources", path: "/integrations" },
];

export default function Settings() {
  return (
    <DashboardLayout title="Settings" description="Configure your MONARCH workspace, team, and integrations.">
      <div className="max-w-2xl">
        <div className="space-y-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.label} href={s.path} asChild>
                <button
                  className="w-full text-left p-5 rounded-xl bg-white dark:bg-[#231a0e] group transition-all hover:shadow-sm"
                  style={{
                    border: "1px solid transparent",
                    backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
                    backgroundOrigin: "border-box",
                    backgroundClip: "padding-box, border-box",
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[#FFBC80]/15 group-hover:bg-[#FFBC80]/25 transition-colors">
                      <Icon size={18} className="text-[#FFBC80]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{s.label}</p>
                      <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
