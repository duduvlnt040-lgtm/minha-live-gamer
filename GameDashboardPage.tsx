import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  Copy,
  Maximize2,
  HelpCircle,
  Play,
  RotateCw,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  Bell,
  Zap,
  Layout,
  Music,
  Share2,
  Gift,
  Heart,
  MessageCircle,
  Plus,
  Trash2,
  ExternalLink,
  Check,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import type { Game, User, UserAccess, LiveStatus, LiveEvent, GameTrigger } from '../types';
import { ChecklistCard } from '../components/ChecklistCard';
import { GameMusicPanel } from '../components/GameMusicPanel';

interface GameDashboardPageProps {
  game: Game;
  user: User | null;
  access: UserAccess | null;
  liveStatus: LiveStatus | null;
  liveEvents?: LiveEvent[];
  onBack: () => void;
  onNavigateToSubscription: () => void;
  onConnectLive: (username: string) => Promise<void>;
  onDisconnectLive: () => Promise<void>;
  onSimulateEvent: (event: Partial<LiveEvent>) => Promise<void>;
}

export const GameDashboardPage: React.FC<GameDashboardPageProps> = ({
  game,
  user,
  access,
  liveStatus,
  liveEvents = [],
  onBack,
  onNavigateToSubscription,
  onConnectLive,
  onDisconnectLive,
  onSimulateEvent,
}) => {
  const [activeTab, setActiveTab] = useState<
    'ajustes' | 'interacao' | 'alertas' | 'gatilhos' | 'natela' | 'musica' | 'tiktok'
  >('ajustes');

  const [tiktokUsername, setTiktokUsername] = useState(
    liveStatus?.username || localStorage.getItem('tiktok_username') || ''
  );
  const [connecting, setConnecting] = useState(false);
  const [toast, setToast] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState('Salvo');
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [events, setEvents] = useState<LiveEvent[]>([]);

  // Game Settings (Isolated per user & game)
  const [settings, setSettings] = useState({
    cameraMode: 'auto',
    autoCamera: true,
    difficulty: 'normal',
    speed: 1.0,
    weddingPace: 1.0,
    minGiftValueDanca: 1,
    minGiftValueCoroacao: 20,
    likeGoal: 500,
    commentTriggerWord: '!dancar',
    alertGifts: true,
    alertComments: true,
    alertFollowers: true,
    alertDuration: 4,
    alertTheme: 'neon_purple',
    showScoreboard: true,
    showWeddingProgress: true,
    showRecentGifters: true,
    widgetPosition: 'top_right',
    bgmEnabled: true,
    bgmVolume: 70,
    sfxVolume: 85,
    coronationFanfare: true,
    ...game.userSettings,
  });

  // User Custom Triggers
  const [triggers, setTriggers] = useState<GameTrigger[]>(game.userTriggers || []);
  const [newTriggerName, setNewTriggerName] = useState('');
  const [newTriggerType, setNewTriggerType] = useState<'gift' | 'comment' | 'like'>('gift');
  const [newTriggerFilter, setNewTriggerFilter] = useState('');
  const [newTriggerAction, setNewTriggerAction] = useState('boost_speed');

  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastForwardedEventIdRef = useRef<string | null>(null);

  const rawLiveStatus = connecting ? 'connecting' : liveStatus?.status || 'disconnected';
  const isLiveConnected = Boolean(liveStatus?.connected && rawLiveStatus === 'connected');
  const overlayUrl = `${window.location.origin}/overlay/${game.id}/${user?.id || 1}`;

  // Forward incoming real TikTok LIVE WebSocket events directly to the preview iframe & event list
  useEffect(() => {
    if (!liveEvents.length) return;
    const newest = liveEvents[0];
    const evtKey = newest.id || `${newest.type}-${newest.timestamp}`;
    if (evtKey === lastForwardedEventIdRef.current) return;
    lastForwardedEventIdRef.current = evtKey;

    setEvents((prev) => [newest, ...prev].slice(0, 60));

    if (!newest.simulation && previewIframeRef.current?.contentWindow) {
      previewIframeRef.current.contentWindow.postMessage(
        { type: 'live:event', payload: newest },
        '*'
      );
      previewIframeRef.current.contentWindow.postMessage(
        { type: 'minha-live-games:event', payload: newest },
        '*'
      );
    }
  }, [liveEvents]);

  // Auto-Save settings with debouncing
  function updateSetting(key: string, value: any) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setAutoSaveStatus('Salvando...');

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        await fetch(`/api/games/${game.id}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        });
        setAutoSaveStatus('Todas as alterações salvas');
        setTimeout(() => setAutoSaveStatus('Salvo'), 2500);

        // Notify preview iframe of setting updates
        if (previewIframeRef.current?.contentWindow) {
          previewIframeRef.current.contentWindow.postMessage(
            { type: 'minha-live-games:settings', payload: next },
            '*'
          );
        }
      } catch {
        setAutoSaveStatus('Erro ao salvar');
      }
    }, 600);
  }

  // Handle TikTok Connect
  async function handleConnect() {
    if (!tiktokUsername.trim()) {
      showToast('Digite seu @ do TikTok antes de conectar.');
      return;
    }
    if (!access?.hasAccess) {
      onNavigateToSubscription();
      return;
    }

    setConnecting(true);
    try {
      localStorage.setItem('tiktok_username', tiktokUsername);
      await onConnectLive(tiktokUsername);
      showToast('Tentativa de conexão iniciada com a TikTok LIVE.');
    } catch (err: any) {
      showToast(err.message || 'Erro ao conectar à LIVE.');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await onDisconnectLive();
      showToast('LIVE desconectada.');
    } catch (err: any) {
      showToast(err.message || 'Erro ao desconectar.');
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  function copyOverlayLink() {
    navigator.clipboard.writeText(overlayUrl);
    showToast('Link do Overlay copiado para a área de transferência!');
  }

  // Trigger Creation
  async function handleAddTrigger() {
    if (!newTriggerName.trim()) return;
    const newTrig: Partial<GameTrigger> = {
      name: newTriggerName,
      event_type: newTriggerType,
      filter_value: newTriggerFilter,
      min_value: newTriggerType === 'gift' ? 10 : 1,
      action: newTriggerAction,
      duration: 5,
      is_active: 1,
    };

    try {
      const res = await fetch(`/api/games/${game.id}/triggers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrig),
      });
      const data = await res.json();
      if (data.ok) {
        setTriggers([...triggers, { ...newTrig, id: data.id } as GameTrigger]);
        setNewTriggerName('');
        setNewTriggerFilter('');
        showToast('Gatilho salvo com sucesso!');
      }
    } catch {
      showToast('Erro ao salvar gatilho.');
    }
  }

  async function handleDeleteTrigger(id: string) {
    try {
      await fetch(`/api/games/${game.id}/triggers/${id}`, { method: 'DELETE' });
      setTriggers(triggers.filter((t) => t.id !== id));
      showToast('Gatilho removido.');
    } catch {
      showToast('Erro ao remover gatilho.');
    }
  }

  // Forward live simulation event to backend and iframe
  async function triggerSimulation(type: string, extra: any = {}) {
    const event: Partial<LiveEvent> = {
      type: type as any,
      user: '@espectador_vip',
      timestamp: Date.now(),
      simulation: true,
      ...extra,
    };

    setEvents((prev) => [event as LiveEvent, ...prev].slice(0, 50));

    // Send to preview iframe directly
    if (previewIframeRef.current?.contentWindow) {
      previewIframeRef.current.contentWindow.postMessage(
        { type: 'live:event', payload: event },
        '*'
      );
      previewIframeRef.current.contentWindow.postMessage(
        { type: 'minha-live-games:event', payload: event },
        '*'
      );
    }

    try {
      await onSimulateEvent(event);
      showToast(`Evento de teste '${type}' executado.`);
    } catch (e) {
      // Direct local simulation fallback
    }
  }

  const gamePreviewSrc =
    game.type === 'link'
      ? game.entry_path
      : `/games/${game.directory}/${game.entry_path}?backend=1&preview=1`;

  return (
    <div className="min-h-screen bg-[#090614] text-white flex flex-col">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-purple-900/90 border border-purple-400 text-white font-bold text-xs shadow-2xl animate-bounce">
          {toast}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. FIXED TOP BAR (Reproduzindo o modelo do vídeo)       */}
      {/* ======================================================== */}
      <nav className="sticky top-0 z-40 w-full glass-panel border-b border-purple-500/25 bg-[#0e0a1f]/95 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        {/* Left: Back & Game Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 transition-all text-xs flex items-center gap-1 font-semibold"
          >
            ← Voltar
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white font-display flex items-center gap-2 leading-tight">
              {game.name}
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-300 border border-purple-500/30 uppercase font-bold">
                {game.category}
              </span>
            </h2>
          </div>
        </div>

        {/* Center: Live Status & TikTok Input & Connect */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Status Badge (Real Status Only) */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              isLiveConnected
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/20'
                : rawLiveStatus === 'connecting'
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                : rawLiveStatus === 'offline'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                : rawLiveStatus === 'error'
                ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                : 'bg-slate-900/70 border-slate-700/60 text-slate-300'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {isLiveConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLiveConnected
                    ? 'bg-emerald-500'
                    : rawLiveStatus === 'connecting' || rawLiveStatus === 'offline'
                    ? 'bg-amber-400'
                    : rawLiveStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-slate-500'
                }`}
              />
            </span>
            <span>
              {isLiveConnected
                ? 'Conectado'
                : rawLiveStatus === 'connecting'
                ? 'Conectando'
                : rawLiveStatus === 'offline'
                ? 'LIVE offline'
                : rawLiveStatus === 'error'
                ? 'Erro de conexão'
                : 'Desconectado'}
            </span>
          </div>

          {/* TikTok Username Input */}
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-purple-400 font-bold text-xs">@</span>
            <input
              type="text"
              placeholder="seu_tiktok"
              value={tiktokUsername}
              onChange={(e) => setTiktokUsername(e.target.value.replace(/^@/, ''))}
              disabled={isLiveConnected || rawLiveStatus === 'connecting'}
              className="w-32 sm:w-44 pl-7 pr-3 py-1.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:border-purple-400 disabled:opacity-60"
            />
          </div>

          {/* Connect / Disconnect Button */}
          {!isLiveConnected ? (
            <button
              onClick={handleConnect}
              disabled={connecting || rawLiveStatus === 'connecting'}
              className="px-4 py-1.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>{connecting || rawLiveStatus === 'connecting' ? 'Conectando...' : 'Conectar à LIVE'}</span>
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="px-4 py-1.5 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/30 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>DESCONECTAR</span>
            </button>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Simulation Dropdown */}
          <button
            onClick={() => triggerSimulation('gift', { giftName: 'Rosa', giftValue: 10 })}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-950/70 border border-purple-500/40 text-purple-300 hover:text-white hover:bg-purple-900/60 transition-all flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>TESTAR</span>
          </button>

          {/* Copy Overlay Link */}
          <button
            onClick={copyOverlayLink}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white shadow-sm shadow-purple-600/30 transition-all flex items-center gap-1"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">COPIAR LINK OVERLAY</span>
            <span className="sm:hidden">OVERLAY</span>
          </button>

          {/* Help Modal Button */}
          <button
            onClick={() => setHelpModalOpen(true)}
            className="p-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-slate-300 hover:text-white transition-all"
            title="Ajuda e Instruções"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* ======================================================== */}
      {/* 2. MAIN WORKSPACE: TWO COLUMN LAYOUT                    */}
      {/* ======================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ======================================== */}
        {/* LEFT COLUMN: REAL-TIME GAME PREVIEW (7 cols) */}
        {/* ======================================== */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          <div className="glass-card rounded-3xl p-3 sm:p-4 border border-purple-500/25 bg-[#100b24]/90 flex flex-col shadow-2xl">
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-purple-500/15 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-slate-200">Prévia em Tempo Real</span>
                <span className="text-[10px] text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-500/20">
                  9:16 Vertical Live
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1.5 rounded-lg bg-purple-950/60 text-slate-300 hover:text-white transition-all"
                  title={soundEnabled ? 'Silenciar Prévia' : 'Ativar Som da Prévia'}
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                <button
                  onClick={() => {
                    if (previewIframeRef.current) {
                      previewIframeRef.current.src = previewIframeRef.current.src;
                    }
                  }}
                  className="p-1.5 rounded-lg bg-purple-950/60 text-slate-300 hover:text-white transition-all"
                  title="Atualizar Prévia"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                <a
                  href={overlayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-purple-950/60 text-purple-300 hover:text-white transition-all flex items-center gap-1"
                  title="Abrir Overlay em Nova Aba"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Viewport Frame strictly preserving 9:16 ratio or responsive fit */}
            <div className="w-full flex justify-center items-center py-2 bg-[#080512] rounded-2xl overflow-hidden border border-purple-900/30">
              <div
                className="relative overflow-hidden rounded-xl shadow-2xl border border-purple-500/40 bg-black"
                style={{
                  width: 'min(100%, 360px)',
                  aspectRatio: '9/16',
                  height: 'min(640px, 75vh)',
                }}
              >
                <iframe
                  ref={previewIframeRef}
                  src={gamePreviewSrc}
                  className="w-full h-full border-none select-none"
                  allow="autoplay; fullscreen"
                  title="Game Live Preview"
                />
              </div>
            </div>

            {/* Quick Test Bar directly below preview */}
            <div className="mt-4 pt-3 border-t border-purple-500/15 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-400">
                Disparar simulação instantânea:
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => triggerSimulation('gift', { giftName: 'Rosa', giftValue: 1 })}
                  className="px-2.5 py-1 rounded-lg bg-pink-950/60 border border-pink-500/30 text-pink-300 hover:bg-pink-900/60 text-[11px] font-bold transition-all flex items-center gap-1"
                >
                  <Gift className="w-3 h-3" />
                  <span>1 Rosa</span>
                </button>

                <button
                  onClick={() =>
                    triggerSimulation('gift', { giftName: 'Coroa Dourada', giftValue: 50 })
                  }
                  className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-300 hover:bg-amber-900/60 text-[11px] font-bold transition-all flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>50 Moedas (Coroação)</span>
                </button>

                <button
                  onClick={() =>
                    triggerSimulation('comment', { comment: settings.commentTriggerWord || '!dancar' })
                  }
                  className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-300 hover:bg-purple-900/60 text-[11px] font-bold transition-all flex items-center gap-1"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>{settings.commentTriggerWord || '!dancar'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Checklist Card */}
          <ChecklistCard
            tiktokUsername={tiktokUsername}
            liveStatus={liveStatus}
            eventsCount={events.length + (liveStatus?.totalEvents || 0)}
            overlayActive={Boolean((liveStatus?.activeOverlayCount ?? 0) > 0)}
            onOpenOverlay={() => window.open(overlayUrl, '_blank')}
          />
        </section>

        {/* ======================================== */}
        {/* RIGHT COLUMN: 7-TAB CONFIGURATION PANEL  */}
        {/* ======================================== */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          <div className="glass-card rounded-3xl p-4 sm:p-5 border border-purple-500/25 bg-[#120d28]/90 flex flex-col shadow-2xl flex-1">
            {/* Header & AutoSave Indicator */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-purple-500/15">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <h3 className="font-extrabold text-sm text-slate-100 font-display">
                  Painel de Configurações
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-purple-300/80 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{autoSaveStatus}</span>
              </div>
            </div>

            {/* Tab Navigation (7 Tabs inspiradas no vídeo) */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-purple-950/40 border border-purple-500/20 mb-4 text-xs font-bold">
              <button
                onClick={() => setActiveTab('ajustes')}
                className={`py-2 px-1 rounded-xl transition-all text-center ${
                  activeTab === 'ajustes'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ajustes
              </button>
              <button
                onClick={() => setActiveTab('interacao')}
                className={`py-2 px-1 rounded-xl transition-all text-center ${
                  activeTab === 'interacao'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Interação
              </button>
              <button
                onClick={() => setActiveTab('alertas')}
                className={`py-2 px-1 rounded-xl transition-all text-center ${
                  activeTab === 'alertas'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Alertas
              </button>
              <button
                onClick={() => setActiveTab('gatilhos')}
                className={`py-2 px-1 rounded-xl transition-all text-center ${
                  activeTab === 'gatilhos'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Gatilhos
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-purple-950/40 border border-purple-500/20 mb-5 text-xs font-bold">
              <button
                onClick={() => setActiveTab('natela')}
                className={`py-2 px-1 rounded-xl transition-all text-center ${
                  activeTab === 'natela'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Na Tela
              </button>
              <button
                onClick={() => setActiveTab('musica')}
                className={`py-2 px-1 rounded-xl transition-all text-center ${
                  activeTab === 'musica'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Música
              </button>
              <button
                onClick={() => setActiveTab('tiktok')}
                className={`py-2 px-1 rounded-xl transition-all text-center flex items-center justify-center gap-1 ${
                  activeTab === 'tiktok'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3 h-3 text-emerald-400" />
                <span>TikTok</span>
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
              {/* ===================================== */}
              {/* TAB 1: AJUSTES                        */}
              {/* ===================================== */}
              {activeTab === 'ajustes' && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Modo de Câmera 3D
                    </label>
                    <select
                      value={settings.cameraMode}
                      onChange={(e) => updateSetting('cameraMode', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white focus:outline-none focus:border-purple-400"
                    >
                      <option value="auto">Câmera Automática Dinâmica</option>
                      <option value="front">Visão Frontal do Altar</option>
                      <option value="orbit">Órbita do Salão de Festas</option>
                      <option value="top">Visão Superior Aérea</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/30 border border-purple-500/20">
                    <div>
                      <p className="font-bold text-slate-200">Alternar Câmera em Eventos</p>
                      <p className="text-[10px] text-slate-400">
                        Aproxima automaticamente dos noivos quando receber presentes
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoCamera}
                      onChange={(e) => updateSetting('autoCamera', e.target.checked)}
                      className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-slate-300 mb-1">
                      <span>Velocidade da Cerimônia / Dança</span>
                      <span className="text-purple-400 font-bold">{settings.weddingPace}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={settings.weddingPace}
                      onChange={(e) => updateSetting('weddingPace', parseFloat(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Nível de Dificuldade / Agitação
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['tranquilo', 'normal', 'frenetico'].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => updateSetting('difficulty', d)}
                          className={`py-2 rounded-xl border text-center font-bold capitalize transition-all ${
                            settings.difficulty === d
                              ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-sm'
                              : 'bg-purple-950/20 border-purple-500/20 text-slate-400 hover:text-white'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================== */}
              {/* TAB 2: INTERAÇÃO                      */}
              {/* ===================================== */}
              {activeTab === 'interacao' && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Moedas Mínimas para Dança Coletiva
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={settings.minGiftValueDanca}
                      onChange={(e) =>
                        updateSetting('minGiftValueDanca', parseInt(e.target.value) || 1)
                      }
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white focus:outline-none focus:border-purple-400"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Qualquer presente de valor igual ou maior dispara a festa dos convidados.
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Moedas para Coroação da Noiva (VIP)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="10000"
                      value={settings.minGiftValueCoroacao}
                      onChange={(e) =>
                        updateSetting('minGiftValueCoroacao', parseInt(e.target.value) || 20)
                      }
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white focus:outline-none focus:border-purple-400"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Presente especial que coroa a noiva e dispara chuva de confetes dourados.
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Palavra-Chave no Chat para Ação do Personagem
                    </label>
                    <input
                      type="text"
                      value={settings.commentTriggerWord}
                      onChange={(e) => updateSetting('commentTriggerWord', e.target.value)}
                      placeholder="!dancar ou !casar"
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white focus:outline-none focus:border-purple-400 font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-slate-300 mb-1">
                      <span>Meta de Curtidas para Chuva de Fogos</span>
                      <span className="text-purple-400 font-bold">{settings.likeGoal} likes</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="5000"
                      step="100"
                      value={settings.likeGoal}
                      onChange={(e) => updateSetting('likeGoal', parseInt(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* ===================================== */}
              {/* TAB 3: ALERTAS                        */}
              {/* ===================================== */}
              {activeTab === 'alertas' && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/30 border border-purple-500/20">
                    <div>
                      <p className="font-bold text-slate-200">Alertas de Presentes</p>
                      <p className="text-[10px] text-slate-400">
                        Banner animado no topo quando receber presente
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.alertGifts}
                      onChange={(e) => updateSetting('alertGifts', e.target.checked)}
                      className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/30 border border-purple-500/20">
                    <div>
                      <p className="font-bold text-slate-200">Alertas de Novos Seguidores</p>
                      <p className="text-[10px] text-slate-400">
                        Notificação quando alguém seguir sua live
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.alertFollowers}
                      onChange={(e) => updateSetting('alertFollowers', e.target.checked)}
                      className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-slate-300 mb-1">
                      <span>Duração do Alerta na Tela</span>
                      <span className="text-purple-400 font-bold">{settings.alertDuration}s</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      value={settings.alertDuration}
                      onChange={(e) => updateSetting('alertDuration', parseInt(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Tema Visual dos Alertas
                    </label>
                    <select
                      value={settings.alertTheme}
                      onChange={(e) => updateSetting('alertTheme', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white focus:outline-none focus:border-purple-400"
                    >
                      <option value="neon_purple">Neon Roxo &amp; Dourado (Padrão)</option>
                      <option value="cyberpunk">Cyberpunk Azul &amp; Rosa</option>
                      <option value="minimal">Minimalista Escuro</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ===================================== */}
              {/* TAB 4: GATILHOS PERSONALIZADOS        */}
              {/* ===================================== */}
              {activeTab === 'gatilhos' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30">
                    <h4 className="font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Criar Novo Gatilho</span>
                    </h4>

                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Nome do Gatilho (ex: Coroa Real)"
                        value={newTriggerName}
                        onChange={(e) => setNewTriggerName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-400"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newTriggerType}
                          onChange={(e: any) => setNewTriggerType(e.target.value)}
                          className="px-2.5 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white text-xs"
                        >
                          <option value="gift">Presente TikTok</option>
                          <option value="comment">Comentário</option>
                          <option value="like">Curtidas</option>
                        </select>

                        <select
                          value={newTriggerAction}
                          onChange={(e) => setNewTriggerAction(e.target.value)}
                          className="px-2.5 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white text-xs"
                        >
                          <option value="boost_speed">Acelerar Dança</option>
                          <option value="crown_bride">Coroar Noiva</option>
                          <option value="confetti_burst">Chuva de Confetes</option>
                          <option value="wedding_fanfare">Tocar Fanfarra</option>
                        </select>
                      </div>

                      <input
                        type="text"
                        placeholder={
                          newTriggerType === 'gift'
                            ? 'Nome do Presente (ou deixe vazio para qualquer)'
                            : 'Palavra-chave (ex: !festa)'
                        }
                        value={newTriggerFilter}
                        onChange={(e) => setNewTriggerFilter(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono"
                      />

                      <button
                        type="button"
                        onClick={handleAddTrigger}
                        className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/30 transition-all active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar Gatilho</span>
                      </button>
                    </div>
                  </div>

                  {/* Triggers List */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Gatilhos Configurados ({triggers.length})
                    </p>
                    {triggers.map((trig) => (
                      <div
                        key={trig.id}
                        className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/20 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-slate-200">{trig.name}</p>
                          <p className="text-[10px] text-purple-300/70 font-mono">
                            {trig.event_type} {trig.filter_value ? `(${trig.filter_value})` : ''} →{' '}
                            {trig.action}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteTrigger(trig.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-950/40 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {triggers.length === 0 && (
                      <p className="text-[11px] text-slate-500 text-center py-2">
                        Nenhum gatilho personalizado adicionado.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ===================================== */}
              {/* TAB 5: NA TELA (OVERLAY ELEMENTS)     */}
              {/* ===================================== */}
              {activeTab === 'natela' && (
                <div className="space-y-3.5 animate-fadeIn">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/30 border border-purple-500/20">
                    <div>
                      <p className="font-bold text-slate-200">Placar de Maiores Apoiadores</p>
                      <p className="text-[10px] text-slate-400">
                        Exibe ranking dos espectadores que enviaram mais presentes
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.showScoreboard}
                      onChange={(e) => updateSetting('showScoreboard', e.target.checked)}
                      className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/30 border border-purple-500/20">
                    <div>
                      <p className="font-bold text-slate-200">Barra de Progresso da Cerimônia</p>
                      <p className="text-[10px] text-slate-400">
                        Mostra o avanço rumo ao grande casamento
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.showWeddingProgress}
                      onChange={(e) => updateSetting('showWeddingProgress', e.target.checked)}
                      className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Posição dos Elementos na Tela
                    </label>
                    <select
                      value={settings.widgetPosition}
                      onChange={(e) => updateSetting('widgetPosition', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white focus:outline-none focus:border-purple-400"
                    >
                      <option value="top_right">Canto Superior Direito</option>
                      <option value="top_left">Canto Superior Esquerdo</option>
                      <option value="bottom_right">Canto Inferior Direito</option>
                      <option value="bottom_left">Canto Inferior Esquerdo</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ===================================== */}
              {/* TAB 6: MÚSICA & ÁUDIO                 */}
              {/* ===================================== */}
              {activeTab === 'musica' && (
                <div className="space-y-4 animate-fadeIn">
                  <GameMusicPanel gameId={game.id} user={user} onToast={showToast} />

                  <div className="pt-3 border-t border-purple-500/20 space-y-3">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Efeitos Sonoros do Jogo (SFX)
                    </p>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-300 mb-1">
                        <span>Volume dos Efeitos Sonoros (SFX)</span>
                        <span className="text-purple-400 font-bold">{settings.sfxVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.sfxVolume}
                        onChange={(e) => updateSetting('sfxVolume', parseInt(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/30 border border-purple-500/20">
                      <div>
                        <p className="font-bold text-slate-200">Fanfarra de Comemoração</p>
                        <p className="text-[10px] text-slate-400">Tocar ao atingir marcos da live</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.coronationFanfare}
                        onChange={(e) => updateSetting('coronationFanfare', e.target.checked)}
                        className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ===================================== */}
              {/* TAB 7: TIKTOK LIVE & EVENT LOGS       */}
              {/* ===================================== */}
              {activeTab === 'tiktok' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Connection Diagnostic Card */}
                  <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/25 space-y-2">
                    <p className="font-bold text-slate-200 flex items-center justify-between">
                      <span>Conectar TikTok LIVE</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isLiveConnected
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : rawLiveStatus === 'connecting' || rawLiveStatus === 'offline'
                            ? 'bg-amber-500/20 text-amber-300'
                            : rawLiveStatus === 'error'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isLiveConnected
                          ? 'Conectado'
                          : rawLiveStatus === 'connecting'
                          ? 'Conectando'
                          : rawLiveStatus === 'offline'
                          ? 'LIVE offline'
                          : rawLiveStatus === 'error'
                          ? 'Erro de conexão'
                          : 'Desconectado'}
                      </span>
                    </p>
                    {liveStatus?.errorMessage && !isLiveConnected && (
                      <p className="text-[11px] p-2 rounded-lg bg-amber-950/50 border border-amber-500/30 text-amber-200">
                        {liveStatus.errorMessage}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-300">
                      Canal Alvo:{' '}
                      <strong className="text-purple-300">
                        {tiktokUsername ? `@${tiktokUsername}` : 'Não informado'}
                      </strong>
                    </p>
                    {isLiveConnected && liveStatus?.roomId && (
                      <p className="text-[11px] text-emerald-300 font-mono">
                        Sala #{liveStatus.roomId} · {liveStatus.viewerCount || 0} espectadores
                      </p>
                    )}
                    <p className="text-[11px] text-slate-300">
                      Total de Eventos Recebidos:{' '}
                      <strong className="text-purple-300">
                        {liveStatus?.totalEvents || events.length}
                      </strong>
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Overlays Conectados:{' '}
                      <strong className="text-purple-300">
                        {liveStatus?.activeOverlayCount || 0}
                      </strong>
                    </p>
                  </div>

                  {/* Real-time event log */}
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Últimos Eventos Recebidos
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-black/40 border border-purple-950">
                      {events.slice(0, 15).map((evt, idx) => (
                        <div
                          key={idx}
                          className="p-1.5 rounded-lg bg-purple-950/30 border border-purple-500/15 flex items-center justify-between text-[11px]"
                        >
                          <div className="flex items-center gap-1.5">
                            {evt.type === 'gift' ? (
                              <Gift className="w-3.5 h-3.5 text-pink-400" />
                            ) : evt.type === 'like' ? (
                              <Heart className="w-3.5 h-3.5 text-rose-400" />
                            ) : (
                              <MessageCircle className="w-3.5 h-3.5 text-purple-400" />
                            )}
                            <span className="font-bold text-white">{evt.user}:</span>
                            <span className="text-slate-300 truncate max-w-[150px]">
                              {evt.giftName
                                ? `${evt.count || 1}x ${evt.giftName} (${evt.giftValue || 0} moedas)`
                                : evt.comment || 'Ação'}
                            </span>
                          </div>
                          {evt.simulation && (
                            <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold">
                              TESTE
                            </span>
                          )}
                        </div>
                      ))}
                      {events.length === 0 && (
                        <p className="text-[11px] text-slate-500 text-center py-4">
                          Aguardando o primeiro evento da sua live...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ======================================================== */}
      {/* 3. HELP & INSTRUCTIONS MODAL                             */}
      {/* ======================================================== */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-3xl glass-card bg-[#140e2c] border border-purple-500/40 p-6 sm:p-8 shadow-2xl text-white">
            <h3 className="text-xl font-black font-display mb-3 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-purple-400" />
              <span>Como usar o jogo no OBS / TikTok Studio</span>
            </h3>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/20">
                <p className="font-bold text-purple-200 mb-1">Passo 1: Copie o link do Overlay</p>
                <p>
                  Clique no botão roxo <strong>COPIAR LINK OVERLAY</strong> na barra superior. Esse link é exclusivo para a sua conta e para este jogo.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/20">
                <p className="font-bold text-purple-200 mb-1">
                  Passo 2: Adicione no OBS ou TikTok LIVE Studio
                </p>
                <p>
                  No seu programa de transmissão, adicione uma nova fonte do tipo <strong>Navegador (Browser Source)</strong>, cole o link e defina a resolução para <strong>1080 x 1920</strong> (formato vertical 9:16) ou ajuste para preencher sua tela.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/20">
                <p className="font-bold text-purple-200 mb-1">Passo 3: Conecte sua LIVE</p>
                <p>
                  Digite seu <strong>@ do TikTok</strong> e clique em <strong>CONECTAR LIVE</strong>. Assim que sua live estiver aberta e pessoas começarem a interagir, o jogo responderá automaticamente!
                </p>
              </div>
            </div>

            <button
              onClick={() => setHelpModalOpen(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all"
            >
              Entendi, fechar instruções
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
