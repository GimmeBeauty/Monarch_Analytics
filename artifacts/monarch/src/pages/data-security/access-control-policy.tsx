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
        text: "This Access Control Policy governs how access to Monarch Analytics and its underlying systems is provisioned, maintained, and revoked. It ensures that only authorised individuals can access data and platform capabilities appropriate to their role, reducing the risk of unauthorised access, data exposure, and insider threat.",
      },
      {
        heading: "Scope",
        text: "This policy applies to all Durham Brands employees and contractors who have access to production systems, and to all customer users of the Monarch Analytics platform. It covers authentication, role assignments, credential management, privileged access, and access review procedures.",
      },
    ],
  },
  {
    title: "2. Authentication Requirements",
    body: [
      {
        heading: "Account credentials",
        text: "All Monarch Analytics accounts require a unique email address and a password meeting the following minimum requirements: at least 12 characters in length; a combination of uppercase letters, lowercase letters, numbers, and at least one special character. Passwords are evaluated against a list of known-compromised passwords at creation and reset time.",
      },
      {
        heading: "Password storage",
        text: "Passwords are hashed using bcrypt with an appropriate work factor before storage. Plaintext passwords are never stored, logged, or transmitted after initial input. Durham Brands employees and systems never have access to users' plaintext passwords.",
      },
      {
        heading: "Rate limiting and lockout",
        text: "Failed authentication attempts are rate-limited. Accounts are temporarily locked after 10 consecutive failed login attempts. Locked accounts can be unlocked via the password reset flow or by an account owner. Suspicious login patterns (e.g., authentication from an unusual geographic location) trigger additional verification.",
      },
      {
        heading: "Session management",
        text: "Authenticated sessions expire after 8 hours of inactivity. Session tokens are cryptographically generated, rotated at each new authentication, and invalidated immediately upon logout or password change. Sessions are bound to the user agent and IP subnet to reduce token hijacking risk.",
      },
    ],
  },
  {
    title: "3. Multi-Factor Authentication (MFA)",
    body: [
      {
        heading: "Internal requirement",
        text: "MFA is mandatory for all Durham Brands employee and contractor accounts with access to production systems, the Snowflake data warehouse, cloud management consoles, or customer workspace data. Access without MFA enabled is not permitted for these accounts.",
      },
      {
        heading: "Customer accounts",
        text: "Customer workspace Owners and Admins are strongly encouraged to enable MFA for their accounts. Workspace-level MFA enforcement (requiring all members of a workspace to use MFA) is a configurable setting available to workspace Owners. Durham Brands reserves the right to require MFA for all accounts in future platform updates.",
      },
      {
        heading: "Supported methods",
        text: "Authenticator app (TOTP — Time-based One-Time Password, compatible with Google Authenticator, Authy, and similar apps) is the preferred and recommended MFA method. SMS-based one-time codes are supported as a fallback. Hardware security keys (FIDO2/WebAuthn) are supported for Durham Brands internal accounts.",
      },
      {
        heading: "Recovery codes",
        text: "MFA bypass (recovery) codes are single-use, generated at MFA enrolment, stored as bcrypt hashes, and presented to the user once at setup. Lost recovery codes require identity verification via account owner or support@durhambrands.com. Durham Brands does not store or have access to individual users' plaintext recovery codes.",
      },
    ],
  },
  {
    title: "4. Role-Based Access Control (RBAC)",
    body: [
      {
        heading: "Customer platform roles",
        list: [
          "Owner — Full platform access including billing management, workspace deletion, and removal of any team member. One Owner per workspace. Owner status can be transferred to another admin by the current Owner.",
          "Admin — Full access to all analytics dashboards, reports, and integrations. Can invite new team members, assign and change roles (up to Admin), and deactivate members. Cannot manage billing or delete the workspace.",
          "User — Read access to all dashboards and reports within the workspace. Cannot modify integrations, team composition, financial settings, or forecast configurations.",
        ],
      },
      {
        heading: "Durham Brands internal roles",
        text: "Internal engineering, support, and operations roles are managed separately from customer workspace roles. Internal access to customer workspace data is restricted to authorised personnel for support, debugging, and platform maintenance purposes. All such access is logged and reviewed. Internal roles follow a least-privilege model and are reviewed monthly.",
      },
      {
        heading: "Role assignment",
        text: "Workspace Owners and Admins are responsible for assigning appropriate roles to team members. Roles should reflect the minimum access required for each individual's responsibilities. Role assignments are documented and subject to periodic review as described in Section 8.",
      },
    ],
  },
  {
    title: "5. Integration and API Access",
    body: [
      {
        heading: "OAuth 2.0 integrations",
        text: "Third-party platform connections — Meta Ads, Google Ads, Pinterest, Shopify, Target, and Walmart — are established using OAuth 2.0. Monarch requests only the minimum permission scopes required to read advertising and sales performance data. Write permissions to connected platforms are never requested. OAuth tokens are encrypted using AES-256 before storage and are scoped to the specific workspace that authorised them.",
      },
      {
        heading: "Direct API integrations",
        text: "API credentials for integrations that use API keys rather than OAuth (including NetSuite and certain Target and Walmart data feed configurations) are stored in an approved secrets management system. Credentials are encrypted at rest, never exposed in application logs or client responses, and not shared between customer workspaces.",
      },
      {
        heading: "Token rotation and revocation",
        text: "Integration credentials are rotated at least annually and immediately upon any suspected compromise. OAuth tokens are revoked and re-requested when a user explicitly disconnects an integration. All active OAuth tokens for a workspace are invalidated when a workspace is deleted.",
      },
      {
        heading: "API key access to Monarch",
        text: "Where Monarch Analytics provides API access to customers for data export or automation purposes, API keys are scoped to the issuing workspace, have configurable expiry, and can be revoked at any time by a workspace Owner or Admin.",
      },
    ],
  },
  {
    title: "6. Privileged Access Management",
    body: [
      {
        heading: "Production system access",
        text: "Access to production infrastructure — including the Snowflake data warehouse, cloud management consoles, deployment pipelines, and customer data stores — is restricted to a named list of authorised Durham Brands engineers. This list is reviewed and updated monthly.",
      },
      {
        heading: "Just-in-time access",
        text: "Production access for routine tasks follows a just-in-time model where possible: access is granted for a defined duration and automatically expires. No standing long-term privileged access is maintained for contractors. Engineer access to production is further protected by VPN and MFA requirements.",
      },
      {
        heading: "Audit logging",
        text: "All privileged actions in production systems are logged with the user identity, timestamp, affected resource, and action taken. Logs are stored in a tamper-evident system, retained for 24 months, and reviewed for anomalies at least monthly.",
      },
    ],
  },
  {
    title: "7. Remote Access",
    body: [
      {
        heading: "VPN requirement",
        text: "Durham Brands employees and contractors accessing production systems remotely must do so through an approved VPN or zero-trust network access solution. Direct internet-accessible SSH or RDP to production infrastructure is not permitted.",
      },
      {
        heading: "Device requirements",
        text: "Personal or company-issued devices used to access production systems must have full-disk encryption enabled, a current operating system with security patches applied, and active endpoint protection software. Unmanaged or non-compliant devices must not be used to access Restricted or Confidential data.",
      },
    ],
  },
  {
    title: "8. Access Reviews and Revocation",
    body: [
      {
        heading: "Customer workspace reviews",
        text: "Workspace Owners are responsible for reviewing their team's access quarterly. The review should confirm that each member's role reflects their current responsibilities and that no former employees or contractors retain active access.",
      },
      {
        heading: "Internal production access reviews",
        text: "Durham Brands engineering leadership reviews the list of individuals with production system access on a monthly basis. Any access that is no longer required for an active role is revoked promptly.",
      },
      {
        heading: "Offboarding",
        text: "When a Durham Brands employee or contractor leaves or changes role, all system access is revoked within one business day of the departure or role change. This includes production infrastructure access, internal tooling, and any access to customer workspace data granted for support or engineering purposes.",
      },
      {
        heading: "Customer offboarding",
        text: "Workspace Owners are responsible for deactivating team members who leave their organisation. Durham Brands provides workspace-level account management tools for this purpose. Deactivated accounts retain no access to the workspace and their sessions are invalidated immediately.",
      },
      {
        heading: "Stale accounts",
        text: "Monarch Analytics accounts with no login activity for 180 days are flagged for review. If no response is received from the account holder within 30 days of notification, the account is suspended. Workspace Owners may reactivate suspended accounts on request.",
      },
    ],
  },
  {
    title: "9. Policy Review",
    body: [
      {
        heading: "Review cycle",
        text: "This policy is reviewed annually, or following any access-related security incident, significant change to the platform's authentication architecture, or change in applicable regulatory requirements.",
      },
    ],
  },
  {
    title: "10. Contact",
    body: [
      {
        heading: "Questions and requests",
        text: "For questions about access control, to report a suspected access violation, or to request access to Durham Brands internal systems, contact support@durhambrands.com.",
      },
    ],
  },
];

export default function AccessControlPolicyPage() {
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
          <h1 className="text-3xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">Access Control Policy</h1>
          <p className="text-sm text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Last updated: May 2026 · Durham Brands</p>
          <p className="text-sm text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mt-4 leading-relaxed">
            This policy defines how access to Monarch Analytics and its underlying systems is provisioned, controlled, and revoked — covering authentication, role-based permissions, MFA, credential management, and periodic access review.
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
