/**
 * Seeds DB-driven plans from static PLAN_ENTITLEMENTS values.
 * Run: `npx prisma db seed` (from packages/database) or via migrate.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Mirrors packages/shared PLAN_ENTITLEMENTS — keep in sync on seed. */
const PLAN_SEEDS = [
  {
    slug: "free",
    displayName: "Free",
    description:
      "Try Bundle Safety on a small catalog — monitoring, basic alerts, limited AI.",
    priceUsdMonthly: 0,
    trialDays: 0,
    maxMonitoredItems: 75,
    historyDays: 7,
    maxOpenIncidents: 15,
    aiReportsPerMonth: 3,
    advancedRules: false,
    exportsEnabled: false,
    teamWorkflows: false,
    isFree: true,
    active: true,
    sortOrder: 0,
  },
  {
    slug: "starter",
    displayName: "Starter",
    description:
      "For growing stores — more items, CSV exports, and monthly AI incident reports.",
    priceUsdMonthly: 14.99,
    trialDays: 14,
    maxMonitoredItems: 500,
    historyDays: 60,
    maxOpenIncidents: 100,
    aiReportsPerMonth: 40,
    advancedRules: false,
    exportsEnabled: true,
    teamWorkflows: false,
    isFree: false,
    active: true,
    sortOrder: 1,
  },
  {
    slug: "pro",
    displayName: "Pro",
    description:
      "Advanced detection rules, team workflows, and deeper history for serious ops teams.",
    priceUsdMonthly: 39.99,
    trialDays: 14,
    maxMonitoredItems: 5000,
    historyDays: 180,
    maxOpenIncidents: 1000,
    aiReportsPerMonth: 200,
    advancedRules: true,
    exportsEnabled: true,
    teamWorkflows: true,
    isFree: false,
    active: true,
    sortOrder: 2,
  },
  {
    slug: "growth",
    displayName: "Growth",
    description:
      "High-volume catalogs and multi-location merchants who need scale.",
    priceUsdMonthly: 99,
    trialDays: 14,
    maxMonitoredItems: 50000,
    historyDays: 365,
    maxOpenIncidents: 10000,
    aiReportsPerMonth: 1000,
    advancedRules: true,
    exportsEnabled: true,
    teamWorkflows: true,
    isFree: false,
    active: true,
    sortOrder: 3,
  },
] as const;

async function ensurePlans() {
  for (const plan of PLAN_SEEDS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: { ...plan },
      update: {
        displayName: plan.displayName,
        description: plan.description,
        priceUsdMonthly: plan.priceUsdMonthly,
        trialDays: plan.trialDays,
        maxMonitoredItems: plan.maxMonitoredItems,
        historyDays: plan.historyDays,
        maxOpenIncidents: plan.maxOpenIncidents,
        aiReportsPerMonth: plan.aiReportsPerMonth,
        advancedRules: plan.advancedRules,
        exportsEnabled: plan.exportsEnabled,
        teamWorkflows: plan.teamWorkflows,
        isFree: plan.isFree,
        active: plan.active,
        sortOrder: plan.sortOrder,
      },
    });
  }
  console.log(`[seed] upserted ${PLAN_SEEDS.length} plans`);
}

const DISCLAIMER_FOOTER =
  "StockSentry monitors stock and flags unusual changes into incidents. AI explains evidence without inventing causes. StockSentry is read-only and never changes Shopify inventory.";

