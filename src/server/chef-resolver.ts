import { supabase } from "../db/client.js";

// ─── Phone number conversion ────────────────────────────────────────

export function chatIdToPhone(chatId: string): string {
  return "+" + chatId.split("@")[0];
}

export function phoneToChatId(phone: string): string {
  return phone.replace("+", "") + "@c.us";
}

// ─── LID resolution ────────────────────────────────────────────────

const lidCache = new Map<string, string>();

export async function resolveLid(lid: string): Promise<string | null> {
  const cached = lidCache.get(lid);
  if (cached) return cached;

  const WAHA_API_URL = process.env.WAHA_API_URL;
  const WAHA_API_KEY = process.env.WAHA_API_KEY;
  const WAHA_SESSION = process.env.WAHA_SESSION || "savora";

  if (!WAHA_API_URL) return null;

  try {
    const res = await fetch(
      `${WAHA_API_URL}/api/contacts?contactId=${encodeURIComponent(lid)}&session=${WAHA_SESSION}`,
      {
        headers: WAHA_API_KEY ? { "X-Api-Key": WAHA_API_KEY } : {},
      }
    );

    if (!res.ok) return null;

    const contact = await res.json() as { id?: string };
    if (contact.id && contact.id.endsWith("@c.us")) {
      lidCache.set(lid, contact.id);
      return contact.id;
    }
  } catch (err: any) {
    console.error("LID resolution failed:", err.message);
  }

  return null;
}

// ─── Chef identity resolution ───────────────────────────────────────

interface CachedChef {
  chefId: string;
  name: string;
}

const cache = new Map<string, CachedChef>();

export async function resolveChef(
  chatId: string
): Promise<{ chefId: string; name: string } | null> {
  const phone = chatIdToPhone(chatId);

  const cached = cache.get(phone);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("chefs")
    .select("id, name")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    console.error("Chef lookup failed:", error.message);
    return null;
  }

  if (!data) return null;

  const entry: CachedChef = { chefId: data.id, name: data.name };
  cache.set(phone, entry);
  return entry;
}
