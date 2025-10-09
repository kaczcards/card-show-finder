-- Create user_profiles table for admin dashboard
-- This table stores user metadata and roles for authentication

-- Create the table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'organizer', 'dealer')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Insert profile for existing admin user (update the user_id)
-- This creates the profile for user: 84ec4c75-1c32-46f6-b0bb-7930869a4c81
INSERT INTO user_profiles (user_id, email, role, display_name)
SELECT 
  id,
  email,
  'admin',
  COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
FROM auth.users
WHERE id = '84ec4c75-1c32-46f6-b0bb-7930869a4c81'
ON CONFLICT (user_id) DO UPDATE
  SET role = 'admin';

-- Verify the admin user was created
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM user_profiles
  WHERE role = 'admin';
  
  RAISE NOTICE 'Admin users created: %', admin_count;
END $$;
