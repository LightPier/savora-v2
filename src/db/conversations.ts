import { supabase } from "./client.js";
import type Anthropic from "@anthropic-ai/sdk";

export async function saveMessage(
  chefId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const { error } = await supabase.from("conversation_messages").insert({
    chef_id: chefId,
    role,
    content,
  });
  if (error) {
    console.error("Failed to save message:", error.message);
  }
}

export async function loadRecentMessages(
  chefId: string,
  limit = 50
): Promise<Anthropic.MessageParam[]> {
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("role, content")
    .eq("chef_id", chefId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Failed to load messages:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    role: row.role as "user" | "assistant",
    content: row.content,
  }));
}
