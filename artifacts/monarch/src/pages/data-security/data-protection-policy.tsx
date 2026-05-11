import { Link } from "wouter";
import { useTheme } from "@/context/ThemeContext";
import Footer from "@/components/layout/Footer";

interface BodyItem { heading: string; text?: string; list?: string[] }
interface Section { title: string; body: BodyItem[] }

const SECTIONS: Section[] = [
  {
    title: "1. Purpose and Scope",
    body: [
      {
        heading: "Purpose",
        text: "This Data Protection Policy defines how Durham Brands protects data throughout its lifecycle on the Monarch Analytics platform. It covers encryption standards, data retention schedules, deletion procedures, backup and recovery, and obligations under applicable privacy law, including the GDPR and CCPA.",
      },
      {
        heading: "Scope",
        text: "This policy applies to all data created, processed, stored, or transmitted by the Monarch Analytics platform — including customer analytics data pulled from third-party integrations, user account information, financial data from NetSuite, and Durham Brands operational data. It applies to all Durham Brands employees, contractors, and systems that handle such data.",
      },
    ],
  },
  {
    title: "2. Data Encryption",
    body: [
      {
        heading: "Encryption in transit",
        text: "All data transmitted between Monarch Analytics clients and Durham Brands servers is encrypted using TLS 1.2 or higher. TLS 1.0 and 1.1 are disabled on all public-facing endpoints. Connections to third-party APIs — including Meta Ads, Google Ads, Pinterest, Shopify, Target, Walmart, and NetSuite — are made exclusively over HTTPS. Unencrypted connections are rejected.",
      },
      {
        heading: "Encryption at rest",
        text: "Data stored in Snowflake is encrypted at rest using AES-256. Snowflake's enterprise key management service manages encryption key lifecycle, including key rotation. Data in transit within the Snowflake environment is encrypted end-to-end. Database backups are encrypted using the same standards as primary data storage.",
      },
      {
        heading: "Credential and token encryption",
        text: "OAuth 2.0 access tokens and refresh tokens for Meta Ads, Google Ads, Pinterest, Shopify, Target, Walmart, and NetSuite integrations are encrypted using AES-256 before storage in the Monarch Analytics database. API keys for direct integrations are stored in an approved secrets management system with encryption at rest. Encryption keys used to protect credentials are stored separately from the encrypted data and are subject to rotation annually.",
      },
      {
        heading: "Export and report data",
        text: "Customer-facing data exports (CSV, Excel, PDF) are generated in-memory and delivered directly to the requesting user. Exports are not stored on Durham Brands servers after delivery. If an export must be temporarily cached (e.g., for large report generation), it is stored encrypted and deleted within 24 hours of generation.",
      },
    ],
  },
  {
    title: "3. Data Retention Schedules",
    body: [
      {
        heading: "Retention schedule by data type",
        list: [
          "User account data (name, email address, hashed password, role, title): retained for the duration of account activity, plus 30 days following account deletion request.",
          "Advertising performance data from Meta Ads, Google Ads, and Pinterest integrations (campaign spend, impressions, conversions, ROAS): retained for 36 months from the date of collection.",
          "Retail sales data from Shopify, Target, and Walmart integrations (revenue, units sold, product performance, geographic data): retained for 36 months from the date of collection.",
          "Financial data from NetSuite (wholesale revenue, order volumes, store-level sales): retained for 36 months from the date of collection.",
          "Platform audit logs (login events, integration changes, data access, settings modifications): retained for 24 months.",
          "Session data and authentication tokens: purged after 90 days of inactivity.",
          "Support ticket records and customer communications: retained for 36 months from ticket closure.",
          "Billing and payment records: retained for 7 years to satisfy financial regulatory requirements.",
        ],
      },
      {
        heading: "Retention overrides",
        text: "Legal holds, regulatory investigations, or contractual obligations may require data to be retained beyond the standard schedules above. In such cases, the standard deletion procedure is suspended for the affected data until the hold is lifted. Durham Brands will notify affected customers where legally permitted.",
      },
    ],
  },
  {
    title: "4. Data Deletion Procedures",
    body: [
      {
        heading: "Account deletion",
        text: "When a user submits an account deletion request, all personally identifiable information associated with that account (name, email address, authentication credentials) is removed from active systems within 30 days. Anonymised usage data that cannot be linked back to the individual may be retained for product analytics purposes.",
      },
      {
        heading: "Workspace deletion",
        text: "When a workspace Owner deletes a Monarch Analytics workspace, all workspace data — including integration configurations, OAuth tokens, historical analytics data, reports, and team member records — is purged from active systems within 30 days. Backup copies containing workspace data are overwritten on the next scheduled backup cycle following the purge.",
      },
      {
        heading: "Integration disconnection",
        text: "When a customer disconnects a third-party integration (Meta, Google, Pinterest, Shopify, Target, Walmart, NetSuite), associated OAuth tokens are immediately revoked and deleted from Durham Brands systems. Historical performance data collected through that integration remains available in the workspace for the standard 36-month retention period unless the customer explicitly requests earlier deletion.",
      },
      {
        heading: "End-of-retention deletion",
        text: "Data that reaches the end of its applicable retention period is deleted from primary storage in the next scheduled data lifecycle run (performed monthly). Backup copies are overwritten on the next backup cycle following the primary deletion. The deletion process produces a log entry confirming what was deleted and when.",
      },
      {
        heading: "Requesting deletion",
        text: "Customers may request deletion of specific data or their entire workspace by contacting support@durhambrands.com. Durham Brands will confirm receipt within two business days and confirm completion of deletion within 30 days, or inform the customer if any legal or regulatory obligation prevents full deletion.",
      },
    ],
  },
  {
    title: "5. Backup and Recovery",
    body: [
      {
        heading: "Backup schedule",
        text: "Monarch Analytics data stored in Snowflake is backed up daily using Snowflake's automated backup capabilities. Point-in-time recovery is available for the preceding 7 days, allowing restoration to any point within that window.",
      },
      {
        heading: "Geographic redundancy",
        text: "Backup data is stored in a geographically separate region from the primary data. This ensures that a regional infrastructure failure does not simultaneously affect both primary data and backups.",
      },
      {
        heading: "Backup integrity",
        text: "Backup integrity is verified monthly through automated restoration tests. Test restorations are performed to a staging environment and validated against known data checksums. Any integrity failure triggers an immediate alert and investigation.",
      },
      {
        heading: "Recovery objectives",
        list: [
          "Recovery Time Objective (RTO): 4 hours for critical platform components (authentication, core dashboards, data query engine) following a major infrastructure failure.",
          "Recovery Point Objective (RPO): 24 hours — in a worst-case scenario, up to one day of data ingest from connected integrations may need to be re-fetched after a catastrophic failure.",
        ],
      },
      {
        heading: "Backup access",
        text: "Access to backup data is restricted to authorised Durham Brands platform engineers. All backup access is logged with user identity, timestamp, and purpose. Backups may not be accessed for any purpose other than disaster recovery, compliance, or integrity testing without written approval from Durham Brands leadership.",
      },
    ],
  },
  {
    title: "6. GDPR Compliance",
    body: [
      {
        heading: "Roles under GDPR",
        text: "Durham Brands acts as a data controller for information it collects about its own users (name, email, usage data). Durham Brands acts as a data processor on behalf of customers who are data controllers for their end users' data where applicable. All data processing activities are governed by a Data Processing Agreement (DPA) available upon request.",
      },
      {
        heading: "Data subject rights",
        text: "Data subjects in the European Economic Area have the following rights, which Durham Brands will honour within 30 days of a verified request: the right to access a copy of their personal data; the right to correct inaccurate data; the right to erasure ('right to be forgotten'); the right to restrict processing; the right to data portability in a machine-readable format; the right to object to processing based on legitimate interest.",
      },
      {
        heading: "Submitting requests",
        text: "Data subjects may submit rights requests to support@durhambrands.com. Durham Brands will verify the identity of the requestor before processing any request and will respond within 30 calendar days (with a possible 60-day extension for complex requests, with notice to the requestor).",
      },
      {
        heading: "Cross-border transfers",
        text: "Durham Brands does not transfer personal data outside the European Economic Area except under appropriate safeguards, including Standard Contractual Clauses (SCCs) or equivalent mechanisms recognised by applicable EU data protection law. A list of countries to which data may be transferred is available on request.",
      },
      {
        heading: "Legal basis for processing",
        text: "Durham Brands processes personal data on the following legal bases: contract performance (providing the Monarch Analytics service); legitimate interest (security monitoring, fraud prevention, platform improvement); legal obligation (complying with applicable law); and, where required, consent (non-essential communications).",
      },
    ],
  },
  {
    title: "7. CCPA Compliance",
    body: [
      {
        heading: "No sale of personal information",
        text: "Durham Brands does not sell personal information as defined under the California Consumer Privacy Act (CCPA). Durham Brands does not share personal information with third parties for cross-context behavioural advertising.",
      },
      {
        heading: "California consumer rights",
        text: "California residents have the right to: know what personal information Durham Brands has collected about them and how it is used; request deletion of their personal information; correct inaccurate personal information; and opt out of any sale or sharing (though Durham Brands does not engage in such activities). Durham Brands will not discriminate against any individual for exercising these rights.",
      },
      {
        heading: "Submitting CCPA requests",
        text: "California residents may submit verified consumer requests to support@durhambrands.com. Durham Brands will respond to verified requests within 45 calendar days, with a possible 45-day extension if reasonably necessary.",
      },
    ],
  },
  {
    title: "8. Data Minimisation",
    body: [
      {
        heading: "Collection limitation",
        text: "Monarch Analytics collects only the data necessary to provide the analytics and optimisation services described in the product. Fields received via integration APIs that are not required for platform functionality are discarded and not stored.",
      },
      {
        heading: "OAuth scope limitation",
        text: "OAuth permission scopes requested from Meta, Google, Pinterest, Shopify, Target, and Walmart are restricted to the minimum required to read advertising and sales performance data. Monarch does not request write permissions to any connected platform. Scope requests are reviewed when integrations are updated and narrowed if feasible.",
      },
    ],
  },
  {
    title: "9. Policy Review",
    body: [
      {
        heading: "Review cycle",
        text: "This policy is reviewed annually, or when significant changes are made to Monarch's data processing activities, infrastructure, or applicable privacy law.",
      },
    ],
  },
  {
    title: "10. Contact",
    body: [
      {
        heading: "Questions and requests",
        text: "For data subject access requests, deletion requests, questions about this policy, or to obtain the current DPA or sub-processor list, contact Durham Brands at support@durhambrands.com.",
      },
    ],
  },
];

