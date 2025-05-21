import { supabase } from './supabase';

// Check if a user is admin for a room
export async function isRoomAdmin(roomId: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('room_participants')
      .select('is_admin')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      console.error('Error checking admin status:', error);
      return false;
    }
    
    return data.is_admin === true;
  } catch (err) {
    console.error('Exception in isRoomAdmin:', err);
    return false;
  }
}

// Update room settings (name, description)
export async function updateRoomSettings(
  roomId: string, 
  userId: string, 
  settings: { name?: string; description?: string }
): Promise<boolean> {
  try {
    // First check if user is admin
    const isAdmin = await isRoomAdmin(roomId, userId);
    if (!isAdmin) {
      console.error('User is not admin of this room');
      return false;
    }
    
    const { error } = await supabase
      .from('rooms')
      .update(settings)
      .eq('id', roomId);
    
    if (error) {
      console.error('Error updating room settings:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Exception in updateRoomSettings:', err);
    return false;
  }
}

// Delete a room (admin only)
export async function deleteRoom(roomId: string, userId: string): Promise<boolean> {
  try {
    // First check if user is admin
    const isAdmin = await isRoomAdmin(roomId, userId);
    if (!isAdmin) {
      console.error('User is not admin of this room');
      return false;
    }
    
    // Delete all messages in the room first
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('room_id', roomId);
    
    if (messagesError) {
      console.error('Error deleting room messages:', messagesError);
      return false;
    }
    
    // Delete all room participants
    const { error: participantsError } = await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId);
    
    if (participantsError) {
      console.error('Error deleting room participants:', participantsError);
      return false;
    }
    
    // Delete the room itself
    const { error: roomError } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId);
    
    if (roomError) {
      console.error('Error deleting room:', roomError);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Exception in deleteRoom:', err);
    return false;
  }
}

// Remove a user from a room (admin only)
export async function removeUserFromRoom(
  roomId: string, 
  adminId: string, 
  userIdToRemove: string
): Promise<boolean> {
  try {
    // Skip if trying to remove self
    if (adminId === userIdToRemove) {
      console.error('Cannot remove yourself from room');
      return false;
    }
    
    // First check if user is admin
    const isAdmin = await isRoomAdmin(roomId, adminId);
    if (!isAdmin) {
      console.error('User is not admin of this room');
      return false;
    }
    
    // Check if the user to remove is not also an admin
    const { data: targetUserData } = await supabase
      .from('room_participants')
      .select('is_admin')
      .eq('room_id', roomId)
      .eq('user_id', userIdToRemove)
      .single();
    
    if (targetUserData?.is_admin) {
      console.error('Cannot remove another admin from room');
      return false;
    }
    
    // Remove the user from room participants
    const { error } = await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userIdToRemove);
    
    if (error) {
      console.error('Error removing user from room:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Exception in removeUserFromRoom:', err);
    return false;
  }
}

// Get all participants in a room
export async function getRoomParticipants(roomId: string): Promise<{
  id: string;
  username: string;
  isAdmin: boolean;
}[]> {
  try {
    const { data, error } = await supabase
      .from('room_participants')
      .select(`
        user_id,
        is_admin,
        users:user_id (username)
      `)
      .eq('room_id', roomId);
    
    if (error || !data) {
      console.error('Error getting room participants:', error);
      return [];
    }
    
    return data.map(participant => ({
      id: participant.user_id,
      username: ((participant.users as any)?.username) || 'Unknown',
      isAdmin: participant.is_admin
    }));
  } catch (err) {
    console.error('Exception in getRoomParticipants:', err);
    return [];
  }
}

// Add a new admin to the room
export async function addRoomAdmin(
  roomId: string, 
  currentAdminId: string, 
  newAdminId: string
): Promise<boolean> {
  try {
    // First check if current user is admin
    const isAdmin = await isRoomAdmin(roomId, currentAdminId);
    if (!isAdmin) {
      console.error('User is not admin of this room');
      return false;
    }
    
    // Update the user's admin status
    const { error } = await supabase
      .from('room_participants')
      .update({ is_admin: true })
      .eq('room_id', roomId)
      .eq('user_id', newAdminId);
    
    if (error) {
      console.error('Error adding admin to room:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Exception in addRoomAdmin:', err);
    return false;
  }
} 