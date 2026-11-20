import React, { useState, useRef } from 'react';
import {
  Music,
  Upload,
  Play,
  Pause,
  Trash2,
  Volume2,
  Globe,
  Gamepad2,
  Check,
  X,
  Image as ImageIcon,
  Save,
} from 'lucide-react';
import type { Game, GlobalMusic } from '../../types';
import { getMediaUrl } from '../../lib/api';

interface AdminMusicViewProps {
  tracks: GlobalMusic[];
  games: Game[];
  onRefresh: () => Promise<void>;
  showToast: (msg: string) => void;
}

export const AdminMusicView: React.FC<AdminMusicViewProps> = ({
  tracks,
  games,
  onRefresh,
  showToast,
}) => {
  const [name, setName] = useState('');
  const [artist, setArtist] = useState('Minha Live Game');
  const [category, setCategory] = useState('Festiva');
  const [defaultVolume, setDefaultVolume] = useState(80);
  const [orderIndex, setOrderIndex] = useState(0);
  const [gameId, setGameId] = useState('all');
  const [isActive, setIsActive] = useState(true);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Preview audio player
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Quick edit modal/inline
  const [editingTrack, setEditingTrack] = useState<GlobalMusic | null>(null);

  function togglePlay(track: GlobalMusic) {
    if (!audioRef.current) return;
    if (playingId === track.id) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current.src = getMediaUrl(track.file_url);
    audioRef.current.volume = Math.max(0, Math.min(1, (track.default_volume || 80) / 100));
    audioRef.current
      .play()
      .then(() => setPlayingId(track.id))
      .catch(() => showToast('Não foi possível reproduzir o arquivo de áudio.'));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!audioFile) {
      setError('Selecione um arquivo de áudio (MP3, WAV, OGG ou M4A).');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('audioFile', audioFile);
      if (coverFile) fd.append('coverFile', coverFile);
      fd.append('name', name.trim() || audioFile.name.replace(/\.[^.]+$/, ''));
      fd.append('artist', artist.trim() || 'Minha Live Game');
      fd.append('category', category);
      fd.append('defaultVolume', String(defaultVolume));
      fd.append('orderIndex', String(orderIndex));
      fd.append('gameId', gameId === 'all' ? '' : gameId);
      fd.append('isActive', String(isActive));

      const res = await fetch('/api/admin/music/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar música.');

      showToast(`Música global "${data.track.name}" publicada!`);
      setName('');
      setArtist('Minha Live Game');
      setAudioFile(null);
      setCoverFile(null);
      setOrderIndex((prev) => prev + 1);
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleToggleActive(track: GlobalMusic) {
    try {
      const res = await fetch(`/api/admin/music/${track.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: track.is_active ? 0 : 1 }),
      });
      if (!res.ok) throw new Error('Falha ao alterar status.');
      showToast(track.is_active ? 'Música desativada.' : 'Música ativada globalmente.');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTrack) return;
    try {
      const res = await fetch(`/api/admin/music/${editingTrack.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingTrack.name,
          artist: editingTrack.artist,
          category: editingTrack.category,
          default_volume: Number(editingTrack.default_volume),
          order_index: Number(editingTrack.order_index),
          game_id: editingTrack.game_id || null,
          is_active: editingTrack.is_active ? 1 : 0,
        }),
      });
      if (!res.ok) throw new Error('Falha ao atualizar música.');
      showToast('Música atualizada com sucesso!');
      setEditingTrack(null);
      await onRefresh();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleDelete(track: GlobalMusic) {
    if (!window.confirm(`Deseja excluir permanentemente a música global "${track.name}"?`)) return;
    try {
      if (playingId === track.id && audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
      }
      const res = await fetch(`/api/admin/music/${track.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir música.');
      showToast('Música removida da biblioteca global.');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  function getGameName(id?: string | null) {
    if (!id) return 'Todos os jogos (Global)';
    return games.find((g) => g.id === id)?.name || id;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      <div>
        <h2 className="text-2xl font-black text-white">Gerenciar Músicas Globais</h2>
        <p className="text-xs text-slate-400 mt-1">
          Envie trilhas sonoras oficiais disponíveis para todos os streamers ou associadas a jogos específicos.
        </p>
      </div>

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="admin-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Adicionar Nova Música Global
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Formatos: MP3, WAV, OGG, M4A</span>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Arquivo de Áudio *</label>
            <input
              type="file"
              accept=".mp3,.wav,.ogg,.m4a,.aac,audio/*"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setAudioFile(f);
                if (f && !name) setName(f.name.replace(/\.[^.]+$/, ''));
              }}
              className="admin-input text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Nome da Música *</label>
            <input
              type="text"
              placeholder="Ex: Marcha Nupcial Turbo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="admin-input"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Artista</label>
            <input
              type="text"
              placeholder="Nome do artista ou banda"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="admin-input"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="admin-select"
            >
              <option value="Festiva">Festiva</option>
              <option value="Cerimônia">Cerimônia</option>
              <option value="Dança">Dança</option>
              <option value="Velocidade">Velocidade / Eletrônica</option>
              <option value="Relaxante">Relaxante / Ambiente</option>
              <option value="Funk / Ritmo">Funk / Ritmo</option>
              <option value="Geral">Geral</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Disponibilidade / Jogo</label>
            <select
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="admin-select"
            >
              <option value="all">Disponibilizar Globalmente (Todos os Jogos)</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  Apenas para: {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-1">
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              Capa da Música (Opcional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              className="admin-input text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
              <span>Volume Padrão</span>
              <span className="text-amber-400">{defaultVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={defaultVolume}
              onChange={(e) => setDefaultVolume(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Ordem de Reprodução</label>
            <input
              type="number"
              min="0"
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value))}
              className="admin-input"
            />
          </div>

          <label className="flex items-center gap-2 pt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-xs font-bold text-slate-200">Ativar imediatamente</span>
          </label>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={uploading} className="admin-btn-primary">
            <Music className="w-4 h-4" />
            {uploading ? 'Enviando Áudio...' : 'Publicar Música Global'}
          </button>
        </div>
      </form>

      {/* Tracks Table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Prévia</th>
              <th>Música / Artista</th>
              <th>Categoria</th>
              <th>Jogo Associado</th>
              <th>Volume / Ordem</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => {
              const isPlaying = playingId === track.id;
              return (
                <tr key={track.id}>
                  <td>
                    <button
                      type="button"
                      onClick={() => togglePlay(track)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center border border-amber-500/40 bg-amber-500/15 text-amber-300"
                      title={isPlaying ? 'Pausar' : 'Tocar prévia'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      {track.cover_url ? (
                        <img
                          src={track.cover_url}
                          alt={track.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-700/60"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400">
                          <Music className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-white">{track.name}</p>
                        <p className="text-[11px] text-slate-400">{track.artist}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="admin-pill neutral">{track.category}</span>
                  </td>
                  <td>
                    <span className={`admin-pill ${track.game_id ? 'info' : 'warning'}`}>
                      {track.game_id ? (
                        <Gamepad2 className="w-3 h-3" />
                      ) : (
                        <Globe className="w-3 h-3" />
                      )}
                      {getGameName(track.game_id)}
                    </span>
                  </td>
                  <td>
                    <div className="text-xs text-slate-300 font-mono">
                      <span className="inline-flex items-center gap-1">
                        <Volume2 className="w-3 h-3 text-amber-400" />
                        {track.default_volume}%
                      </span>
                      <span className="text-slate-500"> · #{track.order_index}</span>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(track)}
                      className={`admin-pill ${track.is_active ? 'success' : 'danger'}`}
                    >
                      {track.is_active ? 'Ativa' : 'Desativada'}
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingTrack({ ...track })}
                        className="admin-btn-secondary"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(track)}
                        className="admin-btn-danger"
                        title="Excluir música"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {tracks.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">
                  Nenhuma música global cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Track Modal */}
      {editingTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form onSubmit={handleSaveEdit} className="admin-card w-full max-w-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <h3 className="text-base font-extrabold text-white">Editar Música Global</h3>
              <button
                type="button"
                onClick={() => setEditingTrack(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Nome</label>
              <input
                type="text"
                value={editingTrack.name}
                onChange={(e) => setEditingTrack({ ...editingTrack, name: e.target.value })}
                className="admin-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Artista</label>
                <input
                  type="text"
                  value={editingTrack.artist}
                  onChange={(e) => setEditingTrack({ ...editingTrack, artist: e.target.value })}
                  className="admin-input"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Categoria</label>
                <input
                  type="text"
                  value={editingTrack.category}
                  onChange={(e) => setEditingTrack({ ...editingTrack, category: e.target.value })}
                  className="admin-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Jogo Associado</label>
              <select
                value={editingTrack.game_id || ''}
                onChange={(e) => setEditingTrack({ ...editingTrack, game_id: e.target.value || null })}
                className="admin-select"
              >
                <option value="">Todos os Jogos (Global)</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Volume Padrão ({editingTrack.default_volume}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editingTrack.default_volume}
                  onChange={(e) =>
                    setEditingTrack({ ...editingTrack, default_volume: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Ordem</label>
                <input
                  type="number"
                  min="0"
                  value={editingTrack.order_index}
                  onChange={(e) =>
                    setEditingTrack({ ...editingTrack, order_index: Number(e.target.value) })
                  }
                  className="admin-input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTrack(null)}
                className="admin-btn-secondary"
              >
                Cancelar
              </button>
              <button type="submit" className="admin-btn-primary">
                <Save className="w-4 h-4" />
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
