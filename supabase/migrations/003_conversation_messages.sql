CREATE TABLE conversation_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id    UUID NOT NULL REFERENCES chefs(id),
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_messages_chef
  ON conversation_messages(chef_id, created_at DESC);
