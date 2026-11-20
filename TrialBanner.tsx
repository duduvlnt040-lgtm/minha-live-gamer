import React from 'react';
import { Clock, AlertTriangle, ShieldCheck, Crown, ArrowRight } from 'lucide-react';
import type { UserAccess } from '../types';

interface TrialBannerProps {
  access: UserAccess | null;
  onNavigateToSubscription: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ access, onNavigateToSubscription }) => {
  if (!access) return null;

  if (access.isAdmin) {
    return (
      <div className="bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-amber-950/40 border-b border-amber-500/20 px-4 py-1.5 text-center text-xs text-amber-300 font-medium flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-amber-400" />
        <span>Conta do Proprietário — Acesso Vitalício Irrestrito &amp; Painel Administrativo Ativo</span>
      </div>
    );
  }

  if (access.isSubscribed) {
    return (
      <div className="bg-emerald-950/40 border-b border-emerald-500/20 px-4 py-1.5 text-center text-xs text-emerald-300 font-medium flex items-center justify-center gap-2">
        <Crown className="w-4 h-4 text-emerald-400" />
        <span>Assinatura Minha Live Game Premium Ativa — Todas as transmissões e jogos liberados!</span>
      </div>
    );
  }

  if (access.isTrial) {
    return (
      <div className="bg-gradient-to-r from-purple-950/70 via-indigo-950/60 to-purple-950/70 border-b border-purple-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-purple-200">
          <Clock className="w-4 h-4 text-purple-400 animate-pulse" />
          <span>
            <strong>Período de Teste Gratuito:</strong> Você tem{' '}
            <span className="text-amber-300 font-bold">{access.trialHoursLeft} horas</span> restantes ({access.trialDaysLeft} dias) de teste total.
          </span>
        </div>
        <button
          onClick={onNavigateToSubscription}
          className="px-3 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
        >
          <span>Garantir Plano Premium (R$ 49,99/mês)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Trial expired
  return (
    <div className="bg-rose-950/80 border-b border-rose-500/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-200 shadow-md">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
        <span>
          <strong>Teste de 3 dias finalizado:</strong> A conexão com a TikTok LIVE e os overlays do OBS estão pausados. Assine para continuar animando sua live.
        </span>
      </div>
      <button
        onClick={onNavigateToSubscription}
        className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold transition-all flex items-center gap-1.5 shadow-lg shadow-rose-600/40 active:scale-95"
      >
        <span>Desbloquear Agora — R$ 49,99</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