export default function DataProtectionPolicyPage() {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/monarch-logo.jpg" : "/monarch-logo-light.jpg";

  return (
    <div className="min-h-screen bg-[#FFF9F2] dark:bg-[#120d06] flex flex-col">
      {/* Top nav */}
      <div className="border-b border-[#FFBC80]/30 dark:border-[#FFBC80]/20 px-8 py-4 bg-[#FFF9F2]/80 dark:bg-[#1a1208]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/knowledge-hub/data-security">
            <button className="flex items-center gap-2 text-sm text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors font-medium">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              Data Security & Privacy
            </button>
          </Link>
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
          <h1 className="text-3xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">Data Protection Policy</h1>
          <p className="text-sm text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Last updated: May 2026 · Durham Brands</p>
          <p className="text-sm text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mt-4 leading-relaxed">
            This policy defines how Durham Brands protects data throughout its lifecycle on the Monarch Analytics platform — covering encryption standards, retention schedules, deletion procedures, backup and recovery, and GDPR and CCPA obligations.
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
                    {item.text && (
                      <p className="text-sm text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 leading-relaxed">{item.text}</p>
                    )}
                    {item.list && (
                      <ul className="space-y-1.5 mt-1">
                        {item.list.map((li, i) => (
                          <li key={i} className="flex gap-2 text-sm text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 leading-relaxed">
                            <span className="text-[#FFBC80] font-bold mt-0.5 shrink-0">·</span>
                            <span>{li}</span>
                          </li>
                        ))}
                      </ul>
                    )}
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
