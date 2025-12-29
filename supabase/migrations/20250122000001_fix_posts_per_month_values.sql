-- Fix posts_per_month values (divide by 30 if they were multiplied)
-- This fixes the issue where values were already monthly but got multiplied by 30

UPDATE tariffs 
SET posts_per_month = posts_per_month / 30 
WHERE posts_per_month > 1000; -- Only fix values that seem wrong (too large)

-- Alternatively, if you want to fix all values:
-- UPDATE tariffs SET posts_per_month = posts_per_month / 30;
