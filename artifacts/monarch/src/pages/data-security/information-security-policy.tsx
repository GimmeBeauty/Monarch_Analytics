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
        text: "This Information Security Policy establishes Durham Brands' commitment to protecting the confidentiality, integrity, and availability of all information assets associated with the Monarch Analytics platform. It sets out the principles, responsibilities, and controls that govern how information is protected across our systems, people, and third-party relationships.",
      },
      {
        heading: "Scope",
        text: "This policy applies to all Durham Brands and Gimme Beauty employees, contractors, and third-party vendors who create, process, store, or transmit data in connection with the Monarch Analytics platform (monarch.durhambrands.com). Monarch Analytics is an internal business intelligence tool — access to the platform is restricted exclusively to authorized Durham Brands and Gimme Beauty personnel; no external parties, vendors, or Gimme Beauty end consumers have login access to Monarch. This policy covers all information systems, cloud infrastructure, application code, and data integrations operated by or on behalf of Durham Brands.",
      },
    ],
  },
  {
    title: "2. Guiding Security Principles",
    body: [
      {
        heading: "Confidentiality, Integrity, Availability",
        text: "All information security decisions are guided by the CIA triad. We protect information from unauthorised disclosure (confidentiality), ensure it remains accurate and complete (integrity), and keep it accessible to authorised users when needed (availability).",
      },
      {
        heading: "Least Privilege",
        text: "Access to systems and data is granted only to the extent required to perform a specific function. No individual or system should hold broader access than is necessary for their role. Permissions are reviewed regularly and revoked when no longer needed.",
      },
      {
        heading: "Defense in Depth",
        text: "We do not rely on any single security control. Multiple overlapping layers — network controls, application-level authentication, encryption, monitoring, and personnel training — are applied so that the failure of one layer does not expose the platform to significant risk.",
      },
      {
        heading: "Security by Design",
        text: "Security requirements are considered at the design stage of all new features and integrations, not retrofitted after development. Code changes undergo security review before deployment, and new data integrations are evaluated for risk before being added to the platform.",
      },
      {
        heading: "Continuous Monitoring",
        text: "We maintain active monitoring of platform access, authentication events, and system anomalies. Alerting thresholds are reviewed quarterly and adjusted in response to the evolving threat landscape.",
      },
    ],
  },
  {
    title: "3. Infrastructure and Platform Security",
    body: [
      {
        heading: "Cloud infrastructure",
        text: "Monarch Analytics is hosted on enterprise-grade cloud infrastructure with physical security controls managed by the cloud provider, including 24/7 on-site security, biometric access controls, and environmental monitoring. Durham Brands does not operate its own physical data centre for production workloads.",
      },
      {
        heading: "Snowflake data warehouse",
        text: "Gimme Beauty consumer analytics data — including purchase history, advertising performance, and retail sales data from Shopify, Target, Walmart, and other channels — is stored in Snowflake, which provides row-level security, network isolation via private endpoints, and AES-256 encryption at rest. Snowflake's enterprise key management is used for encryption key lifecycle management. Access to Snowflake is restricted to authorised Durham Brands engineering personnel and limited service accounts.",
      },
      {
        heading: "Data in transit",
        text: "All data transmitted between Monarch Analytics clients and servers is protected by TLS 1.2 or higher. TLS 1.0 and 1.1 are disabled. Connections to third-party APIs (Meta, Google, Pinterest, Shopify, Target, Walmart, NetSuite) are made exclusively over HTTPS.",
      },
      {
        heading: "Vulnerability management",
        text: "Automated vulnerability scans are performed weekly across platform infrastructure and application dependencies. Critical vulnerabilities are remediated within 72 hours of identification. High and medium severity findings are addressed within 30 days. Security patches for the underlying operating system and runtime environments are applied on a rolling basis.",
      },
      {
        heading: "Network security",
        text: "A web application firewall (WAF) is deployed in front of all public-facing endpoints. DDoS mitigation is applied at the network edge. Production systems are isolated from development and staging environments by network-level segmentation.",
      },
    ],
  },
  {
    title: "4. Application Security",
    body: [
      {
        heading: "OAuth 2.0 for third-party integrations",
        text: "All third-party platform connections — including Meta Ads, Google Ads, Pinterest, Shopify, Target, and Walmart — are established using OAuth 2.0 with the minimum permission scopes required to read advertising and sales performance data. Monarch does not request write permissions to any connected platform. OAuth tokens are encrypted using AES-256 before storage and are never exposed in application logs or client-facing API responses.",
      },
      {
        heading: "API credential management",
        text: "API credentials for integrations that do not support OAuth (such as NetSuite and certain Target and Walmart data feeds) are stored in a secrets management system and are never hardcoded in source code or configuration files. Credentials are rotated at least annually and immediately upon any suspected compromise.",
      },
      {
        heading: "Input validation and injection prevention",
        text: "Input validation is enforced on all API endpoints. SQL queries to Snowflake use parameterised statements. User-supplied data is sanitised before being stored or rendered. Dependency scanning is performed on every build to detect known vulnerabilities in third-party packages.",
      },
      {
        heading: "Session security",
        text: "Session tokens are cryptographically generated, rotated on each authentication, and invalidated immediately on logout or password change. Sessions expire after 8 hours of inactivity. Authentication failures are rate-limited to prevent brute-force attacks.",
      },
    ],
  },
  {
    title: "5. Personnel Security",
    body: [
      {
        heading: "Security awareness training",
        text: "All Durham Brands and Gimme Beauty employees with access to Gimme Beauty consumer data (purchase, advertising, and behavioral data analyzed within Monarch) or production systems must complete security awareness training annually. Training covers phishing recognition, secure credential handling, data classification, and incident reporting procedures.",
      },
      {
        heading: "Production access controls",
        text: "Access to production infrastructure, including the Snowflake data warehouse and cloud management consoles, is limited to a named list of authorised engineering personnel. No standing privileged access is maintained for contractors; contractor access is provisioned for specific tasks and expires automatically.",
      },
      {
        heading: "Offboarding",
        text: "When an employee or contractor leaves Durham Brands or changes role, all associated system access is revoked within one business day. This includes Snowflake access, cloud console credentials, API key permissions, internal tooling accounts, and any access to Gimme Beauty consumer data or workspace configurations.",
      },
      {
        heading: "Contractor agreements",
        text: "Contractors who require access to Gimme Beauty consumer data or production systems must agree to Durham Brands' data processing terms before access is provisioned. Contractor access is scoped to the minimum required for their engagement.",
      },
    ],
  },
  {
    title: "6. Third-Party and Vendor Risk",
    body: [
      {
        heading: "Vendor assessment",
        text: "All vendors who process or access Gimme Beauty consumer data on behalf of Durham Brands are assessed before onboarding. The assessment reviews the vendor's security posture, certifications (such as SOC 2 Type II or ISO 27001), data handling practices, and sub-processor use. Vendor assessments are reviewed annually.",
      },
      {
        heading: "Integration partners",
        text: "API integrations with Meta Ads, Google Ads, Pinterest, Shopify, Target, Walmart, and NetSuite operate under OAuth 2.0 or signed data agreements that restrict the scope of access and prohibit use of Durham Brands data for purposes beyond service delivery. Integration credentials are managed per Section 4 of this policy.",
      },
      {
        heading: "Sub-processors",
        text: "Durham Brands uses a limited number of sub-processors to operate the platform, including cloud infrastructure providers, the Snowflake data warehouse, and error monitoring tools. A current list of sub-processors is maintained and made available on request at support@durhambrands.com.",
      },
      {
        heading: "Contractual requirements",
        text: "All vendors who act as data processors for Durham Brands are required to enter into a data processing agreement (DPA) that includes obligations consistent with GDPR Article 28, including maintaining appropriate technical and organisational security measures.",
      },
    ],
  },
  {
    title: "7. Physical Security",
    body: [
      {
        heading: "Cloud-first infrastructure",
        text: "Durham Brands operates a cloud-first infrastructure model. No customer data is stored on physical servers owned or directly managed by Durham Brands. All production data resides within cloud provider data centres that maintain ISO 27001 and SOC 2 Type II certifications.",
      },
      {
        heading: "Office environments",
        text: "Durham Brands office locations are access-controlled. Employees are required to lock workstations when unattended. Printed materials containing Confidential or Restricted data must be stored securely and disposed of via cross-cut shredding.",
      },
    ],
  },
  {
    title: "8. Incident Response",
    body: [
      {
        heading: "Reporting",
        text: "All suspected security incidents — including unauthorised access, credential compromise, data exposure, or malicious activity — must be reported to security@durhambrands.com within one hour of detection. Early reporting enables rapid containment and limits potential impact.",
      },
      {
        heading: "Response",
        text: "Security incidents are handled per the Monarch Analytics Incident Response Policy, which defines severity classifications, response team responsibilities, containment procedures, stakeholder notification timelines, and post-incident review requirements.",
      },
      {
        heading: "Responsible disclosure",
        text: "Durham Brands welcomes reports of security vulnerabilities from external researchers. Vulnerabilities may be reported to security@durhambrands.com. Durham Brands commits to acknowledging reports within two business days and to working in good faith with reporters toward resolution.",
      },
    ],
  },
  {
    title: "9. Compliance and Auditing",
    body: [
      {
        heading: "Regulatory alignment",
        text: "Monarch Analytics security controls are designed to support compliance with the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA). Durham Brands does not make specific regulatory certifications beyond those described in this policy without written confirmation.",
      },
      {
        heading: "Internal audits",
        text: "Security controls are reviewed internally at least annually. Reviews assess whether implemented controls remain effective and aligned with current threats and platform capabilities. Findings are documented and remediation items tracked to closure.",
      },
      {
        heading: "Access logging",
        text: "All access to production systems — including Snowflake queries, cloud console actions, and privileged API calls — is logged with user identity, timestamp, and action detail. Logs are retained for 24 months and are tamper-evident.",
      },
    ],
  },
  {
    title: "10. Policy Compliance and Review",
    body: [
      {
        heading: "Enforcement",
        text: "Violations of this policy by Durham Brands employees may result in disciplinary action, up to and including termination of employment. Contractor violations may result in immediate termination of the engagement and, where applicable, legal action.",
      },
      {
        heading: "Exceptions",
        text: "Any exception to the requirements of this policy must be documented and approved in writing by Durham Brands leadership. Exceptions are reviewed at each annual policy cycle.",
      },
      {
        heading: "Review cycle",
        text: "This policy is reviewed annually, or sooner if a significant security incident occurs or if material changes are made to the Monarch Analytics platform or its infrastructure.",
      },
    ],
  },
  {
    title: "11. Contact",
    body: [
      {
        heading: "Questions and requests",
        text: "For questions about this policy, to report a security incident, or to request the current sub-processor list, contact Durham Brands at support@durhambrands.com. For vulnerability disclosures, use security@durhambrands.com.",
      },
    ],
  },
];

export default function InfoSecPolicy() {
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
          <h1 className="text-3xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">Information Security Policy</h1>
          <p className="text-sm text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Last updated: May 2026 · Durham Brands</p>
          <p className="text-sm text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mt-4 leading-relaxed">
            This policy establishes Durham Brands' security principles and controls for the Monarch Analytics platform. It applies to all employees, contractors, systems, and third-party integrations associated with the service.
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
