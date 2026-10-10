import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const MAIL_FROM = process.env.MAIL_FROM ?? "Veritas <onboarding@resend.dev>";

function enabled(): boolean {
  return Boolean(RESEND_API_KEY);
}

/**
 * Sends a verification email containing a link the student clicks to confirm
 * their email address. Returns the verification token on success so callers can
 * persist a hash of it. Returns null if email sending is not configured (e.g.
 * local development) so callers can fall back gracefully.
 */
export async function sendVerificationEmail(input: {
  email: string;
  name: string;
  verificationToken: string;
}): Promise<boolean> {
  if (!enabled()) return false;

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERITAS_BASE_URL ?? "";
  const verifyUrl = `${baseUrl}/verify?token=${encodeURIComponent(
    input.verificationToken
  )}`;

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: MAIL_FROM,
    to: [input.email],
    subject: "Verify your Veritas account",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
        <h1 style="font-size:18px;margin:0 0 8px">Verify your email</h1>
        <p style="margin:0 0 16px;color:#475569">
          Hi ${escapeHtml(input.name)}, thanks for creating a Veritas account.
          Confirm your email address to start taking exams.
        </p>
        <p style="margin:0 0 24px">
          <a href="${verifyUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">
            Verify my email
          </a>
        </p>
        <p style="margin:0 0 24px;color:#64748b;font-size:13px">
          Or copy and paste this link into your browser:<br/>
          <span style="color:#64748b;word-break:break-all">${verifyUrl}</span>
        </p>
        <p style="margin:0;color:#94a3b8;font-size:12px">
          If you didn't create this account, you can ignore this email.
        </p>
      </div>
    `,
  });
  return !error;
}

/**
 * Sends a password-reset email containing a single-use link. Returns false if
 * email sending is not configured or Resend reports an error.
 */
export async function sendPasswordResetEmail(input: {
  email: string;
  name: string;
  resetToken: string;
}): Promise<boolean> {
  if (!enabled()) return false;

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERITAS_BASE_URL ?? "";
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(
    input.resetToken
  )}`;

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: MAIL_FROM,
    to: [input.email],
    subject: "Reset your Veritas password",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
        <h1 style="font-size:18px;margin:0 0 8px">Reset your password</h1>
        <p style="margin:0 0 16px;color:#475569">
          Hi ${escapeHtml(input.name)}, we received a request to reset the password
          for your Veritas account. Click the button below to choose a new one.
        </p>
        <p style="margin:0 0 24px">
          <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">
            Choose a new password
          </a>
        </p>
        <p style="margin:0 0 24px;color:#64748b;font-size:13px">
          Or copy and paste this link into your browser:<br/>
          <span style="color:#64748b;word-break:break-all">${resetUrl}</span>
        </p>
        <p style="margin:0;color:#94a3b8;font-size:12px">
          This link expires in 5 minutes. If you didn't request a password reset, you
          can safely ignore this email.
        </p>
      </div>
    `,
  });
  return !error;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string
  );
}
