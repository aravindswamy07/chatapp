import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

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
    
    // Insert new user
    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        password, // In a real app, this would be hashed
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user:', error);
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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password) // In a real app, we'd verify a hash
      .single();
    
    if (error || !data) {
      console.error('Login error:', error);
      return null;
    }
    
    // Update last login time
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', data.id);
    
    // Store in session storage for persistence across page refreshes
    const user = { 
      id: data.id, 
      username: data.username 
    };
    
    currentUser = user;
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
    }
    
    return user;
  } catch (err) {
    console.error('Exception in login:', err);
    return null;
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
  currentUser = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentRoom');
  }
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
    // Generate room ID and password
    const { data: roomIdData } = await supabase.rpc('generate_room_id');
    const roomId = roomIdData as string;
    const password = generateRoomPassword();
    
    // Create room
    const { error } = await supabase
      .from('rooms')
      .insert({
        id: roomId,
        password,
        created_by: userId
      });
    
    if (error) {
      console.error('Error creating room:', error);
      return null;
    }
    
    // Add creator as first participant
    await supabase
      .from('room_participants')
      .insert({
        room_id: roomId,
        user_id: userId
      });
    
    return { roomId, password };
  } catch (err) {
    console.error('Exception in createRoom:', err);
    return null;
  }
}

export async function joinRoom(roomId: string, password: string, userId: string): Promise<boolean> {
  try {
    // Verify room exists with matching password
    const { data: room, error } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .eq('password', password)
      .single();
    
    if (error || !room) {
      console.error('Room not found or incorrect password');
      return false;
    }
    
    // Check if user is already in room
    const { data: existingParticipant } = await supabase
      .from('room_participants')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();
    
    if (existingParticipant) {
      // User is already in the room, which is fine
      return true;
    }
    
    // Check room participant count
    const { count, error: countError } = await supabase
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
    const { error: joinError } = await supabase
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