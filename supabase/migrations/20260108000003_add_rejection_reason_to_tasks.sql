-- Add rejection_reason column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN tasks.rejection_reason IS 'Reason for task rejection by moderator';
