import { Sun, Moon } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useTheme } from "@/context/ThemeContext";

export default function AppearanceSettings() {
  const { theme, toggleTheme } = useTheme();

  const cardStyle = {
    border: "1px solid transparent",
    backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
  };

  return (
    <DashboardLayout title="Appearance" description="Customize how MONARCH looks for you.">
      <div className="max-w-lg space-y-6">
        <div className="rounded-xl p-6 bg-white dark:bg-[#231a0e]" style={cardStyle}>
          <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-5">Theme</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Light mode option */}
            <button
              data-testid="theme-light"
              onClick={() => theme === "dark" && toggleTheme()}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                theme === "light" ? "border-[#FFBC80]" : "border-transparent hover:border-[#FFBC80]/40"
              }`}
              style={theme === "light" ? { background: "linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)" } : { background: "rgba(255,188,128,0.06)" }}
            >
              <Sun size={20} className={`mx-auto mb-2 ${theme === "light" ? "text-[#3A3A3A]" : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40"}`} />
              <p className={`text-sm font-semibold ${theme === "light" ? "text-[#3A3A3A]" : "text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50"}`}>Light</p>
              <p className={`text-xs mt-0.5 ${theme === "light" ? "text-[#3A3A3A]/60" : "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30"}`}>Warm cream tones</p>
            </button>

            {/* Dark mode option */}
            <button
              data-testid="theme-dark"
              onClick={() => theme === "light" && toggleTheme()}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                theme === "dark" ? "border-[#FFBC80]" : "border-transparent hover:border-[#FFBC80]/40"
              }`}
              style={theme === "dark" ? { background: "linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)" } : { background: "rgba(255,188,128,0.06)" }}
            >
              <Moon size={20} className={`mx-auto mb-2 ${theme === "dark" ? "text-[#3A3A3A]" : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40"}`} />
              <p className={`text-sm font-semibold ${theme === "dark" ? "text-[#3A3A3A]" : "text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50"}`}>Dark</p>
              <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-[#3A3A3A]/60" : "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30"}`}>Warm amber night</p>
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
