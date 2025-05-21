import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Display a warning if credentials aren't set
if (typeof window !== 'undefined') {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('⚠️ Supabase credentials not found! Please create a .env.local file with your Supabase credentials.');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

  const { data, error } = await supabase
    .from('active_users')
    .select('*');
  
  if (error) {
    console.error('Error fetching active users:', error);
    return [];
  }
  
  return data || [];
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

  const { error } = await supabase
    .from('active_users')
    .insert([{ id: userId, username }]);
  
  if (error) {
    console.error('Error adding active user:', error);
    return false;
  }
  
  return true;
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

  const { error } = await supabase
    .from('active_users')
    .delete()
    .eq('id', userId);
  
  if (error) {
    console.error('Error removing active user:', error);
    return false;
  }
  
  return true;
} 