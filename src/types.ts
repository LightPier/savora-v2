// ─── Enum-like types ──────────────────────────────────────────────

export type ClientType = "vip" | "regular" | "flyby" | "event";

export type PricingModel =
  | "hourly"
  | "flat_fee"
  | "flat_plus_groceries"
  | "daily"
  | "custom";

export type AllergySeverity = "mild" | "moderate" | "severe" | "unknown";

export type DishFeedback = "loved" | "liked" | "neutral" | "disliked";

export type NoteCategory =
  | "life_event"
  | "personal"
  | "kitchen"
  | "preference_change"
  | "general";

// ─── Table row types (mirror Postgres schema) ────────────────────

export interface Chef {
  id: string;
  name: string;
  phone: string;
  location: string | null;
  default_hourly_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  chef_id: string;
  name: string;
  aliases: string[];
  email: string | null;
  phone: string | null;
  address: string | null;
  household_size: number | null;
  client_type: ClientType;
  scheduling_pattern: string | null;
  pricing_model: PricingModel | null;
  pricing_rate: number | null;
  pricing_notes: string | null;
  general_notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DietaryPreference {
  id: string;
  client_id: string;
  preference: string;
  notes: string | null;
  source: string | null;
  created_at: string;
}

export interface Allergy {
  id: string;
  client_id: string;
  allergen: string;
  severity: AllergySeverity;
  notes: string | null;
  source: string | null;
  created_at: string;
}

export interface MealHistory {
  id: string;
  client_id: string;
  chef_id: string;
  cooked_date: string;
  notes: string | null;
  created_at: string;
}

export interface MealDish {
  id: string;
  meal_id: string;
  name: string;
  feedback: DishFeedback | null;
  notes: string | null;
  created_at: string;
}

export interface ClientNote {
  id: string;
  client_id: string;
  category: NoteCategory;
  content: string;
  captured_at: string;
}

// ─── Tool input/output types ─────────────────────────────────────

// add_client

export interface AddClientInput {
  chef_id: string;
  client: {
    name: string;
    aliases?: string[];
    email?: string;
    phone?: string;
    address?: string;
    household_size?: number;
    client_type?: ClientType;
    scheduling_pattern?: string;
    pricing_model?: PricingModel;
    pricing_rate?: number;
    pricing_notes?: string;
    general_notes?: string;
  };
  dietary_preferences?: { preference: string; notes?: string }[];
  allergies?: { allergen: string; severity: AllergySeverity; notes?: string }[];
  notes?: { category: NoteCategory; content: string }[];
}

export interface AddClientOutput {
  client_id: string;
  stored: {
    dietary_preferences_count: number;
    allergies_count: number;
    notes_count: number;
  };
}

// get_client

export interface GetClientInput {
  chef_id: string;
  query: string;
}

export type GetClientOutput =
  | {
      match: "found";
      client: Client;
      dietary_preferences: DietaryPreference[];
      allergies: Allergy[];
      recent_notes: ClientNote[];
      recent_meals: { meal: MealHistory; dishes: MealDish[] }[];
    }
  | {
      match: "ambiguous";
      candidates: { id: string; name: string; aliases: string[] }[];
    }
  | {
      match: "none";
    };

// update_client

export interface UpdateClientInput {
  client_id: string;
  chef_id: string;
  updates: {
    dietary_preferences_add?: { preference: string; notes?: string }[];
    dietary_preferences_remove?: string[];
    allergies_add?: {
      allergen: string;
      severity: AllergySeverity;
      notes?: string;
    }[];
    allergies_remove?: string[];
    notes_add?: { category: NoteCategory; content: string }[];
    field_updates?: Partial<
      Pick<
        Client,
        | "name"
        | "aliases"
        | "email"
        | "phone"
        | "address"
        | "household_size"
        | "client_type"
        | "scheduling_pattern"
        | "pricing_model"
        | "pricing_rate"
        | "pricing_notes"
        | "general_notes"
        | "active"
      >
    >;
  };
}

export interface UpdateClientOutput {
  updated_fields: string[];
  added: {
    dietary_preferences: number;
    allergies: number;
    notes: number;
  };
  removed: {
    dietary_preferences: number;
    allergies: number;
  };
}

// log_meal

export interface LogMealInput {
  client_id: string;
  chef_id: string;
  cooked_date: string;
  dishes: {
    name: string;
    feedback?: DishFeedback;
    notes?: string;
  }[];
  notes?: string;
}

export interface LogMealOutput {
  meal_id: string;
  dish_count: number;
}
