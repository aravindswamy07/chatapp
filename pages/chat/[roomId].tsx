import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getCurrentUser, logout, getCurrentRoom, User } from '../../lib/auth';
import { getMessages, sendMessage, subscribeToRoomMessages, Message } from '../../lib/messages';
import { getRoomParticipants } from '../../lib/supabase';

export default function ChatRoom() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState<{id: string, username: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
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
      router.push('/login');
      return;
    }
    
    setUser(user);
    
    // Get room ID from URL parameter
    const { roomId: urlRoomId } = router.query;
    if (typeof urlRoomId !== 'string') {
      if (router.isReady) {
        router.push('/home');
      }
      return;
    }
    
    setRoomId(urlRoomId);
    
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch messages for this room
        const fetchedMessages = await getMessages(urlRoomId);
        
        setMessages(fetchedMessages);
        
        // Fetch participants for this room
        const fetchedParticipants = await getRoomParticipants(urlRoomId);
        setParticipants(fetchedParticipants);
        
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (urlRoomId) {
      fetchInitialData();
      
      // Subscribe to new messages in this room
      const subscription = subscribeToRoomMessages(urlRoomId, (newMessage) => {
        setMessages((prev) => [...prev, newMessage]);
      });
      
      // Poll for participants periodically to keep the list updated
      const participantsInterval = setInterval(async () => {
        if (urlRoomId) {
          const updatedParticipants = await getRoomParticipants(urlRoomId);
          setParticipants(updatedParticipants);
        }
      }, 15000); // Update every 15 seconds
      
      // Clean up subscription and interval on unmount
      return () => {
        subscription.unsubscribe();
        clearInterval(participantsInterval);
      };
    }
  }, [router, router.isReady, router.query]);

  // Handle logout and return to home
  const handleLeaveRoom = () => {
    router.push('/home');
  };

  // Handle sending a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user || !roomId) {
      return;
    }
    
    try {
      // Send message to backend
      const messageToSend = {
        userId: user.id,
        username: user.username,
        content: newMessage,
        roomId: roomId,
        replyTo: replyTo?.id
      };
      
      await sendMessage(messageToSend, replyTo?.id);
      
      // Clear input and reply state
      setNewMessage('');
      setReplyTo(null);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message. Please try again.');
    }
  };

  // Handle starting a reply to a message
  const handleReply = (message: Message) => {
    setReplyTo(message);
    // Focus on input field
    document.getElementById('message-input')?.focus();
  };

  // Cancel reply
  const cancelReply = () => {
    setReplyTo(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading chat room...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Head>
        <title>Room {roomId} | NebulaChat</title>
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
            <h1 className="text-xl font-bold text-indigo-400">
              <span className="hidden sm:inline">NebulaChat</span>
              <span className="sm:ml-2">Room #{roomId}</span>
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-gray-300 hidden sm:inline">
              <span className="font-medium text-green-400">{user?.username}</span>
            </span>
            
            <button
              onClick={handleLeaveRoom}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm"
            >
              Leave Room
            </button>
          </div>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Participants list */}
        <aside 
          className={`${isMobile 
            ? `fixed top-[60px] bottom-0 z-10 ${showUserList ? 'left-0' : '-left-64'} transition-all duration-300`
            : 'relative'
          } w-64 bg-gray-800 border-r border-gray-700 flex flex-col`}
        >
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-gray-300 font-medium">Participants ({participants.length}/10)</h2>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {participants.length > 0 ? (
              participants.map((participant) => (
                <div key={participant.id} className="px-4 py-2 hover:bg-gray-700 flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <div className="text-gray-200">{participant.username}</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-gray-400">Loading participants...</div>
            )}
          </div>
        </aside>
        
        {/* Main chat area */}
        <main className="flex-1 flex flex-col bg-gray-700">
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length > 0 ? (
              messages.map((message) => (
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
                    <div className="text-xs mb-1">
                      <span className="font-semibold">{message.username}</span>
                      <span className="text-opacity-70 ml-2">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    {/* Display replied-to message if exists */}
                    {message.replyToMessage && (
                      <div className="border-l-2 border-gray-500 pl-2 mb-2 text-xs italic opacity-75 max-w-[250px] overflow-hidden">
                        <div>{message.replyToMessage.username}: {message.replyToMessage.content}</div>
                      </div>
                    )}
                    
                    <div>{message.content}</div>
                    
                    <div className="mt-1 flex justify-end">
                      <button 
                        onClick={() => handleReply(message)}
                        className="text-xs opacity-70 hover:opacity-100"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400">No messages yet. Be the first to send one!</div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Reply indicator */}
          {replyTo && (
            <div className="bg-gray-800 border-t border-gray-700 p-2 flex justify-between items-center">
              <div className="flex-1 text-sm text-gray-300 flex items-center">
                <span className="text-indigo-400 mr-1">Reply to:</span>
                <span className="font-medium mr-1">{replyTo.username}:</span>
                <span className="text-gray-400 truncate">{replyTo.content}</span>
              </div>
              <button 
                onClick={cancelReply}
                className="text-gray-400 hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          )}
          
          {/* Message input */}
          <div className="bg-gray-800 border-t border-gray-700 p-4">
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <input
                id="message-input"
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-md bg-gray-700 border border-gray-600 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-md"
              >
                Send
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
} 