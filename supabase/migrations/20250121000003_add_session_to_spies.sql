-- Додати поле для збереження сесії GramJS
ALTER TABLE public.telegram_spies 
  ADD COLUMN IF NOT EXISTS session_string text,
  ADD COLUMN IF NOT EXISTS is_authorized boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS error_count integer DEFAULT 0;

-- Коментарі
COMMENT ON COLUMN public.telegram_spies.session_string IS 'GramJS session string for persistent connection';
COMMENT ON COLUMN public.telegram_spies.is_authorized IS 'Whether userbot is successfully authorized';
COMMENT ON COLUMN public.telegram_spies.last_error IS 'Last error message if authorization failed';
COMMENT ON COLUMN public.telegram_spies.error_count IS 'Number of consecutive errors (reset on success)';

-- Індекс
CREATE INDEX IF NOT EXISTS idx_telegram_spies_is_authorized ON public.telegram_spies(is_authorized);
