import React from 'react';
import {
  Play,
  Radio,
  Crown,
  Clock,
  Sparkles,
  Gamepad2,
  ArrowRight,
  Music,
  Layers,
} from 'lucide-react';
import type { Game, User, UserAccess, LiveStatus } from '../types';
import { getMediaUrl } from '../lib/api';

interface UserHomePageProps {
  user: User | null;
  access: UserAccess | null;
  liveStatus: LiveStatus | null;
  games: Game[];
  onSelectGame: (gameId: string) => void;
  onNavigate: (page: string) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const UserHomePage: React.FC<UserHomePageProps> = ({
  user,
  access,
  liveStatus,
  games,
  onSelectGame,
  onNavigate,
  onOpenAuth,
}) => {
  const featuredGames = games.filter((g) => g.is_featured).slice(0, 3);
  const displayGames = featuredGames.length > 0 ? featuredGames : games.slice(0, 3);
  const isLiveConnected = Boolean(liveStatus?.connected);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">
      {/* Welcome Hero */}
      <div className="rounded-3xl glass-card p-6 sm:p-8 border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/40 text-purple-200 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>CENTRAL DO STREAMER — MINHA LIVE GAME</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white font-display tracking-tight">
            {user ? `Olá, ${user.displayName}!` : 'Transforme sua TikTok LIVE em um espetáculo interativo'}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Escolha um jogo da biblioteca global, adicione suas músicas particulares, conecte seu @ do TikTok e transmita ao vivo no OBS ou TikTok LIVE Studio.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {!user ? (
            <>
              <button
                onClick={() => onOpenAuth('register')}
                className="px-5 py-3 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg shadow-purple-600/30 flex items-center gap-2"
              >
                <span>Começar 3 Dias Grátis</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onOpenAuth('login')}
                className="px-5 py-3 rounded-xl font-bold text-xs text-slate-200 bg-purple-950/60 border border-purple-500/30"
              >
                Já tenho conta
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onNavigate('library')}
                className="px-5 py-3 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg shadow-purple-600/30 flex items-center gap-2"
              >
                <Layers className="w-4 h-4" />
                <span>Abrir Biblioteca de Jogos</span>
              </button>
              <button
                onClick={() => onNavigate('tiktok')}
                className="px-5 py-3 rounded-xl font-bold text-xs text-purple-200 bg-purple-950/60 border border-purple-500/30 flex items-center gap-2"
              >
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Conectar TikTok LIVE</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl glass-card p-5 border border-purple-500/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Status do Acesso</span>
            {access?.isSubscribed ? (
              <Crown className="w-4 h-4 text-amber-400" />
            ) : (
              <Clock className="w-4 h-4 text-purple-400" />
            )}
          </div>
          <p className="text-lg font-black text-white">
            {!user
              ? 'Teste Grátis 72h'
              : access?.isSubscribed
              ? 'Premium Ativo'
              : access?.isTrial
              ? `${access.trialHoursLeft}h de Teste Restantes`
              : 'Teste Expirado'}
          </p>
          <button
            onClick={() => onNavigate('subscription')}
            className="text-xs font-bold text-purple-300 hover:underline flex items-center gap-1"
          >
            <span>Gerenciar assinatura (R$ 49,99/mês)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-2xl glass-card p-5 border border-purple-500/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Conexão TikTok LIVE</span>
            <Radio className={`w-4 h-4 ${isLiveConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
          </div>
          <p className="text-lg font-black text-white">
            {isLiveConnected ? `@${liveStatus?.username}` : 'Desconectado'}
          </p>
          <button
            onClick={() => onNavigate('tiktok')}
            className="text-xs font-bold text-purple-300 hover:underline flex items-center gap-1"
          >
            <span>{isLiveConnected ? 'Ver eventos ao vivo' : 'Conectar meu @ agora'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-2xl glass-card p-5 border border-purple-500/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Catálogo Global Liberado</span>
            <Gamepad2 className="w-4 h-4 text-fuchsia-400" />
          </div>
          <p className="text-lg font-black text-white">{games.length} Jogos Prontos</p>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Music className="w-3.5 h-3.5 text-purple-400" />
            <span>Com playlists e upload privado de músicas</span>
          </p>
        </div>
      </div>

      {/* Featured Games */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white font-display">Jogos em Destaque</h2>
          <button
            onClick={() => onNavigate('library')}
            className="text-xs font-bold text-purple-300 hover:text-white flex items-center gap-1"
          >
            <span>Ver biblioteca completa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayGames.map((game) => (
            <div
              key={game.id}
              className="group rounded-3xl glass-card overflow-hidden border border-purple-500/20 flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <img
                    src={getMediaUrl(game.cover_image || '/covers/default-game.svg')}
                    alt={game.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-purple-900/90 text-purple-200 border border-purple-400/30">
                    {game.category}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-black text-white">{game.name}</h3>
                  <p className="text-xs text-slate-300 mt-1.5 line-clamp-2">{game.description}</p>
                </div>
              </div>

              <div className="px-5 pb-5">
                <button
                  onClick={() => onSelectGame(game.id)}
                  className="w-full py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center gap-2 shadow-md shadow-purple-600/30"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>ABRIR PAINEL DO JOGO</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
