import "dotenv/config";
import express from "express";
import { DebounceQueue } from "./debounce.js";
import { createWebhookRouter } from "./webhook.js";
import { sendText } from "./waha-client.js";
import { createAgent, runTurn } from "../agent/index.js";
import {
  loadRecentMessages,
  saveMessage,
} from "../db/conversations.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());

// ─── Per-chat concurrency guard ─────────────────────────────────────

const inFlight = new Map<string, Promise<void>>();

async function handleBatch(
  chatId: string,
  chefId: string,
  messages: string[]
): Promise<void> {
  const batchedText = messages.join("\n");

  try {
    // Load conversation history
    const history = await loadRecentMessages(chefId);
    history.push({ role: "user", content: batchedText });

    // Save user message
    await saveMessage(chefId, "user", batchedText);

    // Run the agent
    const agent = createAgent(chefId);
    const result = await runTurn(agent, history);

    // Save and send the response
    await saveMessage(chefId, "assistant", result.response);
    await sendText(chatId, result.response);
  } catch (err: any) {
    console.error(`Agent error [chef=${chefId}, chat=${chatId}]:`, err);
    await sendText(
      chatId,
      "Something went wrong on my end. Try again in a moment."
    );
  }
}

function onFlush(chatId: string, chefId: string, messages: string[]): void {
  const previous = inFlight.get(chatId) ?? Promise.resolve();

  const next = previous.then(() => handleBatch(chatId, chefId, messages));

  // Clean up the lock when this batch finishes
  const tracked = next.finally(() => {
    if (inFlight.get(chatId) === tracked) {
      inFlight.delete(chatId);
    }
  });

  inFlight.set(chatId, tracked);
}

// ─── Routes ──────────────────────────────────────────────────────────

const queue = new DebounceQueue(onFlush);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(createWebhookRouter(queue));

// ─── Start ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Savora server listening on :${PORT}`);
});
