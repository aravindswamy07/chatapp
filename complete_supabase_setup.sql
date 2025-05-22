-- ===================================================
-- NEBULA CHAT - COMPLETE SUPABASE SETUP
-- ===================================================
-- This file contains all SQL commands to set up the entire database
-- Execute this in your Supabase SQL Editor to recreate the database from scratch

-- ===================================================
-- 0. DROP EXISTING POLICIES (TO AVOID CONFLICTS)
-- ===================================================

-- Drop existing policies to avoid conflicts
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

-- ===================================================
-- 1. BASE DATABASE STRUCTURE
-- ===================================================

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  password TEXT,
  auth_id UUID, -- Add auth_id column to link legacy users to auth users
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rooms table if it doesn't exist
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_private BOOLEAN DEFAULT FALSE,
  password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  content TEXT,
  reply_to UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create active users tracking table
CREATE TABLE IF NOT EXISTS active_users (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Make sure the last_seen column exists in active_users (in case table already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'active_users' AND column_name = 'last_seen'
  ) THEN
    ALTER TABLE active_users ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END
$$;

-- Create room participants table (for tracking who's in which room)
CREATE TABLE IF NOT EXISTS room_participants (
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (room_id, user_id)
);

-- ===================================================
-- 2. INDEXES FOR PERFORMANCE
-- ===================================================

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Make sure to create the last_seen index only if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'active_users' AND column_name = 'last_seen'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_active_users_last_seen ON active_users(last_seen)';
  END IF;
END
$$;

-- ===================================================
-- 3. REALTIME PUBLICATION SETUP
-- ===================================================

-- Create a publication for realtime changes if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE active_users;
ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;

-- ===================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ===================================================

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view all users" 
ON users FOR SELECT USING (true);

CREATE POLICY "Users can update their own record" 
ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Anyone can create a user account" 
ON users FOR INSERT WITH CHECK (true);

-- Rooms table policies
CREATE POLICY "Anyone can view public rooms" 
ON rooms FOR SELECT USING (NOT is_private OR EXISTS (
  SELECT 1 FROM room_participants 
  WHERE room_participants.room_id = rooms.id 
  AND room_participants.user_id = auth.uid()
));

CREATE POLICY "Anyone can create rooms" 
ON rooms FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room creators and admins can update rooms" 
ON rooms FOR UPDATE USING (
  auth.uid() = created_by OR 
  EXISTS (
    SELECT 1 FROM room_participants 
    WHERE room_participants.room_id = rooms.id 
    AND room_participants.user_id = auth.uid()
    AND room_participants.is_admin = true
  )
);

CREATE POLICY "Room creators and admins can delete rooms" 
ON rooms FOR DELETE USING (
  auth.uid() = created_by OR 
  EXISTS (
    SELECT 1 FROM room_participants 
    WHERE room_participants.room_id = rooms.id 
    AND room_participants.user_id = auth.uid()
    AND room_participants.is_admin = true
  )
);

-- Messages table policies
CREATE POLICY "Anyone can view messages in rooms they participate in" 
ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = messages.room_id
    AND (NOT rooms.is_private OR 
      EXISTS (
        SELECT 1 FROM room_participants
        WHERE room_participants.room_id = messages.room_id
        AND room_participants.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Anyone can create messages in rooms they participate in" 
ON messages FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM room_participants
    WHERE room_participants.room_id = messages.room_id
    AND room_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own messages" 
ON messages FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages" 
ON messages FOR DELETE USING (user_id = auth.uid());

-- Active users policies
CREATE POLICY "Anyone can view active users" 
ON active_users FOR SELECT USING (true);

CREATE POLICY "Users can insert their own active status" 
ON active_users FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own active status" 
ON active_users FOR UPDATE USING (id = auth.uid());

-- Room participants policies
CREATE POLICY "Anyone can view room participants" 
ON room_participants FOR SELECT USING (true);

CREATE POLICY "Anyone can join rooms" 
ON room_participants FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave rooms they joined" 
ON room_participants FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Room admins can update participants" 
ON room_participants FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM room_participants AS rp
    WHERE rp.room_id = room_participants.room_id
    AND rp.user_id = auth.uid()
    AND rp.is_admin = true
  )
);

-- ===================================================
-- 5. IMAGE SUPPORT
-- ===================================================

-- Add image support columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Create a storage bucket for chat images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'Chat Message Images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage permissions to allow authenticated users to upload files
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'objects' AND schemaname = 'storage') THEN
    EXECUTE 'CREATE POLICY "Allow authenticated users to upload images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = ''chat-images'')';
    
    EXECUTE 'CREATE POLICY "Allow public read access to chat images"
    ON storage.objects FOR SELECT
    USING (bucket_id = ''chat-images'')';
  ELSE 
    RAISE NOTICE 'Storage objects table does not exist yet, skipping policies';
  END IF;
END
$$;

-- ===================================================
-- 6. ADMIN PRIVILEGES
-- ===================================================

-- Make sure room_participants table has is_admin column
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create function to automatically make room creators admins
CREATE OR REPLACE FUNCTION set_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Only insert a record if created_by is not null
  IF NEW.created_by IS NOT NULL THEN
    -- Insert a record into room_participants making the creator an admin
    INSERT INTO room_participants (room_id, user_id, is_admin)
    VALUES (NEW.id, NEW.created_by, TRUE);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function when a room is created
DROP TRIGGER IF EXISTS trigger_set_creator_as_admin ON rooms;
CREATE TRIGGER trigger_set_creator_as_admin
AFTER INSERT ON rooms
FOR EACH ROW
EXECUTE PROCEDURE set_creator_as_admin();

-- Add policy to allow room admins to remove users
CREATE POLICY "Admins can remove users from rooms"
ON room_participants FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM room_participants AS rp
    WHERE rp.room_id = room_participants.room_id
    AND rp.user_id = auth.uid()
    AND rp.is_admin = true
  )
);

