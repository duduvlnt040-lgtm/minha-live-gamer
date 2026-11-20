import React, { useState } from 'react';
import { Settings, Lock, Save, Check, AlertCircle, User as UserIcon } from 'lucide-react';
import type { User } from '../types';

interface UserSettingsPageProps {
  user: User | null;
  onUserUpdated: (user: User) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const UserSettingsPage: React.FC<UserSettingsPageProps> = ({
  user,
  onUserUpdated,
  onOpenAuth,
}) => {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [tiktokUsername, setTiktokUsername] = useState(user?.tiktokUsername || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <Settings className="w-12 h-12 text-purple-400 mx-auto" />
        <h2 className="text-xl font-black text-white">Entre na sua conta</h2>
        <p className="text-xs text-slate-400">
          Faça login para gerenciar seu perfil, @ padrão do TikTok e senha.
        </p>
        <button
          onClick={() => onOpenAuth('login')}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs"
        >
          Entrar na Conta
        </button>
      </div>
    );
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSavingProfile(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, tiktokUsername }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar perfil.');
      onUserUpdated(data.user);
      if (tiktokUsername) {
        localStorage.setItem('tiktok_username', tiktokUsername.replace(/^@+/, ''));
      }
      setMessage('Perfil atualizado com sucesso!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirmPassword) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }
    setSavingPass(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Senha alterada com sucesso!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPass(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-display flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-purple-400" />
          <span>Minhas Configurações</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Personalize os dados da sua conta de streamer e mantenha sua senha segura.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="rounded-3xl glass-card p-6 border border-purple-500/25 space-y-4">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-purple-400" />
          Dados do Streamer
        </h2>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">E-mail da Conta</label>
          <input
            type="email"
            readOnly
            value={user.email}
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-purple-500/20 text-slate-400 text-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Nome de Exibição</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-white text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">@ Padrão do TikTok</label>
            <input
              type="text"
              placeholder="ex: meucanaloficial"
              value={tiktokUsername}
              onChange={(e) => setTiktokUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-white text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-xs flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{savingProfile ? 'Salvando...' : 'Salvar Perfil'}</span>
          </button>
        </div>
      </form>

      {/* Password Form */}
      <form onSubmit={handleChangePassword} className="rounded-3xl glass-card p-6 border border-purple-500/25 space-y-4">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-purple-400" />
          Alterar Senha
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Senha Atual</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-white text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Nova Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-white text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Confirmar Nova Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-white text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingPass}
            className="px-5 py-2.5 rounded-xl bg-purple-600/30 border border-purple-400 text-purple-200 font-extrabold text-xs flex items-center gap-2"
          >
            <Lock className="w-4 h-4" />
            <span>{savingPass ? 'Atualizando...' : 'Atualizar Senha'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
