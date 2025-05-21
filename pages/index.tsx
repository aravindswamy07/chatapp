import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { login, generateUserId } from '../lib/auth';
import { checkUserLimit, addActiveUser, checkUsernameExists } from '../lib/supabase';

// Password validation regex
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const router = useRouter();

  // Validate input fields on change
  useEffect(() => {
    const errors: {username?: string; password?: string} = {};
    
    // Username validation
    if (username && username.length < 7) {
      errors.username = 'Username must be at least 7 characters';
    } else if (username && !/\d/.test(username)) {
      errors.username = 'Username must contain at least one number';
    }
    
    // Password validation
    if (password && !PASSWORD_REGEX.test(password)) {
      errors.password = 'Password must be at least 8 characters with uppercase, lowercase, number and special character';
    }
    
    setValidationErrors(errors);
  }, [username, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Check for validation errors
    if (Object.keys(validationErrors).length > 0 && (validationErrors.username || validationErrors.password)) {
      setError('Please fix the validation errors');
      setIsLoading(false);
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      setIsLoading(false);
      return;
    }

    // Make sure username is at least 7 characters
    if (username.length < 7) {
      setError('Username must be at least 7 characters');
      setIsLoading(false);
      return;
    }

    // Make sure username contains at least one number
    if (!/\d/.test(username)) {
      setError('Username must contain at least one number');
      setIsLoading(false);
      return;
    }

    // Validate password strength
    if (!PASSWORD_REGEX.test(password)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, number, and special character');
      setIsLoading(false);
      return;
    }

    try {
      // Check if the username already exists
      const usernameExists = await checkUsernameExists(username);
      
      if (usernameExists) {
        setError('Username already exists. Please choose another username.');
        setIsLoading(false);
        return;
      }
      
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
        <title>NebulaChat - Secure Messaging</title>
        <meta name="description" content="A secure real-time messaging application with user limits" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <main className="flex flex-col items-center px-4 w-full">
        <div className="w-full max-w-md">
          <div className="bg-gray-800 rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-center text-indigo-500 mb-8">
              NebulaChat
            </h1>
            <p className="text-gray-400 text-center mb-6">Secure, limited-access messaging</p>
            
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
                  className={`mt-1 block w-full rounded-md bg-gray-700 border ${
                    validationErrors.username ? 'border-red-500' : 'border-gray-600'
                  } text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                  placeholder="Enter a username (min 7 chars with a number)"
                  disabled={isLoading}
                />
                {validationErrors.username && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.username}</p>
                )}
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
                  className={`mt-1 block w-full rounded-md bg-gray-700 border ${
                    validationErrors.password ? 'border-red-500' : 'border-gray-600'
                  } text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                  placeholder="Enter a secure password"
                  disabled={isLoading}
                />
                {validationErrors.password && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Password must be at least 8 characters with uppercase, lowercase, 
                  number and special character
                </p>
              </div>

              {error && (
                <div className="text-red-500 text-sm mt-2">{error}</div>
              )}

              <button
                type="submit"
                disabled={isLoading || Object.keys(validationErrors).length > 0}
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