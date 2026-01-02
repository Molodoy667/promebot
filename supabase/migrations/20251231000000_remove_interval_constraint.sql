-- Remove constraint that blocks intervals less than 15 minutes
ALTER TABLE ai_publishing_settings 
DROP CONSTRAINT IF EXISTS ai_publishing_settings_interval_check;

-- Add new constraint allowing intervals from 10 minutes
ALTER TABLE ai_publishing_settings
ADD CONSTRAINT ai_publishing_settings_interval_check 
CHECK (post_interval_minutes >= 10 AND post_interval_minutes <= 1440);

-- Comment
COMMENT ON CONSTRAINT ai_publishing_settings_interval_check ON ai_publishing_settings 
IS 'Publishing interval must be between 10 minutes and 24 hours';
