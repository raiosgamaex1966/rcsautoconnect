-- Add offset_minutes column to reminders for fully custom timing
ALTER TABLE public.reminders ADD COLUMN offset_minutes INTEGER NOT NULL DEFAULT 60;

-- Update existing reminders with correct offsets based on reminder_key
UPDATE public.reminders SET offset_minutes = CASE
  WHEN reminder_key = '1d' THEN 1440
  WHEN reminder_key = '2h' THEN 120
  WHEN reminder_key = '1h' THEN 60
  WHEN reminder_key = '30m' THEN 30
  ELSE 60
END;

-- Drop the unique constraint on tenant_id, reminder_key if it exists (to allow custom keys)
-- The upsert uses onConflict so we keep the natural uniqueness