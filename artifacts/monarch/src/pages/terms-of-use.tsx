import { useTheme } from "@/context/ThemeContext";
import Footer from "@/components/layout/Footer";
import { ArrowLeft } from "lucide-react";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: [
      {
        heading: null,
        text: "By accessing or using the MONARCH platform at monarch.durhambrands.com (\"Service\"), you agree to be bound by these Terms of Use (\"Terms\") and our Privacy Policy. If you do not agree to these Terms, you may not use the Service. If you are using the Service on behalf of an organisation, you represent that you have the authority to bind that organisation to these Terms.",
      },
    ],
  },
  {
    title: "2. Description of Service",
    body: [
      {
        heading: null,
        text: "MONARCH is a marketing analytics and spend optimisation platform that aggregates advertising and eCommerce performance data, applies statistical modelling, and provides budget allocation recommendations and reporting tools. The Service is provided on a subscription basis. Features and availability may vary by subscription tier.",
      },
    ],
  },
  {
    title: "3. Account Registration and Security",
    body: [
      {
        heading: "Registration",
        text: "You must provide accurate and complete information when creating an account. You are responsible for keeping your account information current.",
      },
      {
        heading: "Credentials",
        text: "You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You must notify us immediately at legal@durhambrands.com if you suspect any unauthorised access to your account.",
      },
      {
        heading: "Team accounts",
        text: "Workspace Owners may invite additional users. Owners and Admins are responsible for ensuring that all team members comply with these Terms and use the Service appropriately.",
      },
    ],
  },
  {
    title: "4. Acceptable Use",
    body: [
      {
        heading: "Permitted use",
        text: "You may use the Service only for lawful business purposes in accordance with these Terms and any applicable laws and regulations.",
      },
      {
        heading: "Prohibited conduct",
        text: "You must not: (a) reverse engineer, decompile, or disassemble any part of the Service; (b) use the Service to transmit malware or harmful code; (c) attempt to gain unauthorised access to any part of the Service or its underlying infrastructure; (d) use automated scripts to scrape, extract, or collect data from the Service in a way not authorised by these Terms; (e) resell or sublicense access to the Service without our prior written consent; or (f) use the Service in a way that interferes with or disrupts the Service for other users.",
      },
    ],
  },
  {
    title: "5. Connected Third-Party Services",
    body: [
      {
        heading: "Your responsibility",
        text: "When you connect a third-party platform (Google Ads, Meta Ads, Shopify, TikTok Shop, or any other integration) to MONARCH, you represent that you have the right to authorise MONARCH to access that platform on your behalf. You are solely responsible for your use of those platforms and for compliance with their respective terms of service.",
      },
      {
        heading: "Data accuracy",
        text: "MONARCH displays data as provided by your connected platforms. We are not responsible for inaccuracies, delays, or gaps in data originating from third-party sources.",
      },
      {
        heading: "No endorsement",
        text: "References to third-party services in the platform do not constitute an endorsement. Durham Brands has no control over, and assumes no responsibility for, the content or practices of any third-party service.",
      },
    ],
  },
  {
    title: "6. Intellectual Property",
    body: [
      {
        heading: "Our IP",
        text: "The MONARCH platform, including its software, design, algorithms, models, and documentation, is the exclusive property of Durham Brands and is protected by copyright, trade secret, and other intellectual property laws. These Terms do not transfer any intellectual property rights to you.",
      },
      {
        heading: "Your data",
        text: "You retain ownership of all data you connect to or upload into the Service. By using the Service, you grant Durham Brands a limited, non-exclusive licence to process your data solely for the purpose of providing the Service to you.",
      },
      {
        heading: "Feedback",
        text: "If you provide feedback or suggestions about the Service, you grant Durham Brands the right to use that feedback for any purpose without obligation to you.",
      },
    ],
  },
  {
    title: "7. Subscription, Payment, and Cancellation",
    body: [
      {
        heading: "Fees",
        text: "Subscription fees are billed in advance on a monthly or annual basis as selected at sign-up. All fees are non-refundable except as required by applicable law or as expressly stated otherwise.",
      },
      {
        heading: "Changes to pricing",
        text: "We reserve the right to change subscription pricing with at least 30 days' notice. Continued use of the Service after the effective date of a price change constitutes acceptance of the new pricing.",
      },
      {
        heading: "Cancellation",
        text: "You may cancel your subscription at any time from your account settings. Your access will continue until the end of the current billing period. Cancellation does not entitle you to a refund for the current period.",
      },
    ],
  },
  {
    title: "8. Disclaimers",
    body: [
      {
        heading: "No warranty",
        text: "The Service is provided \"as is\" and \"as available\" without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. Durham Brands does not warrant that the Service will be uninterrupted, error-free, or completely secure.",
      },
      {
        heading: "Recommendations are not guarantees",
        text: "Budget allocation recommendations, forecasts, and model outputs generated by MONARCH are based on statistical analysis of historical data. They are provided for informational purposes only and do not constitute financial advice. Actual results will differ. You are solely responsible for all decisions made based on information from the Service.",
      },
    ],
  },
  {
    title: "9. Limitation of Liability",
    body: [
      {
        heading: null,
        text: "To the maximum extent permitted by applicable law, Durham Brands and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including loss of revenue, loss of data, or loss of business — arising out of or related to your use of the Service, even if we have been advised of the possibility of such damages. Our total cumulative liability to you for any claims arising under these Terms shall not exceed the fees you paid to Durham Brands in the twelve months preceding the claim.",
      },
    ],
  },
  {
    title: "10. Indemnification",
    body: [
      {
        heading: null,
        text: "You agree to indemnify, defend, and hold harmless Durham Brands and its affiliates, officers, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in any way connected with your access to or use of the Service, your violation of these Terms, or your infringement of any third-party rights.",
      },
    ],
  },
  {
    title: "11. Termination",
    body: [
      {
        heading: "By you",
        text: "You may stop using the Service at any time and cancel your subscription as described in Section 7.",
      },
      {
        heading: "By us",
        text: "We may suspend or terminate your access to the Service immediately if you breach these Terms, if required by law, or if we discontinue the Service. We will endeavour to provide reasonable notice where practicable.",
      },
      {
        heading: "Effect of termination",
        text: "Upon termination, your right to use the Service ceases immediately. Sections 6, 8, 9, 10, and 12 survive termination.",
      },
    ],
  },
  {
    title: "12. Governing Law and Disputes",
    body: [
      {
        heading: null,
        text: "These Terms are governed by the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, except that either party may seek injunctive relief in a court of competent jurisdiction to protect its intellectual property rights.",
      },
    ],
  },
  {
    title: "13. Changes to These Terms",
    body: [
      {
        heading: null,
        text: "We may update these Terms from time to time. If we make material changes, we will notify you by email or by displaying a prominent notice in the platform at least 14 days before the updated Terms take effect. Your continued use of the Service after the effective date constitutes acceptance of the revised Terms.",
      },
    ],
  },
  {
    title: "14. Contact Us",
    body: [
      {
        heading: null,
        text: "If you have questions about these Terms, please contact us at legal@durhambrands.com. Durham Brands, monarch.durhambrands.com.",
      },
    ],
  },
];

export default function TermsOfUse() {
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
          <h1 className="text-3xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">Terms of Use</h1>
          <p className="text-sm text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">
            Effective date: April 17, 2026 · Durham Brands
          </p>
          <p className="text-sm text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mt-4 leading-relaxed">
            Please read these Terms of Use carefully before using MONARCH. These Terms constitute a legally binding agreement between you and Durham Brands governing your use of the Service.
          </p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4 pb-2 border-b border-[#FFBC80]/20">
                {section.title}
              </h2>
              <div className="space-y-4">
                {section.body.map((item, i) => (
                  <div key={i}>
                    {item.heading && (
                      <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-1">{item.heading}</h3>
                    )}
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
