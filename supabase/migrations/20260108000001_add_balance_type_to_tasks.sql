-- Add balance_type column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS balance_type TEXT DEFAULT 'bonus' CHECK (balance_type IN ('bonus', 'main'));

-- Update existing tasks to use bonus balance
UPDATE tasks 
SET balance_type = 'bonus' 
WHERE balance_type IS NULL;
