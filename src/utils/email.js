/**
 * Email service for StudyBuddy.
 * Uses nodemailer when SMTP is configured; otherwise logs to console (mock) for development.
 * Credentials MUST come from environment variables.
 */

const BASE_STYLES = `
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #1f2937;
  max-width: 520px;
  margin: 0 auto;
  padding: 32px 24px;
  background: #ffffff;
`;

const BUTTON_STYLES = `
  display: inline-block;
  padding: 14px 28px;
  background: #2563eb;
  color: #ffffff !important;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
`;

const FOOTER_STYLES = `
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
`;

function createEmailTemplate(content, preheader = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StudyBuddy</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#fff;max-height:0;overflow:hidden;">${preheader}</span>` : ''}
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height:100%;background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="${BASE_STYLES}border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td>
              <div style="text-align:center;margin-bottom:24px;">
                <span style="font-size:24px;font-weight:700;color:#2563eb;">StudyBuddy</span>
              </div>
              ${content}
              <div style="${FOOTER_STYLES}">
                <p style="margin:0 0 8px 0;">StudyBuddy - Your personal study companion</p>
                <p style="margin:0;color:#d1d5db;">This is an automated message. Please do not reply.</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(to, subject, html, text) {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    const from = process.env.EMAIL_FROM || `StudyBuddy <${process.env.SMTP_USER}>`;
    await transporter.sendMail({ from, to, subject, text, html });
    return;
  }

  // Mock: log to console when SMTP is not configured
  console.log(`[Mock Email] To: ${to}`);
  console.log(`[Mock Email] Subject: ${subject}`);
  console.log(`[Mock Email] Text: ${text}`);
}

/** Email Verification */
async function sendVerificationEmail(to, verifyLink) {
  const subject = 'Verify your StudyBuddy account';
  const html = createEmailTemplate(`
    <h1 style="font-size:20px;margin:0 0 16px 0;color:#111827;">Verify your email address</h1>
    <p style="margin:0 0 24px 0;color:#4b5563;">
      Welcome to StudyBuddy! Please verify your email address to activate your account and start your learning journey.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${verifyLink}" style="${BUTTON_STYLES}">Verify Email</a>
    </div>
    <p style="font-size:14px;color:#6b7280;margin:24px 0 0 0;">
      This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.
    </p>
  `, 'Please verify your email to activate your StudyBuddy account.');
  
  const text = `Verify your email address\n\nWelcome to StudyBuddy! Click the link below to verify your email (expires in 24 hours):\n${verifyLink}\n\nIf you didn't create an account, ignore this email.\n\n— StudyBuddy`;
  
  await sendEmail(to, subject, html, text);
}

/** Password Reset */
async function sendPasswordResetEmail(to, resetLink) {
  const subject = 'Reset your StudyBuddy password';
  const html = createEmailTemplate(`
    <h1 style="font-size:20px;margin:0 0 16px 0;color:#111827;">Reset your password</h1>
    <p style="margin:0 0 24px 0;color:#4b5563;">
      You requested a password reset for your StudyBuddy account. Click the button below to choose a new password.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${resetLink}" style="${BUTTON_STYLES}">Reset Password</a>
    </div>
    <p style="font-size:14px;color:#6b7280;margin:24px 0 0 0;">
      This link expires in <strong>15 minutes</strong> and can only be used once. If you didn't request this, you can safely ignore this email.
    </p>
  `, 'Reset your StudyBuddy password (link expires in 15 minutes).');
  
  const text = `Reset your password\n\nClick the link below (expires in 15 minutes, one-time use):\n${resetLink}\n\nIf you didn't request this, ignore this email.\n\n— StudyBuddy`;
  
  await sendEmail(to, subject, html, text);
}

/** Password Changed Alert */
async function sendPasswordChangedEmail(to) {
  const subject = 'Your StudyBuddy password was changed';
  const html = createEmailTemplate(`
    <h1 style="font-size:20px;margin:0 0 16px 0;color:#111827;">Password changed</h1>
    <p style="margin:0 0 16px 0;color:#4b5563;">
      Your StudyBuddy account password was successfully changed.
    </p>
    <p style="margin:0 0 24px 0;color:#4b5563;">
      If you made this change, no further action is needed. If you did not change your password, please reset it immediately and contact support.
    </p>
    <div style="background:#fef3c7;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0;font-size:14px;color:#92400e;">
        <strong>Security tip:</strong> If you didn't make this change, your account may be compromised. Reset your password immediately.
      </p>
    </div>
  `, 'Your StudyBuddy password was changed.');
  
  const text = `Password changed\n\nYour StudyBuddy account password was successfully changed.\n\nIf you didn't make this change, please reset your password immediately.\n\n— StudyBuddy`;
  
  await sendEmail(to, subject, html, text);
}

