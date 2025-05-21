import React from 'react';
import { AppProps } from 'next/app';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { isLoggedIn } from '../lib/auth';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // Simple auth check - redirect to login if not logged in
    // except for the login page itself
    if (!isLoggedIn() && router.pathname !== '/') {
      router.push('/');
    }
  }, [router.pathname]);

  return <Component {...pageProps} />;
}

export default MyApp; 