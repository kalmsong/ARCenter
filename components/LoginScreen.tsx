/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, Sparkles, Scale, Briefcase, Layout } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  onLogin: () => void;
  isLoading?: boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, isLoading }) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-100/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-md w-full relative z-10"
      >
        <div className="bg-white rounded-[48px] shadow-2xl shadow-slate-200 border border-slate-100 p-12 text-center">
          {/* Logo / Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 bg-slate-900 rounded-[32px] flex items-center justify-center shadow-xl rotate-3 group-hover:rotate-0 transition-transform">
                <Scale size={42} className="text-white" />
              </div>
              <div className="absolute -top-3 -right-3 w-10 h-10 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg -rotate-12">
                <Sparkles size={20} className="text-white" />
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">
            Archi-Assistant
          </h1>
          <p className="text-slate-500 font-medium mb-12 leading-relaxed">
            인공지능 기반 건축 법규 검토 및 <br />
            프로젝트 관리 솔루션
          </p>

          <div className="space-y-4 mb-12">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-purple-600">
                <ShieldCheck size={20} />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-slate-900">법규 엔진 탑재</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Real-time Law Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-600">
                <Briefcase size={20} />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-slate-900">프로젝트 관리</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Workspace Management</p>
              </div>
            </div>
          </div>

          <button
            onClick={onLogin}
            disabled={isLoading}
            className="w-full py-4 bg-slate-900 hover:bg-purple-600 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-slate-200 hover:shadow-purple-100 active:scale-[0.98] flex items-center justify-center gap-3 group disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 bg-white p-0.5 rounded" />
                Google 계정으로 시작하기
              </>
            )}
          </button>

          <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
            By continuing, you agree to our <br />
            Service Guidelines & Privacy Standards
          </p>
        </div>

        {/* Footer Info */}
        <div className="mt-8 flex items-center justify-center gap-6 opacity-40">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">System Live</span>
           </div>
           <div className="w-1 h-1 bg-slate-300 rounded-full" />
           <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Vers. 2.5.0</span>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
