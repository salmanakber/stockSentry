import { prisma, type EmailTemplateKey } from "@stocksentry/database";
import { resolveResendConfig } from "./app-config.js";

export type EmailVars = Record<string, string | number | null | undefined>;

export type SendEmailResult = {
  ok: boolean;
  provider: "resend" | "smtp" | "none";
  messageId?: string;
  errorCode?: string;
};

/** Simple mustache-like `{{key}}` substitution (no sections/partials). */
export function renderTemplate(template: string, vars: EmailVars): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    if (v == null) return "";
    return String(v);
  });
}

export async function resolveEmailTemplate(
  shopId: string | null,
  key: EmailTemplateKey,
): Promise<{ subject: string; htmlBody: string; textBody: string }> {
  if (shopId) {
    const override = await prisma.emailTemplate.findFirst({
      where: { shopId, key },
    });
    if (override) {
      return {
        subject: override.subject,
        htmlBody: override.htmlBody,
        textBody: override.textBody,
      };
    }
  }

  const system = await prisma.emailTemplate.findFirst({
    where: { shopId: null, key },
  });
  if (system) {
    return {
      subject: system.subject,
      htmlBody: system.htmlBody,
      textBody: system.textBody,
    };
  }

  // Hardcoded fallback if seed missing
  return {
    subject: `[StockSentry] ${key}`,
    htmlBody: `<p>{{summary}}</p>`,
    textBody: `{{summary}}`,
  };
}

/** Wrap arbitrary body HTML in the StockSentry branded shell when not already wrapped. */
export function wrapBrandedHtml(
  bodyHtml: string,
  opts?: { eyebrow?: string },
): string {
  if (
    bodyHtml.includes("StockSentry") &&
    bodyHtml.includes("#008060") &&
    bodyHtml.includes("<!DOCTYPE")
  ) {
    return bodyHtml;
  }

  const eyebrow = opts?.eyebrow ?? "Inventory monitoring";
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f5;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dce5e1;">
<tr><td style="background:#008060;padding:20px 28px;">
  <div style="color:#ffffff;font-size:18px;font-weight:700;">StockSentry</div>
  <div style="color:#d4f5eb;font-size:13px;margin-top:4px;">${eyebrow}</div>
</td></tr>
<tr><td style="padding:28px;color:#44554d;font-size:14px;line-height:1.5;">
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px;background:#f7faf8;color:#6b7c74;font-size:12px;line-height:1.45;">
StockSentry monitors stock and flags unusual changes. It is read-only and never changes Shopify inventory.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendViaResend(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  apiKey: string;
  fromEmail: string;
}): Promise<SendEmailResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.fromEmail,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[email] Resend failed", res.status, body.slice(0, 200));
    return {
      ok: false,
      provider: "resend",
      errorCode: `RESEND_${res.status}`.slice(0, 64),
    };
  }

  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, provider: "resend", messageId: json.id };
}

async function sendViaSmtp(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromEmail: string;
}): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return { ok: false, provider: "none", errorCode: "NO_EMAIL_PROVIDER" };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const info = await transport.sendMail({
    from: input.fromEmail,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  return {
    ok: true,
    provider: "smtp",
    messageId: typeof info.messageId === "string" ? info.messageId : undefined,
  };
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const cfg = await resolveResendConfig();
  const fromEmail =
    cfg.fromEmail || "StockSentry <noreply@stocksentry.tidyflowapp.com>";
  const html = wrapBrandedHtml(input.html);

  if (cfg.enabled !== false && cfg.apiKey) {
    return sendViaResend({
      to: input.to,
      subject: input.subject,
      html,
      text: input.text,
      apiKey: cfg.apiKey,
      fromEmail,
    });
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return sendViaSmtp({
      to: input.to,
      subject: input.subject,
      html,
      text: input.text,
      fromEmail,
    });
  }

  console.warn(
    "[email] NO_EMAIL_PROVIDER — configure admin Resend settings or set RESEND_API_KEY / SMTP_*",
    { to: input.to, subject: input.subject },
  );
  return { ok: false, provider: "none", errorCode: "NO_EMAIL_PROVIDER" };
}

export async function sendTemplatedEmail(input: {
  shopId: string;
  to: string;
  key: EmailTemplateKey;
  vars: EmailVars;
}): Promise<SendEmailResult> {
  const tpl = await resolveEmailTemplate(input.shopId, input.key);
  return sendEmail({
    to: input.to,
    subject: renderTemplate(tpl.subject, input.vars),
    html: renderTemplate(tpl.htmlBody, input.vars),
    text: renderTemplate(tpl.textBody, input.vars),
  });
}

export function appBaseUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.EMBEDDED_APP_URL ??
    "https://stocksentry.tidyflowapp.com"
  ).replace(/\/$/, "");
}
