
-- Security definer function so any authenticated user can check maintenance status
CREATE OR REPLACE FUNCTION public.is_maintenance_mode()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT maintenance FROM public.system_settings LIMIT 1),
    false
  );
$$;
