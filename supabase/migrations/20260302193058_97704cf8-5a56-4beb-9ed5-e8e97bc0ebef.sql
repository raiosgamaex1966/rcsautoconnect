DROP INDEX IF EXISTS public.idx_conversations_unique_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_by_instance
ON public.conversations (tenant_id, contact_id, instance_id)
WHERE instance_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_no_instance
ON public.conversations (tenant_id, contact_id)
WHERE instance_id IS NULL;