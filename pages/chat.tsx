import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getCurrentUser, logout, User } from '../lib/auth';
import { getMessages, sendMessage, subscribeToMessages, Message } from '../lib/messages';
import { getActiveUsers, removeActiveUser } from '../lib/supabase';

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeUsers, setActiveUsers] = useState<{id: string, username: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [showUserList, setShowUserList] = useState(false);

  // Handle scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detect mobile device
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Initial setup - load messages and subscribe to new ones
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push('/');
      return;
    }
    
    setUser(user);
    
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        const [fetchedMessages, fetchedUsers] = await Promise.all([
          getMessages(),
          getActiveUsers()
        ]);
        
        setMessages(fetchedMessages);
        setActiveUsers(fetchedUsers);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInitialData();
    
    // Subscribe to new messages
    const subscription = subscribeToMessages((newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });
    
    // Poll for active users every 10 seconds
    const intervalId = setInterval(async () => {
      const users = await getActiveUsers();
      setActiveUsers(users);
    }, 10000);
    
    // Clean up on unmount
    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, [router]);

  // Handle logout
  const handleLogout = async () => {
    if (user) {
      await removeActiveUser(user.id);
      logout();
      router.push('/');
    }
  };

  // Handle sending a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Send button clicked', { newMessage, user });
    
    if (!newMessage.trim() || !user) {
      console.log('Missing message or user', { message: newMessage, user });
      return;
    }
    
    try {
      console.log('Attempting to send message to backend');
      
      // For debugging - force a message directly
      const messageToSend = {
        userId: user.id,
        username: user.username,
        content: newMessage
      };
      
      console.log('Message payload:', messageToSend);
      
      const response = await sendMessage(messageToSend);
      console.log('Send message response:', response);
      
      // If the message was sent successfully, clear the input
      if (response) {
        setNewMessage('');
      } else {
        console.error('Failed to send message, empty response');
        alert('Failed to send message. Check console for details.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message. Check console for details.');
    }
  };

  // Handle unmount/navigation with cleanup
  useEffect(() => {
    const handleRouteChange = async () => {
      if (user) {
        await removeActiveUser(user.id);
      }
    };
    
    router.events.on('routeChangeStart', handleRouteChange);
    
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router, user]);

  // Handle window unload to remove user
  useEffect(() => {
    const handleUnload = async () => {
      if (user) {
        await removeActiveUser(user.id);
      }
    };
    
    window.addEventListener('beforeunload', handleUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Head>
        <title>NebulaChat | Secure Messaging</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      
      {/* Header */}
      <header className="bg-gray-800 shadow-md py-3 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center">
            {isMobile && (
              <button
                onClick={() => setShowUserList(!showUserList)}
                className="mr-3 text-indigo-400"
              >
                {showUserList ? '✕' : '☰'}
              </button>
            )}
            <h1 className="text-xl font-bold text-indigo-400">NebulaChat</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-gray-300">
              <span className="font-medium text-green-400">{user?.username}</span>
              <span className="text-xs text-gray-500 ml-2 hidden sm:inline">#{user?.id.slice(0, 8)}</span>
            </span>
            
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Users list */}
        <aside 
          className={`${isMobile 
            ? `fixed top-[60px] bottom-0 z-10 ${showUserList ? 'left-0' : '-left-64'} transition-all duration-300`
            : 'relative'
          } w-64 bg-gray-800 border-r border-gray-700 flex flex-col`}
        >
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-gray-300 font-medium">Active Users ({activeUsers.length}/10)</h2>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {activeUsers.map((activeUser) => (
              <div key={activeUser.id} className="px-4 py-2 hover:bg-gray-700 flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <div>
                  <span className="text-gray-200">{activeUser.username}</span>
                  <span className="text-xs text-gray-500 ml-2">#{activeUser.id.slice(0, 8)}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
        
        {/* Main chat area */}
        <main className="flex-1 flex flex-col bg-gray-700">
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id}
                className={`flex ${message.userId === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-xs sm:max-w-sm md:max-w-md rounded-lg px-4 py-2 ${
                    message.userId === user?.id 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-800 text-gray-200'
                  }`}
                >
                  <div className={`text-xs mb-1 ${
                    message.userId === user?.id 
                      ? 'text-indigo-300' 
                      : 'text-gray-400'
                  }`}>
                    {message.username}
                    <span className="text-xs text-gray-500 ml-2">
                      #{message.userId.slice(0, 8)}
                    </span>
                  </div>
                  <div className="break-words">{message.content}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Message input */}
          <div className="border-t border-gray-600 p-4 bg-gray-800">
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
                onClick={() => console.log('Send button clicked (inline)')}
              >
                Send
              </button>
            </form>
          </div>
        </main>
      </div>
      
      {/* Overlay for mobile when sidebar is shown */}
      {isMobile && showUserList && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-0"
          onClick={() => setShowUserList(false)}
        />
      )}
    </div>
  );
} 