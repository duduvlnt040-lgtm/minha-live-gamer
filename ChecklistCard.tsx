import React from 'react';
import { CheckCircle2, Circle, Radio, ExternalLink, Sparkles } from 'lucide-react';
import type { LiveStatus } from '../types';

interface ChecklistCardProps {
  tiktokUsername: string;
  liveStatus: LiveStatus | null;
  eventsCount: number;
  overlayActive: boolean;
  onOpenOverlay: () => void;
}

export const ChecklistCard: React.FC<ChecklistCardProps> = ({
  tiktokUsername,
  liveStatus,
  eventsCount,
  overlayActive,
  onOpenOverlay,
}) => {
  const step1 = Boolean(tiktokUsername.trim().length >= 2);
  const step2 = Boolean(liveStatus?.connected);
  const step3 = Boolean(overlayActive || (liveStatus?.activeOverlayCount ?? 0) > 0);
  const step4 = Boolean(eventsCount > 0);
  const step5 = Boolean(step2 && step3);

  const completedCount = [step1, step2, step3, step4, step5].filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 5) * 100);

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5 border border-purple-500/25 bg-[#120d26]/80 text-white">
      {/* Header with Progress */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center">
            <Radio className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="font-extrabold text-sm text-slate-100 font-display">
            Checklist de Conexão da LIVE
          </h3>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30">
          {progressPercent}% Concluído
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-purple-950/60 rounded-full h-1.5 mb-4 overflow-hidden border border-purple-500/10">
        <div
          className="bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Checklist Items */}
      <div className="space-y-2 text-xs">
        {/* Item 1 */}
        <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-purple-950/20 border border-purple-500/10">
          <div className="flex items-center gap-2">
            {step1 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span className={step1 ? 'text-slate-200 font-semibold' : 'text-slate-400'}>
              1. @ do TikTok preenchido
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {step1 ? `@${tiktokUsername}` : 'Pendente'}
          </span>
        </div>

        {/* Item 2 */}
        <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-purple-950/20 border border-purple-500/10">
          <div className="flex items-center gap-2">
            {step2 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span className={step2 ? 'text-slate-200 font-semibold' : 'text-slate-400'}>
              2. LIVE conectada no TikTok
            </span>
          </div>
          <span className={`text-[10px] font-bold ${step2 ? 'text-emerald-400' : 'text-slate-400'}`}>
            {step2 ? 'Online' : 'Desconectada'}
          </span>
        </div>

        {/* Item 3 */}
        <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-purple-950/20 border border-purple-500/10">
          <div className="flex items-center gap-2">
            {step3 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span className={step3 ? 'text-slate-200 font-semibold' : 'text-slate-400'}>
              3. Jogo aberto no OBS / TikTok Studio
            </span>
          </div>
          <button
            onClick={onOpenOverlay}
            className="text-[10px] text-purple-400 hover:text-purple-300 underline flex items-center gap-0.5"
          >
            Abrir Overlay <ExternalLink className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Item 4 */}
        <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-purple-950/20 border border-purple-500/10">
          <div className="flex items-center gap-2">
            {step4 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span className={step4 ? 'text-slate-200 font-semibold' : 'text-slate-400'}>
              4. Primeiro evento recebido
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {eventsCount > 0 ? `${eventsCount} eventos` : 'Aguardando'}
          </span>
        </div>

        {/* Item 5 */}
        <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-purple-950/20 border border-purple-500/10">
          <div className="flex items-center gap-2">
            {step5 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span className={step5 ? 'text-slate-200 font-semibold' : 'text-slate-400'}>
              5. Overlay sincronizado e funcionando
            </span>
          </div>
          <span className={`text-[10px] font-bold ${step5 ? 'text-emerald-400' : 'text-slate-400'}`}>
            {step5 ? 'Pronto para a LIVE!' : 'Incompleto'}
          </span>
        </div>
      </div>
    </div>
  );
};
