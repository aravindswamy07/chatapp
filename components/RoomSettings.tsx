import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  isRoomAdmin,
  updateRoomSettings,
  deleteRoom,
  removeUserFromRoom,
  getRoomParticipants
} from '../lib/admin';

type RoomSettingsProps = {
  roomId: string;
  userId: string;
  onClose: () => void;
};

type Participant = {
  id: string;
  username: string;
  isAdmin: boolean;
};

export default function RoomSettings({ roomId, userId, onClose }: RoomSettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    const checkAdminAndLoadData = async () => {
      setIsLoading(true);
      try {
        // Check if user is admin
        const adminStatus = await isRoomAdmin(roomId, userId);
        setIsAdmin(adminStatus);
        
        // Get room participants
        const roomParticipants = await getRoomParticipants(roomId);
        setParticipants(roomParticipants);
        
        // Get room details
        const { data: roomData } = await fetch(`/api/rooms/${roomId}`).then(res => res.json());
        if (roomData) {
          setRoomName(roomData.name || '');
          setRoomDescription(roomData.description || '');
        }
      } catch (err) {
        console.error('Error loading room settings data:', err);
        setError('Failed to load room settings');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAdminAndLoadData();
  }, [roomId, userId]);
  
  const handleSaveSettings = async () => {
    setError('');
    setSuccessMessage('');
    
    try {
      const updated = await updateRoomSettings(roomId, userId, {
        name: roomName,
        description: roomDescription
      });
      
      if (updated) {
        setSuccessMessage('Room settings updated successfully');
      } else {
        setError('Failed to update room settings');
      }
    } catch (err) {
      console.error('Error updating room settings:', err);
      setError('An error occurred while updating room settings');
    }
  };
  
  const handleRemoveUser = async (userIdToRemove: string) => {
    setError('');
    setSuccessMessage('');
    
    try {
      const removed = await removeUserFromRoom(roomId, userId, userIdToRemove);
      
      if (removed) {
        // Update participants list
        setParticipants(participants.filter(p => p.id !== userIdToRemove));
        setSuccessMessage('User removed from the room');
      } else {
        setError('Failed to remove user from room');
      }
    } catch (err) {
      console.error('Error removing user from room:', err);
      setError('An error occurred while removing user');
    }
  };
  
  const handleDeleteRoom = async () => {
    if (!window.confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    setError('');
    
    try {
      const deleted = await deleteRoom(roomId, userId);
      
      if (deleted) {
        router.push('/home');
      } else {
        setError('Failed to delete room');
        setIsDeleting(false);
      }
    } catch (err) {
      console.error('Error deleting room:', err);
      setError('An error occurred while deleting room');
      setIsDeleting(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg mx-auto">
        <div className="text-center text-gray-300">Loading room settings...</div>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg mx-auto">
        <h2 className="text-xl font-semibold text-indigo-400 mb-4">Room Settings</h2>
        <div className="text-red-500 mb-4">You do not have permission to manage this room.</div>
        <button 
          onClick={onClose}
          className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Close
        </button>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800 rounded-lg p-6 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-indigo-400">Room Settings</h2>
        <button 
          onClick={onClose} 
          className="text-gray-400 hover:text-gray-200"
        >
          ✕
        </button>
      </div>
      
      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-900/30 border border-green-800 text-green-400 px-4 py-2 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      <div className="mb-6">
        <h3 className="text-md font-medium text-white mb-2">Room Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Room Name</label>
            <input 
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter a name for this room"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
          
          <div>
            <label className="block text-gray-400 text-sm mb-1">Room Description</label>
            <textarea 
              value={roomDescription}
              onChange={(e) => setRoomDescription(e.target.value)}
              placeholder="Enter a description (optional)"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-24 resize-none"
            />
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
      
      <div className="mb-6 border-t border-gray-700 pt-4">
        <h3 className="text-md font-medium text-white mb-2">Room Participants ({participants.length})</h3>
        <div className="max-h-40 overflow-y-auto">
          {participants.length === 0 ? (
            <div className="text-gray-500 text-sm">No participants found</div>
          ) : (
            <ul className="space-y-2">
              {participants.map(participant => (
                <li 
                  key={participant.id} 
                  className="flex items-center justify-between bg-gray-700 rounded px-3 py-2"
                >
                  <div className="flex items-center">
                    <span className="text-gray-200">{participant.username}</span>
                    {participant.isAdmin && (
                      <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                  
                  {!participant.isAdmin && participant.id !== userId && (
                    <button
                      onClick={() => handleRemoveUser(participant.id)}
                      className="text-sm text-red-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      <div className="border-t border-gray-700 pt-4">
        <h3 className="text-md font-medium text-red-500 mb-2">Danger Zone</h3>
        <p className="text-gray-400 text-sm mb-4">
          Deleting a room will permanently remove all messages and remove all participants.
          This action cannot be undone.
        </p>
        <button
          onClick={handleDeleteRoom}
          disabled={isDeleting}
          className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete Room'}
        </button>
      </div>
    </div>
  );
} 