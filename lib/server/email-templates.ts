const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

function renderEmailShell(title: string, bodyContent: string, extraStyles = ""): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fcfbff; margin: 0; padding: 40px 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 48px; border: 1px solid #e0e0e0; }
    .logo { text-align: center; margin-bottom: 32px; font-size: 22px; font-weight: 700; color: #9966FF; letter-spacing: -0.5px; }
    .greeting { font-size: 20px; font-weight: 600; color: #333333; margin-bottom: 12px; }
    .heading { font-size: 24px; font-weight: 700; color: #333333; margin: 0 0 16px; text-align: center; }
    .message { font-size: 15px; color: #666666; line-height: 1.6; margin-bottom: 28px; }
    .expiry { font-size: 14px; color: #9966FF; text-align: center; margin-bottom: 28px; font-weight: 500; }
    .footer { font-size: 13px; color: #666666; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 28px; }
    .footer a { color: #7D3FFF; text-decoration: none; font-weight: 500; }
    .footer a:hover { text-decoration: underline; }
    ${extraStyles}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">QuizWeb</div>
    ${bodyContent}
    <div class="footer">
      <p style="margin: 0 0 8px; font-weight: 600; color: #333333;">QuizWeb — Learn Web Development</p>
      <p style="margin: 0;">Need help? <a href="mailto:support@quizweb.dev">Contact support</a></p>
    </div>
  </div>
</body>
</html>`;
}

export function renderVerificationEmail(username: string, verificationLink: string): string {
  const safeName = escapeHtml(username);
  const safeLink = escapeHtml(verificationLink);
  return renderEmailShell(
    "Email Verification — QuizWeb",
    `<div class="greeting">Hi, ${safeName}!</div>
    <div class="message">
      We received an account creation using this email address.<br/>
      Please click the link below to verify your email address.
    </div>
    <div class="button"><a href="${safeLink}">Verify Email</a></div>
    <div class="expiry">This link will expire in 5 minutes.</div>`,
    `.button { text-align: center; margin-bottom: 28px; }
     .button a { display: inline-block; background: #9966FF; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; }`,
  );
}

export function renderPasswordResetOtpEmail(username: string, rawOtp: string): string {
  const safeName = escapeHtml(username);
  const safeOtp = escapeHtml(rawOtp);
  return renderEmailShell(
    "Reset Your Password — QuizWeb",
    `<p class="greeting">Hi ${safeName},</p>
    <p class="message">We received a request to reset your password. Use the code below to verify your identity:</p>
    <div class="otp-box">
      <div class="otp-label">Your verification code</div>
      <div class="otp-code">${safeOtp}</div>
    </div>
    <p class="expiry">This code expires in 5 minutes</p>
    <p class="message">If you didn't request a password reset, you can safely ignore this email.</p>`,
    `.otp-box { background: #fcfbff; border: 2px solid #9966FF; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px; }
     .otp-label { font-size: 12px; font-weight: 600; color: #9966FF; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 12px; }
     .otp-code { font-size: 40px; font-weight: 700; letter-spacing: 10px; color: #333333; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; }`,
  );
}

export function renderPasswordUpdatedEmail(): string {
  return renderEmailShell(
    "Password Updated — QuizWeb",
    `<h2 class="heading">Password Updated</h2>
    <p class="message" style="text-align: center;">Your QuizWeb password has been successfully changed. You can now sign in with your new password.</p>
    <div class="alert">
      <strong>Didn't make this change?</strong><br>
      If you didn't update your password, please <a href="mailto:support@quizweb.dev">contact support</a> immediately to secure your account.
    </div>`,
    `.alert { background: #fcfbff; border-left: 4px solid #9966FF; border-radius: 8px; padding: 16px 20px; font-size: 14px; color: #666666; line-height: 1.5; margin-bottom: 32px; }
     .alert strong { color: #333333; }`,
  );
}
