-- Add variables column to automation_states for session-based data collection
ALTER TABLE public.automation_states 
ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '{}'::jsonb;

-- Add metadata column to contacts for persistent data collection
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.automation_states.variables IS 'Armazena dados coletados temporariamente durante a execução de um fluxo.';
COMMENT ON COLUMN public.contacts.metadata IS 'Armazena dados personalizados e permanentes do contato coletados via automação ou manual.';
