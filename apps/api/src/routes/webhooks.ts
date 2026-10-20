import { Router } from "express";
import { prisma, shopRepository } from "@stocksentry/database";
import { shopify } from "../shopify/client.js";
import { ensureShop } from "../services/ensure-shop.js";
import {
  buildWebhookEventKey,
} from "../services/webhook-process.js";
import { enqueue, QUEUE_NAMES } from "../queues/index.js";
import { handleUninstall } from "../services/compliance.js";

/**
 * Validate HMAC, persist WebhookEvent, enqueue webhook.process.
 */
export const webhooksRouter = Router();

webhooksRouter.post("/shopify", async (req, res) => {
  const rawBody =
    typeof req.body === "string" ? req.body : String(req.body ?? "");

  try {
    const validation = await shopify.webhooks.validate({
      rawBody,
      rawRequest: req,
      rawResponse: res,
    });
    if (!validation.valid) {
      res.status(401).send("Unauthorized");
      return;
    }

    const topic =
      validation.topic ?? (req.headers["x-shopify-topic"] as string) ?? "";
    const shopDomain =
      validation.domain ??
      (req.headers["x-shopify-shop-domain"] as string) ??
      "";
    const webhookId =
      (req.headers["x-shopify-webhook-id"] as string | undefined) ?? null;

    if (!shopDomain) {
      res.status(200).send("ok");
      return;
    }

    let payload: unknown = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      payload = {};
    }

    const normalizedTopic = topic.toLowerCase().replace(/_/g, "/");

    // Fast-path uninstall before ensureShop seeds defaults on a dead shop
    if (
      normalizedTopic === "app/uninstalled" ||
      topic === "APP_UNINSTALLED"
    ) {
      const existing = await shopRepository.findByDomain(shopDomain);
      if (existing) {
        await handleUninstall(shopDomain).catch((err) => {
          console.error("[webhooks] uninstall wipe failed", err);
        });
      } else {
        await shopRepository.markUninstalled(shopDomain).catch(() => undefined);
      }
      res.status(200).send("ok");
      return;
    }

    const shop = await ensureShop(shopDomain);
    await shopRepository.touchWebhook(shop.id).catch(() => undefined);

    const eventKey = buildWebhookEventKey({
      topic: normalizedTopic || topic,
      shopDomain,
      webhookId,
      rawBody,
    });

    let webhookEvent;
    try {
      webhookEvent = await prisma.webhookEvent.create({
        data: {
          shopId: shop.id,
          eventKey,
          topic: normalizedTopic || topic,
          status: "QUEUED",
        },
      });
    } catch {
      // Unique constraint — duplicate delivery
      await prisma.webhookEvent
        .updateMany({
          where: { shopId: shop.id, eventKey },
          data: { status: "IGNORED" },
        })
        .catch(() => undefined);
      res.status(200).send("ok");
      return;
    }

    await enqueue(QUEUE_NAMES.WEBHOOK_PROCESS, {
      webhookEventId: webhookEvent.id,
      shopId: shop.id,
      shopDomain,
      topic: normalizedTopic || topic,
      payload,
    });

    console.info(
      `[webhooks] queued ${normalizedTopic || topic} for ${shopDomain}`,
    );

    res.status(200).send("ok");
  } catch (err) {
    console.error("[webhooks] error", err);
    res.status(500).send("error");
  }
});
