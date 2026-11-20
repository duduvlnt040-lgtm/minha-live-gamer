import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Users,
  MessageCircle,
  Heart,
  Gift,
  UserPlus,
  Share2,
  Copy,
  Gamepad2,
} from 'lucide-react';
import type { Game, LiveEvent, LiveStatus, User } from '../../types';

interface AdminTikTokLiveViewProps {
  user: User;
  games: Game[];
  liveStatus: LiveStatus | null;
  liveEvents: LiveEvent[];
  onConnectLive: (username: string) => Promise<void>;
  onDisconnectLive: () => Promise<void>;
  showToast: (msg: string) => void;
}

export const AdminTikTokLiveView: React.FC<AdminTikTokLiveViewProps> = ({
  user,
  games,
  liveStatus,
  liveEvents,
  onConnectLive,
  onDisconnectLive,
  showToast,
}) => {
  const [username, setUsername] = useState(
    liveStatus?.username || user.tiktokUsername || localStorage.getItem('tiktok_username') || ''
  );
  const [connecting, setConnecting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [historyEvents, setHistoryEvents] = useState<LiveEvent[]>([]);

  useEffect(() => {
    fetch('/api/live/recent-events?limit=50')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.events)) {
          setHistoryEvents(d.events.filter((ev: LiveEvent) => !ev.simulation));
        }
      })
      .catch(() => {});
  }, [user.id]);

  const mergedEvents = useMemo(() => {
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
    setFeedback('');

    const clean = username.trim().replace(/^@+/, '');
    if (!clean) {
      setFeedback('Digite seu @ do TikTok para conectar.');
      return;
    }

    setConnecting(true);
    try {
      localStorage.setItem('tiktok_username', clean);
      await onConnectLive(clean);
      showToast(`Conectado à LIVE de @${clean}!`);
    } catch (err: any) {
      setFeedback(err.message || 'Erro de conexão com a TikTok LIVE.');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setFeedback('');
    try {
      await onDisconnectLive();
      showToast('Desconectado da TikTok LIVE.');
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao desconectar.');
    }
  }

  const rawStatus = connecting ? 'connecting' : liveStatus?.status || 'disconnected';
  const isConnected = Boolean(liveStatus?.connected && rawStatus === 'connected');
  const isConnecting = rawStatus === 'connecting';
  const isOffline = rawStatus === 'offline';
  const isError = rawStatus === 'error';

  const statusPill = isConnected
    ? { label: 'Conectado', cls: 'success' }
    : isConnecting
    ? { label: 'Conectando', cls: 'warning' }
    : isOffline
    ? { label: 'LIVE offline', cls: 'warning' }
    : isError
    ? { label: 'Erro de conexão', cls: 'danger' }
    : { label: 'Desconectado', cls: 'neutral' };

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

  const publishedGames = games.filter((g) => Boolean(g.is_active));

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
          <Radio className="w-6 h-6 text-amber-400" />
          <span>Conectar TikTok LIVE</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Conecte diretamente sua conta proprietária ({user.email}) a uma transmissão ao vivo do TikTok e receba eventos em tempo real nos jogos e overlays.
        </p>
      </div>

      {/* Real Connection Control Card */}
      <form onSubmit={handleConnect} className="admin-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            {isConnected ? (
              <Wifi className="w-5 h-5 text-emerald-400" />
            ) : isConnecting ? (
              <Loader2 className="w-5 h-5 text-amber-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-slate-400" />
            )}
            <div>
              <p className="text-sm font-extrabold text-white">
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
                <p className="text-[11px] text-emerald-300 font-mono">
                  Sala #{liveStatus.roomId} · {liveStatus.viewerCount || 0} espectadores ao vivo
                </p>
              )}
            </div>
          </div>

          <span className={`admin-pill ${statusPill.cls}`}>{statusPill.label}</span>
        </div>

        {/* Honest Status Banners */}
        {isOffline && (
          <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-amber-300">LIVE offline</p>
              <p className="mt-0.5">
                {liveStatus?.errorMessage ||
                  feedback ||
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
                  feedback ||
                  'Não foi possível estabelecer conexão real com a TikTok LIVE.'}
              </p>
            </div>
          </div>
        )}

        {!isOffline && !isError && feedback && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
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

        {/* Input @ + Button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-2.5 text-amber-400 font-extrabold text-sm">@</span>
            <input
              type="text"
              placeholder="digite_seu_usuario_tiktok"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isConnecting}
              className="admin-input pl-9"
            />
          </div>

          {isConnected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="admin-btn-danger px-5"
            >
              Desconectar da LIVE
            </button>
          ) : (
            <button
              type="submit"
              disabled={isConnecting}
              className="admin-btn-primary px-6"
            >
              <Radio className="w-4 h-4" />
              {isConnecting ? 'Conectando...' : 'Conectar à LIVE'}
            </button>
          )}
        </div>
      </form>

      {/* Real-time Event Counters */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Comentários</span>
            <MessageCircle className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-white">{commentCount}</p>
        </div>
        <div className="admin-kpi-card">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Curtidas</span>
            <Heart className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-white">{likeCount}</p>
        </div>
        <div className="admin-kpi-card">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Presentes</span>
            <Gift className="w-4 h-4 text-pink-400" />
          </div>
          <p className="text-2xl font-black text-white">{giftCount}</p>
        </div>
        <div className="admin-kpi-card">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Novos Seguidores</span>
            <UserPlus className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white">{followCount}</p>
        </div>
      </div>

      {/* Live Events Feed + Quick Admin Overlay Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="admin-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Eventos Recebidos em Tempo Real
            </h3>
            <span className="text-[11px] text-slate-400">
              {isConnected ? 'Ao vivo agora' : 'Aguardando LIVE ativa'}
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {mergedEvents.map((ev, i) => (
              <div
                key={ev.id || i}
                className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/60 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {ev.type === 'gift' ? (
                    <Gift className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  ) : ev.type === 'like' ? (
                    <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  ) : ev.type === 'follow' ? (
                    <UserPlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : ev.type === 'share' ? (
                    <Share2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  ) : (
                    <MessageCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span className="truncate">
                    <strong className="text-white">{ev.user}</strong>{' '}
                    <span className="text-slate-300">
                      {ev.type === 'gift'
                        ? `enviou ${ev.count || 1}x ${ev.giftName || 'Presente'} (${ev.giftValue || 0} moedas)`
                        : ev.type === 'like'
                        ? `enviou ${ev.count || 1} curtidas`
                        : ev.type === 'follow'
                        ? 'começou a seguir!'
                        : ev.type === 'share'
                        ? 'compartilhou a LIVE!'
                        : ev.comment || ''}
                    </span>
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                  {new Date(ev.timestamp).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            ))}
            {mergedEvents.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-8">
                {isConnected
                  ? 'Conectado! Aguardando comentários, curtidas, presentes e novos seguidores...'
                  : 'Inicie uma transmissão no TikTok, informe seu @ e clique em "Conectar à LIVE".'}
              </p>
            )}
          </div>
        </div>

        {/* Admin Direct OBS Overlay URLs */}
        <div className="admin-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-amber-400" />
              Overlays OBS da Conta Admin
            </h3>
            <span className="admin-pill warning">Vitalício</span>
          </div>
          <p className="text-xs text-slate-400">
            Copie o link direto de qualquer jogo publicado para usar no OBS Studio ou TikTok LIVE Studio conectado à sua LIVE.
          </p>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {publishedGames.map((g) => {
              const overlayUrl = `${window.location.origin}/overlay/${g.id}/${user.id}`;
              return (
                <div
                  key={g.id}
                  className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/60 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{g.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{overlayUrl}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(overlayUrl);
                      showToast(`Link Overlay de "${g.name}" copiado!`);
                    }}
                    className="admin-btn-secondary shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    Copiar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
