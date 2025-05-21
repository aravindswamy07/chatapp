import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export type Message = {
  id: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
};

// Mock messages for development without Supabase
const mockMessages: Message[] = [
  { 
    id: '1', 
    userId: '1', 
    username: 'user1', 
    content: 'Welcome to the chat!', 
    createdAt: new Date().toISOString() 
  }
];

export async function sendMessage(message: Omit<Message, 'id' | 'createdAt'>) {
  console.log('sendMessage function called with:', message);
  console.log('Using Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('Using mock data for sending message');
    const newMessage = {
      id: uuidv4(),
      userId: message.userId,
      username: message.username,
      content: message.content,
      createdAt: new Date().toISOString()
    };
    mockMessages.push(newMessage);
    // Call all subscribers
    mockSubscribers.forEach(callback => callback(newMessage));
    return newMessage;
  }

  try {
    console.log('Sending message to Supabase...');
    
    // For debugging, try a direct insert with minimal fields
    const messageData = {
      user_id: message.userId,
      username: message.username,
      content: message.content,
      created_at: new Date().toISOString(),
    };
    
    console.log('Message data to insert:', messageData);
    
    // Try with explicit id
    const newId = uuidv4();
    console.log('Generated UUID:', newId);
    
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        id: newId,
        ...messageData
      }])
      .select();
    
    if (error) {
      console.error('Error sending message to Supabase:', error);
      
      // Fallback to mock mode for testing
      console.log('Falling back to mock mode due to error');
      const mockMessage = {
        id: newId,
        userId: message.userId,
        username: message.username,
        content: message.content,
        createdAt: new Date().toISOString()
      };
      mockMessages.push(mockMessage);
      mockSubscribers.forEach(callback => callback(mockMessage));
      return mockMessage;
    }
    
    console.log('Message sent successfully, response:', data);
    
    // If no data returned but no error either, create a response object
    if (!data || data.length === 0) {
      console.log('No data returned but no error either, creating response object');
      return {
        id: newId,
        userId: message.userId,
        username: message.username,
        content: message.content,
        createdAt: new Date().toISOString()
      };
    }
    
    return data?.[0] || null;
  } catch (err) {
    console.error('Exception when sending message:', err);
    
    // Fallback to mock mode for testing
    console.log('Falling back to mock mode due to exception');
    const mockMessage = {
      id: uuidv4(),
      userId: message.userId,
      username: message.username,
      content: message.content,
      createdAt: new Date().toISOString()
    };
    mockMessages.push(mockMessage);
    mockSubscribers.forEach(callback => callback(mockMessage));
    return mockMessage;
  }
}

export async function getMessages() {
  console.log('Attempting to get messages');
  console.log('Using Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('Using mock data for messages');
    return mockMessages;
  }

  try {
    console.log('Fetching messages from Supabase...');
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching messages from Supabase:', error);
      return [];
    }
    
    console.log('Messages fetched successfully, count:', data?.length);
    console.log('First message (if available):', data?.[0]);
    
    // Map the snake_case column names from Supabase to camelCase for our frontend
    return (data || []).map(msg => ({
      id: msg.id,
      userId: msg.user_id,  // Changed from userId to user_id
      username: msg.username,
      content: msg.content,
      createdAt: msg.created_at,
    }));
  } catch (err) {
    console.error('Exception when fetching messages:', err);
    return [];
  }
}

// For mock subscription
const mockSubscribers: ((message: Message) => void)[] = [];

export function subscribeToMessages(callback: (message: Message) => void) {
  console.log('Setting up message subscription');
  console.log('Using Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('Using mock subscription for messages');
    mockSubscribers.push(callback);
    return {
      unsubscribe: () => {
        const index = mockSubscribers.indexOf(callback);
        if (index !== -1) {
          mockSubscribers.splice(index, 1);
        }
      }
    };
  }

  try {
    console.log('Setting up Supabase realtime subscription...');
    return supabase
      .channel('public:messages')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' }, 
        (payload) => {
          console.log('Received new message from Supabase realtime:', payload);
          const newMessage = payload.new as any;
          callback({
            id: newMessage.id,
            userId: newMessage.user_id,  // Changed from userId to user_id
            username: newMessage.username,
            content: newMessage.content,
            createdAt: newMessage.created_at,
          });
        }
      )
      .subscribe((status) => {
        console.log('Supabase subscription status:', status);
      });
  } catch (err) {
    console.error('Exception when setting up subscription:', err);
    mockSubscribers.push(callback);
    return {
      unsubscribe: () => {
        const index = mockSubscribers.indexOf(callback);
        if (index !== -1) {
          mockSubscribers.splice(index, 1);
        }
      }
    };
  }
} 