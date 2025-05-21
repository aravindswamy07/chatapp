-- Add columns for room name and description if they don't exist
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT;

-- Add admin flag to room participants if it doesn't exist
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create a trigger to automatically set the room creator as admin
CREATE OR REPLACE FUNCTION set_room_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO room_participants (room_id, user_id, is_admin)
  VALUES (NEW.id, NEW.created_by, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on room creation
DROP TRIGGER IF EXISTS room_creator_as_admin ON rooms;
CREATE TRIGGER room_creator_as_admin
AFTER INSERT ON rooms
FOR EACH ROW
EXECUTE FUNCTION set_room_creator_as_admin();

-- Function to check if a user is an admin of a room
CREATE OR REPLACE FUNCTION is_room_admin(room_id TEXT, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  SELECT rp.is_admin INTO is_admin
  FROM room_participants rp
  WHERE rp.room_id = $1 AND rp.user_id = $2;
  
  RETURN COALESCE(is_admin, false);
END;
$$ LANGUAGE plpgsql; 