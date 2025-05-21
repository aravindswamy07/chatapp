import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../../lib/supabase';
import { isRoomAdmin } from '../../../../lib/admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  const roomId = Array.isArray(id) ? id[0] : id;
  
  if (!roomId) {
    return res.status(400).json({ error: 'Room ID is required' });
  }
  
  switch (req.method) {
    case 'GET':
      try {
        // Get room participants
        const { data, error } = await supabase
          .from('room_participants')
          .select(`
            user_id,
            is_admin,
            joined_at,
            users:user_id (username)
          `)
          .eq('room_id', roomId);
        
        if (error) {
          console.error('Error fetching room participants:', error);
          return res.status(500).json({ error: 'Failed to fetch participants' });
        }
        
        // Format the response
        const participants = data.map(participant => ({
          id: participant.user_id,
          isAdmin: participant.is_admin,
          joinedAt: participant.joined_at,
          username: ((participant.users as any)?.username) || 'Unknown'
        }));
        
        return res.status(200).json({
          data: participants
        });
      } catch (err) {
        console.error('Exception in GET /api/rooms/[id]/participants:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
    case 'DELETE':
      try {
        // Remove a user from the room (admin only)
        const { adminId, userId } = req.body;
        
        if (!adminId || !userId) {
          return res.status(400).json({ error: 'Admin ID and User ID are required' });
        }
        
        // Check if the requester is an admin
        const isAdmin = await isRoomAdmin(roomId, adminId);
        if (!isAdmin) {
          return res.status(403).json({ error: 'You do not have permission to remove users from this room' });
        }
        
        // Check if target user is also an admin
        const { data: targetUserData } = await supabase
          .from('room_participants')
          .select('is_admin')
          .eq('room_id', roomId)
          .eq('user_id', userId)
          .single();
        
        if (targetUserData?.is_admin) {
          return res.status(403).json({ error: 'Cannot remove another admin from the room' });
        }
        
        // Remove the user
        const { error } = await supabase
          .from('room_participants')
          .delete()
          .eq('room_id', roomId)
          .eq('user_id', userId);
        
        if (error) {
          console.error('Error removing user from room:', error);
          return res.status(500).json({ error: 'Failed to remove user from room' });
        }
        
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Exception in DELETE /api/rooms/[id]/participants:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
    case 'POST':
      try {
        // Add a new admin (admin only)
        const { adminId, newAdminId } = req.body;
        
        if (!adminId || !newAdminId) {
          return res.status(400).json({ error: 'Admin ID and New Admin ID are required' });
        }
        
        // Check if the requester is an admin
        const isAdmin = await isRoomAdmin(roomId, adminId);
        if (!isAdmin) {
          return res.status(403).json({ error: 'You do not have permission to add admins to this room' });
        }
        
        // Update the user's admin status
        const { error } = await supabase
          .from('room_participants')
          .update({ is_admin: true })
          .eq('room_id', roomId)
          .eq('user_id', newAdminId);
        
        if (error) {
          console.error('Error adding admin to room:', error);
          return res.status(500).json({ error: 'Failed to add admin to room' });
        }
        
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Exception in POST /api/rooms/[id]/participants:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
} 