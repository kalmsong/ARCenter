import React, { lazy, Suspense, useEffect, useState } from 'react';
import LoginScreen from './components/LoginScreen';
import { supabase } from './services/supabaseClient';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));

type AuthState = 'loading' | 'signed-out' | 'signed-in';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-9 w-9 rounded-full border-4 border-slate-200 border-t-slate-900 animate-spin" />
        <p className="text-sm font-semibold text-slate-500">ARCenter 불러오는 중</p>
      </div>
    </div>
  );
}

export default function AuthBootstrap() {
  const [authState, setAuthState] = useState<AuthState>('loading');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        console.error('Failed to restore Supabase session:', error);
        setAuthState('signed-out');
        return;
      }

      setAuthState(data.session ? 'signed-in' : 'signed-out');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setAuthState(session ? 'signed-in' : 'signed-out');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authState === 'loading') {
    return <LoadingScreen />;
  }

  if (authState === 'signed-out') {
    return <LoginScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuthenticatedApp />
    </Suspense>
  );
}
