
-- System settings table (singleton, one row)
CREATE TABLE public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  maintenance boolean NOT NULL DEFAULT false,
  registration boolean NOT NULL DEFAULT true,
  auto_trial boolean NOT NULL DEFAULT true,
  email_notifs boolean NOT NULL DEFAULT true,
  detailed_logs boolean NOT NULL DEFAULT false,
  rate_limit integer NOT NULL DEFAULT 1000,
  max_starter integer NOT NULL DEFAULT 1,
  max_pro integer NOT NULL DEFAULT 3,
  max_enterprise integer NOT NULL DEFAULT 999,
  timeout integer NOT NULL DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system_settings"
  ON public.system_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view system_settings"
  ON public.system_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default row
INSERT INTO public.system_settings (id) VALUES (gen_random_uuid());

-- Trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
