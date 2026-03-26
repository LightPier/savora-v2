// ─── WAHA HTTP client ───────────────────────────────────────────────

const WAHA_API_URL = process.env.WAHA_API_URL;
const WAHA_API_KEY = process.env.WAHA_API_KEY;
const WAHA_SESSION = process.env.WAHA_SESSION || "savora";

// ─── Echo loop prevention ───────────────────────────────────────────

const recentOutbound = new Map<string, number>();

function recordOutbound(chatId: string, text: string): void {
  const key = `${chatId}:${text}`;
  recentOutbound.set(key, Date.now() + 60_000);
}

export function isEcho(chatId: string, text: string): boolean {
  const key = `${chatId}:${text}`;
  const expiry = recentOutbound.get(key);
  if (expiry && Date.now() < expiry) {
    recentOutbound.delete(key);
    return true;
  }
  return false;
}

// Clean up expired entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of recentOutbound) {
    if (now >= expiry) recentOutbound.delete(key);
  }
}, 60_000).unref();

// ─── Send text message ──────────────────────────────────────────────

export async function sendText(chatId: string, text: string): Promise<void> {
  if (!WAHA_API_URL || !WAHA_API_KEY) {
    console.error("WAHA_API_URL or WAHA_API_KEY not configured");
    return;
  }

  try {
    const res = await fetch(`${WAHA_API_URL}/api/sendText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": WAHA_API_KEY,
      },
      body: JSON.stringify({ chatId, text, session: WAHA_SESSION }),
    });

    if (!res.ok) {
      console.error(`WAHA sendText failed: ${res.status} ${res.statusText}`);
      return;
    }

    recordOutbound(chatId, text);
  } catch (err: any) {
    console.error("WAHA sendText error:", err.message);
  }
}
