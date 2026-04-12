
-- Create a function to send pg_notify for cache reset
CREATE OR REPLACE FUNCTION public.notify_cache_reload()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;
