-- Fix script for existing rooms without passwords
-- This adds random passwords to rooms that don't have one

-- First, make sure the password column exists
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS password TEXT;

-- Add random passwords to rooms that don't have one
UPDATE rooms
SET password = 
  array_to_string(
    ARRAY(
      SELECT substring('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789' FROM floor(random() * 58 + 1)::integer FOR 1)
      FROM generate_series(1, 7)
    ), 
    ''
  )
WHERE password IS NULL;

-- Output the count of updated rooms
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT count(*) INTO updated_count FROM rooms WHERE password IS NOT NULL;
    RAISE NOTICE 'Updated % rooms with passwords.', updated_count;
END
$$; 