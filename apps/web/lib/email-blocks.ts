/** Structured email template blocks → HTML/text compatible with backend templates. */

export type EmailBlockType =
  | "header"
  | "heading"
  | "body"
  | "button"
  | "divider"
  | "footer"
  | "customHtml";

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  /** Plain text or HTML fragment depending on type */
  text?: string;
  color?: string;
  background?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  logoUrl?: string;
  /** Raw HTML for customHtml fallback */
  html?: string;
}

export interface EmailBrand {
  headerBg: string;
  headerText: string;
  bodyText: string;
  mutedText: string;
  buttonBg: string;
  brandName: string;
}

export const DEFAULT_EMAIL_BRAND: EmailBrand = {
  headerBg: "#008060",
  headerText: "#ffffff",
  bodyText: "#101828",
  mutedText: "#667085",
  buttonBg: "#008060",
  brandName: "StockSentry",
};

export const BRAND_PALETTE = [
  "#008060",
  "#101828",
  "#667085",
  "#ffffff",
  "#eaecf0",
  "#f4f6f8",
  "#d92d20",
  "#c2680a",
] as const;

const MARKER = "data-ss-email-blocks";

function uid(): string {
  return `b_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultBlocks(): EmailBlock[] {
  return [
    {
      id: uid(),
      type: "header",
      text: "Inventory monitoring",
      background: DEFAULT_EMAIL_BRAND.headerBg,
      color: DEFAULT_EMAIL_BRAND.headerText,
    },
    {
      id: uid(),
      type: "heading",
      text: "{{incidentTitle}}",
      color: DEFAULT_EMAIL_BRAND.bodyText,
    },
    {
      id: uid(),
      type: "body",
      text: "Shop: {{shopName}}\n\n{{summary}}",
      color: DEFAULT_EMAIL_BRAND.bodyText,
    },
    {
      id: uid(),
      type: "button",
      buttonLabel: "View incident",
      buttonUrl: "{{incidentUrl}}",
      background: DEFAULT_EMAIL_BRAND.buttonBg,
      color: "#ffffff",
    },
    { id: uid(), type: "divider" },
    {
      id: uid(),
      type: "footer",
      text: "StockSentry monitors stock and flags unusual changes. It is read-only and never changes Shopify inventory.",
      color: DEFAULT_EMAIL_BRAND.mutedText,
    },
  ];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br/>");
}

export function compileEmailHtml(
  blocks: EmailBlock[],
  brand: EmailBrand = DEFAULT_EMAIL_BRAND,
): string {
  const inner = blocks
    .map((b) => {
      switch (b.type) {
        case "header": {
          const bg = b.background || brand.headerBg;
          const color = b.color || brand.headerText;
          const logo = b.logoUrl
            ? `<img src="${escapeHtml(b.logoUrl)}" alt="" width="120" style="display:block;margin-bottom:8px;max-width:120px;height:auto;"/>`
            : "";
          return `<tr><td style="background:${bg};padding:20px 28px;">
  ${logo}
  <div style="color:${color};font-size:18px;font-weight:700;">${escapeHtml(brand.brandName)}</div>
  <div style="color:${color};opacity:.85;font-size:13px;margin-top:4px;">${escapeHtml(b.text || "")}</div>
</td></tr>`;
        }
        case "heading":
          return `<tr><td style="padding:24px 28px 0;color:${b.color || brand.bodyText};font-size:18px;font-weight:700;line-height:1.3;">${nl2br(b.text || "")}</td></tr>`;
        case "body":
          return `<tr><td style="padding:12px 28px;color:${b.color || brand.bodyText};font-size:14px;line-height:1.55;">${nl2br(b.text || "")}</td></tr>`;
        case "button": {
          const bg = b.background || brand.buttonBg;
          const color = b.color || "#ffffff";
          const url = b.buttonUrl || "#";
          const label = b.buttonLabel || "Open";
          return `<tr><td style="padding:8px 28px 20px;">
  <a href="${escapeHtml(url)}" style="display:inline-block;background:${bg};color:${color};text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:8px;">${escapeHtml(label)}</a>
</td></tr>`;
        }
        case "divider":
          return `<tr><td style="padding:4px 28px;"><div style="height:1px;background:#eaecf0;"></div></td></tr>`;
        case "footer":
          return `<tr><td style="padding:16px 28px;background:#f7faf8;color:${b.color || brand.mutedText};font-size:12px;line-height:1.45;">${nl2br(b.text || "")}</td></tr>`;
        case "customHtml":
          return `<tr><td style="padding:16px 28px;">${b.html || ""}</td></tr>`;
        default:
          return "";
      }
    })
    .join("\n");

  const payload = encodeURIComponent(JSON.stringify(blocks));

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;" ${MARKER}="${payload}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dce5e1;">
${inner}
</table>
</td></tr></table>
</body></html>`;
}

