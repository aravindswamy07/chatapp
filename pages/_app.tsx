import React from 'react';
import { AppProps } from 'next/app';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { isLoggedIn } from '../lib/auth';
import '../styles/globals.css';
import Head from 'next/head';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // Simple auth check - redirect to login if not logged in
    // except for the login page itself
    if (!isLoggedIn() && router.pathname !== '/') {
      router.push('/');
    }
  }, [router.pathname]);

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