import { supabase } from "../db/client.js";
import type { AddClientInput, AddClientOutput } from "../types.js";
import type Anthropic from "@anthropic-ai/sdk";

export async function addClient(input: AddClientInput): Promise<AddClientOutput> {
  // 1. Insert client
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      chef_id: input.chef_id,
      name: input.client.name,
      aliases: input.client.aliases ?? [],
      email: input.client.email ?? null,
      phone: input.client.phone ?? null,
      address: input.client.address ?? null,
      household_size: input.client.household_size ?? null,
      client_type: input.client.client_type ?? "regular",
      scheduling_pattern: input.client.scheduling_pattern ?? null,
      pricing_model: input.client.pricing_model ?? null,
      pricing_rate: input.client.pricing_rate ?? null,
      pricing_notes: input.client.pricing_notes ?? null,
      general_notes: input.client.general_notes ?? null,
    })
    .select("id")
    .single();

  if (clientError) throw new Error(`Failed to insert client: ${clientError.message}`);

  const clientId = client.id;

  // 2. Insert dietary preferences
  let dietaryCount = 0;
  if (input.dietary_preferences?.length) {
    const rows = input.dietary_preferences.map((dp) => ({
      client_id: clientId,
      preference: dp.preference,
      notes: dp.notes ?? null,
      source: `chef mentioned ${new Date().toISOString().split("T")[0]}`,
    }));
    const { error } = await supabase.from("dietary_preferences").insert(rows);
    if (error) throw new Error(`Failed to insert dietary preferences: ${error.message}`);
    dietaryCount = rows.length;
  }

  // 3. Insert allergies
  let allergyCount = 0;
  if (input.allergies?.length) {
    const rows = input.allergies.map((a) => ({
      client_id: clientId,
      allergen: a.allergen,
      severity: a.severity ?? "unknown",
      notes: a.notes ?? null,
      source: `chef mentioned ${new Date().toISOString().split("T")[0]}`,
    }));
    const { error } = await supabase.from("allergies").insert(rows);
    if (error) throw new Error(`Failed to insert allergies: ${error.message}`);
    allergyCount = rows.length;
  }

  // 4. Insert notes
  let notesCount = 0;
  if (input.notes?.length) {
    const rows = input.notes.map((n) => ({
      client_id: clientId,
      category: n.category,
      content: n.content,
    }));
    const { error } = await supabase.from("client_notes").insert(rows);
    if (error) throw new Error(`Failed to insert client notes: ${error.message}`);
    notesCount = rows.length;
  }

  return {
    client_id: clientId,
    stored: {
      dietary_preferences_count: dietaryCount,
      allergies_count: allergyCount,
      notes_count: notesCount,
    },
  };
}

export const addClientToolDef: Anthropic.Tool = {
  name: "add_client",
  description:
    "Persist a new client record. Call this AFTER parsing the chef's freeform text into structured fields and AFTER the chef confirms the parsed result. Inserts into clients, dietary_preferences, allergies, and client_notes.",
  input_schema: {
    type: "object" as const,
    properties: {
      chef_id: { type: "string", description: "The chef's UUID" },
      client: {
        type: "object",
        properties: {
          name: { type: "string", description: "Primary name the chef uses for this client" },
          aliases: { type: "array", items: { type: "string" }, description: "Other names or references" },
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
          household_size: { type: "integer" },
          client_type: { type: "string", enum: ["vip", "regular", "flyby", "event"] },
          scheduling_pattern: { type: "string", description: "Freeform: 'every Tuesday', 'seasonal summer'" },
          pricing_model: { type: "string", enum: ["hourly", "flat_fee", "flat_plus_groceries", "daily", "custom"] },
          pricing_rate: { type: "number" },
          pricing_notes: { type: "string" },
          general_notes: { type: "string" },
        },
        required: ["name"],
      },
      dietary_preferences: {
        type: "array",
        items: {
          type: "object",
          properties: {
            preference: { type: "string" },
            notes: { type: "string" },
          },
          required: ["preference"],
        },
      },
      allergies: {
        type: "array",
        items: {
          type: "object",
          properties: {
            allergen: { type: "string" },
            severity: { type: "string", enum: ["mild", "moderate", "severe", "unknown"] },
            notes: { type: "string" },
          },
          required: ["allergen"],
        },
      },
      notes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string", enum: ["life_event", "personal", "kitchen", "preference_change", "general"] },
            content: { type: "string" },
          },
          required: ["category", "content"],
        },
      },
    },
    required: ["chef_id", "client"],
  },
};
