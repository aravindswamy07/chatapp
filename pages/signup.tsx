import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { createUser, login, isLoggedIn } from '../lib/auth';

// Password validation regex
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export default function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    username?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn()) {
      router.push('/home');
    }
  }, [router]);

  // Validate input fields on change
  useEffect(() => {
    const errors: {username?: string; password?: string; confirmPassword?: string} = {};
    
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
    
    // Confirm password validation
    if (confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setValidationErrors(errors);
  }, [username, password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Check for validation errors
    if (Object.keys(validationErrors).length > 0) {
      setError('Please fix the validation errors');
      setIsLoading(false);
      return;
    }

    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('All fields are required');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      // Create user
      const user = await createUser(username, password);
      
      if (!user) {
        setError('Failed to create account. Username may already be taken.');
        setIsLoading(false);
        return;
      }
      
      // Auto login after signup
      await login(username, password);
      
      // Redirect to home page
      router.push('/home');
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center">
      <Head>
        <title>Sign Up | NebulaChat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <main className="flex flex-col items-center px-4 w-full">
        <div className="w-full max-w-md">
          <div className="bg-gray-800 rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-center text-indigo-500 mb-2">
              NebulaChat
            </h1>
            <p className="text-gray-400 text-center mb-6">Create your account</p>
            
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
                  placeholder="At least 7 characters with a number"
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
                  placeholder="Create a secure password"
                  disabled={isLoading}
                />
                {validationErrors.password && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  At least 8 characters with uppercase, lowercase, number and special character
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`mt-1 block w-full rounded-md bg-gray-700 border ${
                    validationErrors.confirmPassword ? 'border-red-500' : 'border-gray-600'
                  } text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500`}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                />
                {validationErrors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.confirmPassword}</p>
                )}
              </div>

              {error && (
                <div className="text-red-500 text-sm mt-2">{error}</div>
              )}

              <button
                type="submit"
                disabled={isLoading || Object.keys(validationErrors).length > 0}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </form>
            
            <div className="mt-6 text-sm text-center">
              <p className="text-gray-400">
                Already have an account?{' '}
                <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 