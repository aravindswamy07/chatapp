-- Drop existing tables
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS active_users;

-- Create users table for persistent accounts
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- In real production, this would be hashed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Create rooms table
CREATE TABLE rooms (
  id TEXT PRIMARY KEY, -- 5-digit numeric ID
  password TEXT NOT NULL, -- 7-character password
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room_participants table to track users in each room
CREATE TABLE room_participants (
  room_id TEXT REFERENCES rooms(id),
  user_id UUID REFERENCES users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- Create messages table with room_id and reply_to support
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT REFERENCES rooms(id),
  user_id UUID REFERENCES users(id),
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  reply_to UUID REFERENCES messages(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (for this demo app)
CREATE POLICY "Allow public access to users" 
  ON users FOR ALL USING (true);

CREATE POLICY "Allow public access to rooms" 
  ON rooms FOR ALL USING (true);

CREATE POLICY "Allow public access to room_participants" 
  ON room_participants FOR ALL USING (true);

CREATE POLICY "Allow public access to messages" 
  ON messages FOR ALL USING (true);

-- Enable realtime for these tables
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

-- Add tables to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Create indexes for performance
CREATE INDEX idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_reply_to ON messages(reply_to);

-- Function to generate a random room ID (5-digit number)
CREATE OR REPLACE FUNCTION generate_room_id() RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  conflict_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 5-digit number
    new_id := (floor(random() * 90000) + 10000)::TEXT;
    
    -- Check if this ID already exists
    SELECT EXISTS(SELECT 1 FROM rooms WHERE id = new_id) INTO conflict_exists;
    
    -- If no conflict, return this ID
    IF NOT conflict_exists THEN
      RETURN new_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql; 