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
        text: "This Data Classification Policy defines how Durham Brands categorises information assets to ensure they receive the level of protection appropriate to their sensitivity. Consistent classification enables employees and systems to apply the right controls automatically, reducing the risk of accidental exposure or mishandling.",
      },
      {
        heading: "Scope",
        text: "This policy applies to all data created, processed, stored, or transmitted through the Monarch Analytics platform — including customer analytics data, integration credentials, internal business records, and this policy document itself. It applies to all Durham Brands employees, contractors, and systems that handle such data.",
      },
    ],
  },
  {
    title: "2. Classification Levels",
    body: [
      {
        heading: "Overview",
        text: "Durham Brands uses four classification levels, ordered from least to most sensitive. Every piece of data processed by or on behalf of Durham Brands falls into one of these levels. When in doubt, data should be treated as the more sensitive of the two candidate levels.",
      },
      {
        heading: "Public",
        text: "Information that is approved for unrestricted public release and carries no risk if disclosed externally. This is the lowest sensitivity level.",
      },
      {
        heading: "Internal",
        text: "Information intended for use within Durham Brands that is not approved for public release but would cause limited harm if inadvertently disclosed.",
      },
      {
        heading: "Confidential",
        text: "Sensitive business or customer information that requires controlled access. Unauthorised disclosure could cause material harm to customers, Durham Brands, or its partners.",
      },
      {
        heading: "Restricted",
        text: "Highly sensitive information that requires the strictest possible controls. Unauthorised disclosure could cause severe harm, including regulatory penalties, significant financial loss, or a major security incident. This is the highest sensitivity level.",
      },
    ],
  },
  {
    title: "3. Public Data — Examples and Handling",
    body: [
      {
        heading: "Examples",
        list: [
          "This policy document and all other policies published at monarch.durhambrands.com/knowledge-hub/data-security",
          "Monarch Analytics product documentation, help centre articles, and release notes",
          "Durham Brands marketing materials, press releases, and content published on durhambrands.com",
          "General company information: office locations, leadership names, product pricing tiers",
          "Job postings and publicly shared research or blog content",
        ],
      },
      {
        heading: "Handling requirements",
        text: "No restrictions on distribution or storage. No special labelling is required. May be shared freely via any channel, including external email, social media, and public websites.",
      },
    ],
  },
  {
    title: "4. Internal Data — Examples and Handling",
    body: [
      {
        heading: "Examples",
        list: [
          "Internal product roadmaps, feature specifications, and engineering design documents",
          "Employee handbooks, internal HR communications, and general operational procedures",
          "Aggregated, anonymised platform usage statistics used internally for product development (e.g., feature adoption rates, session duration averages with no customer identity)",
          "Internal team meeting notes, Slack communications, and project management content",
          "Non-production deployment configurations and internal tool documentation",
        ],
      },
      {
        heading: "Handling requirements",
        text: "Share only within Durham Brands-managed systems and with Durham Brands personnel. Do not distribute externally without manager approval. Store only on company-approved systems (managed cloud storage, internal tools). No special encryption beyond standard platform controls is required, but data should not be placed on personal devices or unapproved external services.",
      },
    ],
  },
  {
    title: "5. Confidential Data — Examples and Handling",
    body: [
      {
        heading: "Examples",
        list: [
          "Customer advertising performance data pulled from Meta Ads, Google Ads, and Pinterest integrations (campaign spend, impressions, conversions, ROAS)",
          "Snowflake query results, reports, and data exports generated from the Monarch Analytics platform",
          "NetSuite financial data synced to Monarch, including wholesale revenue, order volumes, and store-level sales figures",
          "Sales and inventory data from Shopify, Target, and Walmart integrations",
          "Customer workspace configurations, store filter settings, and dashboard customisations",
          "API credentials (client IDs and secrets) for connected platform integrations",
          "Business contracts, legal agreements, and pricing negotiations",
          "Customer support tickets and communications containing account-specific details",
        ],
      },
      {
        heading: "Handling requirements",
        text: "Accessible on a strict need-to-know basis. Must be encrypted at rest (AES-256) and in transit (TLS 1.2+). Access is controlled via role-based permissions within Monarch Analytics and logged. Must not be transmitted via unencrypted email. Documents shared externally (e.g., report exports sent to clients) should be marked 'Confidential — Durham Brands' in the header or footer. Must not be stored on personal devices or unapproved cloud storage services.",
      },
    ],
  },
  {
    title: "6. Restricted Data — Examples and Handling",
    body: [
      {
        heading: "Examples",
        list: [
          "OAuth 2.0 access tokens and refresh tokens for Meta Ads, Google Ads, Pinterest, Shopify, Target, Walmart, and NetSuite integrations",
          "Snowflake connection strings, service account credentials, and data warehouse access keys",
          "Database encryption keys and key management service (KMS) credentials",
          "Individual user authentication credentials, password hashes, and MFA recovery codes stored by Monarch Analytics",
          "Personally identifiable information (PII) such as user names, email addresses, and IP addresses held by Durham Brands",
          "Payment and billing information (managed by our payment processor; Durham Brands does not store full card numbers)",
          "Private keys for TLS certificates and code signing",
          "Security audit reports and penetration test results",
        ],
      },
      {
        heading: "Handling requirements",
        text: "Accessible only to specifically authorised personnel, identified by name or role. Must be stored exclusively in approved secrets management systems — never in source code, configuration files, application logs, emails, or chat messages. Access requires multi-factor authentication. Any exposure of Restricted data, whether confirmed or suspected, must be treated as a security incident and reported immediately to security@durhambrands.com. Restricted data must not leave approved systems under any circumstances without explicit written approval from Durham Brands leadership.",
      },
    ],
  },
  {
    title: "7. Labelling and Marking",
    body: [
      {
        heading: "Documents and reports",
        text: "Documents and reports generated from Monarch Analytics that are shared externally should include the classification level in the document header or footer (e.g., 'Confidential — Durham Brands'). Public documents do not require a label.",
      },
      {
        heading: "Electronic files",
        text: "Files stored in shared drives or internal repositories should use folder-level naming conventions to indicate classification (e.g., /Restricted/, /Confidential/). Automated data classification tooling, where available, may supplement manual labelling.",
      },
      {
        heading: "Communications",
        text: "Internal communications (email, Slack) that contain Confidential or Restricted data should include a brief notice at the top (e.g., 'This message contains Confidential information intended only for the named recipients') and should be sent only to individuals with a legitimate need to know.",
      },
    ],
  },
  {
    title: "8. Reclassification and Declassification",
    body: [
      {
        heading: "Reclassification requests",
        text: "Data owners may request reclassification by submitting a written request to support@durhambrands.com describing the data in question, its current classification, the proposed new classification, and the business rationale.",
      },
      {
        heading: "Approval requirements",
        text: "Reclassification to a lower sensitivity level (e.g., from Confidential to Internal) requires manager approval and is documented. Reclassification to a higher level may be made unilaterally by any employee who believes existing classification is insufficient; this should be communicated to the data owner.",
      },
      {
        heading: "Legal and regulatory constraints",
        text: "Data subject to a legal hold, regulatory retention requirement, or active investigation may not be reclassified or deleted until the relevant obligation has been satisfied. Questions should be directed to support@durhambrands.com.",
      },
    ],
  },
  {
    title: "9. Retention and Disposal",
    body: [
      {
        heading: "Retention",
        text: "Data must be retained according to the schedules defined in the Monarch Analytics Data Protection Policy. Classification level does not override retention requirements; even Public data should not be deleted if it is subject to a retention obligation.",
      },
      {
        heading: "Secure disposal",
        text: "When data reaches the end of its retention period or is otherwise authorised for deletion, it must be disposed of in a manner that prevents reconstruction. For digital data, this means secure deletion (overwriting or cryptographic erasure); simply moving a file to the trash or deleting a database record is insufficient for Confidential and Restricted data. Printed copies must be cross-cut shredded.",
      },
    ],
  },
  {
    title: "10. Policy Review",
    body: [
      {
        heading: "Review cycle",
        text: "This policy is reviewed annually, or when significant changes are made to the Monarch Analytics platform, its data processing activities, or applicable regulatory requirements.",
      },
    ],
  },
  {
    title: "11. Contact",
    body: [
      {
        heading: "Questions and requests",
        text: "For questions about data classification or to request a reclassification review, contact Durham Brands at support@durhambrands.com.",
      },
    ],
  },
];

export default function DataClassPolicy() {
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
          <h1 className="text-3xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">Data Classification Policy</h1>
          <p className="text-sm text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Last updated: May 2026 · Durham Brands</p>
          <p className="text-sm text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mt-4 leading-relaxed">
            This policy defines how Durham Brands categorises data processed through Monarch Analytics into four levels — Public, Internal, Confidential, and Restricted — and specifies the handling requirements and real-world examples for each.
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