/** Account Deactivated */
async function sendAccountDeactivatedEmail(to, name) {
  const subject = 'Your StudyBuddy account has been deactivated';
  const html = createEmailTemplate(`
    <h1 style="font-size:20px;margin:0 0 16px 0;color:#111827;">Account deactivated</h1>
    <p style="margin:0 0 16px 0;color:#4b5563;">
      Hi ${name},
    </p>
    <p style="margin:0 0 24px 0;color:#4b5563;">
      Your StudyBuddy account has been deactivated. Your data is preserved, and you can reactivate your account at any time by signing in.
    </p>
    <p style="font-size:14px;color:#6b7280;margin:24px 0 0 0;">
      We'd love to have you back whenever you're ready to continue your learning journey.
    </p>
  `, 'Your StudyBuddy account has been deactivated.');
  
  const text = `Account deactivated\n\nHi ${name},\n\nYour StudyBuddy account has been deactivated. Your data is preserved, and you can reactivate by signing in.\n\n— StudyBuddy`;
  
  await sendEmail(to, subject, html, text);
}

/** Account Deleted */
async function sendAccountDeletedEmail(to, name) {
  const subject = 'Your StudyBuddy account has been deleted';
  const html = createEmailTemplate(`
    <h1 style="font-size:20px;margin:0 0 16px 0;color:#111827;">Account deleted</h1>
    <p style="margin:0 0 16px 0;color:#4b5563;">
      Hi ${name},
    </p>
    <p style="margin:0 0 24px 0;color:#4b5563;">
      Your StudyBuddy account and all associated data have been permanently deleted as requested.
    </p>
    <p style="margin:0 0 24px 0;color:#4b5563;">
      We're sorry to see you go. If you ever want to start fresh, you're always welcome to create a new account.
    </p>
  `, 'Your StudyBuddy account has been permanently deleted.');
  
  const text = `Account deleted\n\nHi ${name},\n\nYour StudyBuddy account and all associated data have been permanently deleted.\n\nWe're sorry to see you go.\n\n— StudyBuddy`;
  
  await sendEmail(to, subject, html, text);
}

/** Security Alert - New Login */
async function sendLoginAlertEmail(to, name, ipAddress, userAgent) {
  const subject = 'New sign-in to your StudyBuddy account';
  const html = createEmailTemplate(`
    <h1 style="font-size:20px;margin:0 0 16px 0;color:#111827;">New sign-in detected</h1>
    <p style="margin:0 0 16px 0;color:#4b5563;">
      Hi ${name},
    </p>
    <p style="margin:0 0 24px 0;color:#4b5563;">
      We detected a new sign-in to your StudyBuddy account.
    </p>
    <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:0 0 24px 0;">
      <p style="margin:0 0 8px 0;font-size:14px;color:#4b5563;"><strong>IP Address:</strong> ${ipAddress || 'Unknown'}</p>
      <p style="margin:0;font-size:14px;color:#4b5563;"><strong>Device:</strong> ${userAgent ? userAgent.substring(0, 100) : 'Unknown'}</p>
    </div>
    <p style="font-size:14px;color:#6b7280;margin:0;">
      If this was you, no action is needed. If you don't recognize this activity, please change your password immediately.
    </p>
  `, 'New sign-in to your StudyBuddy account.');
  
  const text = `New sign-in detected\n\nHi ${name},\n\nWe detected a new sign-in to your StudyBuddy account.\n\nIP Address: ${ipAddress || 'Unknown'}\nDevice: ${userAgent ? userAgent.substring(0, 100) : 'Unknown'}\n\nIf this wasn't you, change your password immediately.\n\n— StudyBuddy`;
  
  await sendEmail(to, subject, html, text);
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountDeactivatedEmail,
  sendAccountDeletedEmail,
  sendLoginAlertEmail
};