-- ===================================================
-- 7. TYPING INDICATOR SUPPORT
-- ===================================================

-- Create table for tracking typing status
CREATE TABLE IF NOT EXISTS user_typing (
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  is_typing BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- Create index for more efficient queries
CREATE INDEX IF NOT EXISTS idx_user_typing_room_id ON user_typing(room_id);
CREATE INDEX IF NOT EXISTS idx_user_typing_updated_at ON user_typing(updated_at);

-- Add this table to realtime publication for subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE user_typing;

-- Create function to automatically clear typing status after timeout
CREATE OR REPLACE FUNCTION clear_stale_typing_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete typing status entries older than 30 seconds
  DELETE FROM user_typing
  WHERE updated_at < NOW() - INTERVAL '30 seconds';
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run every minute 
DROP TRIGGER IF EXISTS trigger_clear_stale_typing ON user_typing;
CREATE TRIGGER trigger_clear_stale_typing
AFTER INSERT OR UPDATE ON user_typing
EXECUTE PROCEDURE clear_stale_typing_status();

-- Add RLS policies for typing indicator
ALTER TABLE user_typing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view typing status"
ON user_typing FOR SELECT USING (true);

CREATE POLICY "Users can insert their own typing status"
ON user_typing FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own typing status"
ON user_typing FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own typing status"
ON user_typing FOR DELETE USING (user_id = auth.uid());

-- ===================================================
-- 8. CREATE DEFAULT ROOM
-- ===================================================

-- Create a default room if it doesn't exist
INSERT INTO rooms (id, name, description, created_by, is_private)
VALUES ('default', 'General Chat', 'Welcome to NebulaChat!', NULL, false)
ON CONFLICT (id) DO NOTHING;

-- ===================================================
-- 9. FIX EXISTING ROOMS WITHOUT PASSWORDS
-- ===================================================

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

-- Output the count of rooms with passwords
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT count(*) INTO updated_count FROM rooms WHERE password IS NOT NULL;
    RAISE NOTICE 'Total rooms with passwords: %', updated_count;
END
$$;

-- ===================================================
-- 10. ADD ROOM ID GENERATOR FUNCTION
-- ===================================================

-- Create function to generate room IDs
CREATE OR REPLACE FUNCTION generate_room_id()
RETURNS TEXT AS $$
DECLARE
  v_id TEXT;
  duplicate_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a short, readable room ID
    v_id := array_to_string(
      ARRAY(
        SELECT substring('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' FROM floor(random() * 33 + 1)::integer FOR 1)
        FROM generate_series(1, 6)
      ), 
      ''
    );
    
    -- Check if it already exists
    SELECT EXISTS(
      SELECT 1 FROM rooms WHERE rooms.id = v_id
    ) INTO duplicate_exists;
    
    -- Exit loop if the ID is unique (doesn't exist yet)
    EXIT WHEN NOT duplicate_exists;
  END LOOP;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ===================================================
-- 11. LEGACY AUTH SUPPORT
-- ===================================================

-- Create a function that will check if a user can access content they own
-- This will be used in RLS policies
CREATE OR REPLACE FUNCTION public.check_user_access(user_id UUID, resource_user_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  -- Return true if the logged-in user is the owner
  -- or if the user has no auth but the legacy ID matches
  RETURN (auth.uid() = resource_user_id) OR 
         -- Check for direct ID match with auth.uid()
         (auth.uid() = user_id) OR
         -- Check for direct match in tables
         EXISTS (
           SELECT 1 FROM public.users
           WHERE users.id = resource_user_id
           AND users.id = user_id
         );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modify rooms table policies
DROP POLICY IF EXISTS "Anyone can create rooms" ON rooms;
CREATE POLICY "Anyone can create rooms" 
ON rooms FOR INSERT WITH CHECK (
  auth.uid() = created_by OR 
  auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Room creators and admins can update rooms" ON rooms;
CREATE POLICY "Room creators and admins can update rooms" 
ON rooms FOR UPDATE USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM room_participants 
    WHERE room_participants.room_id = rooms.id 
    AND room_participants.user_id = auth.uid()
    AND room_participants.is_admin = true
  )
);

DROP POLICY IF EXISTS "Room creators and admins can delete rooms" ON rooms;
CREATE POLICY "Room creators and admins can delete rooms" 
ON rooms FOR DELETE USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM room_participants 
    WHERE room_participants.room_id = rooms.id 
    AND room_participants.user_id = auth.uid()
    AND room_participants.is_admin = true
  )
);

