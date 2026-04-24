
-- Unique partial index to prevent duplicate open/pending conversations for the same contact+instance
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_active 
ON public.conversations (tenant_id, contact_id, instance_id) 
WHERE status IN ('open', 'pending');
