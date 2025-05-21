# Discord-like Chat App

A Next.js chat application with Supabase backend that mimics Discord's interface. Limited to 10 concurrent users.

## Features

- User authentication with unique ID generation
- Real-time chat messaging
- User presence indication
- Discord-like UI with Tailwind CSS
- Limited to 10 concurrent users

## Setup Instructions

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a Supabase account and project at https://supabase.io
4. In your Supabase project, create the following tables:
   
   **active_users:**
   - id (uuid, primary key)
   - username (text)
   - created_at (timestamp with time zone, default: now())

   **messages:**
   - id (uuid, primary key)
   - userId (text) 
   - username (text)
   - content (text)
   - created_at (timestamp with time zone, default: now())

5. Enable realtime for both tables in the Supabase dashboard
6. Create a `.env.local` file with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```
7. Run the development server:
   ```
   npm run dev
   ```
8. Open [http://localhost:3000](http://localhost:3000) in your browser

## How It Works

1. Users provide a username and password on the homepage
2. A unique ID is generated for each user
3. Users can join the chat if there are fewer than 10 active users
4. In the chat, users can send and receive messages in real-time
5. The active users list shows all currently connected users (max 10)
6. Users are automatically removed from active users when they leave 