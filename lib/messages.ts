import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export type Message = {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  imageUrl?: string;  // Add support for image messages
  fileUrl?: string;   // Add support for file attachments
  fileType?: string;  // Add support for file type info
  replyTo?: string;
  replyToMessage?: Message;
  createdAt: string;
};

// Mock messages for development without Supabase
const mockMessages: Record<string, Message[]> = {
  'default': [
    { 
      id: '1', 
      roomId: 'default',
      userId: '1', 
      username: 'System', 
      content: 'Welcome to the chat room!', 
      createdAt: new Date().toISOString() 
    }
  ]
};

// For mock subscription
const mockSubscribers: Record<string, ((message: Message) => void)[]> = {
  'default': []
};

export async function sendMessage(
  message: Omit<Message, 'id' | 'createdAt'>,
  replyTo?: string
): Promise<Message | null> {
  console.log('sendMessage function called with:', { message, replyTo });
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('Using mock data for sending message');
    const roomId = message.roomId || 'default';
    
    // Initialize room's message array if it doesn't exist
    if (!mockMessages[roomId]) {
      mockMessages[roomId] = [];
    }
    if (!mockSubscribers[roomId]) {
      mockSubscribers[roomId] = [];
    }
    
    const newMessage: Message = {
      id: uuidv4(),
      roomId,
      userId: message.userId,
      username: message.username,
      content: message.content,
      imageUrl: message.imageUrl,
      fileUrl: message.fileUrl,
      fileType: message.fileType,
      replyTo,
      createdAt: new Date().toISOString()
    };
    
    mockMessages[roomId].push(newMessage);
    
    // Call all subscribers for this room
    mockSubscribers[roomId].forEach(callback => callback(newMessage));
    return newMessage;
  }

    try {
      const messageData = {
        room_id: message.roomId,
        user_id: message.userId,
        username: message.username,
        content: message.content,
        image_url: message.imageUrl,
        file_url: message.fileUrl,
        file_type: message.fileType,
        reply_to: replyTo,
        created_at: new Date().toISOString(),
      };
      
      console.log('Message data to insert:', messageData);
      
      // Generate a UUID for the message
      const newId = uuidv4();
      
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          id: newId,
          ...messageData
        }])
        .select();
      
      if (error) {
        console.error('Error sending message to Supabase:', error);
        return null;
      }
      
      console.log('Message sent successfully, response:', data);
      
      if (!data || data.length === 0) {
        console.log('No data returned but no error either, creating response object');
        return {
          id: newId,
          roomId: message.roomId,
          userId: message.userId,
          username: message.username,
          content: message.content,
          replyTo,
          createdAt: new Date().toISOString()
        };
      }
      
      // Map the snake_case column names from Supabase to camelCase
      const result = data && data[0];
      return result ? {
        id: result.id,
        roomId: result.room_id,
        userId: result.user_id,
        username: result.username,
        content: result.content,
        replyTo: result.reply_to,
        createdAt: result.created_at
      } : null;
    } catch (err) {
      console.error('Exception when sending message:', err);
      return null;
    }
}

export async function getMessages(roomId: string): Promise<Message[]> {
  console.log('Attempting to get messages for room:', roomId);
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('Using mock data for messages');
    return mockMessages[roomId] || [];
  }

  try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id, 
          room_id, 
          user_id, 
          username, 
          content, 
          image_url,
          file_url,
          file_type,
          reply_to, 
          created_at,
          messages:reply_to(id, room_id, user_id, username, content, created_at)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching messages from Supabase:', error);
      return [];
    }
    
    console.log('Messages fetched successfully, count:', data?.length);
    
    // Map the snake_case column names from Supabase to camelCase for our frontend
    return (data || []).map(msg => {
      const message: Message = {
        id: msg.id,
        roomId: msg.room_id,
        userId: msg.user_id,
        username: msg.username,
        content: msg.content,
        imageUrl: msg.image_url,
        fileUrl: msg.file_url,
        fileType: msg.file_type,
        replyTo: msg.reply_to,
        createdAt: msg.created_at,
      };
      
      // Add replied-to message if it exists
      if (msg.messages) {
        // Type handling for msg.messages which might be an array or object
        const replyData = Array.isArray(msg.messages) 
          ? msg.messages[0] // If it's an array, take the first item
          : msg.messages;   // If it's already an object, use it directly
        
        if (replyData) {
          message.replyToMessage = {
            id: replyData.id,
            roomId: replyData.room_id,
            userId: replyData.user_id,
            username: replyData.username,
            content: replyData.content,
            createdAt: replyData.created_at
          };
        }
      }
      
      return message;
    });
  } catch (err) {
    console.error('Exception when fetching messages:', err);
    return [];
  }
}

export function subscribeToRoomMessages(roomId: string, callback: (message: Message) => void) {
  console.log('Setting up message subscription for room:', roomId);
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('Using mock subscription for messages');
    
    // Initialize room's subscriber array if it doesn't exist
    if (!mockSubscribers[roomId]) {
      mockSubscribers[roomId] = [];
    }
    
    mockSubscribers[roomId].push(callback);
    return {
      unsubscribe: () => {
        if (mockSubscribers[roomId]) {
          const index = mockSubscribers[roomId].indexOf(callback);
          if (index !== -1) {
            mockSubscribers[roomId].splice(index, 1);
          }
        }
      }
    };
  }

  try {
    console.log('Setting up Supabase realtime subscription for room:', roomId);
    
    return supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        }, 
        async (payload) => {
          console.log('Received new message from Supabase realtime:', payload);
          const newMessage = payload.new as any;
          
          let replyToMessage: Message | undefined = undefined;
          
          // If this is a reply, fetch the original message
          if (newMessage.reply_to) {
            const { data } = await supabase
              .from('messages')
              .select('*')
              .eq('id', newMessage.reply_to)
              .single();
              
            if (data) {
              replyToMessage = {
                id: data.id,
                roomId: data.room_id,
                userId: data.user_id,
                username: data.username,
                content: data.content,
                createdAt: data.created_at
              };
            }
          }
          
          callback({
            id: newMessage.id,
            roomId: newMessage.room_id,
            userId: newMessage.user_id,
            username: newMessage.username,
            content: newMessage.content,
            replyTo: newMessage.reply_to,
            replyToMessage,
            createdAt: newMessage.created_at,
          });
        }
      )
      .subscribe((status) => {
        console.log('Supabase subscription status for room:', roomId, status);
      });
  } catch (err) {
    console.error('Exception when setting up subscription:', err);
    
    // Fallback to mock mode
    if (!mockSubscribers[roomId]) {
      mockSubscribers[roomId] = [];
    }
    mockSubscribers[roomId].push(callback);
    
    return {
      unsubscribe: () => {
        if (mockSubscribers[roomId]) {
          const index = mockSubscribers[roomId].indexOf(callback);
          if (index !== -1) {
            mockSubscribers[roomId].splice(index, 1);
          }
        }
      }
    };
  }
} 