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