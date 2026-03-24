import { supabase } from "./client.js";
import type { Chef } from "../types.js";

const GEORGIE_PHONE = "+44700000001"; // placeholder — replace with real number

async function seed() {
  // Check if Georgie already exists
  const { data: existing, error: lookupError } = await supabase
    .from("chefs")
    .select("id, name")
    .eq("phone", GEORGIE_PHONE)
    .maybeSingle();

  if (lookupError) {
    console.error("Error checking for existing chef:", lookupError.message);
    process.exit(1);
  }

  if (existing) {
    console.log(`Chef already exists: ${existing.name} (${existing.id})`);
    return;
  }

  // Insert Georgie
  const { data: chef, error: insertError } = await supabase
    .from("chefs")
    .insert({
      name: "Georgie",
      phone: GEORGIE_PHONE,
      location: "London",
      default_hourly_rate: 65.0,
    })
    .select("id, name")
    .single();

  if (insertError) {
    console.error("Error seeding chef:", insertError.message);
    process.exit(1);
  }

  console.log(`Seeded chef: ${chef.name} (${chef.id})`);
}

seed();
