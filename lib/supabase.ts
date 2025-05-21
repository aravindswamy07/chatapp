import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Display a warning if credentials aren't set
if (typeof window !== 'undefined') {
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key length:', supabaseAnonKey?.length);
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('⚠️ Supabase credentials not found! Please create a .env.local file with your Supabase credentials.');
  }
}

// Create Supabase client with detailed options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  db: {
    schema: 'public'
  },
  global: {
    fetch: fetch,
    headers: { 'x-application-name': 'chatapp' }
  }
});

// Log that the client was created
console.log('Supabase client created successfully');

// Test connection
if (typeof window !== 'undefined') {
  console.log('Testing Supabase connection...');
  // Use an async IIFE to handle errors properly
  (async () => {
    try {
      const { count, error } = await supabase.from('messages').select('count', { count: 'exact', head: true });
      if (error) {
        console.error('Supabase connection test failed:', error);
      } else {
        console.log('Supabase connection successful, message count:', count);
      }
    } catch (err) {
      console.error('Supabase connection test exception:', err);
    }
  })();
}

// Mock implementation for missing Supabase
const mockUsers = [
  { id: '1', username: 'user1' },
  { id: '2', username: 'user2' }
];

const mockMessages = [
  { id: '1', userId: '1', username: 'user1', content: 'Hello!', created_at: new Date().toISOString() }
];

export async function getActiveUsers() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('Using mock data for active users');
    return mockUsers;
  }

  try {
    console.log('Fetching active users from Supabase...');
    const { data, error } = await supabase
      .from('active_users')
      .select('*');
    
    if (error) {
      console.error('Error fetching active users:', error);
      return [];
    }
    
    console.log('Active users retrieved successfully, count:', data?.length);
    return data || [];
  } catch (err) {
    console.error('Exception when fetching active users:', err);
    return [];
  }
}

export async function checkUserLimit() {
  const users = await getActiveUsers();
  return users.length < 10; // Limit of 10 users
}

export async function addActiveUser(userId: string, username: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('Using mock data for adding user');
    mockUsers.push({ id: userId, username });
    return true;
  }

  try {
    console.log('Adding active user to Supabase:', { userId, username });
    const { error } = await supabase
      .from('active_users')
      .insert([{ id: userId, username }]);
    
    if (error) {
      console.error('Error adding active user:', error);
      return false;
    }
    
    console.log('User added successfully');
    return true;
  } catch (err) {
    console.error('Exception when adding active user:', err);
    return false;
  }
}

export async function removeActiveUser(userId: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('Using mock data for removing user');
    const index = mockUsers.findIndex(user => user.id === userId);
    if (index !== -1) {
      mockUsers.splice(index, 1);
    }
    return true;
  }

  try {
    console.log('Removing active user from Supabase:', userId);
    const { error } = await supabase
      .from('active_users')
      .delete()
      .eq('id', userId);
    
    if (error) {
      console.error('Error removing active user:', error);
      return false;
    }
    
    console.log('User removed successfully');
    return true;
  } catch (err) {
    console.error('Exception when removing active user:', err);
    return false;
  }
}

export async function checkUsernameExists(username: string): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('Using mock data for username check');
    // For mock mode, consider these usernames taken
    const takenUsernames = ['admin', 'user1', 'test123'];
    return takenUsernames.includes(username);
  }

  try {
    console.log('Checking if username exists in Supabase:', username);
    const { data, error } = await supabase
      .from('active_users')
      .select('username')
      .eq('username', username)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking username:', error);
      return false;
    }
    
    return !!data;
  } catch (err) {
    console.error('Exception when checking username:', err);
    return false;
  }
} 