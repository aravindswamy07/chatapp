-- ===================================================
-- NEBULA CHAT - COMPLETE SUPABASE SETUP
-- ===================================================
-- This file contains all SQL commands to set up the entire database
-- Execute this in your Supabase SQL Editor to recreate the database from scratch

-- ===================================================
-- 1. BASE DATABASE STRUCTURE
-- ===================================================

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
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
CREATE INDEX IF NOT EXISTS idx_active_users_last_seen ON active_users(last_seen);

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
    SELECT 1 FROM room_participants
    WHERE room_participants.room_id = messages.room_id
    AND room_participants.user_id = auth.uid()
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

CREATE POLICY "Users can update their own active status" 
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
CREATE POLICY "Allow authenticated users to upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images');

-- Allow anyone to view images (since our messages are public in this demo)
CREATE POLICY "Allow public read access to chat images"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

-- ===================================================
-- 6. ADMIN PRIVILEGES
-- ===================================================

-- Make sure room_participants table has is_admin column
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create function to automatically make room creators admins
CREATE OR REPLACE FUNCTION set_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a record into room_participants making the creator an admin
  INSERT INTO room_participants (room_id, user_id, is_admin)
  VALUES (NEW.id, NEW.created_by, TRUE);
  
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

CREATE POLICY "Users can update their own typing status"
ON user_typing FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own typing status"
ON user_typing FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own typing status"
ON user_typing FOR DELETE USING (user_id = auth.uid());

-- ===================================================
-- 8. CREATE DEFAULT ROOM
-- ===================================================

-- Create a default room if it doesn't exist
INSERT INTO rooms (id, name, description, is_private)
VALUES ('default', 'General Chat', 'Welcome to NebulaChat!', false)
ON CONFLICT (id) DO NOTHING; 