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
    console.error('Error sending message:', error);
    return null;
  }
  
  return data?.[0] || null;
}

export async function getMessages() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('Using mock data for messages');
    return mockMessages;
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
  
  return (data || []).map(msg => ({
    id: msg.id,
    userId: msg.userId,
    username: msg.username,
    content: msg.content,
    createdAt: msg.created_at,
  }));
}

// For mock subscription
const mockSubscribers: ((message: Message) => void)[] = [];

export function subscribeToMessages(callback: (message: Message) => void) {
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

  return supabase
    .channel('public:messages')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'messages' }, 
      (payload) => {
        const newMessage = payload.new as any;
        callback({
          id: newMessage.id,
          userId: newMessage.userId,
          username: newMessage.username,
          content: newMessage.content,
          createdAt: newMessage.created_at,
        });
      }
    )
    .subscribe();
} 