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

// Function to get an authenticated Supabase client with JWT token
export const getAuthenticatedClient = async () => {
  // First try to get the session from Supabase Auth
  const { data } = await supabase.auth.getSession();
  
  // If we have a session with a valid access token
  if (data?.session?.access_token) {
    console.log('Using authenticated Supabase client (session found)');
    
    // Create a new client with the auth headers
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          'Authorization': `Bearer ${data.session.access_token}`,
        },
      },
    });
    
    return authClient;
  }
  
  // Fallback for legacy users: Check if we have a user in storage
  if (typeof window !== 'undefined') {
    const userStr = sessionStorage.getItem('currentUser');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        console.log('Found legacy user in storage, creating custom headers with user ID:', user.id);
        
        // Create a client with custom headers that include the user ID
        // This allows our RLS policies to use this header in addition to auth.uid()
        const legacyClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
          global: {
            headers: {
              // Add a custom header with the user ID
              'x-legacy-user-id': user.id,
            },
          },
        });
        
        console.log('Using legacy authenticated client with custom headers');
        return legacyClient;
      } catch (e) {
        console.error('Error parsing user from storage:', e);
      }
    }
  }
  
  console.log('No authenticated session found, using anonymous client');
  return supabase;
};

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

// Get participants for a specific room
export async function getRoomParticipants(roomId: string): Promise<{ id: string; username: string }[]> {
  if (!supabase) {
    // Mock data for development
    return [
      { id: '1', username: 'System' },
      { id: '2', username: 'TestUser1' },
    ];
  }

  try {
    // Define a type for the expected response structure
    type ParticipantData = {
      user_id: string;
      users: {
        username: string;
      } | null;
    };

    const { data, error } = await supabase
      .from('room_participants')
      .select(`
        user_id,
        users:user_id (
          username
        )
      `)
      .eq('room_id', roomId);
    
    if (error) {
      console.error('Error fetching room participants:', error);
      return [];
    }
    
    // Process the data more carefully with proper type assertions
    const participants: { id: string; username: string }[] = [];
    
    if (data) {
      for (const item of data as unknown as ParticipantData[]) {
        try {
          if (item.user_id) {
            // Access the username safely, providing a default if not found
            const username = item.users?.username || 'Unknown User';
            participants.push({
              id: item.user_id,
              username
            });
          }
        } catch (e) {
          console.error('Error processing participant data:', e);
        }
      }
    }
    
    return participants;
  } catch (err) {
    console.error('Exception in getRoomParticipants:', err);
    return [];
  }
}

// Check if a room exists
export async function checkRoomExists(roomId: string): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return true; // For development
  }

  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .single();
    
    if (error) {
      return false;
    }
    
    return !!data;
  } catch (err) {
    console.error('Exception in checkRoomExists:', err);
    return false;
  }
}

// Get rooms created by a user
export async function getUserRooms(userId: string): Promise<{ id: string; password: string }[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return []; // For development
  }

  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, password')
      .eq('created_by', userId);
    
    if (error) {
      console.error('Error fetching user rooms:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Exception in getUserRooms:', err);
    return [];
  }
}

// Get rooms a user has joined
export async function getJoinedRooms(userId: string): Promise<{ id: string }[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return []; // For development
  }

  try {
    const { data, error } = await supabase
      .from('room_participants')
      .select('room_id')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching joined rooms:', error);
      return [];
    }
    
    return (data || []).map(item => ({
      id: item.room_id
    }));
  } catch (err) {
    console.error('Exception in getJoinedRooms:', err);
    return [];
  }
} 