-- Fix for "Could not find the 'password' column of 'rooms'" error
-- This adds the missing password column to the rooms table

-- Add password column to rooms table if it doesn't exist
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS password TEXT;

-- Notify the user
DO $$
BEGIN
  RAISE NOTICE 'Added password column to rooms table.';
  RAISE NOTICE 'If you have existing rooms without passwords, you should add passwords to them manually.';
END
$$; 