-- Table to track which reminders have been sent (avoid duplicates)
CREATE TABLE public.reminder_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  reminder_key TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, reminder_key)
);

ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reminder_logs"
ON public.reminder_logs
FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can manage reminder_logs"
ON public.reminder_logs
FOR ALL
USING (is_tenant_member(auth.uid(), tenant_id));

-- Enable required extensions for cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;