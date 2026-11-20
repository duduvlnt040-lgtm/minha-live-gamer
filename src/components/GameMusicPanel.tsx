import React, { useState, useEffect, useRef } from 'react';
import {
  Music,
  Upload,
  Play,
  Pause,
  SkipForward,
  Volume2,
  Repeat,
  Trash2,
  Plus,
  Star,
  ArrowUp,
  ArrowDown,
  Lock,
  Globe,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { GlobalMusic, UserMusic, PlaylistTrackItem, UserPlaylist, User } from '../types';
import { getMediaUrl } from '../lib/api';

interface GameMusicPanelProps {
  gameId: string;
  user: User | null;
  onToast: (msg: string) => void;
}

export const GameMusicPanel: React.FC<GameMusicPanelProps> = ({ gameId, user, onToast }) => {
  const [globalTracks, setGlobalTracks] = useState<GlobalMusic[]>([]);
  const [myTracks, setMyTracks] = useState<UserMusic[]>([]);
  const [playlist, setPlaylist] = useState<UserPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrackItem[]>([]);

  const [isAutoplay, setIsAutoplay] = useState(true);
  const [isRepeat, setIsRepeat] = useState(true);
  const [volume, setVolume] = useState(75);
  const [playlistName, setPlaylistName] = useState('Playlist Oficial');

  // Upload state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Live audio player state
  const [currentTrackUrl, setCurrentTrackUrl] = useState<string | null>(null);
  const [currentTrackTitle, setCurrentTrackTitle] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlaylistIdx, setCurrentPlaylistIdx] = useState<number>(-1);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadMusicData();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [gameId, user?.id]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
    }
  }, [volume]);

  async function loadMusicData() {
    try {
      const globalRes = await fetch(`/api/music/global?gameId=${encodeURIComponent(gameId)}`).then((r) => r.json());
      setGlobalTracks(globalRes.tracks || []);

      if (user) {
        const [myRes, plRes] = await Promise.all([
          fetch(`/api/music/my`).then((r) => r.json()),
          fetch(`/api/games/${encodeURIComponent(gameId)}/playlist`).then((r) => r.json()),
        ]);
        setMyTracks(myRes.tracks || []);
        if (plRes.playlist) {
          setPlaylist(plRes.playlist);
          setPlaylistName(plRes.playlist.name || 'Playlist Oficial');
          setIsAutoplay(Boolean(plRes.playlist.is_autoplay));
          setIsRepeat(Boolean(plRes.playlist.is_repeat));
          setVolume(Number(plRes.playlist.volume ?? 75));
        }
        setPlaylistTracks(plRes.tracks || []);
      }
    } catch {
      onToast('Erro ao carregar biblioteca de músicas.');
    }
  }

  async function persistPlaylist(
    nextTracks: PlaylistTrackItem[],
    overrides?: { isAutoplay?: boolean; isRepeat?: boolean; volume?: number; name?: string }
  ) {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        name: overrides?.name ?? playlistName,
        is_autoplay: overrides?.isAutoplay ?? isAutoplay,
        is_repeat: overrides?.isRepeat ?? isRepeat,
        volume: overrides?.volume ?? volume,
        tracks: nextTracks.map((t, idx) => ({
          id: t.id,
          trackType: t.trackType,
          orderIndex: idx,
          isPrimary: Boolean(t.isPrimary),
        })),
      };
      const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/playlist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar playlist.');
      if (data.tracks) setPlaylistTracks(data.tracks);
      if (data.playlist) setPlaylist(data.playlist);
    } catch (err: any) {
      onToast(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadMyMusic(e: React.FormEvent) {
    e.preventDefault();
    setUploadError('');
    if (!user) {
      setUploadError('Faça login para enviar suas músicas particulares.');
      return;
    }
    if (!uploadFile) {
      setUploadError('Selecione um arquivo MP3, WAV, OGG ou M4A.');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('audioFile', uploadFile);
      fd.append('name', uploadName.trim() || uploadFile.name.replace(/\.[^.]+$/, ''));
      fd.append('artist', uploadArtist.trim() || user.displayName);
      fd.append('gameId', gameId);

      const res = await fetch('/api/music/my/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar áudio.');

      const created: UserMusic = data.track;
      setMyTracks((prev) => [created, ...prev]);

      // Automatically add newly uploaded private track to this game's playlist
      const nextTracks: PlaylistTrackItem[] = [
        ...playlistTracks,
        {
          id: created.id,
          name: created.name,
          artist: created.artist,
          file_url: created.file_url,
          trackType: 'user',
          isPrimary: playlistTracks.length === 0,
        },
      ];
      setPlaylistTracks(nextTracks);
      await persistPlaylist(nextTracks);

      setUploadFile(null);
      setUploadName('');
      setUploadArtist('');
      setShowUploadForm(false);
      onToast(`Música privada "${created.name}" adicionada à sua conta e playlist!`);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteMyMusic(track: UserMusic) {
    if (!window.confirm(`Excluir sua música particular "${track.name}"?`)) return;
    try {
      const res = await fetch(`/api/music/my/${track.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao remover música.');
      if (currentTrackUrl === track.file_url && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        setCurrentTrackUrl(null);
      }
      setMyTracks((prev) => prev.filter((t) => t.id !== track.id));
      setPlaylistTracks((prev) => prev.filter((t) => !(t.trackType === 'user' && t.id === track.id)));
      onToast('Música removida da sua conta.');
    } catch (err: any) {
      onToast(err.message);
    }
  }

  function addToPlaylist(item: { id: string; name: string; artist: string; file_url: string; trackType: 'global' | 'user' }) {
    if (!user) {
      onToast('Entre na sua conta para personalizar playlists.');
      return;
    }
    if (playlistTracks.some((t) => t.id === item.id && t.trackType === item.trackType)) {
      onToast('Esta música já está na playlist deste jogo.');
      return;
    }
    const next: PlaylistTrackItem[] = [
      ...playlistTracks,
      { ...item, isPrimary: playlistTracks.length === 0 },
    ];
    setPlaylistTracks(next);
    persistPlaylist(next);
    onToast(`"${item.name}" adicionada à playlist!`);
  }

  function removeFromPlaylist(index: number) {
    const next = playlistTracks.filter((_, i) => i !== index);
    setPlaylistTracks(next);
    persistPlaylist(next);
  }

  function setPrimaryTrack(index: number) {
    const chosen = playlistTracks[index];
    if (!chosen) return;
    const reordered = [
      { ...chosen, isPrimary: true },
      ...playlistTracks.filter((_, i) => i !== index).map((t) => ({ ...t, isPrimary: false })),
    ];
    setPlaylistTracks(reordered);
    persistPlaylist(reordered);
    onToast(`"${chosen.name}" definida como Música Principal!`);
  }

  function moveTrack(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= playlistTracks.length) return;
    const copy = [...playlistTracks];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    setPlaylistTracks(copy);
    persistPlaylist(copy);
  }

  function playSingleTrack(url: string, title: string, plIndex = -1) {
    if (!audioRef.current) return;
    if (currentTrackUrl === url && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    if (currentTrackUrl === url && !isPlaying) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      return;
    }
    audioRef.current.src = getMediaUrl(url);
    audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
    setCurrentTrackUrl(url);
    setCurrentTrackTitle(title);
    setCurrentPlaylistIdx(plIndex);
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => onToast('Clique em Tocar para iniciar a reprodução do áudio.'));
  }

  function handleNextTrack() {
    if (playlistTracks.length === 0) return;
    const nextIdx = currentPlaylistIdx + 1;
    if (nextIdx < playlistTracks.length) {
      const t = playlistTracks[nextIdx];
      playSingleTrack(t.file_url, t.name, nextIdx);
    } else if (isRepeat) {
      const t = playlistTracks[0];
      playSingleTrack(t.file_url, t.name, 0);
    } else {
      setIsPlaying(false);
    }
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <audio ref={audioRef} onEnded={handleNextTrack} />

      {/* BOTÃO PRINCIPAL: ADICIONAR MINHA MÚSICA */}
      <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-bold text-white flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              Músicas Particulares da Sua Conta
            </p>
            <p className="text-[10px] text-slate-400">
              Armazenamento privado: outros usuários nunca veem ou acessam suas faixas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowUploadForm((s) => !s)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-[11px] flex items-center gap-1.5 shadow-md"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>ADICIONAR MINHA MÚSICA</span>
          </button>
        </div>

        {showUploadForm && (
          <form onSubmit={handleUploadMyMusic} className="p-3 rounded-xl bg-black/40 border border-purple-500/30 space-y-2.5">
            {uploadError && (
              <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-[11px] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Arquivo de Áudio (MP3, WAV, OGG, M4A)
              </label>
              <input
                type="file"
                accept=".mp3,.wav,.ogg,.m4a,.aac,audio/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setUploadFile(f);
                  if (f && !uploadName) setUploadName(f.name.replace(/\.[^.]+$/, ''));
                }}
                className="w-full text-[11px] text-slate-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nome da música"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-purple-950/60 border border-purple-500/30 text-white text-xs"
              />
              <input
                type="text"
                placeholder="Artista (opcional)"
                value={uploadArtist}
                onChange={(e) => setUploadArtist(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-purple-950/60 border border-purple-500/30 text-white text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-extrabold"
              >
                {uploading ? 'Enviando...' : 'Salvar Música Privada'}
              </button>
            </div>
          </form>
        )}

        {/* Lista das Músicas Privadas do Usuário */}
        {myTracks.length > 0 && (
          <div className="space-y-1.5">
            {myTracks.map((t) => {
              const playingThis = currentTrackUrl === t.file_url && isPlaying;
              return (
                <div key={t.id} className={`music-card ${playingThis ? 'playing' : ''}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => playSingleTrack(t.file_url, t.name)}
                      className="w-7 h-7 rounded-lg bg-purple-600/30 text-purple-200 flex items-center justify-center shrink-0"
                    >
                      {playingThis ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{t.name}</p>
                      <p className="text-[10px] text-emerald-300 truncate">Privada · {t.artist}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        addToPlaylist({
                          id: t.id,
                          name: t.name,
                          artist: t.artist,
                          file_url: t.file_url,
                          trackType: 'user',
                        })
                      }
                      className="px-2 py-1 rounded-lg bg-purple-600/30 text-purple-200 text-[10px] font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Playlist
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMyMusic(t)}
                      className="p-1 rounded-lg text-rose-400 hover:bg-rose-950/40"
                      title="Remover minha música"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PLAYLIST ATIVA DO JOGO + PLAYER DE CONTROLE */}
      <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-500/25 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-purple-400" />
              Playlist deste Jogo ({playlistTracks.length})
            </p>
            <p className="text-[10px] text-slate-400">
              {saving ? 'Salvando playlist...' : 'Sincronizada automaticamente com o Overlay do OBS'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={playlistTracks.length === 0}
              onClick={() => {
                if (isPlaying && audioRef.current) {
                  audioRef.current.pause();
                  setIsPlaying(false);
                } else if (currentTrackUrl && audioRef.current) {
                  audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                } else if (playlistTracks[0]) {
                  playSingleTrack(playlistTracks[0].file_url, playlistTracks[0].name, 0);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1"
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isPlaying ? 'Pausar' : currentTrackUrl ? 'Retomar' : 'Tocar'}
            </button>
            <button
              type="button"
              disabled={playlistTracks.length === 0}
              onClick={handleNextTrack}
              className="p-1.5 rounded-lg bg-purple-900/60 text-purple-200"
              title="Próxima música"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {currentTrackTitle && (
          <div className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center justify-between">
            <span className="truncate">
              {isPlaying ? 'Tocando agora:' : 'Pausado:'} <strong>{currentTrackTitle}</strong>
            </span>
          </div>
        )}

        {/* Volume, Autoplay e Repetição */}
        <div className="space-y-2 pt-1">
          <div>
            <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                Volume da Playlist
              </span>
              <span className="text-purple-300 font-bold">{volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                persistPlaylist(playlistTracks, { volume: v });
              }}
              className="w-full cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-purple-500/20 cursor-pointer">
              <span className="text-[11px] font-bold text-slate-200">Reprodução Automática</span>
              <input
                type="checkbox"
                checked={isAutoplay}
                onChange={(e) => {
                  setIsAutoplay(e.target.checked);
                  persistPlaylist(playlistTracks, { isAutoplay: e.target.checked });
                }}
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-purple-500/20 cursor-pointer">
              <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                <Repeat className="w-3 h-3 text-purple-400" />
                Repetição (Loop)
              </span>
              <input
                type="checkbox"
                checked={isRepeat}
                onChange={(e) => {
                  setIsRepeat(e.target.checked);
                  persistPlaylist(playlistTracks, { isRepeat: e.target.checked });
                }}
              />
            </label>
          </div>
        </div>

        {/* Faixas da Playlist */}
        <div className="space-y-1.5">
          {playlistTracks.map((t, idx) => (
            <div
              key={`${t.trackType}-${t.id}-${idx}`}
              className={`music-card ${currentTrackUrl === t.file_url && isPlaying ? 'playing' : ''}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono text-slate-500 w-4">{idx + 1}.</span>
                <button
                  type="button"
                  onClick={() => playSingleTrack(t.file_url, t.name, idx)}
                  className="w-6 h-6 rounded-md bg-purple-600/30 text-purple-200 flex items-center justify-center shrink-0"
                >
                  {currentTrackUrl === t.file_url && isPlaying ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                </button>
                <div className="min-w-0">
                  <p className="font-bold text-white truncate flex items-center gap-1">
                    {t.isPrimary && <Star className="w-3 h-3 text-amber-400 shrink-0" />}
                    <span className="truncate">{t.name}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {t.trackType === 'user' ? 'Minha Música' : 'Global Oficial'} · {t.artist}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setPrimaryTrack(idx)}
                  className={`p-1 rounded-md ${t.isPrimary ? 'text-amber-400' : 'text-slate-500 hover:text-amber-300'}`}
                  title="Definir como música principal"
                >
                  <Star className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTrack(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 rounded-md text-slate-400 hover:text-white"
                  title="Subir na ordem"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTrack(idx, 1)}
                  disabled={idx === playlistTracks.length - 1}
                  className="p-1 rounded-md text-slate-400 hover:text-white"
                  title="Descer na ordem"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => removeFromPlaylist(idx)}
                  className="p-1 rounded-md text-rose-400 hover:bg-rose-950/40"
                  title="Remover da playlist"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {playlistTracks.length === 0 && (
            <p className="text-[11px] text-slate-400 text-center py-3">
              Sua playlist está vazia. Adicione trilhas oficiais abaixo ou envie sua própria música acima.
            </p>
          )}
        </div>
      </div>

      {/* MÚSICAS GLOBAIS DO ADMINISTRADOR */}
      <div className="p-3 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
        <p className="font-bold text-slate-200 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          Músicas Globais Disponíveis ({globalTracks.length})
        </p>

        <div className="space-y-1.5">
          {globalTracks.map((g) => {
            const playingThis = currentTrackUrl === g.file_url && isPlaying;
            const inPlaylist = playlistTracks.some((p) => p.trackType === 'global' && p.id === g.id);
            return (
              <div key={g.id} className={`music-card ${playingThis ? 'playing' : ''}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => playSingleTrack(g.file_url, g.name)}
                    className="w-7 h-7 rounded-lg bg-cyan-600/20 text-cyan-300 flex items-center justify-center shrink-0"
                  >
                    {playingThis ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{g.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {g.artist} · {g.category}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={inPlaylist}
                  onClick={() =>
                    addToPlaylist({
                      id: g.id,
                      name: g.name,
                      artist: g.artist,
                      file_url: g.file_url,
                      trackType: 'global',
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 ${
                    inPlaylist
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-purple-600/30 text-purple-200 hover:bg-purple-600'
                  }`}
                >
                  {inPlaylist ? (
                    <>
                      <Check className="w-3 h-3" />
                      Na Playlist
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      Adicionar
                    </>
                  )}
                </button>
              </div>
            );
          })}
          {globalTracks.length === 0 && (
            <p className="text-[11px] text-slate-500 text-center py-2">
              Nenhuma música global cadastrada para este jogo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
