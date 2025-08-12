-- Organizer Referral Program Migration (2025-08-08)
-- Safe, idempotent DDL for promoter codes, referrals, earnings, payouts, and awarding logic.

BEGIN;

-- 0) Required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Promoter codes (organizers create/share)
CREATE TABLE IF NOT EXISTS public.promoter_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('organizer_90','dealer_30')),
  referrer_user_id UUID NOT NULL,
  show_series_id UUID,
  max_redemptions INT,
  per_user_limit INT DEFAULT 1,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Redemptions
CREATE TABLE IF NOT EXISTS public.promoter_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID REFERENCES public.promoter_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);

-- 3) Referrals (first-code-wins)
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id  UUID NOT NULL,
  referred_user_id  UUID NOT NULL,
  code_id           UUID REFERENCES public.promoter_codes(id),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_paid_at     TIMESTAMPTZ,
  last_paid_at      TIMESTAMPTZ,
  paid_month_streak INT NOT NULL DEFAULT 0,
  paid_month_total_count INT NOT NULL DEFAULT 0,
  max_payout_months INT NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','blocked')),
  UNIQUE (referred_user_id)
);

-- 3a) Backfill/ALTERs if table existed from prior drafts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='referrals' AND column_name='paid_month_streak'
  ) THEN
    ALTER TABLE public.referrals ADD COLUMN paid_month_streak INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='referrals' AND column_name='paid_month_total_count'
  ) THEN
    ALTER TABLE public.referrals ADD COLUMN paid_month_total_count INT NOT NULL DEFAULT 0;
  END IF;
END$$;

-- 4) Earnings ledger (one earning per payment)
CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID REFERENCES public.referrals(id) ON DELETE CASCADE,
  month_index INT NOT NULL CHECK (month_index BETWEEN 1 AND 3),
  payment_id  UUID,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued','paid','reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_id)
);

-- 5) Payout batches (manual; can be automated later)
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL,
  period_month DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  method TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- 6) Awarding function: 45-day window, lifetime cap of 3
CREATE OR REPLACE FUNCTION public.award_referral_on_payment
(p_user_id UUID, p_payment_id UUID, p_paid_at TIMESTAMPTZ)
RETURNS VOID AS $$
DECLARE
  r               RECORD;
  window_days     CONSTANT INT := 45; -- configurable
  next_idx        INT;
  consecutive     BOOLEAN;
BEGIN
  SELECT * INTO r
    FROM public.referrals
   WHERE referred_user_id = p_user_id
     AND status = 'active'
   LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  -- Lifetime cap check
  IF r.paid_month_total_count >= 3 THEN RETURN; END IF;

  -- Determine if this payment is consecutive
  consecutive := r.last_paid_at IS NULL
                 OR p_paid_at <= (r.last_paid_at + (window_days || ' days')::interval);

  IF NOT consecutive THEN
     UPDATE public.referrals SET paid_month_streak = 0 WHERE id = r.id;
     r.paid_month_streak := 0;
  END IF;

  next_idx := r.paid_month_streak + 1;

  -- Guard for lifetime cap
  IF r.paid_month_total_count + 1 > 3 THEN RETURN; END IF;

  INSERT INTO public.referral_earnings (referral_id, month_index, payment_id, amount)
  VALUES (r.id, next_idx, p_payment_id, 10.00)
  ON CONFLICT DO NOTHING;

  UPDATE public.referrals
     SET paid_month_streak      = next_idx,
         paid_month_total_count = paid_month_total_count + 1,
         first_paid_at          = COALESCE(first_paid_at, p_paid_at),
         last_paid_at           = p_paid_at,
         status = CASE WHEN paid_month_total_count + 1 >= max_payout_months THEN 'completed' ELSE status END
   WHERE id = r.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7) (Optional) Refund reversal helper
CREATE OR REPLACE FUNCTION public.reverse_referral_earning(p_payment_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.referral_earnings
     SET status = 'reversed'
   WHERE payment_id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8) RLS policies for security
DO $$
BEGIN
  -- Promoter codes: organizers can view their own codes
  EXECUTE 'CREATE POLICY IF NOT EXISTS promoter_codes_select_own ON public.promoter_codes
           FOR SELECT USING (auth.uid() = referrer_user_id)';
           
  -- Redemptions: organizers can view redemptions of their codes
  EXECUTE 'CREATE POLICY IF NOT EXISTS redemptions_select_own ON public.promoter_code_redemptions
           FOR SELECT USING (code_id IN (SELECT id FROM public.promoter_codes WHERE referrer_user_id = auth.uid()))';
           
  -- Referrals: organizers can view referrals they created
  EXECUTE 'CREATE POLICY IF NOT EXISTS referrals_select_own ON public.referrals
           FOR SELECT USING (referrer_user_id = auth.uid())';
           
  -- Earnings: organizers can view earnings from their referrals
  EXECUTE 'CREATE POLICY IF NOT EXISTS earnings_select_own ON public.referral_earnings
           FOR SELECT USING (referral_id IN (SELECT id FROM public.referrals WHERE referrer_user_id = auth.uid()))';
           
  -- Payouts: organizers can view their own payouts
  EXECUTE 'CREATE POLICY IF NOT EXISTS payouts_select_own ON public.payouts
           FOR SELECT USING (referrer_user_id = auth.uid())';
           
  -- Admin policies (create/update/delete for all tables)
  -- These would typically check for admin role in a real implementation
END$$;

-- Enable RLS on all tables
ALTER TABLE public.promoter_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promoter_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

COMMIT;
