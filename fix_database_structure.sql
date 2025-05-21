-- Drop and recreate the messages table with the correct structure
DROP TABLE IF EXISTS messages;

-- Create messages table with the correct column names
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,  -- Note: using snake_case here
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop and recreate the active_users table
DROP TABLE IF EXISTS active_users;

-- Create active_users table
CREATE TABLE active_users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE active_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (for this demo app)
CREATE POLICY "Allow public access to active_users" 
  ON active_users FOR ALL USING (true);

CREATE POLICY "Allow public access to messages" 
  ON messages FOR ALL USING (true);

-- Enable realtime for these tables
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

-- Add tables to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE active_users;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Insert a test message
INSERT INTO messages (user_id, username, content)
VALUES ('system', 'System', 'Database structure has been fixed!'); 