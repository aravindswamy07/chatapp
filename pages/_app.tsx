import React from 'react';
import { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { isLoggedIn } from '../lib/auth';
import '../styles/globals.css';
import Head from 'next/head';

// Define public paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/signup'];

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  
  useEffect(() => {
    // Skip auth check for public paths
    if (PUBLIC_PATHS.includes(router.pathname)) {
      setAuthChecked(true);
      return;
    }
    
    // Skip for non-browser environment
    if (typeof window === 'undefined') return;
    
    const checkAuth = () => {
      const isAuthenticated = isLoggedIn();
      console.log('_app.tsx - Auth check:', { isAuthenticated, path: router.pathname });
      
      if (!isAuthenticated && !PUBLIC_PATHS.includes(router.pathname)) {
        console.log('_app.tsx - Redirecting to login');
        // Remove any redirect tracking before forcing navigation
        localStorage.removeItem('redirectInProgress');
        router.replace('/login');
      } else {
        setAuthChecked(true);
      }
    };
    
    checkAuth();
  }, [router.pathname]);
  
  // Show loading state while checking authentication
  if (!authChecked && !PUBLIC_PATHS.includes(router.pathname)) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
        <div className="text-white text-xl">Checking authentication...</div>
      </div>
    );
  }
  
  return (
    <>
      <Head>
        <title>NebulaChat - Secure Messaging Platform</title>
        <meta name="description" content="A secure real-time messaging platform with user limits" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp; 