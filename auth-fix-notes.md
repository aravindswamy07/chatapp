# Authentication Fix - Missing Password Column

## Issue
We encountered an error during user signup: "Could not find the 'password' column of 'users' in the schema cache". 

This happened because our authentication code in `lib/auth.ts` was trying to store passwords directly in the users table, but our Supabase schema didn't have a password column defined.

## Fix Applied
1. Added a `password` column to the `users` table in the following files:
   - `complete_supabase_setup.sql`
   - `supabase_setup_steps.md`

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