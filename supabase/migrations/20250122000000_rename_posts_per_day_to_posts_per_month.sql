-- Rename posts_per_day to posts_per_month in tariffs table
ALTER TABLE tariffs RENAME COLUMN posts_per_day TO posts_per_month;

-- Update existing values (multiply by 30 to convert daily to monthly)
UPDATE tariffs SET posts_per_month = posts_per_month * 30;

-- Add comment
COMMENT ON COLUMN tariffs.posts_per_month IS 'Maximum posts allowed per month for this tariff';