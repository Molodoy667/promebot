-- Create task-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-images',
  'task-images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload task images
CREATE POLICY "Users can upload task images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-images');

-- Allow authenticated users to update their task images
CREATE POLICY "Users can update task images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'task-images');

-- Allow authenticated users to delete their task images
CREATE POLICY "Users can delete task images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-images');

-- Allow public read access
CREATE POLICY "Public can view task images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-images');
