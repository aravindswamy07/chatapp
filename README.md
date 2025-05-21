# NebulaChat

A feature-rich real-time chat application built with Next.js, Tailwind CSS, and Supabase.

## Features

- User authentication with username/password login
- Create and join private chat rooms (10 users per room limit)
- Real-time messaging with Supabase Realtime
- Message reply functionality
- Mobile-responsive design
- Room management system

## Getting Started

### Prerequisites

- Node.js 14.x or later
- npm or yarn
- A Supabase account (free tier is sufficient)

### Setup

1. Clone the repository:
```
git clone <repo-url>
cd chatapp
```

2. Install dependencies:
```
npm install
# or
yarn
```

3. Create a `.env.local` file in the root directory with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up your Supabase database by running the SQL script in `enhanced_database_structure.sql` in the Supabase SQL editor.

5. Run the development server:
```
npm run dev
# or
yarn dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Sign up for a new account
2. Create a new room or join an existing one with a room ID and password
3. Start chatting!

## Development Notes

- For development without Supabase, the application falls back to mock data.
- Room IDs are 5-digit numbers and passwords are 7-character alphanumeric strings.
- Room participants are limited to 10 users per room.

## License

MIT 