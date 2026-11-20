import React, { useState } from 'react';
import { Gamepad2, Radio, Crown, ShieldAlert, User, LogOut, HelpCircle, Layers, Sparkles } from 'lucide-react';
import type { User as UserType, UserAccess, LiveStatus } from '../types';

interface NavbarProps {
  user: UserType | null;
  access: UserAccess | null;
  liveStatus: LiveStatus | null;
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  access,
  liveStatus,
  currentPage,
  onNavigate,
  onOpenAuth,
  onLogout,
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const isLiveConnected = liveStatus?.connected;

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-purple-500/20 bg-[#0a0714]/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onNavigate('home')}
          className="flex items-center gap-3 cursor-pointer group transition-transform active:scale-95"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-700 via-indigo-600 to-violet-400 p-[2px] shadow-lg shadow-purple-500/30">
            <div className="w-full h-full bg-[#0d091a] rounded-[10px] flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-wider text-xl text-white font-display">
                MINHA LIVE
              </span>
              <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                GAME
              </span>
            </div>
            <p className="text-[10px] text-purple-300/60 font-semibold uppercase tracking-widest -mt-0.5">
              Plataforma TikTok LIVE
            </p>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-1.5">
          <button
            onClick={() => onNavigate('home')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              currentPage === 'home'
                ? 'text-white bg-purple-600/20 border border-purple-500/40 shadow-sm shadow-purple-500/20'
                : 'text-slate-300 hover:text-white hover:bg-purple-900/15'
            }`}
          >
            Início
          </button>

          <button
            onClick={() => onNavigate('library')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              currentPage === 'library'
                ? 'text-white bg-purple-600/20 border border-purple-500/40 shadow-sm shadow-purple-500/20'
                : 'text-slate-300 hover:text-white hover:bg-purple-900/15'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-400" />
            Biblioteca de Jogos
          </button>

          <button
            onClick={() => onNavigate('subscription')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              currentPage === 'subscription'
                ? 'text-white bg-purple-600/20 border border-purple-500/40 shadow-sm shadow-purple-500/20'
                : 'text-slate-300 hover:text-white hover:bg-purple-900/15'
            }`}
          >
            <Crown className="w-4 h-4 text-amber-400" />
            Minha Assinatura
          </button>

          <button
            onClick={() => onNavigate('help')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              currentPage === 'help'
                ? 'text-white bg-purple-600/20 border border-purple-500/40 shadow-sm shadow-purple-500/20'
                : 'text-slate-300 hover:text-white hover:bg-purple-900/15'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
            Ajuda
          </button>

          {user?.isAdmin && (
            <button
              onClick={() => onNavigate('admin')}
              className={`px-3.5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${
                currentPage === 'admin'
                  ? 'text-amber-300 bg-amber-500/20 border border-amber-500/40 shadow-sm shadow-amber-500/20'
                  : 'text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/10'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Painel Admin
            </button>
          )}
        </nav>

        {/* Right Section: Status Indicator & User Menu */}
        <div className="flex items-center gap-3">
          {/* Live Status Pill */}
          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isLiveConnected
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/30'
                : 'bg-slate-900/70 border-slate-700/60 text-slate-400'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {isLiveConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLiveConnected ? 'bg-emerald-500' : 'bg-slate-500'
                }`}
              />
            </span>
            <span>{isLiveConnected ? `LIVE: @${liveStatus.username}` : 'LIVE Desconectada'}</span>
          </div>

          {/* User Auth Section */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl bg-purple-950/40 border border-purple-500/30 hover:border-purple-400/60 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xs uppercase shadow-inner">
                  {user.displayName.slice(0, 2)}
                </div>
                <div className="hidden lg:block">
                  <div className="text-xs font-bold text-slate-100 leading-tight flex items-center gap-1">
                    {user.displayName}
                    {user.isAdmin && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold uppercase">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-purple-300/70 truncate max-w-[120px]">
                    {user.email}
                  </div>
                </div>
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl glass-card bg-[#140e2a] border border-purple-500/30 shadow-2xl py-2 z-50"
                  onClick={() => setProfileOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-purple-500/20">
                    <p className="text-xs text-slate-400 font-medium">Conectado como</p>
                    <p className="text-sm font-bold text-white truncate">{user.email}</p>
                    {access && (
                      <p className="text-[11px] text-purple-300/90 mt-1 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        {access.isAdmin
                          ? 'Acesso Vitalício'
                          : access.isSubscribed
                          ? 'Assinante Premium'
                          : `Teste: ${access.trialHoursLeft}h restantes`}
                      </p>
                    )}
                  </div>

                  {user.isAdmin && (
                    <button
                      onClick={() => onNavigate('admin')}
                      className="w-full px-4 py-2 text-left text-xs text-amber-300 hover:bg-amber-500/10 flex items-center gap-2 font-bold"
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      Gerenciador Administrativo
                    </button>
                  )}

                  <button
                    onClick={() => onNavigate('subscription')}
                    className="w-full px-4 py-2 text-left text-xs text-slate-200 hover:bg-purple-900/30 flex items-center gap-2"
                  >
                    <Crown className="w-4 h-4 text-amber-400" />
                    Minha Assinatura
                  </button>

                  <button
                    onClick={onLogout}
                    className="w-full px-4 py-2 text-left text-xs text-rose-300 hover:bg-rose-950/30 flex items-center gap-2 border-t border-purple-500/10 mt-1"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    Sair da conta
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-purple-950/50 transition-all border border-transparent hover:border-purple-500/30"
              >
                Entrar
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-600/30 transition-all active:scale-95"
              >
                Cadastrar (3 dias grátis)
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
