-- Migration: Add channel_type to whatsapp_instances
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS channel_type TEXT DEFAULT 'whatsapp';

COMMENT ON COLUMN public.whatsapp_instances.channel_type IS 'Tipo de canal da instância (whatsapp ou instagram)';
