import React, { useState, useEffect } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  Gift,
  Heart,
  MessageCircle,
  UserPlus,
  Share2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Users,
} from 'lucide-react';
import type { User, UserAccess, LiveStatus, LiveEvent } from '../types';

interface UserTikTokPageProps {
  user: User | null;
  access: UserAccess | null;
  liveStatus: LiveStatus | null;
  liveEvents: LiveEvent[];
  onConnectLive: (username: string) => Promise<void>;
  onDisconnectLive: () => Promise<void>;
  onNavigateToSubscription: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const UserTikTokPage: React.FC<UserTikTokPageProps> = ({
  user,
  access,
  liveStatus,
  liveEvents,
  onConnectLive,
  onDisconnectLive,
  onNavigateToSubscription,
  onOpenAuth,
}) => {
  const [username, setUsername] = useState(
    liveStatus?.username || user?.tiktokUsername || localStorage.getItem('tiktok_username') || ''
  );
  const [connecting, setConnecting] = useState(false);
  const [historyEvents, setHistoryEvents] = useState<LiveEvent[]>([]);
  const [statusFeedback, setStatusFeedback] = useState('');

  // Load persisted real events from DB on mount
  useEffect(() => {
    if (!user) return;
    fetch('/api/live/recent-events?limit=50')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.events)) {
          // Prioritize real TikTok LIVE events
          setHistoryEvents(d.events.filter((ev: LiveEvent) => !ev.simulation));
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // Merge WebSocket real-time events with persisted history (deduplicated)
  const mergedEvents = React.useMemo(() => {
    const seen = new Set<string>();
    const combined: LiveEvent[] = [];
    for (const ev of [...liveEvents.filter((e) => !e.simulation), ...historyEvents]) {
      const key = ev.id || `${ev.type}-${ev.user}-${ev.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(ev);
      }
    }
    return combined.slice(0, 80);
  }, [liveEvents, historyEvents]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setStatusFeedback('');

    if (!user) {
      onOpenAuth('login');
      return;
    }
    if (!access?.hasAccess) {
      onNavigateToSubscription();
      return;
    }
    const clean = username.trim().replace(/^@+/, '');
    if (!clean) {
      setStatusFeedback('Digite o seu @ do TikTok para iniciar a conexão.');
      return;
    }

    setConnecting(true);
    try {
      localStorage.setItem('tiktok_username', clean);
      await onConnectLive(clean);
    } catch (err: any) {
      setStatusFeedback(err.message || 'Erro de conexão com a TikTok LIVE.');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setStatusFeedback('');
    try {
      await onDisconnectLive();
    } catch (err: any) {
      setStatusFeedback(err.message || 'Erro ao desconectar.');
    }
  }

  // Strict real connection state computation
  const rawStatus = connecting ? 'connecting' : liveStatus?.status || 'disconnected';
  const isConnected = Boolean(liveStatus?.connected && rawStatus === 'connected');
  const isConnecting = rawStatus === 'connecting';
  const isOffline = rawStatus === 'offline';
  const isError = rawStatus === 'error';

  const statusMeta = isConnected
    ? {
        label: 'Conectado',
        pillClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50',
        dotClass: 'bg-emerald-500',
      }
    : isConnecting
    ? {
        label: 'Conectando',
        pillClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/50',
        dotClass: 'bg-amber-400',
      }
    : isOffline
    ? {
        label: 'LIVE offline',
        pillClass: 'bg-amber-950/60 text-amber-300 border border-amber-500/40',
        dotClass: 'bg-amber-500',
      }
    : isError
    ? {
        label: 'Erro de conexão',
        pillClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/50',
        dotClass: 'bg-rose-500',
      }
    : {
        label: 'Desconectado',
        pillClass: 'bg-slate-800 text-slate-400 border border-slate-700/60',
        dotClass: 'bg-slate-500',
      };

  const commentCount =
    liveStatus?.eventCounts?.comment ??
    mergedEvents.filter((e) => e.type === 'comment').length;
  const likeCount =
    liveStatus?.eventCounts?.like ??
    mergedEvents.filter((e) => e.type === 'like').length;
  const giftCount =
    liveStatus?.eventCounts?.gift ??
    mergedEvents.filter((e) => e.type === 'gift').length;
  const followCount =
    liveStatus?.eventCounts?.follow ??
    mergedEvents.filter((e) => e.type === 'follow').length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
      {/* Section Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-display flex items-center gap-2.5">
          <Radio className="w-7 h-7 text-purple-400" />
          <span>Conectar TikTok LIVE</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Conecte-se em tempo real à transmissão ao vivo do seu perfil TikTok usando apenas o seu @ (sem senha).
        </p>
      </div>

      {/* Main Connection Card */}
      <form onSubmit={handleConnect} className="rounded-3xl glass-card p-6 border border-purple-500/30 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isConnected ? (
              <Wifi className="w-5 h-5 text-emerald-400" />
            ) : isConnecting ? (
              <Loader2 className="w-5 h-5 text-amber-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-slate-400" />
            )}
            <div>
              <p className="font-bold text-white text-sm">
                {isConnected
                  ? `Conectado à LIVE de @${liveStatus?.username}`
                  : isConnecting
                  ? `Conectando à LIVE de @${liveStatus?.username || username.replace(/^@+/, '')}...`
                  : isOffline
                  ? `LIVE offline — @${liveStatus?.username || username.replace(/^@+/, '')}`
                  : isError
                  ? 'Erro de conexão com TikTok LIVE'
                  : 'Nenhuma LIVE conectada'}
              </p>
              {isConnected && liveStatus?.roomId && (
                <p className="text-[11px] text-emerald-300/80 font-mono">
                  Sala ativa #{liveStatus.roomId} · {liveStatus.viewerCount || 0} espectadores
                </p>
              )}
            </div>
          </div>

          <span className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-2 ${statusMeta.pillClass}`}>
            <span className={`inline-flex rounded-full h-2 w-2 ${statusMeta.dotClass}`} />
            <span>{statusMeta.label}</span>
          </span>
        </div>

        {/* Real-time Honest Status Alerts */}
        {isOffline && (
          <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-amber-300">LIVE offline</p>
              <p className="mt-0.5">
                {liveStatus?.errorMessage ||
                  statusFeedback ||
                  'Este perfil não está ao vivo no momento. Você precisa iniciar uma transmissão ao vivo no TikTok para conectar.'}
              </p>
            </div>
          </div>
        )}

        {isError && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-rose-300">Erro de conexão</p>
              <p className="mt-0.5">
                {liveStatus?.errorMessage ||
                  statusFeedback ||
                  'Não foi possível estabelecer conexão real com a TikTok LIVE.'}
              </p>
            </div>
          </div>
        )}

        {!isOffline && !isError && statusFeedback && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{statusFeedback}</span>
          </div>
        )}

        {isConnected && (
          <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Conexão real estabelecida! Recebendo comentários, curtidas, presentes e novos seguidores em tempo real.
              </span>
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-emerald-300 font-bold shrink-0">
              <Users className="w-3.5 h-3.5" />
              {liveStatus?.viewerCount || 0}
            </span>
          </div>
        )}

        {/* @ Input + Conectar à LIVE button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-3 text-purple-400 font-extrabold text-sm">@</span>
            <input
              type="text"
              placeholder="digite_seu_usuario_tiktok"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isConnecting}
              className="w-full pl-9 pr-4 py-3 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white text-sm"
            />
          </div>

          {isConnected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-6 py-3 rounded-xl bg-rose-600 text-white font-extrabold text-xs whitespace-nowrap"
            >
              Desconectar da LIVE
            </button>
          ) : (
            <button
              type="submit"
              disabled={isConnecting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-xs shadow-lg shadow-purple-600/30 whitespace-nowrap"
            >
              {isConnecting ? 'Conectando...' : 'Conectar à LIVE'}
            </button>
          )}
        </div>
      </form>

      {/* Real-time Event Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl glass-card p-4 border border-purple-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>Comentários</span>
            <MessageCircle className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{commentCount}</p>
        </div>

        <div className="rounded-2xl glass-card p-4 border border-purple-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>Curtidas</span>
            <Heart className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{likeCount}</p>
        </div>

        <div className="rounded-2xl glass-card p-4 border border-purple-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>Presentes</span>
            <Gift className="w-4 h-4 text-pink-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{giftCount}</p>
        </div>

        <div className="rounded-2xl glass-card p-4 border border-purple-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>Novos Seguidores</span>
            <UserPlus className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{followCount}</p>
        </div>
      </div>

      {/* Live Events Real-time Feed */}
      <div className="rounded-3xl glass-card p-6 border border-purple-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-white">
            Eventos em Tempo Real da TikTok LIVE
          </h2>
          <span className="text-[11px] text-slate-400">
            {isConnected ? 'Escutando transmissão ao vivo' : 'Conecte a uma LIVE ativa para receber eventos'}
          </span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {mergedEvents.map((ev, i) => (
            <div
              key={ev.id || i}
              className="p-3 rounded-xl bg-black/40 border border-purple-500/15 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {ev.type === 'gift' ? (
                  <Gift className="w-4 h-4 text-pink-400 shrink-0" />
                ) : ev.type === 'like' ? (
                  <Heart className="w-4 h-4 text-rose-400 shrink-0" />
                ) : ev.type === 'follow' ? (
                  <UserPlus className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : ev.type === 'share' ? (
                  <Share2 className="w-4 h-4 text-cyan-400 shrink-0" />
                ) : (
                  <MessageCircle className="w-4 h-4 text-purple-400 shrink-0" />
                )}

                <div className="min-w-0">
                  <strong className="text-white">{ev.user}</strong>{' '}
                  <span className="text-slate-300">
                    {ev.type === 'gift'
                      ? `enviou ${ev.count || 1}x ${ev.giftName || 'Presente'} (${ev.giftValue || 0} moedas)`
                      : ev.type === 'like'
                      ? `enviou ${ev.count || 1} curtidas`
                      : ev.type === 'follow'
                      ? 'começou a seguir o canal!'
                      : ev.type === 'member'
                      ? 'entrou na LIVE!'
                      : ev.type === 'share'
                      ? 'compartilhou a LIVE!'
                      : ev.comment || ''}
                  </span>
                </div>
              </div>

              <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                {new Date(ev.timestamp).toLocaleTimeString('pt-BR')}
              </span>
            </div>
          ))}

          {mergedEvents.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-500">
              {isConnected
                ? 'Conectado! Aguardando comentários, curtidas, presentes ou novos seguidores na sua LIVE...'
                : 'Inicie uma transmissão ao vivo no TikTok, digite seu @ acima e clique em "Conectar à LIVE".'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
