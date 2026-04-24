
-- Add content and processing status to kb_documents
ALTER TABLE public.kb_documents
  ADD COLUMN content text DEFAULT '',
  ADD COLUMN processing_status text NOT NULL DEFAULT 'pending';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
