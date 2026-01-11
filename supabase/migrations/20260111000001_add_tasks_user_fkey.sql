-- Add foreign key constraint from tasks to profiles
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
