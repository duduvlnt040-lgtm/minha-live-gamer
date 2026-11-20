import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User as UserIcon, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import type { User, UserAccess } from '../types';
import { setSessionToken } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: User, access: UserAccess) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError('');
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'register' && password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'register'
          ? { email, password, displayName }
          : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Falha na autenticação.');
      }

      if (data.sessionToken) {
        setSessionToken(data.sessionToken);
      }
      onSuccess(data.user, data.access);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md rounded-2xl glass-card bg-[#130d2a] border border-purple-500/30 p-6 sm:p-8 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-900/30 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>MINHA LIVE GAME</span>
          </div>
          <h2 className="text-2xl font-black text-white font-display">
            {mode === 'login' ? 'Entrar na sua Conta' : 'Criar Conta Gratuita'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'login'
              ? 'Acesse seu painel e conecte sua LIVE aos jogos interativos.'
              : 'Comece com 3 dias de teste gratuito completo em todos os jogos.'}
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex rounded-xl bg-purple-950/60 p-1 mb-6 border border-purple-500/20">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Criar Conta (3 dias grátis)
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 flex items-start gap-2.5 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nome Completo / Streamer
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Seu nome ou canal"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="Repita sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <span>Carregando...</span>
            ) : mode === 'login' ? (
              <>
                <span>Entrar na Plataforma</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Iniciar 3 Dias de Teste Grátis</span>
                <Sparkles className="w-4 h-4 text-amber-300" />
              </>
            )}
          </button>
        </form>

        {/* Footer Note */}
        <p className="text-[11px] text-center text-slate-400 mt-5">
          {mode === 'login' ? (
            <span>
              Não tem uma conta?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-purple-400 hover:underline font-bold"
              >
                Cadastre-se grátis
              </button>
            </span>
          ) : (
            <span>
              Já tem conta?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-purple-400 hover:underline font-bold"
              >
                Faça login
              </button>
            </span>
          )}
        </p>
      </div>
    </div>
  );
};
