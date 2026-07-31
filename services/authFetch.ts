import { supabase } from './supabaseClient';

export async function authorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`로그인 세션을 확인하지 못했습니다: ${error.message}`);
  }

  if (!session?.access_token) {
    throw new Error('로그인이 필요합니다.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
