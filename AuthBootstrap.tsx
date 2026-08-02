import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import LoginScreen from './components/LoginScreen';
import { supabase } from './services/supabaseClient';
import {
  ensureTestWorkspace,
  QUICK_START_PROJECT_NAME,
} from './services/testOnboarding';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));

type AuthState = 'loading' | 'signed-out' | 'signed-in';

function LoadingScreen({ message = 'ARCenter 불러오는 중' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-9 w-9 rounded-full border-4 border-slate-200 border-t-slate-900 animate-spin" />
        <p className="text-sm font-semibold text-slate-500">{message}</p>
      </div>
    </div>
  );
}

function AutoOpenQuickStartProject() {
  const selectedRef = useRef(false);

  useEffect(() => {
    let attempts = 0;

    const selectProject = () => {
      if (selectedRef.current) return true;

      const candidates = Array.from(
        document.querySelectorAll<HTMLButtonElement>('button'),
      ).filter((button) =>
        button.textContent?.includes(QUICK_START_PROJECT_NAME),
      );

      const target = candidates.sort(
        (a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0),
      )[0];

      if (!target) return false;

      selectedRef.current = true;
      target.click();
      return true;
    };

    if (selectProject()) return;

    const timer = window.setInterval(() => {
      attempts += 1;
      if (selectProject() || attempts >= 40) {
        window.clearInterval(timer);
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  return null;
}

export default function AuthBootstrap() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [loadingMessage, setLoadingMessage] = useState('ARCenter 불러오는 중');
  const mountedRef = useRef(true);
  const preparedUserRef = useRef<string | null>(null);
  const preparingUserRef = useRef<string | null>(null);

  const prepareAuthenticatedUser = useCallback(async (userId: string) => {
    if (
      preparedUserRef.current === userId ||
      preparingUserRef.current === userId
    ) {
      return;
    }

    preparingUserRef.current = userId;
    if (mountedRef.current) {
      setAuthState('loading');
      setLoadingMessage('빠른 체험 프로젝트 준비 중');
    }

    try {
      await ensureTestWorkspace(userId);
      preparedUserRef.current = userId;
    } catch (error) {
      console.error('Failed to prepare quick-start workspace:', error);
    } finally {
      preparingUserRef.current = null;
      if (mountedRef.current) {
        setAuthState('signed-in');
        setLoadingMessage('ARCenter 불러오는 중');
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mountedRef.current) return;

      if (error) {
        console.error('Failed to restore Supabase session:', error);
        setAuthState('signed-out');
        return;
      }

      const userId = data.session?.user.id;
      if (userId) {
        void prepareAuthenticatedUser(userId);
      } else {
        setAuthState('signed-out');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;

      const userId = session?.user.id;
      if (userId) {
        void prepareAuthenticatedUser(userId);
      } else {
        preparedUserRef.current = null;
        preparingUserRef.current = null;
        setAuthState('signed-out');
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [prepareAuthenticatedUser]);

  if (authState === 'loading') {
    return <LoadingScreen message={loadingMessage} />;
  }

  if (authState === 'signed-out') {
    return <LoginScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <AutoOpenQuickStartProject />
      <AuthenticatedApp />
    </Suspense>
  );
}
