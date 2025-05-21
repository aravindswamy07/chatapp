-- Check the structure of the messages table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'messages';

-- Check the structure of the active_users table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'active_users';

-- Fix the messages table if needed
DO $$
BEGIN
    -- Check if userId column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'userId'
    ) THEN
        -- It could be named user_id instead
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'messages' AND column_name = 'user_id'
        ) THEN
            -- Rename user_id to userId for consistency
            ALTER TABLE messages RENAME COLUMN user_id TO "userId";
        ELSE
            -- Add userId column if it doesn't exist
            ALTER TABLE messages ADD COLUMN "userId" TEXT NOT NULL DEFAULT 'unknown';
        END IF;
    END IF;
    
    -- Verify other required columns exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE messages ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'username'
    ) THEN
        ALTER TABLE messages ADD COLUMN username TEXT NOT NULL DEFAULT 'anonymous';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'content'
    ) THEN
        ALTER TABLE messages ADD COLUMN content TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- Verify realtime is enabled for the tables
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Insert a test message to verify everything is working
INSERT INTO messages (id, "userId", username, content, created_at)
VALUES (
    gen_random_uuid(),
    'system',
    'System',
    'If you can see this message, the Supabase connection is working correctly!',
    NOW()
); 