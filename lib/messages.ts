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
  console.log('Attempting to send message:', message);
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
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        userId: message.userId,
        username: message.username,
        content: message.content,
        created_at: new Date().toISOString(),
      }])
      .select();
    
    if (error) {
      console.error('Error sending message to Supabase:', error);
      return null;
    }
    
    console.log('Message sent successfully, response:', data);
    return data?.[0] || null;
  } catch (err) {
    console.error('Exception when sending message:', err);
    return null;
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
    return (data || []).map(msg => ({
      id: msg.id,
      userId: msg.userId || msg.userid || msg.user_id,
      username: msg.username || msg.user_name,
      content: msg.content,
      createdAt: msg.created_at || msg.createdAt,
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
            userId: newMessage.userId || newMessage.userid || newMessage.user_id,
            username: newMessage.username || newMessage.user_name,
            content: newMessage.content,
            createdAt: newMessage.created_at || newMessage.createdAt,
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