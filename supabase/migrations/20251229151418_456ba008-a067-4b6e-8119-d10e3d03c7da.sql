-- Add allow_ai_images column to tariffs table
ALTER TABLE public.tariffs 
ADD COLUMN IF NOT EXISTS allow_ai_images boolean DEFAULT true;