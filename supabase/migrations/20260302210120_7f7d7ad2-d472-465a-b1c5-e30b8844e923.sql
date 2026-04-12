
-- Create roadmap_items table
CREATE TABLE public.roadmap_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('done', 'in-progress', 'planned', 'idea')),
  icon text NOT NULL DEFAULT 'Zap',
  version text DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

-- Anyone can view visible roadmap items (public page)
CREATE POLICY "Anyone can view visible roadmap items"
ON public.roadmap_items
FOR SELECT
USING (visible = true);

-- Admins can manage all roadmap items
CREATE POLICY "Admins can manage roadmap items"
ON public.roadmap_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_roadmap_items_updated_at
BEFORE UPDATE ON public.roadmap_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with existing roadmap data
INSERT INTO public.roadmap_items (title, description, status, icon, version, sort_order) VALUES
('Conexão WhatsApp via Evolution API', 'Conecte seu WhatsApp escaneando QR Code e gerencie instâncias', 'done', 'Smartphone', 'v1.0', 1),
('IA Automática 24/7', 'Respostas automáticas com inteligência artificial para seus clientes', 'done', 'Bot', 'v1.0', 2),
('Base de Conhecimento', 'Upload de documentos para treinar a IA com informações do negócio', 'done', 'FileText', 'v1.0', 3),
('Dashboard com métricas', 'Painel com estatísticas de atendimento em tempo real', 'done', 'BarChart3', 'v1.0', 4),
('Gestão de Conversas', 'Visualize e responda conversas manualmente quando necessário', 'done', 'MessageCircle', 'v1.0', 5),
('Sistema de Planos', 'Planos Grátis, Profissional e Empresarial com Stripe', 'done', 'CreditCard', 'v1.1', 6),
('Agendamento Automático', 'Clientes podem marcar horários diretamente pelo WhatsApp com a IA', 'in-progress', 'CalendarDays', 'v1.2', 7),
('Lembretes Automáticos', 'Envio de lembretes antes dos agendamentos para reduzir faltas', 'in-progress', 'Bell', 'v1.2', 8),
('Múltiplos Atendentes', 'Convide membros da equipe para atender conversas juntos', 'in-progress', 'Users', 'v1.3', 9),
('Fluxos de Automação', 'Crie fluxos personalizados com condições, ações e gatilhos', 'planned', 'Zap', NULL, 10),
('Catálogo de Produtos', 'Integre seu catálogo e permita que a IA apresente produtos com imagens', 'planned', 'Globe', NULL, 11),
('Relatórios Avançados', 'Exportação de relatórios, análise de sentimento e insights detalhados', 'planned', 'BarChart3', NULL, 12),
('Resumo Diário por E-mail', 'Receba um resumo das conversas e métricas do dia por e-mail', 'planned', 'Bell', NULL, 13),
('Autenticação 2FA', 'Camada extra de segurança com autenticação em dois fatores', 'planned', 'Shield', NULL, 14),
('App Mobile', 'Aplicativo nativo para iOS e Android para gerenciar atendimentos', 'idea', 'Smartphone', NULL, 15),
('Integração Instagram', 'Responda mensagens do Instagram Direct com a mesma IA', 'idea', 'MessageCircle', NULL, 16),
('Personalização Visual', 'Temas personalizáveis e white-label para sua marca', 'idea', 'Palette', NULL, 17),
('Suporte por Voz', 'IA capaz de entender e responder áudios dos clientes', 'idea', 'Headphones', NULL, 18),
('API Pública', 'API para desenvolvedores integrarem o ZapMax em seus sistemas', 'idea', 'Globe', NULL, 19);
