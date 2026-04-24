
-- Remove duplicate user_roles entries
DELETE FROM public.user_roles
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, role ORDER BY id) as rn
    FROM public.user_roles
  ) t WHERE t.rn > 1
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_unique UNIQUE (user_id, role);

-- Create helper function for edge function to check if admins exist (bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_admins_exist()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin' LIMIT 1
  );
$$;
