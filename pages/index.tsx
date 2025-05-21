import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();
  
  // Simple direct navigation to the login page on mount
  useEffect(() => {
    console.log('Index page - Redirecting to login page');
    router.replace('/login');
  }, [router]);
  
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
      <Head>
        <title>NebulaChat</title>
        <meta name="description" content="Secure chat application with room-based messaging" />
      </Head>
      <div className="text-white text-2xl mb-4">Welcome to NebulaChat</div>
      <div className="text-gray-400">Loading...</div>
    </div>
  );
} 