-- Add generation lock field to ai_bot_services
ALTER TABLE public.ai_bot_services 
ADD COLUMN IF NOT EXISTS last_generation_started_at timestamptz;

COMMENT ON COLUMN public.ai_bot_services.last_generation_started_at 
IS 'Час останнього старту генерації постів (лок для уникнення дублювання)';

CREATE INDEX IF NOT EXISTS idx_ai_bot_services_generation_lock 
ON public.ai_bot_services(last_generation_started_at) 
WHERE last_generation_started_at IS NOT NULL;