export function compileEmailText(blocks: EmailBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "header":
          return `StockSentry — ${b.text || ""}`.trim();
        case "heading":
        case "body":
        case "footer":
          return (b.text || "").trim();
        case "button":
          return `${b.buttonLabel || "Open"}: ${b.buttonUrl || ""}`.trim();
        case "divider":
          return "---";
        case "customHtml":
          return (b.html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Try to recover blocks from previously saved HTML; fall back to customHtml. */
export function parseEmailHtml(html: string): EmailBlock[] {
  if (!html?.trim()) return defaultBlocks();
  try {
    const m = html.match(
      new RegExp(`${MARKER}=["']([^"']+)["']`),
    );
    if (m?.[1]) {
      const parsed = JSON.parse(decodeURIComponent(m[1])) as EmailBlock[];
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((b) => ({ ...b, id: b.id || uid() }));
      }
    }
  } catch {
    /* fall through */
  }
  return [
    {
      id: uid(),
      type: "customHtml",
      html,
    },
  ];
}

export const SAMPLE_EMAIL_VARS: Record<string, string> = {
  shopName: "Demo Store",
  productTitle: "Gift Box Kit",
  variantTitle: "Default Title",
  sku: "GIFT-001",
  incidentTitle: "Large inventory drop detected",
  incidentUrl: "https://app.stocksentry.example/incidents/sample",
  summary:
    "Available quantity dropped by 42 units at Warehouse A. Review the incident before the related bundle oversells.",
  severity: "HIGH",
  locationName: "Warehouse A",
};

export function applyPreviewVars(
  template: string,
  vars: Record<string, string> = SAMPLE_EMAIL_VARS,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    return vars[key] ?? "";
  });
}

export const BLOCK_CATALOG: Array<{
  type: EmailBlockType;
  label: string;
  hint: string;
}> = [
  { type: "header", label: "Header", hint: "Brand bar" },
  { type: "heading", label: "Heading", hint: "Title line" },
  { type: "body", label: "Body text", hint: "Paragraph" },
  { type: "button", label: "Button CTA", hint: "Link button" },
  { type: "divider", label: "Divider", hint: "Separator" },
  { type: "footer", label: "Footer disclaimer", hint: "Fine print" },
];

export function newBlock(type: EmailBlockType): EmailBlock {
  switch (type) {
    case "header":
      return {
        id: uid(),
        type,
        text: "Inventory monitoring",
        background: DEFAULT_EMAIL_BRAND.headerBg,
        color: DEFAULT_EMAIL_BRAND.headerText,
      };
    case "heading":
      return {
        id: uid(),
        type,
        text: "Heading",
        color: DEFAULT_EMAIL_BRAND.bodyText,
      };
    case "body":
      return {
        id: uid(),
        type,
        text: "Body text…",
        color: DEFAULT_EMAIL_BRAND.bodyText,
      };
    case "button":
      return {
        id: uid(),
        type,
        buttonLabel: "View details",
        buttonUrl: "{{incidentUrl}}",
        background: DEFAULT_EMAIL_BRAND.buttonBg,
        color: "#ffffff",
      };
    case "divider":
      return { id: uid(), type };
    case "footer":
      return {
        id: uid(),
        type,
        text: "StockSentry is read-only and never changes Shopify inventory.",
        color: DEFAULT_EMAIL_BRAND.mutedText,
      };
    case "customHtml":
      return { id: uid(), type, html: "<p></p>" };
  }
}
