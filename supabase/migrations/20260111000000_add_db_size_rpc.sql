-- Add RPC to get real database size (bytes)

CREATE OR REPLACE FUNCTION public.get_database_size_bytes()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Restrict to admins only
  SELECT public.has_role(auth.uid(), 'admin') INTO is_admin;
  IF is_admin IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN pg_database_size(current_database());
END;
$$;

-- Allow authenticated users to call RPC (function enforces admin internally)
GRANT EXECUTE ON FUNCTION public.get_database_size_bytes() TO authenticated;
