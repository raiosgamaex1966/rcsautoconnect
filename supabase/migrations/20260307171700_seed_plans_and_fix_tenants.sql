-- Migration to ensure seed data and fix missing tenants
-- Generated at: 20260307171700

-- 1. Garante que existe pelo menos um plano ativo (necessário para o Onboarding)
-- Isso evita falhas no signup se o usuário esquecer de criar planos manualmente
INSERT INTO public.plans (name, price_cents, max_messages, max_instances, max_users, max_bots, storage_mb, active, trial_days)
SELECT 'Plano Free', 0, 1000, 1, 1, 1, 500, true, 7
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE active = true);

-- 2. Cria Tenants e associa usuários que não possuem empresa vinculada (Correção de Onboarding)
DO $$
DECLARE
  rec RECORD;
  new_tenant_id UUID;
  company_name TEXT;
  slug_name TEXT;
  default_plan_id UUID;
BEGIN
  -- Obtém o ID do plano default (mais barato/grátis)
  SELECT id INTO default_plan_id FROM public.plans WHERE active = true ORDER BY price_cents ASC LIMIT 1;

  FOR rec IN
    SELECT au.id as user_id, au.email, p.company
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    LEFT JOIN public.tenant_members tm ON tm.user_id = au.id
    WHERE tm.tenant_id IS NULL
  LOOP
    -- Nome da empresa: usa o campo 'company' do profile ou parte do email
    company_name := COALESCE(NULLIF(TRIM(rec.company), ''), split_part(rec.email, '@', 1));
    -- Gera slug único
    slug_name := LOWER(REGEXP_REPLACE(company_name, '[^a-z0-9]+', '-', 'gi')) || '-' || SUBSTR(gen_random_uuid()::text, 1, 8);
    
    -- Cria o Tenant
    INSERT INTO public.tenants (name, slug)
    VALUES (company_name, slug_name)
    RETURNING id INTO new_tenant_id;
    
    -- Cria o vínculo de membro (Admin do Tenant)
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (new_tenant_id, rec.user_id, 'admin')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
    
    -- Atualiza o perfil do usuário com o tenant_id
    UPDATE public.profiles 
    SET tenant_id = new_tenant_id, company = company_name
    WHERE user_id = rec.user_id;

    -- Cria a assinatura (Subscription) inicial se o plano existir
    IF default_plan_id IS NOT NULL THEN
      INSERT INTO public.subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_end)
      VALUES (
        new_tenant_id, 
        default_plan_id,
        'trial',
        NOW() + INTERVAL '7 days',
        NOW() + INTERVAL '7 days'
      )
      ON CONFLICT DO NOTHING;
    END IF;

    RAISE NOTICE 'Migração: Criado tenant % para o usuário %', new_tenant_id, rec.email;
  END LOOP;
END $$;
