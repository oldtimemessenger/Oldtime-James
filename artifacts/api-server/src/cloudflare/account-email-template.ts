export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]!);
}

/** No remote fonts, tracking pixels, invented logo, or provider-specific markup. */
export function accountVerificationEmail(email: string, link: string, purpose: "signup" | "change" | "official" = "signup") {
  const change = purpose === "change", official = purpose === "official";
  const heading = change ? "Confirm your new email" : official ? "Confirm your email" : "Welcome to Oldtime";
  const explanation = change
    ? `You asked to use ${email} for your Oldtime sign-in. Your current email stays active until you confirm.`
    : official
      ? `You requested the first claim of the official @oldtime account for ${email}. The account will not be created until you confirm.`
      : "Thanks for joining Oldtime. Please verify your email address to finish setting up your account. You can keep using Oldtime in the meantime.";
  const security = change ? "If you did not request this change, you can safely ignore this email."
    : "If you didn’t create an Oldtime account, you can safely ignore this email.";
  const label = change || official ? "Review and confirm" : "Verify My Email";
  const year = new Date().getUTCFullYear();
  const safeLink = escapeEmailHtml(link);
  return {
    from: "Oldtime <verify@heyoldtime.com>",
    to: [email],
    subject: change ? "Confirm your Oldtime email change" : official ? "Verify your email to claim the official Oldtime account" : "Verify your Oldtime account",
    text: `${heading}\n\n${explanation}\n\n${label}: ${link}\n\nThis link expires in 30 minutes. ${security}\n\n© ${year} Oldtime. All rights reserved.`,
    html: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#ffffff;color:#17191c;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px"><tr><td style="padding:24px;border:1px solid #e8e9ec;border-radius:16px"><p style="margin:0 0 24px;font-size:20px;font-weight:700">Oldtime</p><h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">${heading}</h1><p style="margin:0 0 20px">${escapeEmailHtml(explanation)}</p><p style="margin:24px 0"><a href="${safeLink}" style="display:inline-block;background:#1557d2;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700">${label}</a></p><p style="font-size:14px;color:#53565c">If the button doesn’t work, copy and paste the verification link into your browser:</p><p style="font-size:13px;overflow-wrap:anywhere;word-break:break-all"><a href="${safeLink}" style="color:#1557d2">${safeLink}</a></p><p style="margin:24px 0 0;font-size:14px;color:#53565c">This link expires in 30 minutes. ${security}</p></td></tr><tr><td style="padding:18px 24px;font-size:12px;color:#62656a">© ${year} Oldtime. All rights reserved.</td></tr></table></td></tr></table></body></html>`,
  };
}
