-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all profiles (for displaying usernames, avatars, etc.)
CREATE POLICY "Anyone can view profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Users can update only their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Users can view their own profile data
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Drop the duplicate "Users can view own profile" and keep only "Anyone can view profiles"
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

COMMENT ON POLICY "Anyone can view profiles" ON profiles IS 'Allow all authenticated users to view profiles for displaying usernames and avatars';
