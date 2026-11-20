import React, { useState, useEffect, useRef } from 'react';
import { AuthModal } from './components/AuthModal';
import { UserShell, type UserSection } from './components/UserShell';
import { UserHomePage } from './pages/UserHomePage';
import { HomePage } from './pages/HomePage';
import { GameDashboardPage } from './pages/GameDashboardPage';
import { UserTikTokPage } from './pages/UserTikTokPage';
import { UserSettingsPage } from './pages/UserSettingsPage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { HelpPage } from './pages/HelpPage';
import { AdminPage } from './pages/AdminPage';
import { clearSessionToken, getLiveWsUrl } from './lib/api';
import type { Game, User, UserAccess, LiveStatus, LiveEvent } from './types';

export default function App() {
  // Complete separation: 'admin' renders ONLY AdminPage; 'user' renders ONLY UserShell
  const [panelMode, setPanelMode] = useState<'admin' | 'user'>('user');
  const [userPage, setUserPage] = useState<UserSection>('home');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<UserAccess | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);

  async function loadGames() {
    try {
      const gamesRes = await fetch('/api/games').then((r) => r.json());
      if (gamesRes.games) {
        setGames(gamesRes.games);
      }
    } catch (err) {
      console.error('Failed to fetch games:', err);
    }
  }

  // Initial load: Auth check + automatic role-based panel routing
  useEffect(() => {
    async function init() {
      try {
        const [meRes, gamesRes] = await Promise.all([
          fetch('/api/auth/me').then((r) => r.json()),
          fetch('/api/games').then((r) => r.json()),
        ]);

        if (gamesRes.games) {
          setGames(gamesRes.games);
        }

        if (meRes.user) {
          setUser(meRes.user);
          setAccess(meRes.access);

          if (meRes.user.isAdmin) {
            setPanelMode('admin');
            if (window.location.pathname !== '/admin') {
              window.history.replaceState({}, '', '/admin');
            }
          } else {
            setPanelMode('user');
            if (window.location.pathname.startsWith('/admin')) {
              window.history.replaceState({}, '', '/');
            }
          }
        } else {
          setAccess(meRes.access);
          setPanelMode('user');
          if (window.location.pathname.startsWith('/admin')) {
            window.history.replaceState({}, '', '/');
            setAuthModalMode('login');
            setAuthModalOpen(true);
          }
        }
      } catch (err) {
        console.error('Failed to load initial state:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Guard: non-admin users can NEVER stay in admin panelMode
  useEffect(() => {
    if (panelMode === 'admin' && (!user || !user.isAdmin)) {
      setPanelMode('user');
      if (window.location.pathname.startsWith('/admin')) {
        window.history.replaceState({}, '', '/');
      }
    }
  }, [panelMode, user]);

  // Real-time WebSocket connection to Railway/local backend
  useEffect(() => {
    if (!user) return;
    let socket: WebSocket | null = null;
    let reconnectTimeout = 0;
    let closedByCleanup = false;

    function connectWs() {
      if (closedByCleanup) return;
      const wsUrl = getLiveWsUrl(user!.id);

      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'live:status' && data.payload) {
            setLiveStatus(data.payload);
          } else if (data.type === 'live:event' && data.payload) {
            setLiveEvents((prev) => [data.payload as LiveEvent, ...prev].slice(0, 100));
          }
        } catch {}
      };

      socket.onclose = () => {
        if (!closedByCleanup) {
          reconnectTimeout = window.setTimeout(connectWs, 3500);
        }
      };
    }

    connectWs();

    return () => {
      closedByCleanup = true;
      clearTimeout(reconnectTimeout);
      socket?.close();
    };
  }, [user?.id]);

  // Open game detail with isolated user settings & triggers
  async function handleSelectGame(gameId: string) {
    try {
      const res = await fetch(`/api/games/${encodeURIComponent(gameId)}`).then((r) => r.json());
      if (res.game) {
        setSelectedGame(res.game);
        setUserPage('game_detail');
        return;
      }
    } catch {}
    const fallback = games.find((g) => g.id === gameId) || null;
    if (fallback) {
      setSelectedGame(fallback);
      setUserPage('game_detail');
    }
  }

  // Handle Login / Registration success -> strict automatic panel redirect
  async function handleAuthSuccess(newUser: User, newAccess: UserAccess) {
    setUser(newUser);
    setAccess(newAccess);
    await loadGames();

    if (newUser.isAdmin) {
      setPanelMode('admin');
      window.history.replaceState({}, '', '/admin');
    } else {
      setPanelMode('user');
      setUserPage('home');
      setSelectedGame(null);
      window.history.replaceState({}, '', '/');
    }
  }

  // Handle Logout
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    clearSessionToken();
    setUser(null);
    setAccess(null);
    setLiveStatus(null);
    setLiveEvents([]);
    setPanelMode('user');
    setUserPage('home');
    setSelectedGame(null);
    window.history.replaceState({}, '', '/');
    await loadGames();
  }

  // Handle Real TikTok LIVE Connection (never fakes 'connected')
  async function handleConnectLive(username: string) {
    const clean = username.trim().replace(/^@+/, '');
    setLiveStatus((prev) => ({
      connected: false,
      status: 'connecting',
      username: clean,
      roomId: null,
      viewerCount: 0,
      connectedAt: null,
      lastEventAt: prev?.lastEventAt || null,
      totalEvents: prev?.totalEvents || 0,
      eventCounts: prev?.eventCounts || { comment: 0, like: 0, gift: 0, follow: 0, share: 0 },
      activeOverlayCount: prev?.activeOverlayCount || 0,
      errorMessage: null,
    }));

    const res = await fetch('/api/live/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: clean }),
    });
    const data = await res.json();

    if (data.status) {
      setLiveStatus(data.status);
    }

    if (!res.ok) {
      if (!data.status) {
        setLiveStatus((prev) =>
          prev
            ? { ...prev, connected: false, status: 'error', errorMessage: data.error || 'Erro de conexão com TikTok LIVE.' }
            : null
        );
      }
      throw new Error(data.error || 'Erro ao conectar com TikTok LIVE.');
    }

    setLiveStatus(data.status);
  }

  async function handleDisconnectLive() {
    const res = await fetch('/api/live/disconnect', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao desconectar.');
    if (data.status) {
      setLiveStatus(data.status);
    } else {
      setLiveStatus((prev) =>
        prev ? { ...prev, connected: false, status: 'disconnected', errorMessage: null } : null
      );
    }
  }

  async function handleSimulateEvent(event: Partial<LiveEvent>) {
    await fetch('/api/live/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0714] text-slate-300 flex items-center justify-center text-sm font-bold">
        Carregando Minha Live Game...
      </div>
    );
  }

  // =========================================================================
  // 1. PAINEL ADMINISTRATIVO EXCLUSIVO (RENDERIZADO APENAS PARA ADMIN REAL)
  // =========================================================================
  if (user?.isAdmin && panelMode === 'admin') {
    return (
      <AdminPage
        user={user}
        liveStatus={liveStatus}
        liveEvents={liveEvents}
        onConnectLive={handleConnectLive}
        onDisconnectLive={handleDisconnectLive}
        onViewAsStreamer={() => {
          setPanelMode('user');
          setUserPage('home');
          window.history.replaceState({}, '', '/');
        }}
        onLogout={handleLogout}
        onGamesChanged={loadGames}
      />
    );
  }

  // Filter strictly published games for streamer library view
  const publishedGames = games.filter((g) => Boolean(g.is_active));

  // =========================================================================
  // 2. PAINEL DO USUÁRIO COMUM (COMPLETAMENTE SEPARADO)
  // =========================================================================
  return (
    <>
      <UserShell
        user={user}
        access={access}
        liveStatus={liveStatus}
        currentPage={userPage}
        onNavigate={(p) => {
          setUserPage(p);
          if (p !== 'game_detail') setSelectedGame(null);
        }}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode);
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        onReturnToAdmin={
          user?.isAdmin
            ? () => {
                setPanelMode('admin');
                window.history.replaceState({}, '', '/admin');
              }
            : undefined
        }
      >
        {userPage === 'home' && (
          <UserHomePage
            user={user}
            access={access}
            liveStatus={liveStatus}
            games={publishedGames}
            onSelectGame={handleSelectGame}
            onNavigate={(p) => setUserPage(p as UserSection)}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setAuthModalOpen(true);
            }}
          />
        )}

        {userPage === 'library' && (
          <HomePage
            games={publishedGames}
            user={user}
            access={access}
            onSelectGame={handleSelectGame}
            onNavigateToSubscription={() => setUserPage('subscription')}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setAuthModalOpen(true);
            }}
          />
        )}

        {userPage === 'game_detail' && selectedGame && (
          <GameDashboardPage
            game={selectedGame}
            user={user}
            access={access}
            liveStatus={liveStatus}
            liveEvents={liveEvents}
            onBack={() => {
              setUserPage('library');
              setSelectedGame(null);
            }}
            onNavigateToSubscription={() => setUserPage('subscription')}
            onConnectLive={handleConnectLive}
            onDisconnectLive={handleDisconnectLive}
            onSimulateEvent={handleSimulateEvent}
          />
        )}

        {userPage === 'tiktok' && (
          <UserTikTokPage
            user={user}
            access={access}
            liveStatus={liveStatus}
            liveEvents={liveEvents}
            onConnectLive={handleConnectLive}
            onDisconnectLive={handleDisconnectLive}
            onNavigateToSubscription={() => setUserPage('subscription')}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setAuthModalOpen(true);
            }}
          />
        )}

        {userPage === 'settings' && (
          <UserSettingsPage
            user={user}
            onUserUpdated={(updated) => setUser(updated)}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setAuthModalOpen(true);
            }}
          />
        )}

        {userPage === 'subscription' && (
          <SubscriptionPage
            user={user}
            access={access}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setAuthModalOpen(true);
            }}
          />
        )}

        {userPage === 'help' && <HelpPage />}
      </UserShell>

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
