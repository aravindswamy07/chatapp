import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { isLoggedIn } from '../lib/auth';

export default function Home() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  
  // Check login status and redirect appropriately
  useEffect(() => {
    // Set a prevention flag in localStorage to avoid redirect loops
    if (typeof window !== 'undefined') {
      const redirectInProgress = localStorage.getItem('redirectInProgress');
      const timestamp = parseInt(redirectInProgress || '0');
      const now = Date.now();
      
      // If a redirect was initiated in the last 3 seconds, don't redirect again
      if (redirectInProgress && now - timestamp < 3000) {
        console.log('Recent redirect detected, preventing loop');
        return;
      }
      
      // Set redirect flag with current timestamp
      localStorage.setItem('redirectInProgress', now.toString());
      
      // Clear the flag after 3 seconds
      setTimeout(() => {
        localStorage.removeItem('redirectInProgress');
      }, 3000);
    }
    
    // Prevent redirection if already in progress
    if (redirecting) return;
    
    // Add a larger delay to prevent rapid redirection loops
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
    }, 1500); // 1.5 second delay
    
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