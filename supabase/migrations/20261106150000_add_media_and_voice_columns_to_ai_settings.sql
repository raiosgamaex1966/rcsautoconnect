-- Add media and voice columns to ai_settings
ALTER TABLE public.ai_settings
ADD COLUMN IF NOT EXISTS image_understanding_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS audio_transcription_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_id TEXT DEFAULT 'alloy',
ADD COLUMN IF NOT EXISTS voice_model TEXT DEFAULT '';
