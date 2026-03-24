import { supabase } from "../db/client.js";
import type { GetClientInput, GetClientOutput, Client } from "../types.js";
import type Anthropic from "@anthropic-ai/sdk";

export async function getClient(input: GetClientInput): Promise<GetClientOutput> {
  const { chef_id, query } = input;
  const q = query.trim();

  // 1. Exact name match (case-insensitive)
  let { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .eq("chef_id", chef_id)
    .ilike("name", q);

  if (error) throw new Error(`Client lookup failed: ${error.message}`);

  // 2. Alias array contains query (case-insensitive)
  if (!clients?.length) {
    const { data, error: e } = await supabase
      .from("clients")
      .select("*")
      .eq("chef_id", chef_id)
      .contains("aliases", [q]);

    if (e) throw new Error(`Alias lookup failed: ${e.message}`);
    clients = data;
  }

  // 3. ILIKE partial match on name (catches substrings)
  if (!clients?.length) {
    const { data, error: e } = await supabase
      .from("clients")
      .select("*")
      .eq("chef_id", chef_id)
      .ilike("name", `%${q}%`);

    if (e) throw new Error(`Partial name lookup failed: ${e.message}`);
    clients = data;
  }

  // 4. pg_trgm similarity on name (catches typos/transpositions)
  if (!clients?.length) {
    const { data, error: e } = await supabase.rpc("search_clients_by_similarity", {
      p_chef_id: chef_id,
      p_query: q,
      p_threshold: 0.2,
    });

    if (!e && data?.length) {
      clients = data;
    }
  }

  // 5. ILIKE on scheduling_pattern
  if (!clients?.length) {
    const { data, error: e } = await supabase
      .from("clients")
      .select("*")
      .eq("chef_id", chef_id)
      .ilike("scheduling_pattern", `%${q}%`);

    if (e) throw new Error(`Schedule lookup failed: ${e.message}`);
    clients = data;
  }

  // 6. No results
  if (!clients?.length) {
    return { match: "none" };
  }

  // 7. Ambiguous (2+ results)
  if (clients.length > 1) {
    return {
      match: "ambiguous",
      candidates: clients.map((c) => ({
        id: c.id,
        name: c.name,
        aliases: c.aliases ?? [],
      })),
    };
  }

  // 6. Single match — load full profile
  const client = clients[0] as Client;

  const [dietaryRes, allergiesRes, notesRes, mealsRes] = await Promise.all([
    supabase.from("dietary_preferences").select("*").eq("client_id", client.id),
    supabase.from("allergies").select("*").eq("client_id", client.id),
    supabase
      .from("client_notes")
      .select("*")
      .eq("client_id", client.id)
      .order("captured_at", { ascending: false })
      .limit(10),
    supabase
      .from("meal_history")
      .select("*, meal_dishes(*)")
      .eq("client_id", client.id)
      .order("cooked_date", { ascending: false })
      .limit(5),
  ]);

  return {
    match: "found",
    client,
    dietary_preferences: dietaryRes.data ?? [],
    allergies: allergiesRes.data ?? [],
    recent_notes: notesRes.data ?? [],
    recent_meals: (mealsRes.data ?? []).map((m: any) => ({
      meal: {
        id: m.id,
        client_id: m.client_id,
        chef_id: m.chef_id,
        cooked_date: m.cooked_date,
        notes: m.notes,
        created_at: m.created_at,
      },
      dishes: m.meal_dishes ?? [],
    })),
  };
}

export const getClientToolDef: Anthropic.Tool = {
  name: "get_client",
  description:
    "Look up a client by name, alias, nickname, or scheduling pattern (e.g. 'Tuesday client'). Returns the full profile including dietary preferences, allergies, recent notes, and recent meal history. Call this before suggesting menus, generating grocery lists, or answering questions about a client.",
  input_schema: {
    type: "object" as const,
    properties: {
      chef_id: { type: "string", description: "The chef's UUID" },
      query: {
        type: "string",
        description: "Name, alias, nickname, or descriptive reference like 'Tuesday client'",
      },
    },
    required: ["chef_id", "query"],
  },
};
