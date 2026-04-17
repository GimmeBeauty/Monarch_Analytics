import { useTheme } from "@/context/ThemeContext";
import Footer from "@/components/layout/Footer";
import { ArrowLeft } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: [
      {
        heading: "Account information",
        text: "When you create a MONARCH account we collect your name, email address, job title, and password. If you are invited to an organisation by a team admin, we collect the same information when you complete your registration.",
      },
      {
        heading: "Usage data",
        text: "We automatically collect information about how you interact with the platform: pages visited, features used, date range and filter selections, and session duration. This data is used solely to operate and improve the service.",
      },
      {
        heading: "Connected integration data",
        text: "When you connect a third-party platform (such as Google Ads, Meta Ads, Shopify, or TikTok Shop) MONARCH reads advertising spend, revenue, and performance data from those platforms on your behalf using the permissions you grant via OAuth. We store this data in order to power the analytics dashboards and modelling features described in the service.",
      },
      {
        heading: "Payment information",
        text: "Billing and subscription payments are processed by our third-party payment provider. Durham Brands does not store full credit card numbers or payment credentials on its own servers.",
      },
    ],
  },
  {
    title: "2. How We Use Your Information",
    body: [
      {
        heading: "Providing the service",
        text: "We use your account information to authenticate you, manage your organisation workspace, and deliver the analytics, modelling, and optimisation features of MONARCH.",
      },
      {
        heading: "Product improvement",
        text: "Aggregated, de-identified usage data helps us understand which features are most valuable and where users encounter friction. We use this to prioritise product improvements.",
      },
      {
        heading: "Communications",
        text: "We may send you transactional emails (password resets, integration alerts, weekly performance digests) and, with your consent, product update announcements. You can unsubscribe from non-transactional emails at any time from Settings → Notifications.",
      },
      {
        heading: "Legal obligations",
        text: "We may process your information where required to comply with applicable law, respond to lawful requests from public authorities, or protect the rights and safety of our users.",
      },
    ],
  },
  {
    title: "3. Third-Party Integrations",
    body: [
      {
        heading: "Data accessed on your behalf",
        text: "MONARCH connects to third-party advertising and eCommerce platforms at your direction. The data pulled from these platforms (campaign spend, revenue, conversions, etc.) remains your data. We act as a data processor on your behalf when handling it.",
      },
      {
        heading: "OAuth tokens",
        text: "Access tokens obtained through OAuth flows (Google, Meta, TikTok Shop, Shopify) are stored securely in encrypted form. We use them only to fetch data you have authorised us to read. We do not use these tokens to make any write or modify requests on your connected platforms.",
      },
      {
        heading: "Sub-processors",
        text: "We use trusted sub-processors to operate the service, including cloud infrastructure providers, database services, and error monitoring tools. A current list of sub-processors is available on request at legal@durhambrands.com.",
      },
    ],
  },
  {
    title: "4. Data Sharing",
    body: [
      {
        heading: "We do not sell your data",
        text: "Durham Brands does not sell, rent, or trade your personal information or your connected platform data to any third party for marketing or any other commercial purpose.",
      },
      {
        heading: "Within your organisation",
        text: "Data within a MONARCH workspace is shared among team members according to their assigned role (Owner, Admin, or User). Owners and Admins can manage who has access to the workspace.",
      },
      {
        heading: "Legal disclosure",
        text: "We may disclose information if required by law, court order, or other governmental authority, or if we believe disclosure is necessary to protect the rights, property, or safety of Durham Brands, our users, or the public.",
      },
    ],
  },
  {
    title: "5. Data Security",
    body: [
      {
        heading: "Measures in place",
        text: "We apply industry-standard security practices including encryption of data in transit (TLS) and at rest, role-based access controls, and regular security reviews. OAuth credentials and API secrets are stored encrypted.",
      },
      {
        heading: "No guarantee",
        text: "No method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security. You are responsible for maintaining the confidentiality of your account credentials.",
      },
    ],
  },
  {
    title: "6. Data Retention",
    body: [
      {
        heading: "Active accounts",
        text: "We retain your account information and connected platform data for as long as your MONARCH account remains active.",
      },
      {
        heading: "Account deletion",
        text: "When you delete your account or disconnect an integration, we will delete the associated data within 30 days, unless we are required to retain it for legal or compliance purposes.",
      },
    ],
  },
  {
    title: "7. Your Rights",
    body: [
      {
        heading: "Access and portability",
        text: "You have the right to request a copy of the personal data we hold about you in a structured, machine-readable format.",
      },
      {
        heading: "Correction and deletion",
        text: "You can update your name and profile information directly in Settings → Profile. To request deletion of your account and associated data, contact us at legal@durhambrands.com.",
      },
      {
        heading: "GDPR and CCPA",
        text: "If you are located in the European Economic Area or California, you may have additional rights under the GDPR or CCPA respectively — including the right to object to certain processing and to lodge a complaint with your local supervisory authority. We will respond to verified rights requests within 30 days.",
      },
    ],
  },
  {
    title: "8. Cookies",
    body: [
      {
        heading: "What we use",
        text: "MONARCH uses strictly necessary cookies to maintain your authenticated session. We do not use advertising cookies or share cookie data with any ad network.",
      },
    ],
  },
  {
    title: "9. Changes to This Policy",
    body: [
      {
        heading: "Notification",
        text: "We may update this Privacy Policy from time to time. If we make material changes, we will notify you by email or by displaying a prominent notice in the platform at least 14 days before the change takes effect. Continued use of the service after the effective date constitutes acceptance of the updated policy.",
      },
    ],
  },
  {
    title: "10. Contact Us",
    body: [
      {
        heading: "Questions or requests",
        text: "If you have any questions about this Privacy Policy or wish to exercise your data rights, please contact us at legal@durhambrands.com. Durham Brands, monarch.durhambrands.com.",
      },
    ],
  },
];

export default function PrivacyPolicy() {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/monarch-logo.jpg" : "/monarch-logo-light.jpg";

  return (
    <div className="min-h-screen bg-[#FFF9F2] dark:bg-[#120d06] flex flex-col">
      {/* Top nav */}
      <div className="border-b border-[#FFBC80]/30 dark:border-[#FFBC80]/20 px-8 py-4 bg-[#FFF9F2]/80 dark:bg-[#1a1208]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-sm text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors font-medium"
          >
            <ArrowLeft size={16} />Back
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="Monarch" className="w-7 h-7 rounded-md object-cover object-center" />
            <span className="font-black text-sm tracking-widest text-[#3A3A3A] dark:text-[#FFF9F2]">MONARCH</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-8 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">Privacy Policy</h1>
          <p className="text-sm text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">
            Effective date: April 17, 2026 · Durham Brands
          </p>
          <p className="text-sm text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mt-4 leading-relaxed">
            Durham Brands ("we", "us", or "our") operates the MONARCH analytics platform at monarch.durhambrands.com ("Service"). This Privacy Policy explains how we collect, use, store, and share information about you when you use the Service.
          </p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4 pb-2 border-b border-[#FFBC80]/20">
                {section.title}
              </h2>
              <div className="space-y-4">
                {section.body.map((item) => (
                  <div key={item.heading}>
                    <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-1">{item.heading}</h3>
                    <p className="text-sm text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pb-10">
        <Footer />
      </div>
    </div>
  );
}
