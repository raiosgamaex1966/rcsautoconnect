
-- Floating WhatsApp button settings (singleton, admin-only)
CREATE TABLE public.floating_button_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL DEFAULT '',
  default_message text NOT NULL DEFAULT 'Olá! Gostaria de saber mais informações.',
  button_text text NOT NULL DEFAULT 'Precisa de ajuda?',
  position text NOT NULL DEFAULT 'bottom-right',
  icon text NOT NULL DEFAULT 'MessageCircle',
  button_color text NOT NULL DEFAULT '#25D366',
  text_color text NOT NULL DEFAULT '#ffffff',
  show_text boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.floating_button_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage
CREATE POLICY "Admins can manage floating_button_settings"
ON public.floating_button_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view (needed for landing page)
CREATE POLICY "Anyone can view floating_button_settings"
ON public.floating_button_settings
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_floating_button_settings_updated_at
BEFORE UPDATE ON public.floating_button_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row
INSERT INTO public.floating_button_settings (phone, default_message, button_text) VALUES ('', 'Olá! Gostaria de saber mais informações.', 'Precisa de ajuda?');
