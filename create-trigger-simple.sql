-- Simple Auth Trigger Creation
-- This creates the trigger step by step with explicit error checking

-- Step 1: Clean slate - remove any existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Verify the function exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user'
    ) THEN
        RAISE EXCEPTION 'handle_new_user function does not exist!';
    END IF;
    RAISE NOTICE 'handle_new_user function exists ✓';
END $$;

-- Step 3: Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Verify the trigger was created
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
    ) THEN
        RAISE EXCEPTION 'Trigger was not created successfully!';
    END IF;
    RAISE NOTICE 'Auth trigger created successfully ✓';
END $$;

-- Step 5: Show the trigger info
SELECT 'Trigger Created:' as result;
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgfoid::regproc as function_name,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

SELECT 'Trigger creation complete!' as result;