
'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page is now a simple router, relying on AuthProvider to handle all logic.
// The AuthProvider will display a loader and redirect to the correct page.
export default function RootPage() {
  const { user, isCoach, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace(isCoach ? '/coach/dashboard' : '/client/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isCoach, loading, router]);
  
  return null; // The AuthProvider shows a global loader
}
