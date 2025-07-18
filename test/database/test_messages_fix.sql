-- ================================================================
-- MESSAGES TABLE VERIFICATION SCRIPT
-- ================================================================
-- This script checks if the messages table exists and has the correct columns.
-- It's designed to verify that the fix for the "message_text" column issue works.
--
-- Usage: psql -d your_database -f test/database/test_messages_fix.sql
-- ================================================================

-- Set output format to make results more readable
\pset format aligned
\pset border 2
\pset null '[NULL]'

-- Begin transaction to ensure we don't modify anything
BEGIN;

-- Output header
SELECT '=== MESSAGES TABLE VERIFICATION ===' AS test_name;

-- Check if messages table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'messages'
        ) 
        THEN 'YES - Table exists'
        ELSE 'NO - Table does not exist'
    END AS messages_table_exists;

-- If table exists, check its columns
SELECT '--- COLUMNS IN MESSAGES TABLE ---' AS info;

SELECT 
    column_name,
    data_type,
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'messages'
ORDER BY 
    ordinal_position;

-- Specifically check for content and message_text columns
SELECT '--- CHECKING SPECIFIC COLUMNS ---' AS info;

SELECT 
    'content' AS column_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'messages' 
            AND column_name = 'content'
        ) 
        THEN 'YES - Column exists'
        ELSE 'NO - Column does not exist'
    END AS exists_in_table;

SELECT 
    'message_text' AS column_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'messages' 
            AND column_name = 'message_text'
        ) 
        THEN 'YES - Column exists'
        ELSE 'NO - Column does not exist'
    END AS exists_in_table;

-- Test our fix: Try to add message_text column if it doesn't exist
SELECT '--- TESTING COLUMN ADDITION FIX ---' AS info;

DO $msg_col$
BEGIN
    RAISE NOTICE 'Checking if message_text column needs to be added...';
    
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'messages'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'messages'
            AND column_name = 'message_text'
        ) THEN
            RAISE NOTICE 'Adding message_text column to messages table...';
            
            -- This would normally execute the ALTER TABLE statement
            -- But we're just testing, so we'll output a message
            RAISE NOTICE 'Would execute: ALTER TABLE public.messages ADD COLUMN message_text TEXT;';
            
            -- If we wanted to actually add the column:
            -- ALTER TABLE public.messages ADD COLUMN message_text TEXT;
            -- UPDATE public.messages SET message_text = content WHERE message_text IS NULL;
        ELSE
            RAISE NOTICE 'message_text column already exists.';
        END IF;
    ELSE
        RAISE NOTICE 'messages table does not exist. Messaging feature may be on hold.';
    END IF;
END;
$msg_col$;

-- Test inserting into both columns
SELECT '--- TESTING INSERT COMPATIBILITY ---' AS info;

DO $test_insert$
DECLARE
    table_exists boolean;
    content_exists boolean;
    message_text_exists boolean;
BEGIN
    -- Check if table and columns exist
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
    ) INTO table_exists;
    
    IF table_exists THEN
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'messages' 
            AND column_name = 'content'
        ) INTO content_exists;
        
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'messages' 
            AND column_name = 'message_text'
        ) INTO message_text_exists;
        
        -- Output what kind of INSERT would be needed
        IF content_exists AND message_text_exists THEN
            RAISE NOTICE 'Would need to insert into both columns: INSERT INTO messages (..., content, message_text) VALUES (..., ''text'', ''text'')';
        ELSIF content_exists THEN
            RAISE NOTICE 'Would need to insert into content column only: INSERT INTO messages (..., content) VALUES (..., ''text'')';
        ELSIF message_text_exists THEN
            RAISE NOTICE 'Would need to insert into message_text column only: INSERT INTO messages (..., message_text) VALUES (..., ''text'')';
        ELSE
            RAISE NOTICE 'Neither content nor message_text columns exist';
        END IF;
    ELSE
        RAISE NOTICE 'Cannot test insert - messages table does not exist';
    END IF;
END;
$test_insert$;

-- Rollback to ensure we don't modify anything
ROLLBACK;

-- Final summary
SELECT '=== TEST COMPLETE ===' AS status;
