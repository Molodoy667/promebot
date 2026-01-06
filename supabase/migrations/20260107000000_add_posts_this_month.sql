-- posts_current_period already exists in profiles
-- This is the field that tracks monthly post usage
-- We just need to make sure it doesn't get decremented when posts are deleted

-- Function to recalculate posts_current_period for a user
-- (based on posts created since stats_period_start)
CREATE OR REPLACE FUNCTION recalculate_posts_current_period(user_id_param uuid)
RETURNS integer AS $$
DECLARE
  post_count integer;
  period_start timestamptz;
BEGIN
  -- Get period start date for this user
  SELECT stats_period_start INTO period_start
  FROM profiles
  WHERE id = user_id_param;
  
  -- If no period start, use beginning of current month
  IF period_start IS NULL THEN
    period_start := date_trunc('month', CURRENT_DATE);
  END IF;
  
  -- Count posts from ai_bot_services owned by this user
  SELECT COUNT(*)
  INTO post_count
  FROM (
    SELECT p.created_at 
    FROM ai_generated_posts p
    JOIN ai_bot_services s ON s.id = p.ai_bot_service_id
    WHERE s.user_id = user_id_param 
      AND p.created_at >= period_start
    UNION ALL
    SELECT p.created_at 
    FROM posts_history p
    JOIN bot_services s ON s.id = p.bot_service_id
    WHERE s.user_id = user_id_param 
      AND p.created_at >= period_start
  ) AS all_posts;
  
  RETURN COALESCE(post_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update posts_current_period for all users to ensure accuracy
UPDATE profiles
SET posts_current_period = recalculate_posts_current_period(id);

-- Note: We intentionally do NOT add triggers to decrement on post deletion
-- posts_current_period is a cumulative monthly counter that should persist
