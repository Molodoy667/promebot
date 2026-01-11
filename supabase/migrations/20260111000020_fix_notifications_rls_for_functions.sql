-- Fix RLS for notifications to allow SECURITY DEFINER functions to create notifications
-- for any user (not just the current user)

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Functions can insert notifications" ON notifications;

-- Recreate policies with proper permissions
CREATE POLICY "Users can view their notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Allow service_role and authenticated to insert (for SECURITY DEFINER functions)
CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);
