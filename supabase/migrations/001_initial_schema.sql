-- 001: Initial schema — Creative Space + CRM
-- Tables: chefs, clients, dietary_preferences, allergies, meal_history, meal_dishes, client_notes

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── chefs ──────────────────────────────────────────────────────────

CREATE TABLE chefs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  phone               TEXT UNIQUE NOT NULL,
  location            TEXT,
  default_hourly_rate NUMERIC(10,2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── clients ────────────────────────────────────────────────────────

CREATE TABLE clients (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id            UUID NOT NULL REFERENCES chefs(id),
  name               TEXT NOT NULL,
  aliases            TEXT[] DEFAULT '{}',
  email              TEXT,
  phone              TEXT,
  address            TEXT,
  household_size     INTEGER,
  client_type        TEXT DEFAULT 'regular'
                     CHECK (client_type IN ('vip', 'regular', 'flyby', 'event')),
  scheduling_pattern TEXT,
  pricing_model      TEXT
                     CHECK (pricing_model IN ('hourly', 'flat_fee', 'flat_plus_groceries', 'daily', 'custom')),
  pricing_rate       NUMERIC(10,2),
  pricing_notes      TEXT,
  general_notes      TEXT,
  active             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_chef_id ON clients(chef_id);
CREATE INDEX idx_clients_name_trgm ON clients USING gin (name gin_trgm_ops);

-- ─── dietary_preferences ────────────────────────────────────────────

CREATE TABLE dietary_preferences (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  preference TEXT NOT NULL,
  notes      TEXT,
  source     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dietary_client_id ON dietary_preferences(client_id);

-- ─── allergies ──────────────────────────────────────────────────────

CREATE TABLE allergies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  allergen   TEXT NOT NULL,
  severity   TEXT NOT NULL DEFAULT 'unknown'
             CHECK (severity IN ('mild', 'moderate', 'severe', 'unknown')),
  notes      TEXT,
  source     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_allergies_client_id ON allergies(client_id);

-- ─── meal_history ───────────────────────────────────────────────────

CREATE TABLE meal_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  chef_id     UUID NOT NULL REFERENCES chefs(id),
  cooked_date DATE NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meal_history_client_id ON meal_history(client_id);
CREATE INDEX idx_meal_history_cooked_date ON meal_history(cooked_date DESC);

-- ─── meal_dishes ────────────────────────────────────────────────────

CREATE TABLE meal_dishes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id    UUID NOT NULL REFERENCES meal_history(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  feedback   TEXT
             CHECK (feedback IN ('loved', 'liked', 'neutral', 'disliked')),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meal_dishes_meal_id ON meal_dishes(meal_id);
CREATE INDEX idx_meal_dishes_feedback ON meal_dishes(feedback) WHERE feedback IS NOT NULL;

-- ─── client_notes ───────────────────────────────────────────────────

CREATE TABLE client_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT 'general'
              CHECK (category IN ('life_event', 'personal', 'kitchen', 'preference_change', 'general')),
  content     TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_notes_client_id ON client_notes(client_id);
