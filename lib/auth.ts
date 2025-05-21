import { v4 as uuidv4 } from 'uuid';
import { supabase, getAuthenticatedClient } from './supabase';

export type User = {
  id: string;
  username: string;
};

// For storing the current user session
let currentUser: User | null = null;

// Create a new user account
export async function createUser(username: string, password: string): Promise<User | null> {
  try {
    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .maybeSingle();
    
    if (existingUser) {
      throw new Error('Username already exists');
    }
    
    // First create an auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: `${username}@gmail.com`, // Using a standard domain that will pass validation
      password: password,
    });
    
    if (authError) {
      console.error('Error creating auth user:', authError);
      throw new Error(`Authentication error: ${authError.message}`);
    }
    
    if (!authData.user || !authData.user.id) {
      throw new Error('Failed to create auth user - no user ID returned');
    }
    
    // Now insert into the users table with the auth user ID
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: authData.user.id, // Use the ID from the auth user
        username,
        password, // In a real app, this would be hashed
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user:', error);
      
      // Add specific check for missing password column
      if (error.message && error.message.includes('password') && error.message.includes('column')) {
        throw new Error('Database setup issue: password column missing. Please run the SQL setup script in Supabase.');
      }
      
      // Try to clean up the auth user if the DB insert failed
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupErr) {
        console.error('Failed to clean up auth user after insert error:', cleanupErr);
      }
      
      return null;
    }
    
    return {
      id: data.id,
      username: data.username
    };
  } catch (err) {
    console.error('Exception in createUser:', err);
    throw err;
  }
}

// Log in with username and password
export async function login(username: string, password: string): Promise<User | null> {
  try {
    // First try the new auth system login
    try {
      // Log in with email (using username) and password via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: `${username}@gmail.com`, // Match the email format used during signup
        password: password,
      });
      
      if (!authError && authData.user) {
        // Auth login succeeded, get user from database
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();
        
        if (!error && data) {
          // Success - update last login time
          await supabase
            .from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', data.id);
          
          // Return the user
          const user = { 
            id: data.id, 
            username: data.username 
          };
          
          currentUser = user;
          
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('currentUser', JSON.stringify(user));
          }
          
          return user;
        }
      }
      
      // If we get here, auth login failed but we don't throw - try legacy login
      console.log('Auth login failed, trying legacy login');
    } catch (authErr) {
      console.error('Auth login error, trying legacy login:', authErr);
      // Fall through to legacy login
    }
    
    // LEGACY LOGIN METHOD for existing users
    console.log('Attempting legacy login for:', username);
    const { data: legacyData, error: legacyError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password) // In a real app, we'd verify a hash
      .single();
    
    if (legacyError) {
      console.error('Legacy login error:', legacyError);
      return null;
    }
    
    if (!legacyData) {
      console.error('No user found with those credentials');
      return null;
    }
    
    // Legacy login succeeded - create auth user for future logins
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: `${username}@gmail.com`,
        password: password,
      });
      
      if (!authError && authData.user) {
        console.log('Created auth user for legacy account');
        // If user ID doesn't match, we should update the user record
        // But that's more complex - for now just advise them to use new signup
      }
    } catch (createErr) {
      console.error('Failed to create auth user for legacy account:', createErr);
      // Continue with legacy login anyway
    }
    
    // Update last login time
    await supabase
      .from('users')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', legacyData.id);
    
    // Store in session storage for persistence across page refreshes
    const user = { 
      id: legacyData.id, 
      username: legacyData.username 
    };
    
    currentUser = user;
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
    }
    
    return user;
  } catch (err) {
    console.error('Exception in login:', err);
    throw err;
  }
}

export function getUserFromStorage() {
  if (typeof window === 'undefined') {
    console.log('getUserFromStorage called on server side, returning null');
    return null;
  }
  
  try {
    const storedUser = sessionStorage.getItem('currentUser');
    console.log('Getting user from storage:', storedUser ? 'Found user' : 'No user found');
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
      return currentUser;
    }
  } catch (err) {
    console.error('Error retrieving user from storage:', err);
    // Clear potentially corrupted data
    try {
      sessionStorage.removeItem('currentUser');
    } catch (e) {
      console.error('Error clearing sessionStorage:', e);
    }
  }
  return null;
}

