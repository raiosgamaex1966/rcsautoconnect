
-- Services table for scheduling
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 30,
  price_cents integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view services" ON public.services
  FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can manage services" ON public.services
  FOR ALL USING (is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Business hours table
CREATE TABLE public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  enabled boolean NOT NULL DEFAULT false,
  open_time text NOT NULL DEFAULT '09:00',
  close_time text NOT NULL DEFAULT '18:00',
  break_start text DEFAULT '',
  break_end text DEFAULT '',
  interval_label text DEFAULT '30 min',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, day_of_week)
);

ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view business_hours" ON public.business_hours
  FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can manage business_hours" ON public.business_hours
  FOR ALL USING (is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER update_business_hours_updated_at
  BEFORE UPDATE ON public.business_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Blocked dates table
CREATE TABLE public.blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  reason text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view blocked_dates" ON public.blocked_dates
  FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can manage blocked_dates" ON public.blocked_dates
  FOR ALL USING (is_tenant_member(auth.uid(), tenant_id));

-- Reminders config table
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reminder_key text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  message text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, reminder_key)
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reminders" ON public.reminders
  FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can manage reminders" ON public.reminders
  FOR ALL USING (is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
