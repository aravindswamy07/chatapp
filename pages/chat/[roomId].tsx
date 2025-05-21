import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getCurrentUser, logout, User } from '../../lib/auth';
import { getMessages, sendMessage, subscribeToRoomMessages, Message } from '../../lib/messages';
import { getActiveUsers, removeActiveUser } from '../../lib/supabase';
import { uploadImage, validateFile } from '../../lib/storage';
import { isRoomAdmin } from '../../lib/admin';
import { setTypingStatus, subscribeToTypingStatus, clearTypingStatus } from '../../lib/typing';
import RoomSettings from '../../components/RoomSettings';
import TypingIndicator from '../../components/TypingIndicator';

export default function ChatRoom() {  const [messages, setMessages] = useState<Message[]>([]);  const [newMessage, setNewMessage] = useState('');  const [activeUsers, setActiveUsers] = useState<{id: string, username: string}[]>([]);  const [isLoading, setIsLoading] = useState(true);  const [user, setUser] = useState<User | null>(null);  const [roomName, setRoomName] = useState('');  const [roomDescription, setRoomDescription] = useState('');  const [isAdmin, setIsAdmin] = useState(false);  const [showRoomSettings, setShowRoomSettings] = useState(false);  const [typingUsers, setTypingUsers] = useState<string[]>([]);  const [isTyping, setIsTyping] = useState(false);  const messagesEndRef = useRef<HTMLDivElement>(null);  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);  const router = useRouter();  const { roomId } = router.query;  const [isMobile, setIsMobile] = useState(false);  const [showUserList, setShowUserList] = useState(false);  const [selectedFile, setSelectedFile] = useState<File | null>(null);  const [uploadError, setUploadError] = useState('');  const [isUploading, setIsUploading] = useState(false);  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!roomId) return;  // Wait until roomId is available
    
    const user = getCurrentUser();
    if (!user) {
      router.push('/login');
      return;
    }
    
    setUser(user);
    
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        
        // Check if user is room admin
        const adminStatus = await isRoomAdmin(roomId as string, user.id);
        setIsAdmin(adminStatus);
        
        // Get room details
        const roomResponse = await fetch(`/api/rooms/${roomId}`);
        const roomData = await roomResponse.json();
        if (roomData.data) {
          setRoomName(roomData.data.name || `Room ${roomId}`);
          setRoomDescription(roomData.data.description || '');
        }
        
        // Get messages and users
        const [fetchedMessages, fetchedUsers] = await Promise.all([
          getMessages(roomId as string),
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
    
    // Subscribe to new messages for this room
    const subscription = subscribeToRoomMessages(roomId as string, (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });
    
    // Subscribe to typing status changes
    const typingSubscription = subscribeToTypingStatus(
      roomId as string,
      user.id,
      (users) => {
        setTypingUsers(users);
      }
    );
    
    // Poll for active users every 10 seconds
    const intervalId = setInterval(async () => {
      const users = await getActiveUsers();
      setActiveUsers(users);
    }, 10000);
    
    // Clean up on unmount
    return () => {
      subscription.unsubscribe();
      typingSubscription.unsubscribe();
      clearInterval(intervalId);
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      
      // Clear user typing status when leaving the room
      clearTypingStatus(roomId as string, user.id);
    };
  }, [router, roomId]);

  // Handle logout
  const handleLogout = async () => {
    if (user) {
      await removeActiveUser(user.id);
      logout();
      router.push('/login');
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

  // Handle typing status updates
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Only update typing status if we have a user and roomId
    if (!user || !roomId) return;
    
    // If user wasn't typing before, set status to typing
    if (!isTyping) {
      setIsTyping(true);
      setTypingStatus(roomId as string, user, true);
    }
    
    // Clear any existing timer
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    
    // Set a timer to clear typing status after 3 seconds of inactivity
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      setTypingStatus(roomId as string, user, false);
    }, 3000);
  };

  // Handle sending a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((!newMessage.trim() && !selectedFile) || !user || !roomId) {
      return;
    }
    
    try {
      setIsUploading(selectedFile !== null);
      let imageUrl = null;
      
      // If there's a file selected, upload it first
      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile, roomId as string);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      
      // Send the message
      const messageToSend = {
        userId: user.id,
        username: user.username,
        content: newMessage,
        roomId: roomId as string,
        imageUrl: imageUrl || undefined
      };
      
      const response = await sendMessage(messageToSend);
      
      // If the message was sent successfully, clear the input
      if (response) {
        setNewMessage('');
        setIsUploading(false);
        
        // Reset typing status when message is sent
        if (isTyping) {
          setIsTyping(false);
          setTypingStatus(roomId as string, user, false);
          
          // Clear any existing timer
          if (typingTimerRef.current) {
            clearTimeout(typingTimerRef.current);
            typingTimerRef.current = null;
          }
        }
      } else {
        console.error('Failed to send message, empty response');
        setUploadError('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsUploading(false);
      setUploadError('Error sending message');
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
  
  // Return to home
  const handleReturnToHome = () => {
    router.push('/home');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading chat...</div>
      </div>
    );
  }

  if (showRoomSettings && user) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <Head>
          <title>Room Settings | {roomName}</title>
        </Head>
        <div className="flex-1 flex items-center justify-center p-4">
          <RoomSettings 
            roomId={roomId as string} 
            userId={user.id} 
            onClose={() => setShowRoomSettings(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Head>
        <title>{roomName} | NebulaChat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      
      {/* Header */}
      <header className="bg-gray-800 shadow-md py-3 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleReturnToHome}
              className="text-indigo-400 hover:text-indigo-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-indigo-400">{roomName || `Room ${roomId}`}</h1>
              {roomDescription && (
                <p className="text-xs text-gray-400">{roomDescription}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {isMobile && (
              <button
                onClick={() => setShowUserList(!showUserList)}
                className="text-indigo-400 hover:text-indigo-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            
            {isAdmin && (
              <button 
                onClick={() => setShowRoomSettings(true)}
                className="text-indigo-400 hover:text-indigo-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            
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
            
            {/* Typing Indicator */}
            <div className="sticky bottom-0 left-0">
              <TypingIndicator typingUsers={typingUsers} />
            </div>
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
                onChange={handleMessageInputChange}
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