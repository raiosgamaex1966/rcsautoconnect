
-- Reload PostgREST schema cache for ai_settings
NOTIFY pgrst, 'reload schema';

-- Create storage bucket for knowledge base documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base', 'knowledge-base', false);

-- Storage policies for knowledge-base bucket
CREATE POLICY "Authenticated users can upload to knowledge-base"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'knowledge-base' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view own tenant kb files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'knowledge-base'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete own tenant kb files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'knowledge-base'
  AND auth.role() = 'authenticated'
);

-- Create kb_documents table to track uploaded documents
CREATE TABLE public.kb_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'outro',
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size_bytes integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view kb_documents"
ON public.kb_documents FOR SELECT
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Members can manage kb_documents"
ON public.kb_documents FOR ALL
USING (is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER update_kb_documents_updated_at
BEFORE UPDATE ON public.kb_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
