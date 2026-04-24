-- Add OpenAI configuration columns to ai_settings
ALTER TABLE public.ai_settings 
ADD COLUMN IF NOT EXISTS openai_api_key text DEFAULT '',
ADD COLUMN IF NOT EXISTS openai_model text DEFAULT 'gpt-4o-mini';