import { supabase } from "../db/client.js";
import type { UpdateClientInput, UpdateClientOutput } from "../types.js";
import type Anthropic from "@anthropic-ai/sdk";

export async function updateClient(input: UpdateClientInput): Promise<UpdateClientOutput> {
  const { client_id, chef_id, updates } = input;

  // Verify client exists and belongs to chef
  const { data: client, error: lookupError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", client_id)
    .eq("chef_id", chef_id)
    .maybeSingle();

  if (lookupError) throw new Error(`Client lookup failed: ${lookupError.message}`);
  if (!client) throw new Error("Client not found or does not belong to this chef");

  const result: UpdateClientOutput = {
    updated_fields: [],
    added: { dietary_preferences: 0, allergies: 0, notes: 0 },
    removed: { dietary_preferences: 0, allergies: 0 },
  };

  // Add dietary preferences
  if (updates.dietary_preferences_add?.length) {
    const rows = updates.dietary_preferences_add.map((dp) => ({
      client_id,
      preference: dp.preference,
      notes: dp.notes ?? null,
      source: `chef mentioned ${new Date().toISOString().split("T")[0]}`,
    }));
    const { error } = await supabase.from("dietary_preferences").insert(rows);
    if (error) throw new Error(`Failed to add dietary preferences: ${error.message}`);
    result.added.dietary_preferences = rows.length;
  }

  // Remove dietary preferences
  if (updates.dietary_preferences_remove?.length) {
    for (const pref of updates.dietary_preferences_remove) {
      const { count, error } = await supabase
        .from("dietary_preferences")
        .delete({ count: "exact" })
        .eq("client_id", client_id)
        .ilike("preference", pref);
      if (error) throw new Error(`Failed to remove dietary preference: ${error.message}`);
      result.removed.dietary_preferences += count ?? 0;
    }
  }

  // Add allergies
  if (updates.allergies_add?.length) {
    const rows = updates.allergies_add.map((a) => ({
      client_id,
      allergen: a.allergen,
      severity: a.severity ?? "unknown",
      notes: a.notes ?? null,
      source: `chef mentioned ${new Date().toISOString().split("T")[0]}`,
    }));
    const { error } = await supabase.from("allergies").insert(rows);
    if (error) throw new Error(`Failed to add allergies: ${error.message}`);
    result.added.allergies = rows.length;
  }

  // Remove allergies
  if (updates.allergies_remove?.length) {
    for (const allergen of updates.allergies_remove) {
      const { count, error } = await supabase
        .from("allergies")
        .delete({ count: "exact" })
        .eq("client_id", client_id)
        .ilike("allergen", allergen);
      if (error) throw new Error(`Failed to remove allergy: ${error.message}`);
      result.removed.allergies += count ?? 0;
    }
  }

  // Add notes
  if (updates.notes_add?.length) {
    const rows = updates.notes_add.map((n) => ({
      client_id,
      category: n.category,
      content: n.content,
    }));
    const { error } = await supabase.from("client_notes").insert(rows);
    if (error) throw new Error(`Failed to add notes: ${error.message}`);
    result.added.notes = rows.length;
  }

  // Update client fields
  if (updates.field_updates && Object.keys(updates.field_updates).length) {
    const { error } = await supabase
      .from("clients")
      .update({ ...updates.field_updates, updated_at: new Date().toISOString() })
      .eq("id", client_id);
    if (error) throw new Error(`Failed to update client fields: ${error.message}`);
    result.updated_fields = Object.keys(updates.field_updates);
  } else {
    // Still touch updated_at if we made any related-table changes
    const madeChanges =
      result.added.dietary_preferences +
      result.added.allergies +
      result.added.notes +
      result.removed.dietary_preferences +
      result.removed.allergies;
    if (madeChanges > 0) {
      await supabase
        .from("clients")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", client_id);
    }
  }

  return result;
}

export const updateClientToolDef: Anthropic.Tool = {
  name: "update_client",
  description:
    "Update an existing client's profile. Can add/remove dietary preferences, add/remove allergies, add notes, and update direct fields (name, address, pricing, etc.). Always confirm changes with the chef before calling.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string", description: "The client's UUID" },
      chef_id: { type: "string", description: "The chef's UUID (for ownership verification)" },
      updates: {
        type: "object",
        properties: {
          dietary_preferences_add: {
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
          dietary_preferences_remove: {
            type: "array",
            items: { type: "string" },
            description: "Preference text to match and remove (case-insensitive)",
          },
          allergies_add: {
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
          allergies_remove: {
            type: "array",
            items: { type: "string" },
            description: "Allergen text to match and remove (case-insensitive)",
          },
          notes_add: {
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
          field_updates: {
            type: "object",
            description: "Direct field updates on the clients table (name, aliases, email, phone, address, household_size, client_type, scheduling_pattern, pricing_model, pricing_rate, pricing_notes, general_notes, active)",
          },
        },
      },
    },
    required: ["client_id", "chef_id", "updates"],
  },
};
