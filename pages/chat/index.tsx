import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { isLoggedIn } from '../../lib/auth';

export default function ChatIndex() {
  const router = useRouter();
  
  // Redirect to the appropriate place
  useEffect(() => {
    if (isLoggedIn()) {
      // If logged in, go to home page to select a room
      router.push('/home');
    } else {
      // If not logged in, go to login
      router.push('/login');
    }
  }, [router]);
  
  // Loading state while redirecting
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>
  );
} 