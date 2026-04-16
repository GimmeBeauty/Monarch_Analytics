import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "Monarch <noreply@monarchdash.com>";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// Lazy-initialize so the server can start without a Resend key.
// Sending will still fail if the key is absent, but startup won't crash.
function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set. Configure it to enable email sending.");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

// ─── Templates ────────────────────────────────────────────────────────────────

function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#FFF9F2;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF9F2;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #FFDE99;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#FFBC80 0%,#FFE29A 100%);padding:28px 40px;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#3A3A3A;letter-spacing:-0.5px;">MONARCH</h1>
              <p style="margin:4px 0 0;font-size:12px;color:#3A3A3A;opacity:0.6;">Analytics Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 40px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #FFF0D9;background:#FFFCF5;">
              <p style="margin:0;font-size:11px;color:#3A3A3A;opacity:0.4;text-align:center;">
                © ${new Date().getFullYear()} Monarch Analytics Platform · This email was sent because an action was taken on your account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:13px 28px;background:linear-gradient(135deg,#FFBC80,#FFE29A);color:#3A3A3A;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.2px;">${label}</a>`;
}

// ─── Invite Email ─────────────────────────────────────────────────────────────

export async function sendInviteEmail(to: string, token: string, inviterName?: string): Promise<void> {
  const link = `${APP_URL}/set-password?token=${token}`;
  const inviter = inviterName ? `<strong>${inviterName}</strong>` : "a team admin";

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#3A3A3A;">You're invited to Monarch</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6B6B6B;line-height:1.6;">
      ${inviter} has invited you to join the Monarch analytics platform. Click the button below to set your password and activate your account.
    </p>
    <p style="margin:0;font-size:13px;color:#6B6B6B;line-height:1.6;">
      This invitation link expires in <strong>24 hours</strong> and can only be used once.
    </p>
    ${ctaButton(link, "Accept Invitation &amp; Set Password")}
    <p style="margin:20px 0 0;font-size:11px;color:#9B9B9B;">
      Or copy this URL: <a href="${link}" style="color:#D97706;">${link}</a>
    </p>
  `;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: "You've been invited to Monarch",
    html: baseHtml("Invitation to Monarch", body),
  });
}

// ─── Password Reset Email ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${token}`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#3A3A3A;">Reset your password</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6B6B6B;line-height:1.6;">
      We received a request to reset the password for your Monarch account. Click the button below to choose a new password.
    </p>
    <p style="margin:0;font-size:13px;color:#6B6B6B;line-height:1.6;">
      This link expires in <strong>24 hours</strong>. If you did not request a password reset, you can safely ignore this email.
    </p>
    ${ctaButton(link, "Reset Password")}
    <p style="margin:20px 0 0;font-size:11px;color:#9B9B9B;">
      Or copy this URL: <a href="${link}" style="color:#D97706;">${link}</a>
    </p>
  `;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Reset your Monarch password",
    html: baseHtml("Password Reset · Monarch", body),
  });
}
