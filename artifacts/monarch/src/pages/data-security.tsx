import { Link } from "wouter";
import { Shield, Lock, Database, UserCheck, AlertTriangle, ArrowRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import Footer from "@/components/layout/Footer";

const POLICIES = [
  {
    Icon: Shield,
    title: "Information Security Policy",
    description:
      "Our foundational security principles, infrastructure controls, personnel responsibilities, and third-party risk management practices for the Monarch Analytics platform.",
    href: "/knowledge-hub/data-security/information-security-policy",
    color: "#3B82F6",
  },
  {
    Icon: Database,
    title: "Data Classification Policy",
    description:
      "How we categorise information as Public, Internal, Confidential, or Restricted — with handling requirements and real examples from Monarch's Snowflake and integration data.",
    href: "/knowledge-hub/data-security/data-classification-policy",
    color: "#8B5CF6",
  },
  {
    Icon: UserCheck,
    title: "Access Control Policy",
    description:
      "Authentication requirements, role-based permissions, MFA enforcement, credential management, and periodic access review procedures for all platform users.",
    href: "/knowledge-hub/data-security/access-control-policy",
    color: "#10B981",
  },
  {
    Icon: Lock,
    title: "Data Protection Policy",
    description:
      "Encryption standards, data retention schedules, deletion procedures, backup and recovery, and our GDPR and CCPA compliance commitments.",
    href: "/knowledge-hub/data-security/data-protection-policy",
    color: "#F59E0B",
  },
  {
    Icon: AlertTriangle,
    title: "Incident Response Policy",
    description:
      "How we classify security incidents, who responds, customer and regulatory notification timelines, and our post-incident review process.",
    href: "/knowledge-hub/data-security/incident-response-policy",
    color: "#EF4444",
  },
];

export default function DataSecurity() {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/monarch-logo.jpg" : "/monarch-logo-light.jpg";

  return (
    <div className="min-h-screen bg-[#FFF9F2] dark:bg-[#120d06] flex flex-col">
      {/* Top nav */}
      <div className="border-b border-[#FFBC80]/30 dark:border-[#FFBC80]/20 px-8 py-4 bg-[#FFF9F2]/80 dark:bg-[#1a1208]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-sm text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors font-medium"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            Back
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="Monarch" className="w-7 h-7 rounded-md object-cover object-center" />
            <span className="font-black text-sm tracking-widest text-[#3A3A3A] dark:text-[#FFF9F2]">MONARCH</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-8 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5" style={{ background: "linear-gradient(135deg,#FFBC80,#FFE29A)" }}>
            <Shield size={24} className="text-[#3A3A3A]" />
          </div>
          <h1 className="text-3xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">Data Security & Privacy</h1>
          <p className="text-sm text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">
            Last updated: May 2026 · Durham Brands
          </p>
          <p className="text-sm text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mt-4 leading-relaxed max-w-2xl">
            Durham Brands is committed to protecting the security and privacy of data processed through Monarch Analytics. The policies below define how we safeguard your information across our platform, infrastructure, and third-party integrations. All policies apply to the Monarch Analytics service at monarch.durhambrands.com.
          </p>
          <p className="text-sm text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mt-3 leading-relaxed">
            Questions? Contact us at{" "}
            <a href="mailto:support@durhambrands.com" className="text-[#FFBC80] hover:underline">
              support@durhambrands.com
            </a>
          </p>
        </div>

        {/* Policy cards */}
        <div className="grid grid-cols-1 gap-4">
          {POLICIES.map(({ Icon, title, description, href, color }) => (
            <Link key={href} href={href}>
              <div className="group rounded-2xl border border-[#FFBC80]/20 dark:border-[#FFBC80]/15 bg-white dark:bg-[#1a1208] hover:border-[#FFBC80]/50 dark:hover:border-[#FFBC80]/40 transition-all duration-200 cursor-pointer overflow-hidden">
                <div className="px-6 py-5 flex items-start gap-5">
                  <div
                    className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: `${color}18` }}
                  >
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] group-hover:text-[#FFBC80] transition-colors leading-snug mb-1">
                      {title}
                    </p>
                    <p className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 leading-relaxed">
                      {description}
                    </p>
                  </div>
                  <div className="shrink-0 self-center text-[#3A3A3A]/25 dark:text-[#FFF9F2]/20 group-hover:text-[#FFBC80] transition-colors">
                    <ArrowRight size={16} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-8 border-t border-[#FFBC80]/15">
          <p className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 leading-relaxed">
            These policies apply to Durham Brands, Inc. and the Monarch Analytics platform. For legal enquiries, data subject access requests, or vulnerability disclosures, please contact{" "}
            <a href="mailto:support@durhambrands.com" className="hover:text-[#FFBC80] transition-colors">
              support@durhambrands.com
            </a>
            . Policies are reviewed annually and updated as required by changes to the platform, applicable law, or industry standards.
          </p>
        </div>
      </div>

      <div className="pb-10">
        <Footer />
      </div>
    </div>
  );
}
