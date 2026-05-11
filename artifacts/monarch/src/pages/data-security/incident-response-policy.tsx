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
        text: "This Incident Response Policy establishes Durham Brands' procedures for detecting, containing, investigating, and recovering from security incidents that affect the Monarch Analytics platform, its infrastructure, or the customer data it holds. A consistent and well-practised response minimises the impact of incidents and fulfils Durham Brands' obligations to customers, regulators, and the public.",
      },
      {
        heading: "Scope",
        text: "This policy applies to all systems, data, personnel, and third-party integrations involved in delivering the Monarch Analytics service. It covers incidents affecting customer data (advertising performance data from Meta, Google, Pinterest, Shopify, Target, Walmart, and NetSuite), user account information, Snowflake data warehouse access, platform availability, and Durham Brands internal systems.",
      },
    ],
  },
  {
    title: "2. Incident Classification",
    body: [
      {
        heading: "P1 — Critical",
        list: [
          "Confirmed unauthorised access to customer data in any volume",
          "Confirmed exfiltration of Restricted data — including OAuth tokens for connected integrations, Snowflake credentials, or user PII",
          "Platform-wide outage exceeding one hour affecting all or most customers",
          "Active ransomware, destructive malware, or denial-of-service attack with material service impact",
          "Compromise of Durham Brands' core authentication or secrets management infrastructure",
        ],
      },
      {
        heading: "P2 — High",
        list: [
          "Suspected (unconfirmed) unauthorised access to customer or internal systems",
          "Significant unintended exposure of Confidential data to internal or external parties",
          "Compromise of a single integration credential (e.g., a Meta Ads or Shopify OAuth token for one workspace)",
          "Account takeover of a Monarch Analytics Admin, Owner, or Durham Brands internal user",
          "Breach of a third-party sub-processor that processes Monarch Analytics customer data",
        ],
      },
      {
        heading: "P3 — Medium",
        list: [
          "Unsuccessful intrusion attempts that reached internal systems but did not result in data access",
          "Limited, unintended exposure of Internal data to external parties with no confirmed harm",
          "Phishing attacks targeting Durham Brands employees, regardless of success",
          "Violation of access control policy by an internal actor without evidence of malicious intent",
          "Anomalous platform behaviour that could indicate an active attack but has not been confirmed",
        ],
      },
      {
        heading: "P4 — Low",
        list: [
          "Minor policy violations by employees (e.g., use of an unapproved tool to store Internal data)",
          "Anomalous activity investigated and confirmed to be non-malicious",
          "Suspected phishing with no successful compromise confirmed",
          "Isolated misconfigurations with no data exposure",
        ],
      },
    ],
  },
  {
    title: "3. Roles and Responsibilities",
    body: [
      {
        heading: "Incident Commander",
        text: "The Durham Brands CTO or a designated senior engineering lead acts as Incident Commander. The Incident Commander declares the incident severity classification, coordinates the response team, authorises containment and eradication actions, and approves all external communications. For P1 incidents, the Incident Commander is notified immediately and remains engaged until the incident is closed.",
      },
      {
        heading: "Technical Response Team",
        text: "Platform engineers responsible for investigating, containing, and remediating the incident. The team analyses affected systems, preserves forensic evidence, implements containment measures, and leads the eradication and recovery phases. For incidents involving third-party integrations, the relevant integration owners (Meta, Google, Pinterest, Shopify, Target, Walmart, NetSuite) may be engaged.",
      },
      {
        heading: "Communications Lead",
        text: "Responsible for preparing customer notifications, regulatory filings, and any public-facing communications. Works closely with Legal Counsel to ensure all communications meet regulatory requirements and do not inadvertently create additional legal exposure.",
      },
      {
        heading: "Legal Counsel",
        text: "Advises on regulatory notification obligations (GDPR Article 33/34, state breach notification laws), manages legal privilege over investigation materials where appropriate, and coordinates with cyber-insurance providers if applicable.",
      },
      {
        heading: "All employees",
        text: "Any Durham Brands employee or contractor who becomes aware of a potential security incident must report it immediately to security@durhambrands.com. Prompt reporting is critical; employees must not attempt to investigate or contain incidents independently before notifying the response team.",
      },
    ],
  },
  {
    title: "4. Detection and Reporting",
    body: [
      {
        heading: "Detection sources",
        text: "Incidents may be detected through automated monitoring and alerting systems, anomaly detection in authentication logs, customer reports, third-party security disclosures, penetration test findings, or direct observation by Durham Brands employees.",
      },
      {
        heading: "Monitoring coverage",
        text: "All authentication events, privileged system access, Snowflake query activity, integration credential use, and platform API calls are logged. Anomaly detection rules review these logs continuously and generate alerts for patterns that may indicate unauthorised access or misuse.",
      },
      {
        heading: "Reporting channel",
        text: "Suspected incidents must be reported to security@durhambrands.com and escalated verbally to the Incident Commander within one hour of initial detection. Reports should include: what was observed, when it was observed, what systems or data may be affected, and any immediate actions already taken.",
      },
      {
        heading: "Responsible disclosure",
        text: "Durham Brands operates a responsible disclosure programme for security researchers. Vulnerabilities may be reported to security@durhambrands.com. Durham Brands commits to acknowledging reports within two business days and to working in good faith toward remediation before public disclosure.",
      },
    ],
  },
  {
    title: "5. Response Procedures",
    body: [
      {
        heading: "Step 1 — Triage",
        text: "Within one hour of the report: the Incident Commander is notified, the severity classification is assigned, the response team is assembled, and an incident record is opened to track all actions taken. Initial containment decisions are made based on available information.",
      },
      {
        heading: "Step 2 — Containment",
        list: [
          "P1 (Critical): containment actions initiated within 2 hours of detection.",
          "P2 (High): containment actions initiated within 4 hours of detection.",
          "P3/P4: containment actions initiated within 24 hours of detection.",
          "Containment measures may include: isolating affected systems from the network; revoking compromised credentials and OAuth tokens (including tokens for Meta, Google, Pinterest, Shopify, Target, Walmart, NetSuite); disabling affected integrations or user accounts; blocking identified malicious IP addresses; and restricting access to affected Snowflake schemas or tables.",
        ],
      },
      {
        heading: "Step 3 — Investigation",
        text: "The technical response team determines the root cause, the full scope of affected systems and data, the timeline of the incident, and the identity of the threat actor where possible. Forensic evidence — including logs, system snapshots, and network captures — is preserved in a tamper-evident manner before any remediation actions that might overwrite it.",
      },
      {
        heading: "Step 4 — Eradication",
        text: "The threat is removed from affected systems. This may include: patching the exploited vulnerability; revoking and rotating all potentially compromised credentials (including Snowflake connection strings, OAuth tokens, API keys, and internal service credentials); removing malicious code or backdoors; and rebuilding affected systems from known-good images where necessary.",
      },
      {
        heading: "Step 5 — Recovery",
        text: "Affected services are restored from clean backups or rebuilt infrastructure. System integrity is validated before returning to production. The restored environment is monitored closely for at least 48 hours post-recovery to confirm the threat has been fully eradicated. Recovery actions are documented in the incident record.",
      },
      {
        heading: "Step 6 — Post-Incident Review",
        text: "A post-incident review (PIR) is conducted after the incident is closed, per Section 7 of this policy. The PIR produces a written report and actionable remediation items.",
      },
    ],
  },
  {
    title: "6. Notification Timelines",
    body: [
      {
        heading: "Internal notification",
        text: "The Incident Commander and technical response team are notified within one hour of initial detection for all classified incidents. Durham Brands leadership is notified within two hours for P1 incidents and within four hours for P2 incidents.",
      },
      {
        heading: "Customer notification — P1 and P2 affecting customer data",
        text: "Where a P1 or P2 incident involves confirmed or likely unauthorised access to customer data, affected customers are notified within 72 hours of Durham Brands confirming the scope of the incident. Notifications include: the nature of the incident; the categories of data involved; the likely consequences for the affected workspace; the measures Durham Brands has taken in response; and a contact for further questions (support@durhambrands.com).",
      },
      {
        heading: "Regulatory notification — GDPR",
        text: "Where a personal data breach is likely to result in a risk to the rights and freedoms of natural persons, Durham Brands notifies the relevant supervisory authority within 72 hours of becoming aware of the breach, per GDPR Article 33. If the full scope is not yet known at 72 hours, an initial notification is submitted with a commitment to provide further information as it becomes available.",
      },
      {
        heading: "Regulatory notification — other jurisdictions",
        text: "Durham Brands complies with applicable state and national breach notification requirements in jurisdictions where affected individuals or data reside, including US state breach notification laws. Notification timelines vary by jurisdiction and are determined in consultation with Legal Counsel.",
      },
      {
        heading: "Public disclosure",
        text: "Public disclosure (e.g., a public statement or press release) is made only at the discretion of Durham Brands leadership, in coordination with Legal Counsel. Timing and content will comply with applicable law and will not be made in a manner that impedes the ongoing investigation or recovery.",
      },
    ],
  },
  {
    title: "7. Post-Incident Review",
    body: [
      {
        heading: "Review timelines",
        list: [
          "P1 (Critical): post-incident review completed and written report produced within 5 business days of incident closure.",
          "P2 (High): post-incident review completed within 10 business days of incident closure.",
          "P3 (Medium): post-incident review completed within 15 business days of incident closure.",
          "P4 (Low): documented in the incident record; formal PIR at the discretion of the Incident Commander.",
        ],
      },
      {
        heading: "PIR content",
        text: "The post-incident review report covers: a full timeline of events from detection to closure; root cause analysis; scope and impact assessment (systems affected, data exposed, customers impacted); immediate actions taken during the response; recommended remediation items to prevent recurrence; and any relevant improvements to detection, containment, or response procedures.",
      },
      {
        heading: "Remediation tracking",
        text: "All remediation items identified in the PIR are assigned to named owners with target completion dates. Progress is tracked to closure. Overdue items are escalated to Durham Brands leadership.",
      },
      {
        heading: "Leadership review",
        text: "PIR reports for P1 incidents are reviewed by Durham Brands leadership. Significant findings that affect product security architecture, customer data handling, or regulatory compliance trigger updates to this policy or other relevant security documentation.",
      },
    ],
  },
  {
    title: "8. Testing and Drills",
    body: [
      {
        heading: "Annual tabletop exercise",
        text: "Durham Brands conducts at least one tabletop incident response exercise per year, simulating a P1-level scenario (such as a confirmed breach of customer data or a credential compromise affecting production systems). The exercise tests detection, communication chains, containment decisions, and notification procedures. Findings are incorporated into future policy updates.",
      },
      {
        heading: "Contact verification",
        text: "Contact information and escalation paths for the Incident Commander, technical response team, Legal Counsel, and Communications Lead are verified quarterly to ensure they are current and reachable.",
      },
      {
        heading: "Integration revocation drills",
        text: "Durham Brands periodically tests the ability to rapidly revoke and rotate credentials for third-party integrations, including OAuth tokens for Meta, Google, Pinterest, Shopify, Target, Walmart, and NetSuite, and Snowflake connection strings. This ensures the team is practised in credential rotation under time pressure.",
      },
    ],
  },
  {
    title: "9. Policy Review",
    body: [
      {
        heading: "Review cycle",
        text: "This policy is reviewed annually, following any significant security incident, or when material changes are made to the Monarch Analytics platform, its infrastructure, or applicable regulatory requirements. Each annual review incorporates lessons learned from any incidents or drills conducted in the preceding year.",
      },
    ],
  },
  {
    title: "10. Contact",
    body: [
      {
        heading: "Reporting a security incident or vulnerability",
        text: "To report a suspected security incident or disclose a vulnerability: security@durhambrands.com. For general policy questions or customer notifications: support@durhambrands.com. Durham Brands commits to acknowledging all security reports within two business days.",
      },
    ],
  },
];

export default function IncidentResponsePolicyPage() {
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
          <h1 className="text-3xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">Incident Response Policy</h1>
          <p className="text-sm text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Last updated: May 2026 · Durham Brands</p>
          <p className="text-sm text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mt-4 leading-relaxed">
            This policy defines how Durham Brands detects, responds to, and recovers from security incidents affecting Monarch Analytics — including incident classification, response team roles, step-by-step procedures, customer and regulatory notification timelines, and post-incident review requirements.
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
