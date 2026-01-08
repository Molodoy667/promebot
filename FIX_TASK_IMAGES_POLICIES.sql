-- Fix task-images bucket RLS policies
-- Execute this in Supabase Dashboard > SQL Editor

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can upload task images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update task images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete task images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view task images" ON storage.objects;

-- Create new policies for task-images bucket
CREATE POLICY "Users can upload task images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-images');

CREATE POLICY "Users can update task images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'task-images');

CREATE POLICY "Users can delete task images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-images');

CREATE POLICY "Public can view task images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-images');
