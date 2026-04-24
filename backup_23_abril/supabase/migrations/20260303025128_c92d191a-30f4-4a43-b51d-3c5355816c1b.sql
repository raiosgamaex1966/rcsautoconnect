
-- Kanban columns table
CREATE TABLE public.kanban_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view kanban_columns"
ON public.kanban_columns FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can manage kanban_columns"
ON public.kanban_columns FOR ALL
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER update_kanban_columns_updated_at
BEFORE UPDATE ON public.kanban_columns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add kanban_column_id to conversations
ALTER TABLE public.conversations
ADD COLUMN kanban_column_id UUID REFERENCES public.kanban_columns(id) ON DELETE SET NULL;
