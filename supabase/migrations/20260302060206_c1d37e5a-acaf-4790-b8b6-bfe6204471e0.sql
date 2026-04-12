
-- Drop existing restrictive policies on plans
DROP POLICY IF EXISTS "Admins can manage plans" ON public.plans;
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.plans;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage plans"
ON public.plans
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active plans"
ON public.plans
FOR SELECT
TO authenticated, anon
USING (active = true);
