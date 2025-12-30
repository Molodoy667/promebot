-- Create exec_sql RPC function for DB manager script
-- Allows executing arbitrary SQL queries via RPC

CREATE OR REPLACE FUNCTION exec_sql(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_data jsonb;
BEGIN
  -- Execute the query and return results as JSONB
  EXECUTE format('SELECT jsonb_agg(t) FROM (%s) t', query_text) INTO result_data;
  
  -- If no rows, return empty array
  IF result_data IS NULL THEN
    result_data := '[]'::jsonb;
  END IF;
  
  RETURN result_data;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'SQL Error: %', SQLERRM;
END;
$$;

-- Grant execute to service_role only (for security)
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM anon, authenticated;

COMMENT ON FUNCTION exec_sql IS 'Execute arbitrary SQL queries - SERVICE_ROLE only';
