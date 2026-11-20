import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Gamepad2,
  PlusCircle,
  Library,
  Music,
  Users,
  Crown,
  CreditCard,
  Webhook,
  Cpu,
  Settings,
  ScrollText,
  ShieldCheck,
  LogOut,
  Eye,
  Edit,
  Trash2,
  RotateCw,
  Copy,
  Check,
  X,
  Upload,
  Clock,
  DollarSign,
  Radio,
  AlertTriangle,
  Search,
  Sparkles,
  ExternalLink,
  Ban,
  CheckCircle2,
  Menu,
  Save,
} from 'lucide-react';
import type {
  Game,
  User,
  AdminMetrics,
  CaktoConfig,
  GlobalMusic,
  AdminSubscriptionItem,
  AdminPaymentItem,
  AuditLogItem,
  PlatformSettings,
  DatabaseStatus,
  LiveStatus,
  LiveEvent,
} from '../types';
import { AdminAddGameView } from '../components/admin/AdminAddGameView';
import { AdminMusicView } from '../components/admin/AdminMusicView';
import { AdminTikTokLiveView } from '../components/admin/AdminTikTokLiveView';
import { getMediaUrl } from '../lib/api';

type AdminSection =
  | 'overview'
  | 'tiktok_live'
  | 'manage_games'
  | 'add_game'
  | 'global_library'
  | 'music'
  | 'users'
  | 'subscriptions'
  | 'payments'
  | 'cakto'
  | 'apis'
  | 'general'
  | 'logs'
  | 'security';

