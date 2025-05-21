-- ===================================================
-- NEBULA CHAT - SUPABASE COMPLETE RESET SCRIPT
-- ===================================================
-- This script will completely reset your Supabase instance
-- Use with caution - all data will be deleted!

-- 1. Drop all existing policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 
                      policy_record.policyname, 
                      policy_record.tablename);
    END LOOP;
    
    -- Also drop storage policies
    FOR policy_record IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.%I', 
                      policy_record.policyname, 
                      policy_record.tablename);
    END LOOP;
END
$$;

-- 2. Delete from storage tables correctly
DELETE FROM storage.objects;
DELETE FROM storage.buckets;

-- 3. Drop all tables in the correct order
DROP TABLE IF EXISTS user_typing CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS room_participants CASCADE;
DROP TABLE IF EXISTS active_users CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 4. Drop any triggers and functions
DROP FUNCTION IF EXISTS clear_stale_typing_status CASCADE;
DROP FUNCTION IF EXISTS set_creator_as_admin CASCADE;

-- Done! Your database is now reset.
-- Next, run the complete_supabase_setup.sql script to recreate everything. 