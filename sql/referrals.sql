-- sql/referrals.sql
-- Referral / Coupon schema and helper functions
-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_codes (
  code           TEXT PRIMARY KEY,
  organizer_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  applies_to     TEXT CHECK (applies_to IN ('dealer','organizer','both')) DEFAULT 'both',
  discount_type  TEXT CHECK (discount_type IN ('free_month')) NOT NULL DEFAULT 'free_month',
  expires_at     TIMESTAMPTZ NOT NULL,
  active         BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT REFERENCES public.referral_codes(code) ON DELETE CASCADE,
  redeemer_user_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  redeemed_at        TIMESTAMPTZ DEFAULT NOW(),
  plan_type          TEXT,                     -- dealer / organizer
  is_free_month      BOOLEAN DEFAULT FALSE,
  UNIQUE (redeemer_user_id)
);

CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id             UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  dealer_user_id           UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_at                 TIMESTAMPTZ DEFAULT NOW(),
  consecutive_paid_months  INT DEFAULT 0,
  last_paid_at             TIMESTAMPTZ,
  completed                BOOLEAN DEFAULT FALSE,
  UNIQUE (dealer_user_id)
);

CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id    UUID NOT NULL,
  dealer_user_id  UUID NOT NULL,
  payment_id      TEXT,      -- Stripe payment intent or synthetic ID for free month
  month_number    INT,       -- 1,2,3
  amount          NUMERIC(10,2),
  status          TEXT DEFAULT 'pending',  -- pending / paid
  period_start    DATE,
  period_end      DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (dealer_user_id, month_number)
);

-- ------------------------------------------------------------
-- Function: validate_coupon
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code       TEXT,
  p_plan_type  TEXT DEFAULT NULL,   -- 'dealer','organizer'
  preview_only BOOLEAN DEFAULT TRUE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row  referral_codes%ROWTYPE;
  v_now  TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_row
  FROM public.referral_codes
  WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', FALSE, 'message', 'code_not_found');
  END IF;

  IF NOT v_row.active THEN
    RETURN jsonb_build_object('valid', FALSE, 'message', 'code_inactive');
  END IF;

  IF v_row.expires_at < v_now OR v_row.expires_at <= TIMESTAMPTZ '2025-12-31 23:59:59+00' THEN
    RETURN jsonb_build_object('valid', FALSE, 'expired', TRUE, 'expiresAt', v_row.expires_at);
  END IF;

  IF p_plan_type IS NOT NULL AND v_row.applies_to <> 'both' AND v_row.applies_to <> p_plan_type THEN
    RETURN jsonb_build_object('valid', FALSE, 'message', 'not_applicable_for_plan');
  END IF;

  RETURN jsonb_build_object(
    'valid', TRUE,
    'expiresAt', v_row.expires_at,
    'appliesTo', v_row.applies_to,
    'organizerId', v_row.organizer_id
  );
END;
$$;

-- ------------------------------------------------------------
-- Function: redeem_coupon_for_subscription
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_coupon_for_subscription(
  p_user_id    UUID,
  p_code       TEXT,
  p_plan_type  TEXT,       -- 'dealer' | 'organizer'
  p_duration   TEXT,       -- 'monthly' | 'annual'
  preview_only BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_check JSONB;
  v_valid BOOLEAN;
  v_exists BOOLEAN;
  v_row   referral_codes%ROWTYPE;
BEGIN
  v_check := validate_coupon(p_code, p_plan_type, TRUE);
  v_valid := (v_check ->> 'valid')::BOOLEAN;

  IF preview_only THEN
    RETURN v_check;
  END IF;

  IF NOT v_valid THEN
    RETURN v_check || jsonb_build_object('grant_free_month', FALSE);
  END IF;

  -- Ensure not redeemed before
  SELECT EXISTS (
    SELECT 1 FROM public.referral_redemptions
    WHERE redeemer_user_id = p_user_id
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('grant_free_month', FALSE, 'message', 'already_redeemed');
  END IF;

  -- Fetch code row
  SELECT * INTO v_row FROM public.referral_codes WHERE code = p_code;

  INSERT INTO public.referral_redemptions(code, redeemer_user_id, plan_type, is_free_month)
  VALUES (p_code, p_user_id, p_plan_type, TRUE);

  -- Create attribution only if plan_type = dealer
  IF p_plan_type = 'dealer' THEN
    INSERT INTO public.referral_attributions(organizer_id, dealer_user_id)
    VALUES (v_row.organizer_id, p_user_id)
    ON CONFLICT (dealer_user_id) DO NOTHING;
  END IF;

  IF p_duration = 'monthly' THEN
    RETURN jsonb_build_object('grant_free_month', TRUE, 'organizer_id', v_row.organizer_id);
  ELSE
    RETURN jsonb_build_object('grant_free_month', FALSE, 'organizer_id', v_row.organizer_id);
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- Function: award_referral_on_payment
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_referral_on_payment(
  p_user_id   UUID,
  p_payment_id TEXT,
  p_paid_at   TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attr referral_attributions%ROWTYPE;
  v_month INT;
  v_amount NUMERIC(10,2);
BEGIN
  SELECT * INTO v_attr
  FROM public.referral_attributions
  WHERE dealer_user_id = p_user_id
    AND completed IS FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN; -- No active attribution
  END IF;

  -- Determine consecutive month
  IF v_attr.last_paid_at IS NULL OR (p_paid_at - v_attr.last_paid_at) > INTERVAL '45 days' THEN
    v_month := 1;
  ELSE
    v_month := v_attr.consecutive_paid_months + 1;
  END IF;

  IF v_month > 3 THEN
    -- Past earning window
    UPDATE public.referral_attributions
    SET completed = TRUE,
        consecutive_paid_months = v_month,
        last_paid_at = p_paid_at
    WHERE id = v_attr.id;
    RETURN;
  END IF;

  -- Determine payout amount
  v_amount := CASE v_month
                WHEN 1 THEN 10.00
                WHEN 2 THEN 5.00
                WHEN 3 THEN 5.00
                ELSE 0
              END;

  INSERT INTO public.referral_earnings(
    organizer_id,
    dealer_user_id,
    payment_id,
    month_number,
    amount,
    period_start,
    period_end
  ) VALUES (
    v_attr.organizer_id,
    p_user_id,
    p_payment_id,
    v_month,
    v_amount,
    date_trunc('month', p_paid_at),
    date_trunc('month', p_paid_at) + INTERVAL '1 month - 1 day'
  )
  ON CONFLICT (dealer_user_id, month_number) DO NOTHING;

  -- Update attribution progress
  UPDATE public.referral_attributions
  SET consecutive_paid_months = v_month,
      last_paid_at = p_paid_at,
      completed = (v_month >= 3)
  WHERE id = v_attr.id;
END;
$$;

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon_for_subscription(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_referral_on_payment(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
