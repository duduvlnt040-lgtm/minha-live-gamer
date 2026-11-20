import React, { useState } from 'react';
import {
  Home,
  Layers,
  Radio,
  Settings,
  Crown,
  HelpCircle,
  LogOut,
  Gamepad2,
  ShieldCheck,
  Menu,
  X,
  LogIn,
  Sparkles,
} from 'lucide-react';
import type { User, UserAccess, LiveStatus } from '../types';
import { TrialBanner } from './TrialBanner';

export type UserSection =
  | 'home'
  | 'library'
  | 'game_detail'
  | 'tiktok'
  | 'settings'
  | 'subscription'
  | 'help';

interface UserShellProps {
  user: User | null;
  access: UserAccess | null;
  liveStatus: LiveStatus | null;
  currentPage: UserSection;
  onNavigate: (page: UserSection) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  onReturnToAdmin?: () => void;
  children: React.ReactNode;
}

export const UserShell: React.FC<UserShellProps> = ({
  user,
  access,
  liveStatus,
  currentPage,
  onNavigate,
  onOpenAuth,
  onLogout,
  onReturnToAdmin,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLiveConnected = Boolean(liveStatus?.connected);

  const menuItems: Array<{
    id: UserSection;
    label: string;
    icon: React.FC<{ className?: string }>;
  }> = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'library', label: 'Biblioteca de jogos', icon: Layers },
    { id: 'tiktok', label: 'Conectar TikTok LIVE', icon: Radio },
    { id: 'settings', label: 'Minhas configurações', icon: Settings },
    { id: 'subscription', label: 'Minha assinatura', icon: Crown },
    { id: 'help', label: 'Ajuda', icon: HelpCircle },
  ];

  return (
    <div className="user-shell">
      {/* Sidebar do Usuário Comum (7 itens: 6 seções + Sair) */}
      <aside className={`user-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="p-5 border-b border-purple-500/20 flex items-center justify-between">
          <div
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-700 via-indigo-600 to-violet-400 p-[2px] shadow-md shadow-purple-500/30">
              <div className="w-full h-full bg-[#0d091a] rounded-[10px] flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-black text-sm text-white tracking-wider">MINHA LIVE</span>
                <span className="font-black text-sm text-purple-400">GAME</span>
              </div>
              <p className="text-[9px] text-purple-300/70 font-bold uppercase tracking-widest">
                Painel do Streamer
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="sm:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPage === item.id ||
              (item.id === 'library' && currentPage === 'game_detail');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  setSidebarOpen(false);
                }}
                className={`user-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0 text-purple-400" />
                <span>{item.label}</span>
              </button>
            );
          })}

          {user && (
            <div className="pt-3 mt-4 border-t border-purple-500/15">
              <button
                type="button"
                onClick={onLogout}
                className="user-nav-item text-rose-300"
              >
                <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
                <span>Sair</span>
              </button>
            </div>
          )}
        </nav>

        {/* Account Footer */}
        <div className="p-3.5 border-t border-purple-500/20 bg-purple-950/30">
          {user ? (
            <div className="space-y-1">
              <p className="text-xs font-extrabold text-white truncate">{user.displayName}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              {access && (
                <p className="text-[10px] font-bold text-purple-300 flex items-center gap-1 pt-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>
                    {access.isAdmin
                      ? 'Visualização Streamer (Admin)'
                      : access.isSubscribed
                      ? 'Assinante Premium'
                      : access.isTrial
                      ? `Teste Grátis: ${access.trialHoursLeft}h`
                      : 'Teste Expirado'}
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="w-full py-2 rounded-xl bg-purple-950/80 border border-purple-500/30 text-xs font-bold text-white flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-xs font-extrabold text-white"
              >
                Criar Conta (72h Grátis)
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Exclusively visible ONLY when the verified Admin is previewing the streamer interface */}
        {user?.isAdmin && onReturnToAdmin && (
          <div className="streamer-preview-banner">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                Modo Visualização Streamer ativo ({user.email}) — Você está vendo exatamente o que um usuário comum vê.
              </span>
            </div>
            <button
              type="button"
              onClick={onReturnToAdmin}
              className="px-3 py-1 rounded-lg bg-black/40 text-white font-extrabold text-xs border border-amber-300/40 whitespace-nowrap"
            >
              Voltar ao Painel Administrativo
            </button>
          </div>
        )}

        {/* Streamer Topbar */}
        <header className="sticky top-0 z-20 glass-panel border-b border-purple-500/20 px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg bg-purple-950/60 border border-purple-500/30 text-slate-200 sm:hidden"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm font-bold text-slate-200">
              {currentPage === 'home'
                ? 'Início'
                : currentPage === 'library'
                ? 'Biblioteca de Jogos'
                : currentPage === 'game_detail'
                ? 'Painel do Jogo'
                : currentPage === 'tiktok'
                ? 'Conectar TikTok LIVE'
                : currentPage === 'settings'
                ? 'Minhas Configurações'
                : currentPage === 'subscription'
                ? 'Minha Assinatura'
                : 'Ajuda'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Status Pill (Real Status Only) */}
            <button
              type="button"
              onClick={() => onNavigate('tiktok')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                isLiveConnected
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : liveStatus?.status === 'connecting'
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                  : liveStatus?.status === 'offline'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                  : liveStatus?.status === 'error'
                  ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                  : 'bg-slate-900/70 border-slate-700/60 text-slate-400'
              }`}
            >
              <span
                className={`inline-flex rounded-full h-2 w-2 ${
                  isLiveConnected
                    ? 'bg-emerald-500'
                    : liveStatus?.status === 'connecting' || liveStatus?.status === 'offline'
                    ? 'bg-amber-400'
                    : liveStatus?.status === 'error'
                    ? 'bg-rose-500'
                    : 'bg-slate-500'
                }`}
              />
              <span>
                {isLiveConnected
                  ? `Conectado: @${liveStatus?.username}`
                  : liveStatus?.status === 'connecting'
                  ? 'Conectando...'
                  : liveStatus?.status === 'offline'
                  ? 'LIVE offline'
                  : liveStatus?.status === 'error'
                  ? 'Erro de conexão'
                  : 'Conectar TikTok LIVE'}
              </span>
            </button>

            {!user && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-200 border border-purple-500/30"
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold text-white bg-gradient-to-r from-purple-600 to-indigo-600"
                >
                  3 Dias Grátis
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Trial / Expiration Banner (never displays to admin because access.isAdmin hides it) */}
        <TrialBanner
          access={access}
          onNavigateToSubscription={() => onNavigate('subscription')}
        />

        {/* Page Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};