interface AdminPageProps {
  user: User | null;
  liveStatus: LiveStatus | null;
  liveEvents: LiveEvent[];
  onConnectLive: (username: string) => Promise<void>;
  onDisconnectLive: () => Promise<void>;
  onViewAsStreamer: () => void;
  onLogout: () => void;
  onGamesChanged: () => Promise<void>;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  user,
  liveStatus,
  liveEvents,
  onConnectLive,
  onDisconnectLive,
  onViewAsStreamer,
  onLogout,
  onGamesChanged,
}) => {
  const [section, setSection] = useState<AdminSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [musicTracks, setMusicTracks] = useState<GlobalMusic[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionItem[]>([]);
  const [payments, setPayments] = useState<AdminPaymentItem[]>([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [securityData, setSecurityData] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [testingDb, setTestingDb] = useState(false);
  const [caktoData, setCaktoData] = useState<{
    config: CaktoConfig;
    webhookUrl: string;
    recentEvents: any[];
    recentPayments: any[];
  } | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    platformName: 'MINHA LIVE GAME',
    supportEmail: 'suporte@minhalivegame.com',
    maintenanceMode: false,
    trialHours: 72,
    subscriptionPrice: 49.99,
    tiktokPollingInterval: 1000,
    tiktokConnectorEnabled: true,
    supabaseUrl: '',
    allowUserMusicUpload: true,
    maxUserMusicSizeMb: 50,
  });

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Preview modal for existing game
  const [previewGame, setPreviewGame] = useState<Game | null>(null);

  // Edit / update files modal for existing game
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editZipFile, setEditZipFile] = useState<File | null>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editThumbFile, setEditThumbFile] = useState<File | null>(null);
  const [savingGame, setSavingGame] = useState(false);

  useEffect(() => {
    refreshAll();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3800);
  }

  async function refreshAll() {
    setLoading(true);
    try {
      const [
        mRes,
        gRes,
        musRes,
        uRes,
        subRes,
        payRes,
        caktoRes,
        setRes,
        logRes,
        secRes,
        dbRes,
      ] = await Promise.all([
        fetch('/api/admin/metrics').then((r) => r.json()),
        fetch('/api/games').then((r) => r.json()),
        fetch('/api/admin/music').then((r) => r.json()),
        fetch('/api/admin/users').then((r) => r.json()),
        fetch('/api/admin/subscriptions').then((r) => r.json()),
        fetch('/api/admin/payments').then((r) => r.json()),
        fetch('/api/admin/cakto').then((r) => r.json()),
        fetch('/api/admin/settings').then((r) => r.json()),
        fetch('/api/admin/logs?limit=150').then((r) => r.json()),
        fetch('/api/admin/security').then((r) => r.json()),
        fetch('/api/admin/database-status').then((r) => r.json()),
      ]);

      if (!mRes.error) setMetrics(mRes);
      if (gRes.games) setGames(gRes.games);
      if (musRes.tracks) setMusicTracks(musRes.tracks);
      if (uRes.users) setUsersList(uRes.users);
      if (subRes.subscriptions) setSubscriptions(subRes.subscriptions);
      if (payRes.payments) {
        setPayments(payRes.payments);
        setPaymentsTotal(payRes.totalApproved || 0);
      }
      if (caktoRes.config) setCaktoData(caktoRes);
      if (setRes.settings) setPlatformSettings((prev) => ({ ...prev, ...setRes.settings }));
      if (logRes.logs) setLogs(logRes.logs);
      if (secRes.policies) setSecurityData(secRes);
      if (dbRes.sqlite) setDbStatus(dbRes);
    } catch {
      showToast('Erro ao carregar dados administrativos.');
    } finally {
      setLoading(false);
    }
  }

  // Strict frontend double-check (backend already returns 403)
  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#060911]">
        <div className="admin-card max-w-md w-full text-center space-y-4">
          <ShieldCheck className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-xl font-black text-white">Acesso Restrito ao Administrador</h2>
          <p className="text-xs text-slate-400">
            Esta área é exclusiva do proprietário da plataforma Minha Live Game.
          </p>
          <button onClick={onViewAsStreamer} className="admin-btn-primary w-full">
            Voltar ao Painel do Usuário
          </button>
        </div>
      </div>
    );
  }

  function formatDate(ts?: number | null) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatBRL(val?: number | null) {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  async function handleSaveGameEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGame) return;
    setSavingGame(true);
    try {
      const fd = new FormData();
      fd.append('name', editingGame.name);
      fd.append('description', editingGame.description || '');
      fd.append('category', editingGame.category);
      fd.append('version', editingGame.version || '1.0.0');
      fd.append('isActive', String(Boolean(editingGame.is_active)));
      if (editZipFile) fd.append('zipFile', editZipFile);
      if (editCoverFile) fd.append('coverFile', editCoverFile);
      if (editThumbFile) fd.append('thumbnailFile', editThumbFile);

      const res = await fetch(`/api/admin/games/${editingGame.id}/update-files`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar jogo.');

      await fetch(`/api/admin/games/${editingGame.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_featured: editingGame.is_featured ? 1 : 0,
          order_index: Number(editingGame.order_index || 0),
        }),
      });

      showToast('Jogo atualizado na Biblioteca Global (configurações dos usuários preservadas)!');
      setEditingGame(null);
      setEditZipFile(null);
      setEditCoverFile(null);
      setEditThumbFile(null);
      await refreshAll();
      await onGamesChanged();
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setSavingGame(false);
    }
  }

  async function handleToggleGameStatus(game: Game) {
    try {
      const next = game.is_active ? 0 : 1;
      const res = await fetch(`/api/admin/games/${game.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      });
      if (!res.ok) throw new Error('Falha ao atualizar status do jogo.');
      showToast(next ? `Jogo "${game.name}" publicado globalmente!` : `Jogo "${game.name}" desativado.`);
      await refreshAll();
      await onGamesChanged();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleDeleteGame(game: Game) {
    if (!window.confirm(`Tem certeza que deseja excluir o jogo "${game.name}" da biblioteca global?`)) return;
    try {
      const res = await fetch(`/api/admin/games/${game.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir jogo.');
      showToast(`Jogo "${game.name}" excluído.`);
      await refreshAll();
      await onGamesChanged();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleUserAction(userId: number, action: 'suspend' | 'reactivate' | 'grant-subscription') {
    try {
      const res = await fetch(`/api/admin/users/${userId}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao executar ação.');
      showToast(
        action === 'suspend'
          ? 'Usuário suspenso e sessões encerradas.'
          : action === 'reactivate'
          ? 'Usuário reativado com sucesso.'
          : 'Assinatura Premium (30 dias) concedida manualmente!'
      );
      await refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleCancelSubscription(subId: string) {
    if (!window.confirm('Deseja cancelar esta assinatura ativa?')) return;
    try {
      const res = await fetch(`/api/admin/subscriptions/${subId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Erro ao cancelar assinatura.');
      showToast('Assinatura cancelada.');
      await refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleSaveCakto(e: React.FormEvent) {
    e.preventDefault();
    if (!caktoData) return;
    try {
      const res = await fetch('/api/admin/cakto', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caktoData.config),
      });
      if (!res.ok) throw new Error('Falha ao salvar configurações da Cakto.');
      showToast('Configurações da Cakto salvas com sucesso!');
      await refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(platformSettings),
      });
      if (!res.ok) throw new Error('Falha ao salvar configurações.');
      showToast('Configurações da plataforma atualizadas!');
      await refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleRevokeSessions(userId: number) {
    try {
      const res = await fetch(`/api/admin/security/revoke-sessions/${userId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao revogar sessões.');
      showToast('Sessões do usuário revogadas!');
      await refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  function getGamePreviewSrc(g: Game) {
    return g.type === 'link' ? g.entry_path : getMediaUrl(`/games/${g.directory}/${g.entry_path}`);
  }

  const navItems: Array<{
    id: AdminSection;
    label: string;
    icon: React.FC<{ className?: string }>;
    group: string;
  }> = [
    { id: 'overview', label: 'Visão geral', icon: LayoutDashboard, group: 'PRINCIPAL' },
    { id: 'tiktok_live', label: 'Conectar TikTok LIVE', icon: Radio, group: 'PRINCIPAL' },
    { id: 'manage_games', label: 'Gerenciar jogos', icon: Gamepad2, group: 'CATÁLOGO GLOBAL' },
    { id: 'add_game', label: 'Adicionar jogo', icon: PlusCircle, group: 'CATÁLOGO GLOBAL' },
    { id: 'global_library', label: 'Biblioteca global', icon: Library, group: 'CATÁLOGO GLOBAL' },
    { id: 'music', label: 'Gerenciar músicas', icon: Music, group: 'CATÁLOGO GLOBAL' },
    { id: 'users', label: 'Usuários', icon: Users, group: 'CLIENTES & RECEITA' },
    { id: 'subscriptions', label: 'Assinaturas', icon: Crown, group: 'CLIENTES & RECEITA' },
    { id: 'payments', label: 'Pagamentos', icon: CreditCard, group: 'CLIENTES & RECEITA' },
    { id: 'cakto', label: 'Configurações da Cakto', icon: Webhook, group: 'INTEGRAÇÕES & SISTEMA' },
    { id: 'apis', label: 'Configurações de APIs', icon: Cpu, group: 'INTEGRAÇÕES & SISTEMA' },
    { id: 'general', label: 'Configurações gerais', icon: Settings, group: 'INTEGRAÇÕES & SISTEMA' },
    { id: 'logs', label: 'Logs e atividades', icon: ScrollText, group: 'AUDITORIA & SEGURANÇA' },
    { id: 'security', label: 'Segurança', icon: ShieldCheck, group: 'AUDITORIA & SEGURANÇA' },
  ];

  const groups = ['PRINCIPAL', 'CATÁLOGO GLOBAL', 'CLIENTES & RECEITA', 'INTEGRAÇÕES & SISTEMA', 'AUDITORIA & SEGURANÇA'];

  const filteredUsers = usersList.filter(
    (u) =>
      !searchQuery ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLogs = logs.filter(
    (l) =>
      !searchQuery ||
      l.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.details || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-shell">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl bg-amber-500 text-black font-extrabold text-xs shadow-2xl flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* SIDEBAR FIXA (14 ITENS: 13 SEÇÕES + SAIR) */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="flex items-center justify-between">
            <div className="admin-brand-badge">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Vitalício</span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="sm:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <h1 className="text-base font-black text-white mt-3 tracking-tight">
            PAINEL ADMINISTRATIVO
          </h1>
          <p className="text-[11px] font-bold text-amber-400 tracking-wider">
            MINHA LIVE GAME
          </p>
        </div>

        <nav className="admin-nav">
          {groups.map((grp) => (
            <div key={grp}>
              <p className="admin-nav-section-label">{grp}</p>
              {navItems
                .filter((i) => i.group === grp)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSection(item.id);
                        setSearchQuery('');
                        setSidebarOpen(false);
                      }}
                      className={`admin-nav-item ${section === item.id ? 'active' : ''}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
            </div>
          ))}

          {/* Item 14: Sair */}
          <div className="mt-4 pt-3 border-t border-slate-700/60">
            <button
              type="button"
              onClick={onLogout}
              className="admin-nav-item danger"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sair</span>
            </button>
          </div>
        </nav>

        {/* Owner Footer */}
        <div className="p-3 border-t border-slate-700/60 bg-slate-900/70">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            Proprietário Conectado
          </p>
          <p className="text-xs font-bold text-white truncate mt-0.5">{user.email}</p>
          <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
            Plano Vitalício · Sem Limites
          </p>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="admin-main">
        {/* Executive Topbar */}
        <header className="admin-topbar">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="admin-btn-secondary sm:hidden"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div>
              <p className="text-xs font-black text-amber-400 tracking-wider uppercase">
                PAINEL ADMINISTRATIVO — MINHA LIVE GAME
              </p>
              <p className="text-[11px] text-slate-400">
                Controle global de jogos, músicas, assinaturas (R$ 49,99/mês), Cakto e segurança
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSection('tiktok_live')}
              className="admin-btn-secondary"
              title="Conectar TikTok LIVE na conta do administrador"
            >
              <Radio
                className={`w-3.5 h-3.5 ${
                  liveStatus?.connected
                    ? 'text-emerald-400'
                    : liveStatus?.status === 'connecting' || liveStatus?.status === 'offline'
                    ? 'text-amber-400'
                    : liveStatus?.status === 'error'
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              />
              <span>
                {liveStatus?.connected
                  ? `LIVE: @${liveStatus.username}`
                  : liveStatus?.status === 'connecting'
                  ? 'Conectando...'
                  : liveStatus?.status === 'offline'
                  ? 'LIVE offline'
                  : liveStatus?.status === 'error'
                  ? 'Erro TikTok'
                  : 'Conectar TikTok LIVE'}
              </span>
            </button>

            <button
              type="button"
              onClick={refreshAll}
              className="admin-btn-secondary"
              title="Atualizar dados reais do banco"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Atualizar</span>
            </button>

            <button
              type="button"
              onClick={onViewAsStreamer}
              className="admin-btn-primary"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver como Streamer</span>
            </button>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <main className="admin-content">
          {loading && !metrics ? (
            <div className="admin-card text-center py-16 text-slate-400 text-sm">
              Carregando métricas reais do banco de dados...
            </div>
          ) : (
            <>
              {/* ====================================================== */}
              {/* 1. VISÃO GERAL (DASHBOARD ADMINISTRATIVO)              */}
              {/* ====================================================== */}
              {section === 'overview' && metrics && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-white">Visão Geral da Plataforma</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Métricas em tempo real consultadas diretamente do banco de dados.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSection('add_game')}
                        className="admin-btn-primary"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Adicionar Novo Jogo
                      </button>
                      <button
                        type="button"
                        onClick={() => setSection('music')}
                        className="admin-btn-secondary"
                      >
                        <Music className="w-4 h-4 text-amber-400" />
                        Adicionar Música Global
                      </button>
                    </div>
                  </div>

                  {/* 8 KPI Cards */}
                  <div className="admin-kpi-grid">
                    <div className="admin-kpi-card">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">Usuários Cadastrados</span>
                        <Users className="w-4 h-4 text-cyan-400" />
                      </div>
                      <p className="text-3xl font-black text-white">{metrics.totalUsers}</p>
                      <span className="text-[11px] text-slate-400">Streamers registrados (excl. admin)</span>
                    </div>

                    <div className="admin-kpi-card">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">Em Teste Gratuito (72h)</span>
                        <Clock className="w-4 h-4 text-amber-400" />
                      </div>
                      <p className="text-3xl font-black text-amber-300">{metrics.activeTrials}</p>
                      <span className="text-[11px] text-slate-400">Contas com período de 3 dias ativo</span>
                    </div>

                    <div className="admin-kpi-card">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">Assinaturas Ativas</span>
                        <Crown className="w-4 h-4 text-emerald-400" />
                      </div>
                      <p className="text-3xl font-black text-emerald-400">{metrics.activeSubs}</p>
                      <span className="text-[11px] text-slate-400">Plano Premium R$ 49,99/mês</span>
                    </div>

                    <div className="admin-kpi-card">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">Assinaturas Vencidas</span>
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                      </div>
                      <p className="text-3xl font-black text-rose-400">{metrics.expiredSubs}</p>
                      <span className="text-[11px] text-slate-400">Expiradas, canceladas ou reembolsadas</span>
                    </div>

                    <div className="admin-kpi-card">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">Pagamentos Recebidos</span>
                        <CreditCard className="w-4 h-4 text-emerald-400" />
                      </div>
                      <p className="text-3xl font-black text-white">{metrics.paymentsCount}</p>
                      <span className="text-[11px] text-emerald-300 font-semibold">
                        Total acumulado: {formatBRL(metrics.paymentsTotal)}
                      </span>
                    </div>

                    <div className="admin-kpi-card">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">Receita Mensal (MRR)</span>
                        <DollarSign className="w-4 h-4 text-amber-400" />
                      </div>
                      <p className="text-3xl font-black text-amber-300">
                        {formatBRL(metrics.monthlyRevenue)}
                      </p>
                      <span className="text-[11px] text-slate-400">Baseado em assinaturas ativas</span>
                    </div>

                    <div className="admin-kpi-card">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">Jogos Publicados</span>
                        <Gamepad2 className="w-4 h-4 text-purple-400" />
                      </div>
                      <p className="text-3xl font-black text-white">{metrics.publishedGames}</p>
                      <span className="text-[11px] text-slate-400">
                        Total na plataforma: {metrics.totalGames ?? games.length}
                      </span>
                    </div>

                    <div className="admin-kpi-card">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">Músicas Disponíveis</span>
                        <Music className="w-4 h-4 text-pink-400" />
                      </div>
                      <p className="text-3xl font-black text-white">{metrics.totalMusic}</p>
                      <span className="text-[11px] text-slate-400">
                        Trilhas globais ativas ({metrics.liveConnections} LIVEs conectadas)
                      </span>
                    </div>
                  </div>

                  {/* Atividade Recente */}
                  <div className="admin-card space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                        <ScrollText className="w-4 h-4 text-amber-400" />
                        Atividade Recente da Plataforma
                      </h3>
                      <button
                        type="button"
                        onClick={() => setSection('logs')}
                        className="text-xs text-amber-400 font-bold hover:underline"
                      >
                        Ver todos os logs
                      </button>
                    </div>

                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Ação</th>
                            <th>Usuário</th>
                            <th>Detalhes</th>
                            <th>Data / Hora</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(metrics.recentActivity || []).slice(0, 12).map((act) => (
                            <tr key={act.id}>
                              <td>
                                <span className="admin-pill info font-mono">{act.action}</span>
                              </td>
                              <td className="text-xs">{act.email || 'Sistema / Webhook'}</td>
                              <td className="text-xs text-slate-400 font-mono truncate" style={{ maxWidth: '340px' }}>
                                {act.details}
                              </td>
                              <td className="text-xs text-slate-400 whitespace-nowrap">
                                {formatDate(act.createdAt)}
                              </td>
                            </tr>
                          ))}
                          {(!metrics.recentActivity || metrics.recentActivity.length === 0) && (
                            <tr>
                              <td colSpan={4} className="text-center py-6 text-slate-400">
                                Nenhuma atividade registrada ainda.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ====================================================== */}
              {/* 1B. CONECTAR TIKTOK LIVE (CONTA ADMIN)                 */}
              {/* ====================================================== */}
              {section === 'tiktok_live' && (
                <AdminTikTokLiveView
                  user={user}
                  games={games}
                  liveStatus={liveStatus}
                  liveEvents={liveEvents}
                  onConnectLive={onConnectLive}
                  onDisconnectLive={onDisconnectLive}
                  showToast={showToast}
                />
              )}

              {/* ====================================================== */}
              {/* 2. GERENCIAR JOGOS                                     */}
              {/* ====================================================== */}
              {section === 'manage_games' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-white">Gerenciar Jogos Globais</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Edite informações, atualize arquivos ZIP preservando configurações dos streamers, teste a prévia real ou altere o status de publicação.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSection('add_game')}
                      className="admin-btn-primary"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Adicionar Novo Jogo
                    </button>
                  </div>

                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Jogo</th>
                          <th>Categoria / Tipo</th>
                          <th>Versão</th>
                          <th>Status</th>
                          <th className="text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {games.map((g) => (
                          <tr key={g.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <img
                                  src={getMediaUrl(g.thumbnail_image || g.cover_image || '/covers/default-game.svg')}
                                  alt={g.name}
                                  className="w-14 h-10 rounded-lg object-cover border border-slate-700/60"
                                />
                                <div>
                                  <p className="font-bold text-white flex items-center gap-2">
                                    {g.name}
                                    {Boolean(g.is_featured) && (
                                      <span className="admin-pill warning">Destaque</span>
                                    )}
                                  </p>
                                  <p className="text-[11px] text-slate-400 font-mono">{g.slug}</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="admin-pill neutral">{g.category}</span>
                                <span className="admin-pill info uppercase">{g.type}</span>
                              </div>
                            </td>
                            <td className="font-mono text-xs text-slate-300">v{g.version || '1.0.0'}</td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleToggleGameStatus(g)}
                                className={`admin-pill ${g.is_active ? 'success' : 'danger'}`}
                              >
                                {g.is_active ? 'Publicado' : 'Desativado'}
                              </button>
                            </td>
                            <td>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPreviewGame(g)}
                                  className="admin-btn-secondary"
                                  title="Testar prévia real"
                                >
                                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                  Prévia
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingGame({ ...g });
                                    setEditZipFile(null);
                                    setEditCoverFile(null);
                                    setEditThumbFile(null);
                                  }}
                                  className="admin-btn-secondary"
                                  title="Editar e atualizar arquivos"
                                >
                                  <Edit className="w-3.5 h-3.5 text-amber-400" />
                                  Editar / Arquivos
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGame(g)}
                                  className="admin-btn-danger"
                                  title="Excluir jogo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ====================================================== */}
              {/* 3. ADICIONAR JOGO (DUAS COLUNAS: PRÉVIA REAL + FORM)   */}
              {/* ====================================================== */}
              {section === 'add_game' && (
                <AdminAddGameView
                  showToast={showToast}
                  onGamePublished={async () => {
                    await refreshAll();
                    await onGamesChanged();
                    setSection('manage_games');
                  }}
                />
              )}

              {/* ====================================================== */}
              {/* 4. BIBLIOTECA GLOBAL                                   */}
              {/* ====================================================== */}
              {section === 'global_library' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-white">Biblioteca Global Compartilhada</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Todos os jogos marcados como publicados aparecem automaticamente na conta de todos os usuários atuais e futuros.
                      </p>
                    </div>
                    <span className="admin-pill success">
                      {games.filter((g) => g.is_active).length} jogos ativos para streamers
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {games.map((g) => (
                      <div key={g.id} className="admin-card flex flex-col justify-between gap-4">
                        <div>
                          <div className="relative rounded-xl overflow-hidden mb-4 border border-slate-700/60 aspect-[16/10]">
                            <img
                              src={getMediaUrl(g.cover_image || '/covers/default-game.svg')}
                              alt={g.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-3 left-3 flex gap-1.5">
                              <span className={`admin-pill ${g.is_active ? 'success' : 'danger'}`}>
                                {g.is_active ? 'Publicado Global' : 'Desativado'}
                              </span>
                            </div>
                          </div>
                          <h3 className="text-base font-black text-white">{g.name}</h3>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-3">{g.description}</p>
                        </div>

                        <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between">
                          <span className="text-[11px] font-mono text-slate-400">
                            {g.category} · v{g.version || '1.0.0'}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewGame(g)}
                              className="admin-btn-secondary"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Testar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingGame({ ...g })}
                              className="admin-btn-primary"
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ====================================================== */}
              {/* 5. GERENCIAR MÚSICAS GLOBAIS                           */}
              {/* ====================================================== */}
              {section === 'music' && (
                <AdminMusicView
                  tracks={musicTracks}
                  games={games}
                  onRefresh={refreshAll}
                  showToast={showToast}
                />
              )}

              {/* ====================================================== */}
              {/* 6. USUÁRIOS                                            */}
              {/* ====================================================== */}
              {section === 'users' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-white">Gerenciamento de Usuários</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Acompanhe contas registradas, teste de 72h, assinaturas e suspensões.
                      </p>
                    </div>
                    <div className="relative" style={{ width: '280px' }}>
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nome ou e-mail..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="admin-input pl-9"
                      />
                    </div>
                  </div>

                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Usuário</th>
                          <th>Papel</th>
                          <th>Acesso / Plano</th>
                          <th>Cadastro</th>
                          <th className="text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => {
                          const isOwner = u.role === 'admin';
                          const hasSub = u.subStatus === 'active' && (!u.subExpiresAt || u.subExpiresAt > Date.now());
                          const hasTrial = u.trialExpiresAt && u.trialExpiresAt > Date.now();
                          return (
                            <tr key={u.id}>
                              <td>
                                <p className="font-bold text-white">{u.displayName}</p>
                                <p className="text-xs text-slate-400">{u.email}</p>
                              </td>
                              <td>
                                <span className={`admin-pill ${isOwner ? 'warning' : 'neutral'}`}>
                                  {isOwner ? 'ADMINISTRADOR' : 'USUÁRIO'}
                                </span>
                              </td>
                              <td>
                                {u.isSuspended ? (
                                  <span className="admin-pill danger">Suspenso</span>
                                ) : isOwner ? (
                                  <span className="admin-pill warning">Vitalício Ilimitado</span>
                                ) : hasSub ? (
                                  <span className="admin-pill success">Assinante Premium</span>
                                ) : hasTrial ? (
                                  <span className="admin-pill info">Teste 72h Ativo</span>
                                ) : (
                                  <span className="admin-pill danger">Teste Expirado</span>
                                )}
                              </td>
                              <td className="text-xs text-slate-400">{formatDate(u.createdAt)}</td>
                              <td>
                                <div className="flex items-center justify-end gap-2">
                                  {!isOwner && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleUserAction(u.id, 'grant-subscription')}
                                        className="admin-btn-secondary"
                                      >
                                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                                        +30 dias
                                      </button>
                                      {u.isSuspended ? (
                                        <button
                                          type="button"
                                          onClick={() => handleUserAction(u.id, 'reactivate')}
                                          className="admin-btn-secondary"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                          Reativar
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleUserAction(u.id, 'suspend')}
                                          className="admin-btn-danger"
                                        >
                                          <Ban className="w-3.5 h-3.5" />
                                          Suspender
                                        </button>
                                      )}
                                    </>
                                  )}
                                  {isOwner && (
                                    <span className="text-[11px] text-amber-400 font-bold">
                                      Conta Protegida
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ====================================================== */}
              {/* 7. ASSINATURAS                                         */}
              {/* ====================================================== */}
              {section === 'subscriptions' && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <h2 className="text-2xl font-black text-white">Assinaturas — Plano R$ 49,99/mês</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Controle completo de assinaturas ativas, vencidas, canceladas e concedidas manualmente.
                    </p>
                  </div>

                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Assinante</th>
                          <th>Plano / Valor</th>
                          <th>Status</th>
                          <th>Início / Vencimento</th>
                          <th>Transação</th>
                          <th className="text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <p className="font-bold text-white">{s.displayName}</p>
                              <p className="text-xs text-slate-400">{s.email}</p>
                            </td>
                            <td>
                              <p className="font-bold text-amber-300">{s.planName}</p>
                              <p className="text-xs text-slate-400">{formatBRL(s.amount)}/mês</p>
                            </td>
                            <td>
                              <span
                                className={`admin-pill ${
                                  s.status === 'active'
                                    ? 'success'
                                    : s.status === 'pending'
                                    ? 'warning'
                                    : 'danger'
                                }`}
                              >
                                {s.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="text-xs text-slate-300">
                              <div>Início: {formatDate(s.startedAt)}</div>
                              <div className="text-slate-400">Vence: {formatDate(s.expiresAt)}</div>
                            </td>
                            <td className="font-mono text-xs text-slate-400">{s.transactionId || '—'}</td>
                            <td className="text-right">
                              {s.status === 'active' && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelSubscription(s.id)}
                                  className="admin-btn-danger"
                                >
                                  Cancelar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {subscriptions.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-slate-400">
                              Nenhuma assinatura registrada ainda.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ====================================================== */}
              {/* 8. PAGAMENTOS                                          */}
              {/* ====================================================== */}
              {section === 'payments' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-white">Pagamentos Recebidos</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Transações confirmadas automaticamente via webhook da Cakto.
                      </p>
                    </div>
                    <div className="admin-pill success text-sm px-4 py-2">
                      Total Aprovado: {formatBRL(paymentsTotal)}
                    </div>
                  </div>

                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Pedido Cakto</th>
                          <th>Valor</th>
                          <th>Status</th>
                          <th>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <p className="font-bold text-white">{p.displayName}</p>
                              <p className="text-xs text-slate-400">{p.email}</p>
                            </td>
                            <td className="font-mono text-xs text-slate-300">{p.orderId || p.id}</td>
                            <td className="font-bold text-emerald-400">{formatBRL(p.amount)}</td>
                            <td>
                              <span
                                className={`admin-pill ${
                                  p.status === 'approved' ? 'success' : 'danger'
                                }`}
                              >
                                {p.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="text-xs text-slate-400">{formatDate(p.createdAt)}</td>
                          </tr>
                        ))}
                        {payments.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400">
                              Nenhum pagamento recebido até o momento.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ====================================================== */}
              {/* 9. CONFIGURAÇÕES DA CAKTO                              */}
              {/* ====================================================== */}
              {section === 'cakto' && caktoData && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <h2 className="text-2xl font-black text-white">Configurações da Cakto</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Configure o link oficial de checkout (R$ 49,99/mês) e o endpoint de webhook com idempotência garantida.
                    </p>
                  </div>

                  <div className="admin-card space-y-3">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                      URL do Webhook Cakto (Cole no painel da Cakto)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        readOnly
                        value={caktoData.webhookUrl}
                        className="admin-input font-mono flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(caktoData.webhookUrl);
                          showToast('URL do Webhook copiada!');
                        }}
                        className="admin-btn-primary"
                      >
                        <Copy className="w-4 h-4" />
                        Copiar URL
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleSaveCakto} className="admin-card space-y-4">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                      Credenciais e Oferta Comercial
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Link de Checkout (Oferta R$ 49,99/mês)
                        </label>
                        <input
                          type="url"
                          value={caktoData.config.offer_url}
                          onChange={(e) =>
                            setCaktoData({
                              ...caktoData,
                              config: { ...caktoData.config, offer_url: e.target.value },
                            })
                          }
                          className="admin-input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Product ID Cakto
                        </label>
                        <input
                          type="text"
                          value={caktoData.config.product_id}
                          onChange={(e) =>
                            setCaktoData({
                              ...caktoData,
                              config: { ...caktoData.config, product_id: e.target.value },
                            })
                          }
                          className="admin-input font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Offer ID Cakto
                        </label>
                        <input
                          type="text"
                          value={caktoData.config.offer_id}
                          onChange={(e) =>
                            setCaktoData({
                              ...caktoData,
                              config: { ...caktoData.config, offer_id: e.target.value },
                            })
                          }
                          className="admin-input font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Webhook Secret
                        </label>
                        <input
                          type="text"
                          value={caktoData.config.webhook_secret}
                          onChange={(e) =>
                            setCaktoData({
                              ...caktoData,
                              config: { ...caktoData.config, webhook_secret: e.target.value },
                            })
                          }
                          className="admin-input font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="admin-btn-primary">
                        <Save className="w-4 h-4" />
                        Salvar Configurações Cakto
                      </button>
                    </div>
                  </form>

                  <div className="admin-card space-y-3">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                      Eventos de Webhook Recebidos ({caktoData.recentEvents.length})
                    </h3>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Event ID</th>
                            <th>Tipo</th>
                            <th>Status</th>
                            <th>Recebido em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {caktoData.recentEvents.map((ev: any) => (
                            <tr key={ev.id}>
                              <td className="font-mono text-xs">{ev.id}</td>
                              <td>
                                <span className="admin-pill info">{ev.eventType}</span>
                              </td>
                              <td>
                                <span className={`admin-pill ${ev.processed ? 'success' : 'warning'}`}>
                                  {ev.processed ? 'Processado' : 'Pendente'}
                                </span>
                              </td>
                              <td className="text-xs text-slate-400">{formatDate(ev.receivedAt)}</td>
                            </tr>
                          ))}
                          {caktoData.recentEvents.length === 0 && (
                            <tr>
                              <td colSpan={4} className="text-center py-6 text-slate-400">
                                Nenhum webhook recebido ainda.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ====================================================== */}
              {/* 10. CONFIGURAÇÕES DE APIs                              */}
              {/* ====================================================== */}
              {section === 'apis' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-black text-white">Configurações de APIs e Banco de Dados</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Diagnóstico real do banco ativo (SQLite + Supabase via .env) e parâmetros do conector TikTok LIVE.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={testingDb}
                      onClick={async () => {
                        setTestingDb(true);
                        try {
                          const res = await fetch('/api/admin/database-status').then((r) => r.json());
                          if (res.sqlite) setDbStatus(res);
                          showToast('Diagnóstico de banco de dados atualizado!');
                        } finally {
                          setTestingDb(false);
                        }
                      }}
                      className="admin-btn-secondary"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      {testingDb ? 'Testando...' : 'Testar Conexão do Banco'}
                    </button>
                  </div>

                  {/* Real Database Status Panel (SQLite + Supabase) */}
                  {dbStatus && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="admin-card space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                            Banco Local (SQLite)
                          </span>
                          <span className={`admin-pill ${dbStatus.sqlite.connected ? 'success' : 'danger'}`}>
                            {dbStatus.sqlite.connected ? 'CONECTADO' : 'ERRO'}
                          </span>
                        </div>
                        <p className="text-sm font-black text-white">{dbStatus.sqlite.engine}</p>
                        <p className="text-xs text-slate-400">
                          {dbStatus.sqlite.tablesCount} tabelas · {dbStatus.sqlite.usersCount} contas ·{' '}
                          {dbStatus.sqlite.gamesCount} jogos · {dbStatus.sqlite.musicCount} músicas
                        </p>
                      </div>

                      <div className="admin-card space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                            Integração Supabase (Nuvem)
                          </span>
                          <span
                            className={`admin-pill ${
                              dbStatus.supabase.connected && dbStatus.supabase.schemaReady
                                ? 'success'
                                : dbStatus.supabase.configured
                                ? 'warning'
                                : 'neutral'
                            }`}
                          >
                            {dbStatus.supabase.connected && dbStatus.supabase.schemaReady
                              ? 'CONECTADO'
                              : dbStatus.supabase.configured
                              ? 'VERIFICAR SCHEMA'
                              : 'AGUARDANDO .ENV'}
                          </span>
                        </div>
                        <p className="text-sm font-black text-white font-mono">
                          {dbStatus.supabase.host || 'Não configurado em .env'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {dbStatus.supabase.error ||
                            'Auth saudável e tabelas sincronizadas via variáveis de ambiente seguras no backend.'}
                        </p>
                      </div>
                    </div>
                  )}

                <form onSubmit={handleSaveSettings} className="space-y-6">

                  <div className="admin-card space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          URL do Projeto Supabase
                        </label>
                        <input
                          type="url"
                          placeholder="https://seu-projeto.supabase.co"
                          value={platformSettings.supabaseUrl}
                          onChange={(e) =>
                            setPlatformSettings({ ...platformSettings, supabaseUrl: e.target.value })
                          }
                          className="admin-input font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Intervalo de Polling TikTok LIVE (ms)
                        </label>
                        <input
                          type="number"
                          min={250}
                          max={10000}
                          value={platformSettings.tiktokPollingInterval}
                          onChange={(e) =>
                            setPlatformSettings({
                              ...platformSettings,
                              tiktokPollingInterval: Number(e.target.value),
                            })
                          }
                          className="admin-input font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Limite de Upload de Áudio por Usuário (MB)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={100}
                          value={platformSettings.maxUserMusicSizeMb}
                          onChange={(e) =>
                            setPlatformSettings({
                              ...platformSettings,
                              maxUserMusicSizeMb: Number(e.target.value),
                            })
                          }
                          className="admin-input font-mono"
                        />
                      </div>

                      <div className="flex items-center pt-5">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={platformSettings.tiktokConnectorEnabled}
                            onChange={(e) =>
                              setPlatformSettings({
                                ...platformSettings,
                                tiktokConnectorEnabled: e.target.checked,
                              })
                            }
                            className="w-4 h-4"
                          />
                          <span className="text-xs font-bold text-slate-200">
                            Habilitar conector real TikTok LIVE (tiktok-live-connector)
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 text-xs text-slate-300">
                      <p className="font-bold text-amber-300 mb-1">Schema SQL do Supabase Pronto</p>
                      <p>
                        O script completo com 17 tabelas, funções de segurança, triggers e RLS para{' '}
                        <strong className="text-white">duduvlnt040@gmail.com</strong> está disponível em{' '}
                        <code className="font-mono text-cyan-300">supabase/schema.sql</code>.
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <button type="submit" className="admin-btn-primary">
                        <Save className="w-4 h-4" />
                        Salvar Configurações de APIs
                      </button>
                    </div>
                  </div>
                </form>
                </div>
              )}

              {/* ====================================================== */}
              {/* 11. CONFIGURAÇÕES GERAIS                               */}
              {/* ====================================================== */}
              {section === 'general' && (
                <form onSubmit={handleSaveSettings} className="space-y-6 animate-fadeIn">
                  <div>
                    <h2 className="text-2xl font-black text-white">Configurações Gerais</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Regras comerciais, período de teste gratuito e permissões da plataforma.
                    </p>
                  </div>

                  <div className="admin-card space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Nome da Plataforma
                        </label>
                        <input
                          type="text"
                          value={platformSettings.platformName}
                          onChange={(e) =>
                            setPlatformSettings({ ...platformSettings, platformName: e.target.value })
                          }
                          className="admin-input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          E-mail de Suporte
                        </label>
                        <input
                          type="email"
                          value={platformSettings.supportEmail}
                          onChange={(e) =>
                            setPlatformSettings({ ...platformSettings, supportEmail: e.target.value })
                          }
                          className="admin-input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Período de Teste Gratuito (Horas)
                        </label>
                        <input
                          type="number"
                          min={24}
                          max={720}
                          value={platformSettings.trialHours}
                          onChange={(e) =>
                            setPlatformSettings({
                              ...platformSettings,
                              trialHours: Number(e.target.value),
                            })
                          }
                          className="admin-input font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Valor da Assinatura Mensal (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={platformSettings.subscriptionPrice}
                          onChange={(e) =>
                            setPlatformSettings({
                              ...platformSettings,
                              subscriptionPrice: Number(e.target.value),
                            })
                          }
                          className="admin-input font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 cursor-pointer">
                        <div>
                          <p className="text-xs font-bold text-white">Permitir Upload de Músicas Particulares</p>
                          <p className="text-[11px] text-slate-400">
                            Streamers podem enviar arquivos de áudio privados dentro da aba MÚSICA dos jogos
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={platformSettings.allowUserMusicUpload}
                          onChange={(e) =>
                            setPlatformSettings({
                              ...platformSettings,
                              allowUserMusicUpload: e.target.checked,
                            })
                          }
                          className="w-4 h-4"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 cursor-pointer">
                        <div>
                          <p className="text-xs font-bold text-white">Modo Manutenção</p>
                          <p className="text-[11px] text-slate-400">
                            Exibe aviso de manutenção para usuários comuns mantendo acesso total ao administrador
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={platformSettings.maintenanceMode}
                          onChange={(e) =>
                            setPlatformSettings({
                              ...platformSettings,
                              maintenanceMode: e.target.checked,
                            })
                          }
                          className="w-4 h-4"
                        />
                      </label>
                    </div>

                    <div className="flex justify-end">
                      <button type="submit" className="admin-btn-primary">
                        <Save className="w-4 h-4" />
                        Salvar Configurações Gerais
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* ====================================================== */}
              {/* 12. LOGS E ATIVIDADES                                  */}
              {/* ====================================================== */}
              {section === 'logs' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-white">Logs e Auditoria do Sistema</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Registro persistente de autenticação, publicações de jogos, músicas, webhooks e ações administrativas.
                      </p>
                    </div>
                    <div className="relative" style={{ width: '280px' }}>
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filtrar ação ou e-mail..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="admin-input pl-9"
                      />
                    </div>
                  </div>

                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Ação</th>
                          <th>Usuário</th>
                          <th>Detalhes</th>
                          <th>Data / Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLogs.map((l) => (
                          <tr key={l.id}>
                            <td className="font-mono text-xs text-slate-500">#{l.id}</td>
                            <td>
                              <span className="admin-pill info font-mono">{l.action}</span>
                            </td>
                            <td className="text-xs">
                              {l.email || 'Sistema'}
                              {l.role === 'admin' && (
                                <span className="ml-2 admin-pill warning">ADMIN</span>
                              )}
                            </td>
                            <td className="font-mono text-xs text-slate-400 break-all" style={{ maxWidth: '380px' }}>
                              {l.details}
                            </td>
                            <td className="text-xs text-slate-400 whitespace-nowrap">
                              {formatDate(l.createdAt)}
                            </td>
                          </tr>
                        ))}
                        {filteredLogs.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400">
                              Nenhum log encontrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ====================================================== */}
              {/* 13. SEGURANÇA                                          */}
              {/* ====================================================== */}
              {section === 'security' && securityData && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <h2 className="text-2xl font-black text-white">Segurança e Controle de Acesso</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Proteção real no backend contra escalação de privilégios, gestão de sessões ativas e blindagem de áudios privados.
                    </p>
                  </div>

                  {/* Security Policies */}
                  <div className="admin-kpi-grid">
                    <div className="admin-kpi-card">
                      <span className="text-xs font-bold text-slate-400">Proprietário Oficial</span>
                      <p className="text-sm font-black text-amber-300 font-mono">
                        {securityData.policies.adminOwnerEmail}
                      </p>
                      <span className="admin-pill success">Vitalício · Protegido no Backend</span>
                    </div>
                    <div className="admin-kpi-card">
                      <span className="text-xs font-bold text-slate-400">Validação de Permissões</span>
                      <p className="text-sm font-black text-white">Backend + HttpOnly Cookie</p>
                      <span className="admin-pill success">Imune a edição no navegador</span>
                    </div>
                    <div className="admin-kpi-card">
                      <span className="text-xs font-bold text-slate-400">Áudios Privados</span>
                      <p className="text-sm font-black text-white">Isolamento por Conta + HMAC</p>
                      <span className="admin-pill success">403 para terceiros</span>
                    </div>
                    <div className="admin-kpi-card">
                      <span className="text-xs font-bold text-slate-400">Criptografia de Senhas</span>
                      <p className="text-sm font-black text-white">Scrypt + Salt Aleatório</p>
                      <span className="admin-pill success">Zero senha fixa no código</span>
                    </div>
                  </div>

                  {/* Active Sessions */}
                  <div className="admin-card space-y-3">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                      Sessões Ativas ({securityData.activeSessions?.length || 0})
                    </h3>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Usuário</th>
                            <th>Papel</th>
                            <th>Sessões</th>
                            <th>Expira em</th>
                            <th className="text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(securityData.activeSessions || []).map((s: any) => (
                            <tr key={s.userId}>
                              <td>
                                <p className="font-bold text-white">{s.displayName}</p>
                                <p className="text-xs text-slate-400">{s.email}</p>
                              </td>
                              <td>
                                <span className={`admin-pill ${s.role === 'admin' ? 'warning' : 'neutral'}`}>
                                  {s.role.toUpperCase()}
                                </span>
                              </td>
                              <td className="font-mono text-xs">{s.sessionCount}</td>
                              <td className="text-xs text-slate-400">{formatDate(s.latestExpiry)}</td>
                              <td className="text-right">
                                {s.userId !== user.id ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeSessions(s.userId)}
                                    className="admin-btn-danger"
                                  >
                                    Revogar Sessões
                                  </button>
                                ) : (
                                  <span className="text-xs text-emerald-400 font-bold">Sessão Atual</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ====================================================== */}
      {/* MODAL: PRÉVIA REAL DO JOGO EXISTENTE                   */}
      {/* ====================================================== */}
      {previewGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="admin-card w-full max-w-5xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div>
                <h3 className="text-lg font-black text-white">Prévia Real — {previewGame.name}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  {getGamePreviewSrc(previewGame)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.open(getGamePreviewSrc(previewGame), '_blank')}
                  className="admin-btn-secondary"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir em Nova Aba
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewGame(null)}
                  className="admin-btn-danger"
                >
                  <X className="w-4 h-4" />
                  Fechar
                </button>
              </div>
            </div>

            <div className="w-full rounded-xl overflow-hidden border border-slate-700/60 bg-black" style={{ height: '70vh' }}>
              <iframe
                src={getGamePreviewSrc(previewGame)}
                title={previewGame.name}
                allow="autoplay; fullscreen"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* MODAL: EDITAR JOGO E ATUALIZAR ARQUIVOS ZIP/CAPA       */}
      {/* ====================================================== */}
      {editingGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleSaveGameEdit} className="admin-card w-full max-w-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div>
                <h3 className="text-lg font-black text-white">Editar Jogo Global</h3>
                <p className="text-xs text-emerald-400">
                  As configurações individuais dos usuários serão preservadas automaticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingGame(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div style={{ gridColumn: 'span 2' }}>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nome do Jogo</label>
                <input
                  type="text"
                  required
                  value={editingGame.name}
                  onChange={(e) => setEditingGame({ ...editingGame, name: e.target.value })}
                  className="admin-input"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Versão</label>
                <input
                  type="text"
                  value={editingGame.version || '1.0.0'}
                  onChange={(e) => setEditingGame({ ...editingGame, version: e.target.value })}
                  className="admin-input font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Categoria</label>
                <input
                  type="text"
                  value={editingGame.category}
                  onChange={(e) => setEditingGame({ ...editingGame, category: e.target.value })}
                  className="admin-input"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Status</label>
                <select
                  value={editingGame.is_active ? '1' : '0'}
                  onChange={(e) =>
                    setEditingGame({ ...editingGame, is_active: e.target.value === '1' ? 1 : 0 })
                  }
                  className="admin-select"
                >
                  <option value="1">Publicado (Global)</option>
                  <option value="0">Desativado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Descrição</label>
              <textarea
                rows={3}
                value={editingGame.description}
                onChange={(e) => setEditingGame({ ...editingGame, description: e.target.value })}
                className="admin-textarea resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 space-y-3">
              <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Atualizar Arquivos do Jogo (Opcional)
              </p>
              {editingGame.type === 'zip' && (
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Novo Pacote .ZIP</label>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setEditZipFile(e.target.files?.[0] || null)}
                    className="admin-input text-xs"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Nova Capa</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditCoverFile(e.target.files?.[0] || null)}
                    className="admin-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Nova Miniatura</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditThumbFile(e.target.files?.[0] || null)}
                    className="admin-input text-xs"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(editingGame.is_featured)}
                onChange={(e) =>
                  setEditingGame({ ...editingGame, is_featured: e.target.checked ? 1 : 0 })
                }
                className="w-4 h-4"
              />
              <span className="text-xs font-bold text-slate-200">Marcar como jogo em DESTAQUE</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingGame(null)}
                className="admin-btn-secondary"
              >
                Cancelar
              </button>
              <button type="submit" disabled={savingGame} className="admin-btn-primary">
                <Save className="w-4 h-4" />
                {savingGame ? 'Atualizando...' : 'Salvar e Atualizar Globalmente'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
