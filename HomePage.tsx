import React, { useState } from 'react';
import { Play, Sparkles, Flame, Search, Layers, Crown, ShieldAlert } from 'lucide-react';
import type { Game, User, UserAccess } from '../types';

interface HomePageProps {
  games: Game[];
  user: User | null;
  access: UserAccess | null;
  onSelectGame: (gameId: string) => void;
  onNavigateToSubscription: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  games,
  user,
  access,
  onSelectGame,
  onNavigateToSubscription,
  onOpenAuth,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['Todos', '3D Interativo', 'Competitivo', 'Simulação'];

  const filteredGames = games.filter((g) => {
    const matchesCategory =
      selectedCategory === 'Todos' || g.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-[calc(100vh-4.5rem)] pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="pt-8 sm:pt-12 pb-8 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 text-xs font-bold mb-4 shadow-sm shadow-purple-900/40">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>BIBLIOTECA EXCLUSIVA MINHA LIVE GAME</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white font-display tracking-tight leading-tight">
          Qual jogo vai animar sua{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-violet-300 to-fuchsia-400">
            live hoje?
          </span>
        </h1>

        <p className="mt-3.5 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
          Jogos interativos 100% integrados à TikTok LIVE. Cada presente, curtida e comentário movimenta a tela em tempo real sem complicação.
        </p>

        {/* Search & Filter Bar */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-2.5 rounded-2xl border border-purple-500/25">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-purple-900/20'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar jogo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-400"
            />
          </div>
        </div>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 pt-4">
        {filteredGames.map((game) => (
          <div
            key={game.id}
            className="group rounded-3xl glass-card overflow-hidden border border-purple-500/20 hover:border-purple-400/60 transition-all flex flex-col"
          >
            {/* Game Cover */}
            <div className="relative aspect-[16/10] w-full bg-gradient-to-tr from-purple-950 to-indigo-950 overflow-hidden">
              <img
                src={game.cover_image || '/covers/default-game.svg'}
                alt={game.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/covers/default-game.svg';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#120d26] via-transparent to-transparent opacity-80" />

              {/* Tags */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-900/90 text-purple-200 border border-purple-400/30 shadow-md">
                  {game.category}
                </span>
                {Boolean(game.is_featured) && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/90 text-amber-950 shadow-md flex items-center gap-1">
                    <Flame className="w-3 h-3 fill-current" />
                    DESTAQUE
                  </span>
                )}
              </div>

              {game.type === 'zip' && game.directory === 'casamento-da-barata-3d' && (
                <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-purple-600/90 text-white text-[10px] font-bold shadow-md">
                  3D THREE.JS
                </div>
              )}
            </div>

            {/* Game Info */}
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-black text-white font-display group-hover:text-purple-300 transition-colors">
                  {game.name}
                </h3>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed line-clamp-3">
                  {game.description}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-purple-500/15 flex items-center justify-between">
                <span className="text-[11px] text-purple-300/70 font-semibold">
                  Versão {game.version || '1.0'}
                </span>

                <button
                  onClick={() => onSelectGame(game.id)}
                  className="px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-600/30 transition-all flex items-center gap-2 active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>ABRIR JOGO</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredGames.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Layers className="w-12 h-12 text-purple-500/40 mx-auto mb-3" />
          <p className="text-sm font-semibold">Nenhum jogo encontrado nesta categoria.</p>
        </div>
      )}
    </div>
  );
};
