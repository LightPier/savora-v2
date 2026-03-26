import { Router } from "express";
import { resolveChef } from "./chef-resolver.js";
import { isEcho } from "./waha-client.js";
import type { DebounceQueue } from "./debounce.js";

// ─── Webhook payload types ──────────────────────────────────────────

interface WahaPayload {
  id?: string;
  timestamp?: number;
  from?: string;
  body?: string;
  fromMe?: boolean;
  hasMedia?: boolean;
}

interface WahaWebhook {
  event?: string;
  session?: string;
  payload?: WahaPayload;
}

// ─── Router factory ─────────────────────────────────────────────────

export function createWebhookRouter(queue: DebounceQueue): Router {
  const router = Router();

  router.post("/webhook/waha", async (req, res) => {
    const body = req.body as WahaWebhook;

    // 1. Must be a message event
    if (body.event !== "message") {
      res.json({ status: "ignored" });
      return;
    }

    // 2. Must be from the savora session
    if (body.session !== "savora") {
      res.json({ status: "ignored" });
      return;
    }

    const payload = body.payload;
    if (!payload) {
      res.status(400).json({ status: "error", reason: "missing payload" });
      return;
    }

    // 3. Ignore our own outbound messages
    if (payload.fromMe) {
      res.json({ status: "ignored" });
      return;
    }

    // 4. Must have text or media
    const hasText = typeof payload.body === "string" && payload.body.length > 0;
    const hasMedia = payload.hasMedia === true;
    if (!hasText && !hasMedia) {
      res.json({ status: "ignored" });
      return;
    }

    const chatId = payload.from;
    if (!chatId) {
      res.status(400).json({ status: "error", reason: "missing from" });
      return;
    }

    // 5. Build message text (handle media annotations)
    let messageText: string;
    if (hasMedia && !hasText) {
      messageText = "[user sent an image, text-only processing available]";
    } else if (hasMedia && hasText) {
      messageText = `[user sent an image, text-only processing available]\n${payload.body}`;
    } else {
      messageText = payload.body!;
    }

    // 6. Echo loop check
    if (isEcho(chatId, messageText)) {
      res.json({ status: "ignored" });
      return;
    }

    // 7. Resolve chef identity
    const chef = await resolveChef(chatId);
    if (!chef) {
      const redacted = chatId.replace(/@.*/, "").slice(0, -4) + "****";
      console.warn(`Unknown sender: ${redacted}`);
      res.json({ status: "ignored" });
      return;
    }

    // 8. Enqueue into debounce queue
    queue.enqueue(chatId, chef.chefId, messageText);
    res.json({ status: "queued" });
  });

  return router;
}
