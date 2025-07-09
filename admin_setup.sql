
    -- Start a transaction to ensure all or nothing
    BEGIN;

    -- Create user_roles table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      UNIQUE(user_id, role)
    );

    -- Enable Row Level Security
    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist to avoid errors
    DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;

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

    -- Grant execute permissions on function
    GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated, anon;

    -- Create a function to assign admin role to a user
    CREATE OR REPLACE FUNCTION public.assign_admin_role(target_user_id UUID)
    RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      -- Check if the current user is an admin
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      ) THEN
        RAISE EXCEPTION 'Only admins can assign admin roles';
      END IF;

      -- Insert or update the role
      INSERT INTO public.user_roles (user_id, role)
      VALUES (target_user_id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    END;
    $$;

    -- Grant execute permissions on function
    GRANT EXECUTE ON FUNCTION public.assign_admin_role TO authenticated;

    -- Create a function to remove admin role from a user
    CREATE OR REPLACE FUNCTION public.revoke_admin_role(target_user_id UUID)
    RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      -- Check if the current user is an admin
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      ) THEN
        RAISE EXCEPTION 'Only admins can revoke admin roles';
      END IF;

      -- Delete the role
      DELETE FROM public.user_roles
      WHERE user_id = target_user_id AND role = 'admin';
    END;
    $$;

    -- Grant execute permissions on function
    GRANT EXECUTE ON FUNCTION public.revoke_admin_role TO authenticated;

    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Admins can update show coordinates" ON public.shows;

    -- Create a special policy for the shows table to allow admins to update coordinates
    CREATE POLICY "Admins can update show coordinates"
      ON public.shows
      FOR UPDATE
      USING (EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      ));

    -- Create a view for admin-only access to all shows if it doesn't exist
    CREATE OR REPLACE VIEW admin_shows_view AS
    SELECT * FROM public.shows;

    -- Secure the admin view with RLS
    REVOKE ALL ON admin_shows_view FROM anon, authenticated;
    
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Only admins can access admin_shows_view" ON admin_shows_view;
    
    -- Create policy for admin view
    CREATE POLICY "Only admins can access admin_shows_view"
      ON admin_shows_view
      FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      ));

    -- Commit the transaction
    COMMIT;
  