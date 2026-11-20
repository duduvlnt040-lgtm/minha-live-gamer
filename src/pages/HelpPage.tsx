import React from 'react';
import { HelpCircle, Radio, Music, Monitor, Crown, Sparkles } from 'lucide-react';

export const HelpPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white font-display flex items-center gap-2.5">
          <HelpCircle className="w-7 h-7 text-purple-400" />
          <span>Central de Ajuda — Minha Live Game</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Aprenda em poucos minutos como configurar seus jogos no OBS Studio, TikTok LIVE Studio e adicionar suas próprias músicas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-3xl glass-card p-6 border border-purple-500/25 space-y-2">
          <Monitor className="w-6 h-6 text-purple-400" />
          <h2 className="text-base font-black text-white">1. Configurar no OBS / TikTok LIVE Studio</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Abra o jogo desejado na <strong>Biblioteca de Jogos</strong> e clique em <strong>COPIAR LINK OVERLAY</strong>. No OBS ou TikTok LIVE Studio, adicione uma fonte do tipo <strong>Navegador (Browser Source)</strong>, cole o link e defina <strong>1080 x 1920</strong> para formato vertical.
          </p>
        </div>

        <div className="rounded-3xl glass-card p-6 border border-purple-500/25 space-y-2">
          <Radio className="w-6 h-6 text-emerald-400" />
          <h2 className="text-base font-black text-white">2. Conectar sua TikTok LIVE</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Vá em <strong>Minha conta TikTok</strong> ou use a barra superior do jogo, informe apenas o seu <strong>@ público</strong> (nunca pedimos sua senha!) e clique em conectar com a sua transmissão já aberta.
          </p>
        </div>

        <div className="rounded-3xl glass-card p-6 border border-purple-500/25 space-y-2">
          <Music className="w-6 h-6 text-pink-400" />
          <h2 className="text-base font-black text-white">3. Adicionar Músicas Particulares</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Dentro da página do jogo, clique na aba <strong>MÚSICA</strong> e em <strong>ADICIONAR MINHA MÚSICA</strong>. Suas faixas ficam salvas de forma 100% privada na sua conta e você pode montar playlists com repetição, volume e reprodução automática.
          </p>
        </div>

        <div className="rounded-3xl glass-card p-6 border border-purple-500/25 space-y-2">
          <Crown className="w-6 h-6 text-amber-400" />
          <h2 className="text-base font-black text-white">4. Teste de 72h e Assinatura Premium</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Todas as novas contas recebem <strong>72 horas (3 dias) de teste gratuito</strong>. Depois desse período, assine o plano único <strong>MINHA LIVE GAME PREMIUM (R$ 49,99/mês)</strong> pela Cakto com liberação automática imediata.
          </p>
        </div>
      </div>

      <div className="rounded-3xl glass-card p-6 border border-purple-500/25 space-y-3">
        <h3 className="text-base font-black text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Dica de Áudio no OBS / Navegador
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          Se o navegador bloquear o início automático da música antes da primeira interação, basta clicar uma vez sobre a tela da fonte de navegador (no OBS, use <em>Interagir</em>) ou habilitar a opção <strong>Controlar áudio via OBS</strong> nas propriedades da fonte de navegador.
        </p>
      </div>
    </div>
  );
};
