import { supabase } from "../db/client.js";
import type { LogMealInput, LogMealOutput } from "../types.js";
import type Anthropic from "@anthropic-ai/sdk";

export async function logMeal(input: LogMealInput): Promise<LogMealOutput> {
  // 1. Insert meal_history
  const { data: meal, error: mealError } = await supabase
    .from("meal_history")
    .insert({
      client_id: input.client_id,
      chef_id: input.chef_id,
      cooked_date: input.cooked_date,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (mealError) throw new Error(`Failed to log meal: ${mealError.message}`);

  // 2. Insert meal_dishes
  if (input.dishes.length) {
    const rows = input.dishes.map((d) => ({
      meal_id: meal.id,
      name: d.name,
      feedback: d.feedback ?? null,
      notes: d.notes ?? null,
    }));
    const { error } = await supabase.from("meal_dishes").insert(rows);
    if (error) throw new Error(`Failed to log dishes: ${error.message}`);
  }

  return {
    meal_id: meal.id,
    dish_count: input.dishes.length,
  };
}

export const logMealToolDef: Anthropic.Tool = {
  name: "log_meal",
  description:
    "Record a completed cooking session with per-dish details and feedback. Call this AFTER confirming the meal details with the chef. Logged meals influence future menu suggestions (avoid recent repeats, favor hits, skip misses).",
  input_schema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string", description: "The client's UUID" },
      chef_id: { type: "string", description: "The chef's UUID" },
      cooked_date: {
        type: "string",
        description: "ISO date string (YYYY-MM-DD). Defaults to today if the chef doesn't specify.",
      },
      dishes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Dish name, e.g. 'miso-glazed cod'" },
            feedback: {
              type: "string",
              enum: ["loved", "liked", "neutral", "disliked"],
              description: "Client's reaction. Omit if no feedback given.",
            },
            notes: { type: "string", description: "Additional context, e.g. 'asked for the recipe'" },
          },
          required: ["name"],
        },
        description: "List of dishes cooked in this session",
      },
      notes: { type: "string", description: "General notes about the cooking session" },
    },
    required: ["client_id", "chef_id", "cooked_date", "dishes"],
  },
};
