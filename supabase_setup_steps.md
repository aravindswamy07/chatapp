# Step-by-Step Supabase Setup for NebulaChat

Follow these steps in order to set up your Supabase database for the NebulaChat application.

## Step 1: Reset Your Supabase Database (If Needed)

Run this SQL in the Supabase SQL Editor to clear everything:

```sql
-- Delete all data from tables
DELETE FROM user_typing;
DELETE FROM messages;
DELETE FROM room_participants;
DELETE FROM active_users;
DELETE FROM storage.objects;
DELETE FROM storage.buckets;

-- Drop all tables
DROP TABLE IF EXISTS user_typing CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS room_participants CASCADE;
DROP TABLE IF EXISTS active_users CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop any triggers and functions
DROP FUNCTION IF EXISTS clear_stale_typing_status CASCADE;
DROP FUNCTION IF EXISTS set_creator_as_admin CASCADE;

-- Drop all policies
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
```

## Step 2: Create Base Tables

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  content TEXT,
  reply_to UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  image_url TEXT,
  file_url TEXT,
  file_type TEXT
);

-- Create active users tracking table
CREATE TABLE IF NOT EXISTS active_users (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room participants table
CREATE TABLE IF NOT EXISTS room_participants (
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (room_id, user_id)
);

-- Create typing status table
CREATE TABLE IF NOT EXISTS user_typing (
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  is_typing BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);
```

## Step 3: Create Indexes for Performance

```sql
-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_active_users_last_seen ON active_users(last_seen);
CREATE INDEX IF NOT EXISTS idx_user_typing_room_id ON user_typing(room_id);
CREATE INDEX IF NOT EXISTS idx_user_typing_updated_at ON user_typing(updated_at);
```

## Step 4: Set Up Realtime for All Tables

```sql
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
ALTER PUBLICATION supabase_realtime ADD TABLE user_typing;
```

## Step 5: Create Storage Bucket for Images

```sql
-- Create a storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'Chat Message Images', true)
ON CONFLICT (id) DO NOTHING;
```

## Step 6: Create Trigger Functions

```sql
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

-- Create function to automatically clear typing status
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
```

## Step 7: Enable Row Level Security (RLS)

```sql
-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_typing ENABLE ROW LEVEL SECURITY;
```

## Step 8: Create RLS Policies - Users

```sql
-- Users table policies
CREATE POLICY "Users can view all users" 
ON users FOR SELECT USING (true);

CREATE POLICY "Users can update their own record" 
ON users FOR UPDATE USING (auth.uid() = id);
```

## Step 9: Create RLS Policies - Rooms

```sql
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
```

## Step 10: Create RLS Policies - Messages

```sql
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
```

## Step 11: Create RLS Policies - Active Users

```sql
-- Active users policies
CREATE POLICY "Anyone can view active users" 
ON active_users FOR SELECT USING (true);

CREATE POLICY "Users can insert their own active status" 
ON active_users FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own active status" 
ON active_users FOR UPDATE USING (id = auth.uid());
```

## Step 12: Create RLS Policies - Room Participants

```sql
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

CREATE POLICY "Admins can remove users from rooms"
ON room_participants FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM room_participants AS rp
    WHERE rp.room_id = room_participants.room_id
    AND rp.user_id = auth.uid()
    AND rp.is_admin = true
  )
);
```

## Step 13: Create RLS Policies - Typing Status

```sql
-- Typing indicator policies
CREATE POLICY "Anyone can view typing status"
ON user_typing FOR SELECT USING (true);

CREATE POLICY "Users can insert their own typing status"
ON user_typing FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own typing status"
ON user_typing FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own typing status"
ON user_typing FOR DELETE USING (user_id = auth.uid());
```

## Step 14: Create RLS Policies - Storage

```sql
-- Storage policies
CREATE POLICY "Allow authenticated users to upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images');

CREATE POLICY "Allow public read access to chat images"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');
```

## Step 15: Create Default Room

```sql
-- Create a default room
INSERT INTO rooms (id, name, description, created_by, is_private)
VALUES ('default', 'General Chat', 'Welcome to NebulaChat!', NULL, false)
ON CONFLICT (id) DO NOTHING;
```

## Verification

After running all steps, you can verify your setup with:

```sql
-- Check tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify storage bucket exists
SELECT * FROM storage.buckets;

-- Check policies
SELECT * FROM pg_policies WHERE schemaname = 'public';
SELECT * FROM pg_policies WHERE schemaname = 'storage';

-- Verify default room was created
SELECT * FROM rooms;
``` 