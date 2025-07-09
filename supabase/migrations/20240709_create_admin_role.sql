-- Migration: 20240709_create_admin_role.sql
-- Description: Sets up an admin role and permissions for the coordinate validation tool

-- Create a table to store user roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable Row Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage all roles
CREATE POLICY "Admins can manage all roles" 
  ON public.user_roles 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create policy for users to read their own roles
CREATE POLICY "Users can read their own roles" 
  ON public.user_roles 
  FOR SELECT
  USING (user_id = auth.uid());

-- Create a function to check if the current user has admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Create a function to assign admin role to a user
CREATE OR REPLACE FUNCTION public.assign_admin_role(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can assign admin roles';
  END IF;

  -- Insert or update the role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Create a function to remove admin role from a user
CREATE OR REPLACE FUNCTION public.revoke_admin_role(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can revoke admin roles';
  END IF;

  -- Delete the role
  DELETE FROM public.user_roles
  WHERE user_id = target_user_id AND role = 'admin';
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_admin_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin_role TO authenticated;

-- Create the first admin user (replace with your actual admin user ID)
-- You'll need to update this with a real user ID after creating the admin account
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('your-admin-user-id-here', 'admin');

-- Create a special policy for the shows table to allow admins to update coordinates
CREATE POLICY "Admins can update show coordinates"
  ON public.shows
  FOR UPDATE
  USING (public.is_admin());

-- Create a view for admin-only access to all shows
CREATE OR REPLACE VIEW admin_shows_view AS
SELECT * FROM public.shows;

-- Secure the admin view with RLS
REVOKE ALL ON admin_shows_view FROM anon, authenticated;
CREATE POLICY "Only admins can access admin_shows_view"
  ON admin_shows_view
  FOR SELECT
  USING (public.is_admin());

COMMENT ON TABLE public.user_roles IS 'Stores user roles including admin privileges';
COMMENT ON FUNCTION public.is_admin() IS 'Checks if the current user has admin role';
COMMENT ON FUNCTION public.assign_admin_role(UUID) IS 'Assigns admin role to a user (admin only)';
COMMENT ON FUNCTION public.revoke_admin_role(UUID) IS 'Revokes admin role from a user (admin only)';
COMMENT ON VIEW admin_shows_view IS 'View of all shows for admin access only';