-- Create a special bypass policy for legacy room creation
CREATE POLICY "Legacy users can create rooms" 
ON rooms FOR INSERT WITH CHECK (true);

-- Create a trigger function to automatically associate a room with its creator
CREATE OR REPLACE FUNCTION auto_set_room_creator()
RETURNS TRIGGER AS $$
BEGIN
  -- If no created_by is provided, try to use auth.uid() or extract from header
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add the trigger to the rooms table
DROP TRIGGER IF EXISTS trig_auto_set_room_creator ON rooms;
CREATE TRIGGER trig_auto_set_room_creator
BEFORE INSERT ON rooms
FOR EACH ROW EXECUTE FUNCTION auto_set_room_creator();

-- Modify messages table policies
DROP POLICY IF EXISTS "Anyone can create messages in rooms they participate in" ON messages;
CREATE POLICY "Anyone can create messages in rooms they participate in" 
ON messages FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM room_participants
    WHERE room_participants.room_id = messages.room_id
    AND room_participants.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages" 
ON messages FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages" 
ON messages FOR DELETE USING (user_id = auth.uid());

-- Modify active users policies
DROP POLICY IF EXISTS "Users can insert their own active status" ON active_users;
CREATE POLICY "Users can insert their own active status" 
ON active_users FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own active status" ON active_users;
CREATE POLICY "Users can update their own active status" 
ON active_users FOR UPDATE USING (id = auth.uid());

-- Modify room participants policies
DROP POLICY IF EXISTS "Anyone can join rooms" ON room_participants;
CREATE POLICY "Anyone can join rooms" 
ON room_participants FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can leave rooms they joined" ON room_participants;
CREATE POLICY "Users can leave rooms they joined" 
ON room_participants FOR DELETE USING (user_id = auth.uid());

-- Modify typing status policies
DROP POLICY IF EXISTS "Users can insert their own typing status" ON user_typing;
CREATE POLICY "Users can insert their own typing status" 
ON user_typing FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own typing status" ON user_typing;
CREATE POLICY "Users can update their own typing status" 
ON user_typing FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own typing status" ON user_typing;
CREATE POLICY "Users can delete their own typing status" 
ON user_typing FOR DELETE USING (user_id = auth.uid());

-- ===================================================
-- 12. BYPASS FUNCTIONS FOR LEGACY USERS
-- ===================================================

-- Create a function to bypass RLS for room creation
CREATE OR REPLACE FUNCTION create_room_bypass(
  room_id TEXT,
  room_name TEXT,
  room_password TEXT,
  creator_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
  -- Insert the room directly, bypassing RLS
  INSERT INTO rooms (id, name, password, created_by, created_at)
  VALUES (room_id, room_name, room_password, creator_id, NOW());
  
  -- Also add the creator as a participant and admin
  INSERT INTO room_participants (room_id, user_id, joined_at, is_admin)
  VALUES (room_id, creator_id, NOW(), TRUE);
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating room: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql; 