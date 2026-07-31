/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Mail,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../services/supabaseClient';

interface LoginScreenProps {
  // Kept optional while the parent app is migrated away from the old Google handler.
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
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-100/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="max-w-md w-full relative z-10"
      >
        <div className="bg-white rounded-[48px] shadow-2xl shadow-slate-200 border border-slate-100 p-12 text-center">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 bg-slate-900 rounded-[32px] flex items-center justify-center shadow-xl rotate-3">
                <Scale size={42} className="text-white" />
              </div>
              <div className="absolute -top-3 -right-3 w-10 h-10 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg -rotate-12">
                <Sparkles size={20} className="text-white" />
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">
            ARCenter
          </h1>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">
            건축 프로젝트별 법규 검토와<br />
            근거 자료를 안전하게 관리합니다.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
              <ShieldCheck size={20} className="text-purple-600 mb-3" />
              <p className="text-xs font-black text-slate-900">사용자별 보안</p>
              <p className="text-[10px] text-slate-500 mt-1">Private workspace</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
              <Briefcase size={20} className="text-blue-600 mb-3" />
              <p className="text-xs font-black text-slate-900">프로젝트 기록</p>
              <p className="text-[10px] text-slate-500 mt-1">Review history</p>
            </div>
          </div>

          {isSent ? (
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={22} />
                <div>
                  <p className="text-sm font-black text-emerald-950">로그인 메일을 보냈습니다.</p>
                  <p className="text-xs text-emerald-800 mt-2 leading-relaxed break-all">
                    {email.trim()} 메일함에서 로그인 링크를 눌러 주세요.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSent(false);
                  setErrorMessage('');
                }}
                className="mt-5 text-xs font-bold text-emerald-800 underline underline-offset-4"
              >
                다른 이메일 사용
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 text-left">
              <label htmlFor="login-email" className="block text-xs font-black text-slate-700 ml-1">
                이메일
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  disabled={isSending || isLoading}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100 disabled:opacity-60"
                />
              </div>

              {errorMessage && (
                <p className="text-xs font-medium text-red-600 px-1">{errorMessage}</p>
              )}

              <button
                type="submit"
                disabled={isSending || isLoading}
                className="w-full py-4 bg-slate-900 hover:bg-purple-600 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-slate-200 hover:shadow-purple-100 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSending || isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    로그인 링크 받기
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="mt-7 text-[11px] text-slate-400 leading-relaxed">
            비밀번호 없이 이메일로 받은 일회용 링크를 통해 로그인합니다.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 opacity-40">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
              System Live
            </span>
          </div>
          <div className="w-1 h-1 bg-slate-300 rounded-full" />
          <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
            Supabase Auth
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