export function getCurrentUser() {
  // If on server side, can't have a user
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (currentUser) {
    console.log('Using cached user:', currentUser.username);
    return currentUser;
  }
  
  const storageUser = getUserFromStorage();
  console.log('Getting current user:', storageUser ? storageUser.username : 'No user');
  return storageUser;
}

export function logout() {
  // Clear local state and storage
  currentUser = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentRoom');
  }
  
  // Sign out from Supabase Auth
  supabase.auth.signOut()
    .catch(error => {
      console.error("Error signing out from Supabase Auth:", error);
    });
}

export function isLoggedIn() {
  // Make sure we're not running on server
  if (typeof window === 'undefined') {
    console.log('isLoggedIn called server-side - returning false');
    return false;
  }
  
  try {
    const user = getCurrentUser();
    const isUserLoggedIn = !!user;
    console.log('isLoggedIn check:', isUserLoggedIn);
    return isUserLoggedIn;
  } catch (err) {
    console.error('Error in isLoggedIn:', err);
    return false;
  }
}

// Room functions
export function generateRoomPassword(): string {
  // Generate a 7 character password with moderate complexity
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createRoom(userId: string): Promise<{ roomId: string, password: string } | null> {
  try {
    console.log('Creating room for user:', userId);
    
    // Get an authenticated client
    const authClient = await getAuthenticatedClient();
    
    // Generate room ID and password
    const { data: roomIdData, error: rpcError } = await authClient.rpc('generate_room_id');
    if (rpcError) {
      console.error('Error generating room ID:', rpcError);
      return null;
    }
    
    const roomId = roomIdData as string;
    const password = generateRoomPassword();
    
    console.log('Generated room ID:', roomId, 'with password (length):', password.length);
    
    // Create room - get the current auth session first
    const { data: sessionData } = await authClient.auth.getSession();
    console.log('Current session exists:', !!sessionData?.session);
    
    const { error } = await authClient
      .from('rooms')
      .insert({
        id: roomId,
        name: `Room ${roomId.substring(0, 4)}`,
        password,
        created_by: userId
      });
    
    if (error) {
      console.error('Error creating room:', error);
      return null;
    }
    
    // Add creator as first participant
    const { error: participantError } = await authClient
      .from('room_participants')
      .insert({
        room_id: roomId,
        user_id: userId
      });
    
    if (participantError) {
      console.error('Error adding room participant:', participantError);
      // Room was created but participant wasn't added
      // We could try to clean up by deleting the room
    }
    
    return { roomId, password };
  } catch (err) {
    console.error('Exception in createRoom:', err);
    return null;
  }
}

export async function joinRoom(roomId: string, password: string, userId: string): Promise<boolean> {
  try {
    console.log('Joining room:', roomId, 'for user:', userId);
    
    // Get an authenticated client
    const authClient = await getAuthenticatedClient();
    
    // Verify room exists with matching password
    const { data: room, error } = await authClient
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .eq('password', password)
      .single();
    
    if (error || !room) {
      console.error('Room not found or incorrect password:', error);
      return false;
    }
    
    // Check if user is already in room
    const { data: existingParticipant, error: checkError } = await authClient
      .from('room_participants')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
      console.error('Error checking existing participant:', checkError);
    }
    
    if (existingParticipant) {
      // User is already in the room, which is fine
      console.log('User is already in the room');
      return true;
    }
    
    // Check room participant count
    const { count, error: countError } = await authClient
      .from('room_participants')
      .select('user_id', { count: 'exact' })
      .eq('room_id', roomId);
    
    if (countError) {
      console.error('Error checking participant count:', countError);
      return false;
    }
    
    if (count !== null && count >= 10) {
      console.error('Room is full (max 10 users)');
      return false;
    }
    
    // Add user to room
    const { error: joinError } = await authClient
      .from('room_participants')
      .insert({
        room_id: roomId,
        user_id: userId
      });
    
    if (joinError) {
      console.error('Error joining room:', joinError);
      return false;
    }
    
    // Store current room in session storage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('currentRoom', roomId);
    }
    
    return true;
  } catch (err) {
    console.error('Exception in joinRoom:', err);
    return false;
  }
}

export function getCurrentRoom(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('currentRoom');
  }
  return null;
}

export function setCurrentRoom(roomId: string | null) {
  if (typeof window !== 'undefined') {
    if (roomId) {
      sessionStorage.setItem('currentRoom', roomId);
    } else {
      sessionStorage.removeItem('currentRoom');
    }
  }
} 