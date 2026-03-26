import "dotenv/config";
import express from "express";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ─── Webhook stub (wired in T5) ─────────────────────────────────────

app.post("/webhook/waha", (_req, res) => {
  res.json({ status: "queued" });
});

// ─── Start ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Savora server listening on :${PORT}`);
});
