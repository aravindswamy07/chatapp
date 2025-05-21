-- Add RLS policy to allow user signup
-- This fixes the 401 Unauthorized error: "new row violates row-level security policy for table users"

-- First check if the policy already exists
DO $$
DECLARE
    policy_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'users'
        AND operation = 'INSERT'
    ) INTO policy_exists;

    IF NOT policy_exists THEN
        -- Add the missing INSERT policy
        EXECUTE 'CREATE POLICY "Anyone can create a user account" ON users FOR INSERT WITH CHECK (true)';
        RAISE NOTICE 'Created new INSERT policy for users table';
    ELSE
        RAISE NOTICE 'INSERT policy for users table already exists';
    END IF;
END
$$; 