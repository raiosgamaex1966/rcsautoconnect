-- ============================================
-- PASSO 2: CORREÇÃO AUTOMÁTICA
-- Cria tenant + membership para usuários que não têm
-- ============================================

-- 2a. Criar tenants para usuários sem tenant
DO $$
DECLARE
  rec RECORD;
  new_tenant_id UUID;
  company_name TEXT;
  slug_name TEXT;
BEGIN
  FOR rec IN
    SELECT au.id as user_id, au.email, p.full_name, p.company
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    LEFT JOIN public.tenant_members tm ON tm.user_id = au.id
    WHERE tm.tenant_id IS NULL
  LOOP
    -- Use company name or email as fallback
    company_name := COALESCE(NULLIF(TRIM(rec.company), ''), split_part(rec.email, '@', 1));
    slug_name := LOWER(REGEXP_REPLACE(company_name, '[^a-z0-9]+', '-', 'gi')) || '-' || SUBSTR(gen_random_uuid()::text, 1, 8);
    
    -- Create tenant
    INSERT INTO public.tenants (name, slug)
    VALUES (company_name, slug_name)
    RETURNING id INTO new_tenant_id;
    
    -- Create tenant membership
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (new_tenant_id, rec.user_id, 'admin')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
    
    -- Update profile
    UPDATE public.profiles 
    SET tenant_id = new_tenant_id, company = company_name
    WHERE user_id = rec.user_id;
    
    RAISE NOTICE 'Created tenant % for user % (%)', new_tenant_id, rec.email, company_name;
  END LOOP;
END $$;

-- ============================================
-- PASSO 4: Garantir que plano free existe e associar subscription
-- ============================================

-- Criar subscriptions para tenants sem subscription
INSERT INTO public.subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_end)
SELECT 
  tm.tenant_id,
  (SELECT id FROM public.plans WHERE active = true ORDER BY price_cents ASC LIMIT 1),
  'trial',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '7 days'
FROM public.tenant_members tm
LEFT JOIN public.subscriptions s ON s.tenant_id = tm.tenant_id
WHERE s.id IS NULL
  AND EXISTS (SELECT 1 FROM public.plans WHERE active = true)
GROUP BY tm.tenant_id;
