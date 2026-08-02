/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface LoginScreenProps {
  onLogin?: () => void;
  isLoading?: boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ isLoading = false }) => {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage('이메일 주소를 입력해 주세요.');
      return;
    }

    setIsSending(true);
    setErrorMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      },
    });

    setIsSending(false);

    if (error) {
      console.error('Email sign-in failed:', error);
      setErrorMessage('로그인 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    setIsSent(true);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 sm:p-10 shadow-xl shadow-slate-200/60">
        <div className="mb-8">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white">
            AR
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            ARCenter
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            건축 프로젝트별 법규 자료와 검토 기록을 안전하게 관리합니다.
          </p>
        </div>

        {isSent ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-bold text-emerald-950">로그인 메일을 보냈습니다.</p>
            <p className="mt-2 break-all text-sm leading-6 text-emerald-800">
              {email.trim()} 메일함에서 로그인 링크를 눌러 주세요.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsSent(false);
                setErrorMessage('');
              }}
              className="mt-4 text-sm font-bold text-emerald-800 underline underline-offset-4"
            >
              다른 이메일 사용
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                이메일
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                disabled={isSending || isLoading}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
              />
            </div>

            {errorMessage && (
              <p className="text-sm font-medium text-red-600">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={isSending || isLoading}
              className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-sm font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending || isLoading ? '전송 중…' : '로그인 링크 받기'}
            </button>
          </form>
        )}

        <p className="mt-7 text-xs leading-5 text-slate-400">
          비밀번호 없이 이메일로 받은 일회용 링크를 통해 로그인합니다.
        </p>
      </section>
    </main>
  );
};

export default LoginScreen;
