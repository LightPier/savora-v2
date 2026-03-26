import { supabase } from "../db/client.js";

// ─── Phone number conversion ────────────────────────────────────────

export function chatIdToPhone(chatId: string): string {
  return "+" + chatId.split("@")[0];
}

export function phoneToChatId(phone: string): string {
  return phone.replace("+", "") + "@c.us";
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
