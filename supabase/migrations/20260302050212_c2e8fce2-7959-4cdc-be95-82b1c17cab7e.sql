
CREATE TABLE public.ai_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  focus_mode text NOT NULL DEFAULT 'base-conhecimento',
  tone text NOT NULL DEFAULT 'amigavel',
  general_instructions text DEFAULT '',
  formatting_style text DEFAULT '',
  greeting text DEFAULT '',
  farewell text DEFAULT '',
  forbidden_responses text DEFAULT '',
  human_trigger_words text DEFAULT '',
  business_type text DEFAULT '',
  business_hours text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view ai_settings"
ON public.ai_settings FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can manage ai_settings"
ON public.ai_settings FOR ALL
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER update_ai_settings_updated_at
BEFORE UPDATE ON public.ai_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
