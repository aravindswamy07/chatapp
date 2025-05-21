import { supabase } from './supabase';
import { User } from './auth';

// Table to track user typing status
// user_typing (
//   room_id TEXT,
//   user_id UUID,
//   username TEXT,
//   is_typing BOOLEAN,
//   updated_at TIMESTAMP,
//   PRIMARY KEY (room_id, user_id)
// )

/**
 * Set a user's typing status in a room
 */
export async function setTypingStatus(roomId: string, user: User, isTyping: boolean): Promise<void> {
  if (!user) return;
  
  try {
    await supabase
      .from('user_typing')
      .upsert({
        room_id: roomId,
        user_id: user.id,
        username: user.username,
        is_typing: isTyping,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'room_id,user_id'
      });
  } catch (err) {
    console.error('Error updating typing status:', err);
  }
}

/**
 * Get typing status information for a specific room
 */
export async function getTypingUsers(roomId: string, currentUserId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('user_typing')
      .select('username')
      .eq('room_id', roomId)
      .eq('is_typing', true)
      .neq('user_id', currentUserId) // Don't include the current user
      .gte('updated_at', new Date(Date.now() - 10000).toISOString()); // Only show users typing in the last 10 seconds
    
    if (error || !data) {
      console.error('Error getting typing users:', error);
      return [];
    }
    
    return data.map(user => user.username);
  } catch (err) {
    console.error('Error getting typing users:', err);
    return [];
  }
}

/**
 * Subscribe to typing status changes in a room
 */
export function subscribeToTypingStatus(
  roomId: string, 
  currentUserId: string,
  callback: (typingUsers: string[]) => void
) {
  // Initialize with current state
  getTypingUsers(roomId, currentUserId).then(users => {
    callback(users);
  });
  
  // Set up real-time subscription
  return supabase
    .channel(`room-typing:${roomId}`)
    .on('postgres_changes', 
      {
        event: '*',
        schema: 'public', 
        table: 'user_typing',
        filter: `room_id=eq.${roomId}`
      }, 
      async () => {
        // When any typing status changes, get the full list of typing users
        const users = await getTypingUsers(roomId, currentUserId);
        callback(users);
      }
    )
    .subscribe();
}

/**
 * Clean up typing data for a user when they leave a room
 */
export async function clearTypingStatus(roomId: string, userId: string): Promise<void> {
  if (!userId || !roomId) return;
  
  try {
    await supabase
      .from('user_typing')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);
  } catch (err) {
    console.error('Error clearing typing status:', err);
  }
} 