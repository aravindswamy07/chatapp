import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { isLoggedIn } from '../lib/auth';

export default function Home() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  
  // Check login status and redirect appropriately
  useEffect(() => {
    // Prevent redirection if already in progress
    if (redirecting) return;
    
    // Add a small delay to prevent rapid redirection loops
    const redirectTimer = setTimeout(() => {
      const loggedIn = isLoggedIn();
      console.log('Index page - User logged in:', loggedIn);
      
      setRedirecting(true);
      
      if (loggedIn) {
        // If already logged in, go to home page
        console.log('Redirecting to /home');
        router.push('/home');
      } else {
        // Otherwise, redirect to login
        console.log('Redirecting to /login');
        router.push('/login');
      }
    }, 500); // 500ms delay
    
    return () => clearTimeout(redirectTimer);
  }, [router, redirecting]);
  
  // Loading state while redirecting
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
      <div className="text-white text-2xl mb-4">Welcome to NebulaChat</div>
      <div className="text-gray-400">Loading...</div>
    </div>
  );
} 