-- Supabase RLS hardening and view invoker migration (2025-09-12)
-- This migration consolidates the manual fixes applied in production.

BEGIN;

-- 1) referral_codes: enable RLS and least-privilege policies for organizers
GRANT SELECT, INSERT, UPDATE ON public.referral_codes TO authenticated;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_codes_select_own ON public.referral_codes;
DROP POLICY IF EXISTS referral_codes_insert_self ON public.referral_codes;
DROP POLICY IF EXISTS referral_codes_update_own ON public.referral_codes;

CREATE POLICY referral_codes_select_own
ON public.referral_codes
FOR SELECT
TO authenticated
USING (organizer_id = auth.uid());

CREATE POLICY referral_codes_insert_self
ON public.referral_codes
FOR INSERT
TO authenticated
WITH CHECK (
  organizer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.account_type = 'organizer'
  )
);

CREATE POLICY referral_codes_update_own
ON public.referral_codes
FOR UPDATE
TO authenticated
USING (organizer_id = auth.uid())
WITH CHECK (organizer_id = auth.uid());

-- 2) Lock down server-only referral tables (writes via SECURITY DEFINER functions)
REVOKE ALL ON TABLE public.referral_redemptions FROM anon, authenticated;
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.referral_attributions FROM anon, authenticated;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.referral_earnings FROM anon, authenticated;
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;

-- 3) admin_users: server-only
REVOKE ALL ON TABLE public.admin_users FROM anon, authenticated;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 4) spatial_ref_sys: owned by PostGIS; cannot enable RLS. Keep non-exposed.
REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;

-- 5) Views: ensure invoker security
-- role_capabilities_v exists from messaging migration
ALTER VIEW public.role_capabilities_v SET (security_invoker = on);

-- valid_user_roles: create if missing, then set invoker
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'valid_user_roles'
  ) THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW public.valid_user_roles AS
      SELECT unnest(ARRAY['attendee','dealer','mvp_dealer','show_organizer','admin']) AS role;
    $v$;
  END IF;
END$$;

ALTER VIEW public.valid_user_roles SET (security_invoker = on);

COMMIT;
