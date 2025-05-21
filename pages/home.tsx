import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getCurrentUser, logout, createRoom, joinRoom, isLoggedIn, User } from '../lib/auth';
import { getUserRooms, getJoinedRooms } from '../lib/supabase';

type Room = {
  id: string;
  password?: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const router = useRouter();
  
  // Check if user is logged in
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push('/login');
      return;
    }
    
    setUser(user);
    
    // Fetch user's rooms
    const fetchUserRooms = async () => {
      setIsLoading(true);
      
      try {
        if (user) {
          // Get rooms created by this user (with passwords)
          const createdRooms = await getUserRooms(user.id);
          
          // Get rooms this user has joined
          const joinedRoomIds = await getJoinedRooms(user.id);
          
          // Filter out rooms that were created by the user (to avoid duplicates)
          const filteredJoinedRooms = joinedRoomIds.filter(
            (joinedRoom: { id: string }) => !createdRooms.some((createdRoom: { id: string }) => createdRoom.id === joinedRoom.id)
          );
          
          // Combine the rooms (created rooms have passwords, joined rooms don't)
          const allRooms = [
            ...createdRooms,
            ...filteredJoinedRooms.map((room: { id: string }) => ({ id: room.id }))
          ];
          
          setRooms(allRooms);
        }
      } catch (err) {
        console.error('Error fetching rooms:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserRooms();
  }, [router]);

  // Handle logout
  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Handle room creation
  const handleCreateRoom = async () => {
    if (!user) return;
    
    setIsCreating(true);
    setError('');
    
    try {
      const result = await createRoom(user.id);
      
      if (result) {
        // Add new room to state
        setRooms([...rooms, { id: result.roomId, password: result.password }]);
        
        // Navigate to the chat room
        router.push(`/chat/${result.roomId}`);
      } else {
        setError('Failed to create room. Please try again.');
      }
    } catch (err) {
      console.error('Error creating room:', err);
      setError('An error occurred while creating the room.');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle room join
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    setIsJoining(true);
    setError('');
    
    // Validate input
    if (!joinRoomId.trim() || !joinPassword.trim()) {
      setError('Room ID and password are required.');
      setIsJoining(false);
      return;
    }
    
    try {
      const joined = await joinRoom(joinRoomId, joinPassword, user.id);
      
      if (joined) {
        // Navigate to the chat room
        router.push(`/chat/${joinRoomId}`);
      } else {
        setError('Failed to join room. Invalid room ID or password.');
      }
    } catch (err) {
      console.error('Error joining room:', err);
      setError('An error occurred while joining the room.');
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Head>
        <title>Home | NebulaChat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      
      {/* Header */}
      <header className="bg-gray-800 shadow-md py-3 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-indigo-400">NebulaChat</h1>
          
          <div className="flex items-center space-x-4">
            <span className="text-gray-300">
              <span className="font-medium text-green-400">{user?.username}</span>
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
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-indigo-400 mb-2">Welcome, {user?.username}!</h2>
          <p className="text-gray-300">Create a new chat room or join an existing one.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Room Card */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Create New Room</h3>
            <p className="text-gray-400 mb-6">
              Create a new private chat room. You'll get a room ID and password to share with others.
            </p>
            
            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isCreating ? 'Creating Room...' : 'Create Room'}
            </button>
          </div>
          
          {/* Join Room Card */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Join Room</h3>
            
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label htmlFor="roomId" className="block text-sm font-medium text-gray-300">
                  Room ID
                </label>
                <input
                  id="roomId"
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="5-digit room ID"
                  className="mt-1 block w-full rounded-md bg-gray-700 border border-gray-600 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label htmlFor="roomPassword" className="block text-sm font-medium text-gray-300">
                  Room Password
                </label>
                <input
                  id="roomPassword"
                  type="password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  placeholder="7-character password"
                  className="mt-1 block w-full rounded-md bg-gray-700 border border-gray-600 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              
              <button
                type="submit"
                disabled={isJoining}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isJoining ? 'Joining Room...' : 'Join Room'}
              </button>
            </form>
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mt-6 bg-red-500 bg-opacity-20 border border-red-400 text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {/* Rooms List (for future implementation) */}
        {rooms.length > 0 && (
          <div className="mt-8 bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Your Rooms</h3>
            <div className="space-y-2">
              {rooms.map((room) => (
                <div key={room.id} className="bg-gray-700 p-4 rounded-md flex justify-between items-center">
                  <div>
                    <h4 className="text-white font-medium">Room ID: {room.id}</h4>
                    {room.password && (
                      <p className="text-gray-400 text-sm">Password: {room.password}</p>
                    )}
                  </div>
                  <button 
                    onClick={() => router.push(`/chat/${room.id}`)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm"
                  >
                    Enter
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 