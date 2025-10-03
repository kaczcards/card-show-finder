-- Fix missing profile for user 28cbf88b-5416-47a9-bebe-76723c7210e9

-- First, check if the user exists in auth.users
SELECT 
  id, 
  email,
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE id = '28cbf88b-5416-47a9-bebe-76723c7210e9';

-- Check if profile already exists (it shouldn't)
SELECT * FROM public.profiles 
WHERE id = '28cbf88b-5416-47a9-bebe-76723c7210e9';

-- Create the missing profile
INSERT INTO public.profiles (
  id,
  first_name,
  last_name,
  home_zip_code,
  role,
  account_type,
  subscription_status,
  payment_status,
  created_at,
  updated_at
) VALUES (
  '28cbf88b-5416-47a9-bebe-76723c7210e9',
  'Test',
  'User',
  '10001',
  'ATTENDEE',
  'collector',
  'none',
  'none',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Verify the profile was created
SELECT 
  id,
  first_name,
  last_name,
  role,
  account_type
FROM public.profiles 
WHERE id = '28cbf88b-5416-47a9-bebe-76723c7210e9';
