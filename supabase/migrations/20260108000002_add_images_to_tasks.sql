-- Add images column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS images TEXT[];

COMMENT ON COLUMN tasks.images IS 'Array of image URLs for the task';
