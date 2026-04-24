
-- Instance-level bot settings
CREATE TABLE public.instance_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),

  -- Debounce
  debounce_enabled BOOLEAN NOT NULL DEFAULT false,
  debounce_seconds INTEGER NOT NULL DEFAULT 3,

  -- Split long messages
  split_messages_enabled BOOLEAN NOT NULL DEFAULT false,
  split_messages_limit INTEGER NOT NULL DEFAULT 1000,

  -- Conversation memory
  memory_enabled BOOLEAN NOT NULL DEFAULT false,
  memory_messages_count INTEGER NOT NULL DEFAULT 20,

  -- Typing indicator
  typing_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Fallback messages
  fallback_image TEXT NOT NULL DEFAULT 'Desculpe, não consigo visualizar imagens no momento. Por favor, descreva o que você precisa por texto.',
  fallback_audio TEXT NOT NULL DEFAULT 'Desculpe, não consigo ouvir áudios no momento. Por favor, escreva sua mensagem.',

  -- Pause control
  pause_words TEXT NOT NULL DEFAULT 'parar',
  resume_words TEXT NOT NULL DEFAULT 'voltar',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(instance_id)
);

ALTER TABLE public.instance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view instance_settings"
  ON public.instance_settings FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can manage instance_settings"
  ON public.instance_settings FOR ALL
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER update_instance_settings_updated_at
  BEFORE UPDATE ON public.instance_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
