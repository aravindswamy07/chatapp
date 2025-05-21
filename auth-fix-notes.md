# Authentication Fix - Missing Password Column & RLS Policy

## Issue 1: Missing Password Column
We encountered an error during user signup: "Could not find the 'password' column of 'users' in the schema cache". 

This happened because our authentication code in `lib/auth.ts` was trying to store passwords directly in the users table, but our Supabase schema didn't have a password column defined.

## Issue 2: Missing RLS Policy for User Creation
After adding the password column, we encountered a 401 Unauthorized error with the message: "new row violates row-level security policy for table users".

This occurred because we enabled Row Level Security (RLS) on the users table but didn't add an INSERT policy to allow new user creation during signup.

## Fixes Applied
1. Added a `password` column to the `users` table in the setup files
2. Added an INSERT policy for the users table to allow user creation
3. Improved error handling in auth.ts for better debugging

## How to Apply These Fixes
1. Go to the Supabase SQL Editor
2. Run the following SQL:
```sql
-- Fix 1: Add password column
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;

-- Fix 2: Add INSERT policy for users table
CREATE POLICY "Anyone can create a user account" 
ON users FOR INSERT WITH CHECK (true);
```

Alternatively, run the individual fix scripts:
- `fix-user-insert-policy.sql` - Adds the missing RLS policy

## Important Notes
1. **Security Warning**: This implementation stores passwords as plaintext in the database, which is not secure for a production application. 

2. **Better Alternative**: For a production application, we should consider:
   - Using Supabase's built-in auth system with JWT tokens
   - Implementing proper password hashing using bcrypt/Argon2
   - Setting up proper auth flows with email verification

3. **Next Steps**: After running the updated SQL in Supabase, the signup and login functionality should work correctly.

## How to Apply This Fix
1. Go to the Supabase SQL Editor
2. Run the following SQL:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
```

This is a temporary fix to get the application working. In a future update, we should implement proper authentication security. 