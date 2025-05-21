import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import { isRoomAdmin } from '../../../lib/admin';

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
        // Get room details
        const { data, error } = await supabase
          .from('rooms')
          .select('id, name, description, created_at, created_by')
          .eq('id', roomId)
          .single();
        
        if (error) {
          console.error('Error fetching room details:', error);
          return res.status(500).json({ error: 'Failed to fetch room details' });
        }
        
        if (!data) {
          return res.status(404).json({ error: 'Room not found' });
        }
        
        return res.status(200).json({
          data: {
            id: data.id,
            name: data.name,
            description: data.description,
            createdAt: data.created_at,
            createdBy: data.created_by
          }
        });
      } catch (err) {
        console.error('Exception in GET /api/rooms/[id]:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
    case 'PUT':
      try {
        // Check if user is admin
        const { userId, name, description } = req.body;
        
        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }
        
        const isAdmin = await isRoomAdmin(roomId, userId);
        if (!isAdmin) {
          return res.status(403).json({ error: 'You do not have permission to update this room' });
        }
        
        // Update room
        const { error } = await supabase
          .from('rooms')
          .update({
            name,
            description
          })
          .eq('id', roomId);
        
        if (error) {
          console.error('Error updating room:', error);
          return res.status(500).json({ error: 'Failed to update room' });
        }
        
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Exception in PUT /api/rooms/[id]:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
    case 'DELETE':
      try {
        // Check if user is admin
        const { userId } = req.body;
        
        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }
        
        const isAdmin = await isRoomAdmin(roomId, userId);
        if (!isAdmin) {
          return res.status(403).json({ error: 'You do not have permission to delete this room' });
        }
        
        // Delete room participants first
        const { error: participantsError } = await supabase
          .from('room_participants')
          .delete()
          .eq('room_id', roomId);
        
        if (participantsError) {
          console.error('Error deleting room participants:', participantsError);
          return res.status(500).json({ error: 'Failed to delete room participants' });
        }
        
        // Delete room messages
        const { error: messagesError } = await supabase
          .from('messages')
          .delete()
          .eq('room_id', roomId);
        
        if (messagesError) {
          console.error('Error deleting room messages:', messagesError);
          return res.status(500).json({ error: 'Failed to delete room messages' });
        }
        
        // Delete room
        const { error } = await supabase
          .from('rooms')
          .delete()
          .eq('id', roomId);
        
        if (error) {
          console.error('Error deleting room:', error);
          return res.status(500).json({ error: 'Failed to delete room' });
        }
        
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Exception in DELETE /api/rooms/[id]:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
} 