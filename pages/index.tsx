import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { login, generateUserId } from '../lib/auth';
import { checkUserLimit, addActiveUser } from '../lib/supabase';

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      setIsLoading(false);
      return;
    }

    try {
      // Check if the chat server is full
      const canJoin = await checkUserLimit();
      
      if (!canJoin) {
        setError('Chat server is full (max 10 users). Please try again later.');
        setIsLoading(false);
        return;
      }

      // Generate a unique user ID
      const userId = generateUserId();
      
      // Log the user in
      login(username, password, userId);
      
      // Add user to active users in Supabase
      await addActiveUser(userId, username);
      
      // Redirect to chat page
      router.push('/chat');
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center">
      <Head>
        <title>Discord-like Chat App</title>
        <meta name="description" content="A simple Discord-like chat application" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex flex-col items-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-800 rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-center text-indigo-500 mb-8">
              Discord-like Chat
            </h1>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Enter a username"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Enter a password"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm mt-2">{error}</div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? 'Connecting...' : 'Join Chat Server'}
              </button>
            </form>
            
            <p className="mt-6 text-sm text-gray-400 text-center">
              A unique ID will be generated for you automatically.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
} 