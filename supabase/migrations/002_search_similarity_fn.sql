-- Fuzzy search function for client name lookup using pg_trgm
CREATE OR REPLACE FUNCTION search_clients_by_similarity(
  p_chef_id UUID,
  p_query TEXT,
  p_threshold REAL DEFAULT 0.3
)
RETURNS SETOF clients
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM clients
  WHERE chef_id = p_chef_id
    AND similarity(name, p_query) >= p_threshold
  ORDER BY similarity(name, p_query) DESC;
$$;
