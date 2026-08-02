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
    throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);

  try {
    return await fetch(input, {
      ...init,
      headers,
    });
  } catch (fetchError) {
    const raw = fetchError instanceof Error ? fetchError.message : String(fetchError);
    console.error('Authorized request failed:', raw);
    throw new Error(
      '임시 서버에 연결하지 못했습니다. 네트워크 상태를 확인하고 잠시 후 다시 시도해 주세요.',
    );
  }
}