const EMAIL_TEMPLATE_SEEDS = [
  {
    key: "INCIDENT_ALERT" as const,
    subject:
      "[StockSentry] {{severity}} unusual inventory change — {{productTitle}}",
    htmlBody: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f5;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dce5e1;">
<tr><td style="background:#008060;padding:20px 28px;">
  <div style="color:#ffffff;font-size:18px;font-weight:700;">StockSentry</div>
  <div style="color:#d4f5eb;font-size:13px;margin-top:4px;">Unusual inventory change</div>
</td></tr>
<tr><td style="padding:28px;">
  <p style="margin:0 0 12px;color:#1a1a1a;font-size:16px;font-weight:600;">{{incidentTitle}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Shop:</strong> {{shopName}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Product:</strong> {{productTitle}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Location:</strong> {{locationName}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Severity:</strong> {{severity}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Qty before → after:</strong> {{quantityBeforeAfter}}</p>
  <p style="margin:0 0 16px;color:#44554d;font-size:14px;"><strong>Why flagged:</strong> {{whyFlagged}}</p>
  <p style="margin:0 0 16px;color:#44554d;font-size:14px;">{{summary}}</p>
  <p style="margin:0 0 20px;color:#6b7c74;font-size:13px;line-height:1.45;">{{confirmedNote}}</p>
  <a href="{{incidentUrl}}" style="display:inline-block;background:#008060;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600;">View incident</a>
  <span style="display:inline-block;width:8px;"></span>
  <a href="{{productUrl}}" style="display:inline-block;color:#008060;text-decoration:underline;font-size:14px;font-weight:600;">View product</a>
</td></tr>
<tr><td style="padding:16px 28px;background:#f7faf8;color:#6b7c74;font-size:12px;line-height:1.45;">{{disclaimer}} ${DISCLAIMER_FOOTER}</td></tr>
</table>
</td></tr></table>
</body></html>`,
    textBody: `StockSentry — unusual inventory change

{{incidentTitle}}
Shop: {{shopName}}
Product: {{productTitle}}
Location: {{locationName}}
Severity: {{severity}}
Qty before → after: {{quantityBeforeAfter}}
Why flagged: {{whyFlagged}}

{{summary}}

{{confirmedNote}}
{{disclaimer}}

View incident: {{incidentUrl}}
View product: {{productUrl}}`,
  },
  {
    key: "REFILL_ALERT" as const,
    subject:
      "[StockSentry] Refill suggestion — {{productTitle}} at {{locationName}}",
    htmlBody: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f5;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dce5e1;">
<tr><td style="background:#008060;padding:20px 28px;">
  <div style="color:#ffffff;font-size:18px;font-weight:700;">StockSentry</div>
  <div style="color:#d4f5eb;font-size:13px;margin-top:4px;">Refill suggestion</div>
</td></tr>
<tr><td style="padding:28px;">
  <p style="margin:0 0 12px;color:#1a1a1a;font-size:16px;font-weight:600;">Low stock may need a refill</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Shop:</strong> {{shopName}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Product:</strong> {{productTitle}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Location:</strong> {{locationName}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Qty before → after:</strong> {{quantityBeforeAfter}}</p>
  <p style="margin:0 0 16px;color:#44554d;font-size:14px;"><strong>Why flagged:</strong> {{whyFlagged}}</p>
  <p style="margin:0 0 16px;color:#44554d;font-size:14px;">{{summary}}</p>
  <p style="margin:0 0 20px;color:#6b7c74;font-size:13px;line-height:1.45;">Suggested action: review Shopify inventory and plan a refill. StockSentry will not change quantities.</p>
  <a href="{{incidentUrl}}" style="display:inline-block;background:#008060;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600;">Review suggestion</a>
  <span style="display:inline-block;width:8px;"></span>
  <a href="{{productUrl}}" style="display:inline-block;color:#008060;text-decoration:underline;font-size:14px;font-weight:600;">View product</a>
</td></tr>
<tr><td style="padding:16px 28px;background:#f7faf8;color:#6b7c74;font-size:12px;line-height:1.45;">{{disclaimer}} ${DISCLAIMER_FOOTER}</td></tr>
</table>
</td></tr></table>
</body></html>`,
    textBody: `StockSentry — refill suggestion

Product: {{productTitle}}
Location: {{locationName}}
Shop: {{shopName}}
Qty before → after: {{quantityBeforeAfter}}
Why flagged: {{whyFlagged}}

{{summary}}

Suggested action: review Shopify inventory and plan a refill. StockSentry will not change quantities.
{{disclaimer}}

Review: {{incidentUrl}}
Product: {{productUrl}}`,
  },
  {
    key: "DIGEST" as const,
    subject: "[StockSentry] Daily digest for {{shopName}}",
    htmlBody: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f5;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dce5e1;">
<tr><td style="background:#008060;padding:20px 28px;">
  <div style="color:#ffffff;font-size:18px;font-weight:700;">StockSentry</div>
  <div style="color:#d4f5eb;font-size:13px;margin-top:4px;">Daily digest</div>
</td></tr>
<tr><td style="padding:28px;">
  <p style="margin:0 0 12px;color:#1a1a1a;font-size:16px;font-weight:600;">Digest for {{shopName}}</p>
  <p style="margin:0 0 16px;color:#44554d;font-size:14px;">{{summary}}</p>
  <p style="margin:0;color:#6b7c74;font-size:13px;">Digest delivery is optional and can be enabled in merchant notification settings.</p>
</td></tr>
<tr><td style="padding:16px 28px;background:#f7faf8;color:#6b7c74;font-size:12px;">${DISCLAIMER_FOOTER}</td></tr>
</table>
</td></tr></table>
</body></html>`,
    textBody: `StockSentry daily digest for {{shopName}}

{{summary}}

${DISCLAIMER_FOOTER}`,
  },
  {
    key: "SUPPLIER_REPLENISH" as const,
    subject:
      "[StockSentry] Replenishment request — {{productTitle}} (qty {{restockQuantity}})",
    htmlBody: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f5;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dce5e1;">
<tr><td style="background:#008060;padding:20px 28px;">
  <div style="color:#ffffff;font-size:18px;font-weight:700;">StockSentry</div>
  <div style="color:#d4f5eb;font-size:13px;margin-top:4px;">Supplier replenishment</div>
</td></tr>
<tr><td style="padding:28px;">
  <p style="margin:0 0 12px;color:#1a1a1a;font-size:16px;font-weight:600;">Please restock {{productTitle}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Shop:</strong> {{shopName}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Supplier:</strong> {{supplierName}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>SKU / product:</strong> {{productTitle}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Observed quantity:</strong> {{currentQuantity}}</p>
  <p style="margin:0 0 8px;color:#44554d;font-size:14px;"><strong>Low-stock threshold:</strong> {{threshold}}</p>
  <p style="margin:0 0 16px;color:#44554d;font-size:14px;"><strong>Requested restock qty:</strong> {{restockQuantity}}</p>
  <p style="margin:0 0 16px;color:#44554d;font-size:14px;">{{summary}}</p>
  <p style="margin:0 0 20px;color:#6b7c74;font-size:13px;line-height:1.45;">This message was sent by the merchant via StockSentry. StockSentry is read-only and does not change Shopify inventory.</p>
  <a href="{{requestUrl}}" style="display:inline-block;background:#008060;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600;">View in StockSentry</a>
</td></tr>
<tr><td style="padding:16px 28px;background:#f7faf8;color:#6b7c74;font-size:12px;line-height:1.45;">{{disclaimer}} ${DISCLAIMER_FOOTER}</td></tr>
</table>
</td></tr></table>
</body></html>`,
    textBody: `StockSentry — supplier replenishment request

Shop: {{shopName}}
Supplier: {{supplierName}}
Product: {{productTitle}}
Observed quantity: {{currentQuantity}}
Threshold: {{threshold}}
Requested restock qty: {{restockQuantity}}

{{summary}}

StockSentry is read-only and does not change Shopify inventory.
{{disclaimer}}

View: {{requestUrl}}`,
  },
  {
    key: "TEST" as const,
    subject: "[StockSentry] Test email for {{shopName}}",
    htmlBody: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f5;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dce5e1;">
<tr><td style="background:#008060;padding:20px 28px;">
  <div style="color:#ffffff;font-size:18px;font-weight:700;">StockSentry</div>
  <div style="color:#d4f5eb;font-size:13px;margin-top:4px;">Test delivery</div>
</td></tr>
<tr><td style="padding:28px;">
  <p style="margin:0 0 12px;color:#1a1a1a;font-size:16px;font-weight:600;">Email delivery is working</p>
  <p style="margin:0 0 12px;color:#44554d;font-size:14px;">This is a test message for <strong>{{shopName}}</strong>. If you received it, Resend (or your fallback SMTP) is configured correctly for StockSentry incident and refill alert emails.</p>
  <p style="margin:0;color:#6b7c74;font-size:13px;">{{disclaimer}}</p>
</td></tr>
<tr><td style="padding:16px 28px;background:#f7faf8;color:#6b7c74;font-size:12px;">${DISCLAIMER_FOOTER}</td></tr>
</table>
</td></tr></table>
</body></html>`,
    textBody: `StockSentry test email for {{shopName}}

Email delivery is working. Used for merchant incident and refill alert emails.
{{disclaimer}}

${DISCLAIMER_FOOTER}`,
  },
] as const;

async function ensureEmailTemplates() {
  for (const tpl of EMAIL_TEMPLATE_SEEDS) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { shopId: null, key: tpl.key },
    });
    if (existing) {
      await prisma.emailTemplate.update({
        where: { id: existing.id },
        data: {
          subject: tpl.subject,
          htmlBody: tpl.htmlBody,
          textBody: tpl.textBody,
        },
      });
    } else {
      await prisma.emailTemplate.create({
        data: {
          shopId: null,
          key: tpl.key,
          subject: tpl.subject,
          htmlBody: tpl.htmlBody,
          textBody: tpl.textBody,
        },
      });
    }
  }
  console.log(
    `[seed] upserted ${EMAIL_TEMPLATE_SEEDS.length} system email templates`,
  );
}

async function main() {
  await ensurePlans();
  await ensureEmailTemplates();
}

main()
  .catch((err) => {
    console.error("[seed] failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
