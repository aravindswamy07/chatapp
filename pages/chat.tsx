import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getCurrentUser, logout, User } from '../lib/auth';
import { getMessages, sendMessage, subscribeToRoomMessages, Message } from '../lib/messages';
import { getActiveUsers, removeActiveUser } from '../lib/supabase';
import { uploadImage, validateFile } from '../lib/storage';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          getMessages('default'),
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
    
    // Subscribe to new messages using the 'default' room
    const subscription = subscribeToRoomMessages('default', (newMessage) => {
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

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validation = validateFile(file);
      
      if (!validation.valid) {
        setUploadError(validation.message || 'Invalid file');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  // Handle sending a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Send button clicked', { newMessage, selectedFile, user });
    
    if ((!newMessage.trim() && !selectedFile) || !user) {
      console.log('Missing message/file or user', { message: newMessage, file: selectedFile, user });
      return;
    }
    
    try {
      setIsUploading(selectedFile !== null);
      let imageUrl = null;
      
      // If there's a file selected, upload it first
      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile, 'default');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      
      console.log('Attempting to send message to backend');
      
      // For debugging - force a message directly
      const messageToSend = {
        userId: user.id,
        username: user.username,
        content: newMessage,
        roomId: 'default',
        imageUrl: imageUrl || undefined
      };
      
      console.log('Message payload:', messageToSend);
      
      const response = await sendMessage(messageToSend);
      console.log('Send message response:', response);
      
      // If the message was sent successfully, clear the input
      if (response) {
        setNewMessage('');
        setIsUploading(false);
      } else {
        console.error('Failed to send message, empty response');
        alert('Failed to send message. Check console for details.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsUploading(false);
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

  // Message display with image support
  const renderMessage = (message: Message) => {
    const isOwnMessage = message.userId === user?.id;
    
    return (
      <div
        key={message.id}
        className={`mb-4 flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`max-w-[75%] px-4 py-2 rounded-lg ${
          isOwnMessage ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-100'
        }`}>
          {!isOwnMessage && (
            <div className="text-xs font-medium text-gray-300 mb-1">
              {message.username}
            </div>
          )}
          
          {message.replyToMessage && (
            <div className="border-l-2 border-gray-500 pl-2 mb-2 text-sm text-gray-400">
              {message.replyToMessage.username}: {message.replyToMessage.content}
            </div>
          )}

          {message.imageUrl && (
            <div className="mb-2">
              <img 
                src={message.imageUrl} 
                alt="Shared image" 
                className="rounded-md max-h-60 max-w-full cursor-pointer"
                onClick={() => window.open(message.imageUrl, '_blank')}
              />
            </div>
          )}
          
          {message.content && (
            <p className="break-words">{message.content}</p>
          )}
          
          <div className="text-xs opacity-70 mt-1 text-right">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  };

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
      
      {/* Chat Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* User List - Hidden on mobile unless toggled */}
        <div 
          className={`bg-gray-800 w-64 flex-shrink-0 flex flex-col border-r border-gray-700
            ${isMobile ? (showUserList ? 'block absolute inset-y-0 left-0 z-10 mt-16' : 'hidden') : 'block'}`}
        >
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-gray-300 font-medium">Online Users <span className="text-green-400 text-xs">({activeUsers.length})</span></h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ul className="p-2">
              {activeUsers.map((activeUser) => (
                <li key={activeUser.id} className="px-2 py-1 rounded hover:bg-gray-700 text-gray-300 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  {activeUser.username}
                </li>
              ))}
              {activeUsers.length === 0 && (
                <li className="px-2 py-1 text-gray-500 text-sm italic">No users online</li>
              )}
            </ul>
          </div>
        </div>
        
        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.map(message => renderMessage(message))}
            <div ref={messagesEndRef} />
            
            {messages.length === 0 && (
              <div className="text-center text-gray-500 my-6">
                No messages yet. Start the conversation!
              </div>
            )}
          </div>
          
          {/* Message Input */}
          <div className="bg-gray-800 border-t border-gray-700 p-4">
            {uploadError && (
              <div className="mb-2 text-red-500 text-sm">{uploadError}</div>
            )}
            
            {selectedFile && (
              <div className="mb-2 text-gray-300 text-sm flex items-center">
                <span className="text-green-400 mr-1">✓</span> 
                {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                <button 
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="ml-2 text-red-400 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            )}
            
            <form onSubmit={handleSendMessage} className="flex items-center">
              <label className="cursor-pointer text-indigo-400 p-2 hover:bg-gray-700 rounded mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                />
              </label>
              
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-gray-700 text-white p-2 rounded-l focus:outline-none focus:ring-1 focus:ring-indigo-500"
                disabled={isUploading}
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-r focus:outline-none disabled:opacity-50"
                disabled={(!newMessage.trim() && !selectedFile) || isUploading}
              >
                {isUploading ? 'Uploading...' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 