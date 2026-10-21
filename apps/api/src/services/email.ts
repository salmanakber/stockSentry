import { prisma, type EmailTemplateKey } from "@stocksentry/database";

export type EmailVars = Record<string, string | number | null | undefined>;

export type SendEmailResult = {
  ok: boolean;
  provider: "resend" | "smtp" | "none";
  messageId?: string;
  errorCode?: string;
};

const DEFAULT_FROM =
  process.env.EMAIL_FROM ??
  "StockSentry <noreply@stocksentry.tidyflowapp.com>";

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

async function sendViaResend(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, provider: "none", errorCode: "NO_EMAIL_PROVIDER" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: DEFAULT_FROM,
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
}): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return { ok: false, provider: "none", errorCode: "NO_EMAIL_PROVIDER" };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  // Dynamic import so API boots without nodemailer when unused
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const info = await transport.sendMail({
    from: DEFAULT_FROM,
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
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(input);
  }
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return sendViaSmtp(input);
  }

  console.warn(
    "[email] NO_EMAIL_PROVIDER — set RESEND_API_KEY or SMTP_* to deliver mail",
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
