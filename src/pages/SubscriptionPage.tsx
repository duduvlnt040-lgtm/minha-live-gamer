import React, { useState, useEffect } from 'react';
import { Crown, Check, Sparkles, ShieldCheck, ArrowRight, Clock, HelpCircle, ExternalLink } from 'lucide-react';
import type { User, UserAccess } from '../types';

interface SubscriptionPageProps {
  user: User | null;
  access: UserAccess | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const SubscriptionPage: React.FC<SubscriptionPageProps> = ({
  user,
  access,
  onOpenAuth,
}) => {
  const [planInfo, setPlanInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/subscription/plan')
      .then((res) => res.json())
      .then((data) => {
        setPlanInfo(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const features = [
    'Acesso a todos os jogos interativos da biblioteca global',
    'Conexão instantânea com TikTok LIVE pelo seu @ sem senha',
    'Overlays transparentes 9:16 para OBS e TikTok LIVE Studio',
    'Painel de controle com 7 abas de personalização avançada',
    'Gatilhos personalizados para presentes, comentários e curtidas',
    'Simulador em tempo real para testar antes de abrir a live',
    'Atualizações semanais com novos jogos e novidades',
    'Suporte prioritário via WhatsApp e Discord',
  ];

  function handleSubscribe() {
    if (!user) {
      onOpenAuth('register');
      return;
    }
    const checkoutUrl = planInfo?.checkoutUrl || 'https://cakto.com.br/checkout/minha-live-game-premium';
    window.open(checkoutUrl, '_blank');
  }

  return (
    <div className="min-h-[calc(100vh-4.5rem)] pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto pt-8 sm:pt-12">
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 text-xs font-bold mb-4 shadow-sm shadow-purple-900/40">
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>PLANO ÚNICO &amp; EXCLUSIVO</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white font-display tracking-tight leading-tight">
          Assinatura{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-violet-300 to-fuchsia-400">
            Minha Live Game
          </span>
        </h1>
        <p className="mt-3 text-sm text-slate-300 leading-relaxed">
          Tudo o que você precisa para transformar suas transmissões do TikTok em um verdadeiro espetáculo interativo de presentes.
        </p>
      </div>

      {/* Main Pricing Card */}
      <div className="max-w-xl mx-auto rounded-3xl glass-card border-2 border-purple-500/50 p-6 sm:p-10 shadow-2xl relative overflow-hidden bg-gradient-to-b from-[#191033] to-[#0f0b22]">
        <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-600 to-indigo-600 text-white font-extrabold text-[10px] tracking-wider uppercase px-4 py-1.5 rounded-bl-xl shadow-lg">
          3 DIAS DE TESTE GRÁTIS
        </div>

        {/* Plan Header */}
        <div className="mb-6">
          <h3 className="text-2xl font-black text-white font-display">
            MINHA LIVE GAME PREMIUM
          </h3>
          <p className="text-xs text-purple-300/80 mt-1">
            Plano mensal com renovação automática e cancelamento simples a qualquer momento.
          </p>

          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black text-white font-display">
              R$ 49,99
            </span>
            <span className="text-slate-400 font-bold text-sm">/ mês</span>
          </div>

          {/* Current Status Box */}
          <div className="mt-5 p-3.5 rounded-2xl bg-purple-950/50 border border-purple-500/30 text-xs">
            <p className="font-bold text-slate-200 flex items-center justify-between">
              <span>Status da sua conta:</span>
              <span
                className={`font-black uppercase px-2 py-0.5 rounded-full text-[10px] ${
                  access?.isAdmin
                    ? 'bg-amber-500/20 text-amber-300'
                    : access?.isSubscribed
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : access?.isTrial
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {access?.isAdmin
                  ? 'Acesso Vitalício Admin'
                  : access?.isSubscribed
                  ? 'Ativo'
                  : access?.isTrial
                  ? 'Em Período de Teste'
                  : 'Expirado'}
              </span>
            </p>
            <p className="text-slate-400 mt-1 text-[11px]">{access?.message}</p>
          </div>
        </div>

        {/* Feature List */}
        <div className="space-y-3 mb-8">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            O que está incluído:
          </p>
          {features.map((feat, i) => (
            <div key={i} className="flex items-start gap-2.5 text-xs text-slate-200">
              <div className="w-4 h-4 rounded-full bg-purple-600/30 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-purple-300" />
              </div>
              <span>{feat}</span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleSubscribe}
          className="w-full py-4 px-6 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 shadow-xl shadow-purple-600/40 transition-all active:scale-95 flex items-center justify-center gap-2 group"
        >
          <span>ASSINAR AGORA NA CAKTO</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="text-[11px] text-center text-slate-400 mt-4">
          Pagamento 100% seguro processado via <strong>CAKTO</strong>. Liberação automática imediata via webhook.
        </p>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto mt-12 space-y-4">
        <h4 className="text-lg font-bold text-white text-center font-display mb-4">
          Perguntas Frequentes
        </h4>

        <div className="p-4 rounded-2xl glass-card border border-purple-500/20 text-xs space-y-1">
          <p className="font-bold text-slate-200">Como funciona o período de 3 dias de teste?</p>
          <p className="text-slate-400 leading-relaxed">
            Assim que você cria sua conta, você recebe 72 horas para testar todos os jogos, conectar sua LIVE e transmitir no OBS. Após 72h, você pode assinar o plano por R$ 49,99/mês para continuar.
          </p>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-purple-500/20 text-xs space-y-1">
          <p className="font-bold text-slate-200">Preciso informar minha senha do TikTok?</p>
          <p className="text-slate-400 leading-relaxed">
            Nunca! O conector da Minha Live Game utiliza apenas o seu nome público (@ do TikTok) para escutar os presentes e comentários da sua live.
          </p>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-purple-500/20 text-xs space-y-1">
          <p className="font-bold text-slate-200">Posso cancelar a qualquer momento?</p>
          <p className="text-slate-400 leading-relaxed">
            Sim! Sem fidelidade ou taxas de cancelamento. Você cancela com um clique quando quiser.
          </p>
        </div>
      </div>
    </div>
  );
};
