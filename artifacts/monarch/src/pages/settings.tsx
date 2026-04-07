import DashboardLayout from "@/components/layout/DashboardLayout";
import { Users, CreditCard, CalendarClock, KeyRound, Palette, Bell, Download } from "lucide-react";

const sections = [
  { icon: Users, label: "Team", desc: "Manage team members and permissions" },
  { icon: CreditCard, label: "Financial Settings", desc: "Configure billing, invoicing, and financial preferences" },
  { icon: CalendarClock, label: "Forecast Settings", desc: "Tune forecast model parameters and seasonality" },
  { icon: KeyRound, label: "API Keys", desc: "Generate and manage API access keys" },
  { icon: Palette, label: "Appearance", desc: "Customize theme, colors, and display preferences" },
  { icon: Bell, label: "Notifications", desc: "Set up alerts and notification preferences" },
  { icon: Download, label: "Exports", desc: "Configure data export formats and schedules" },
];

export default function Settings() {
  return (
    <DashboardLayout title="Settings" description="Configure your MONARCH workspace, team, and integrations.">
      <div className="max-w-2xl">
        <div className="space-y-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
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
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
