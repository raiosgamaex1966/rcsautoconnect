
-- Create conversation_transfers table for audit logging
CREATE TABLE public.conversation_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  from_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  to_instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  transferred_by UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversation_transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view transfers"
ON public.conversation_transfers
FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can insert transfers"
ON public.conversation_transfers
FOR INSERT
WITH CHECK (is_tenant_member(auth.uid(), tenant_id));

-- Index for quick lookups
CREATE INDEX idx_conversation_transfers_conversation ON public.conversation_transfers(conversation_id);
CREATE INDEX idx_conversation_transfers_tenant ON public.conversation_transfers(tenant_id);
