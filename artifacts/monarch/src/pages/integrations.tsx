import DashboardLayout from "@/components/layout/DashboardLayout";
import { SiGoogleads, SiMeta, SiTiktok, SiGoogleanalytics, SiShopify } from "react-icons/si";
import { CheckCircle, Circle } from "lucide-react";

const integrations = [
  { Icon: SiGoogleads, name: "Google Ads", desc: "Import campaign data, spend, and conversions", connected: true, color: "#4285F4" },
  { Icon: SiMeta, name: "Meta Ads", desc: "Sync Facebook and Instagram ad data", connected: true, color: "#0082FB" },
  { Icon: SiTiktok, name: "TikTok Ads", desc: "Connect TikTok for Business campaigns", connected: false, color: "#010101" },
  { Icon: SiGoogleanalytics, name: "Google Analytics", desc: "Pull traffic, pageview, and behavior data", connected: true, color: "#E37400" },
  { Icon: SiShopify, name: "Shopify", desc: "Connect your store for revenue attribution", connected: false, color: "#96BF48" },
];

export default function Integrations() {
  return (
    <DashboardLayout title="Integrations" description="Connect your ad platforms, analytics tools, and data sources.">
      <div className="max-w-2xl space-y-3">
        {integrations.map(({ Icon, name, desc, connected, color }) => (
          <div
            key={name}
            className="flex items-center gap-4 p-5 rounded-xl monarch-card-settings"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-50 dark:bg-[#2e2010]">
              <Icon size={20} color={color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{name}</p>
              <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">{desc}</p>
            </div>
            <div className="flex items-center gap-2">
              {connected ? (
                <>
                  <CheckCircle size={16} className="text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Connected</span>
                </>
              ) : (
                <button
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#3A3A3A] transition-opacity hover:opacity-80"
                  style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
