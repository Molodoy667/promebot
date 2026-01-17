-- Add instant_publish field to telegram_bot_services
ALTER TABLE telegram_bot_services 
ADD COLUMN IF NOT EXISTS instant_publish BOOLEAN DEFAULT true;

-- Set default for existing records
UPDATE telegram_bot_services 
SET instant_publish = true 
WHERE instant_publish IS NULL;

COMMENT ON COLUMN telegram_bot_services.instant_publish IS 'Publish posts instantly as they appear in source channels';
