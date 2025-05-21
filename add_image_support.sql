-- Add new columns to the messages table for image and file support
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