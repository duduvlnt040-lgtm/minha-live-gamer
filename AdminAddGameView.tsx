import React, { useState, useRef } from 'react';
import {
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Maximize2,
  Play,
  Gift,
  Heart,
  MessageCircle,
  Image as ImageIcon,
  Sparkles,
  FileArchive,
  ShieldCheck,
} from 'lucide-react';
import type { Game } from '../../types';

interface AdminAddGameViewProps {
  onGamePublished: (game: Game) => void;
  showToast: (msg: string) => void;
}

export const AdminAddGameView: React.FC<AdminAddGameViewProps> = ({
  onGamePublished,
  showToast,
}) => {
  const [sourceType, setSourceType] = useState<'zip' | 'link'>('zip');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('3D Interativo');
  const [version, setVersion] = useState('1.0.0');
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  // Source inputs
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');

  // Cover & Thumbnail
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');

  // Validation & Live Preview State
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [previewId, setPreviewId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [entryHtml, setEntryHtml] = useState('');
  const [fileCount, setFileCount] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  function resetValidation() {
    setValidated(false);
    setValidationMessage('');
    setPreviewId('');
    setPreviewUrl('');
    setEntryHtml('');
    setFileCount(0);
    setIframeLoaded(false);
  }

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setCoverFile(file);
    if (file) {
      setCoverPreview(URL.createObjectURL(file));
    } else {
      setCoverPreview('');
    }
  }

  function handleThumbSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setThumbnailFile(file);
    if (file) {
      setThumbnailPreview(URL.createObjectURL(file));
    } else {
      setThumbnailPreview('');
    }
  }

  async function handleValidateZip() {
    if (!zipFile) {
      setError('Selecione um arquivo .ZIP antes de validar.');
      return;
    }
    setError('');
    setValidating(true);
    resetValidation();

    try {
      const fd = new FormData();
      fd.append('zipFile', zipFile);
      const res = await fetch('/api/admin/games/preview-zip', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na validação do arquivo ZIP.');

      setValidated(true);
      setPreviewId(data.previewId);
      setPreviewUrl(data.previewUrl);
      setEntryHtml(data.entryHtml);
      setFileCount(data.fileCount || 0);
      setIframeKey((k) => k + 1);
      setValidationMessage(
        `ZIP validado! Arquivo de entrada "${data.entryHtml}" encontrado (${data.fileCount} arquivos). Teste na prévia ao lado.`
      );
      if (!name.trim()) {
        setName(zipFile.name.replace(/\.zip$/i, '').replace(/[-_]+/g, ' '));
      }
      showToast('Jogo ZIP validado e carregado na prévia real!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  }

  async function handleValidateLink() {
    if (!linkUrl.trim()) {
      setError('Informe a URL completa (https://...) do jogo para validar.');
      return;
    }
    setError('');
    setValidating(true);
    resetValidation();

    try {
      const res = await fetch('/api/admin/games/validate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao validar URL do jogo.');

      setValidated(true);
      setPreviewUrl(data.previewUrl);
      setIframeKey((k) => k + 1);
      setValidationMessage('Link externo validado com suporte a iframe! Teste o jogo na prévia ao lado.');
      showToast('URL validada e carregada na prévia real!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  }

  function sendTestEventToPreview(eventType: 'gift' | 'like' | 'comment') {
    if (!iframeRef.current?.contentWindow) return;
    const payload =
      eventType === 'gift'
        ? { type: 'gift', user: '@AdminTeste', giftName: 'Rosa Dourada', giftValue: 10, count: 1, timestamp: Date.now(), simulation: true }
        : eventType === 'like'
        ? { type: 'like', user: '@AdminTeste', count: 50, timestamp: Date.now(), simulation: true }
        : { type: 'comment', user: '@AdminTeste', comment: '!dancar', timestamp: Date.now(), simulation: true };

    iframeRef.current.contentWindow.postMessage({ type: 'live:event', payload }, '*');
    iframeRef.current.contentWindow.postMessage({ type: 'minha-live-games:event', payload }, '*');
    showToast(`Evento de teste (${eventType}) enviado para a prévia do jogo!`);
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Informe o nome do jogo.');
      return;
    }
    if (isActive && !validated) {
      setError('Não é permitido publicar um jogo sem antes validar e testar na prévia real.');
      return;
    }
    if (!validated) {
      setError('Valide o arquivo ZIP ou o link antes de cadastrar o jogo.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('description', description.trim() || `Jogo interativo ${name.trim()} para TikTok LIVE.`);
      fd.append('category', category);
      fd.append('version', version.trim() || '1.0.0');
      fd.append('isActive', String(isActive));
      fd.append('isFeatured', String(isFeatured));
      if (coverFile) fd.append('coverFile', coverFile);
      if (thumbnailFile) fd.append('thumbnailFile', thumbnailFile);

      let endpoint = '/api/admin/games/upload-zip';
      if (sourceType === 'zip') {
        if (previewId) {
          fd.append('previewId', previewId);
        } else if (zipFile) {
          fd.append('zipFile', zipFile);
        }
      } else {
        endpoint = '/api/admin/games/link';
        fd.append('url', linkUrl.trim());
      }

      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao publicar jogo.');

      showToast(`Jogo "${data.game.name}" publicado na Biblioteca Global!`);
      onGamePublished(data.game);

      // Reset form
      setName('');
      setDescription('');
      setVersion('1.0.0');
      setZipFile(null);
      setLinkUrl('');
      setCoverFile(null);
      setCoverPreview('');
      setThumbnailFile(null);
      setThumbnailPreview('');
      resetValidation();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Adicionar Novo Jogo Global</h2>
          <p className="text-xs text-slate-400 mt-1">
            Valide e teste o jogo ao vivo na coluna esquerda antes de publicá-lo automaticamente na biblioteca de todos os usuários.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`admin-pill ${validated ? 'success' : 'warning'}`}>
            {validated ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                Jogo Validado — Pronto para Publicar
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                Aguardando Validação Obrigatória
              </>
            )}
          </span>
        </div>
      </div>

      {/* DUAS COLUNAS: ESQUERDA PRÉVIA REAL | DIREITA FORMULÁRIO */}
      <div className="admin-two-col">
        {/* COLUNA ESQUERDA: PRÉVIA REAL DO JOGO FUNCIONANDO */}
        <div className="admin-card flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                Prévia Real do Jogo (Execução ao Vivo)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {previewUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => setIframeKey((k) => k + 1)}
                    className="admin-btn-secondary"
                    title="Recarregar jogo"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Recarregar
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(previewUrl, '_blank')}
                    className="admin-btn-secondary"
                    title="Abrir em nova aba"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Nova Aba
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Live Iframe Container */}
          <div
            className="relative w-full rounded-xl overflow-hidden border border-slate-700/60 bg-black flex items-center justify-center"
            style={{ height: '520px' }}
          >
            {previewUrl ? (
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={previewUrl}
                title="Prévia real do jogo"
                onLoad={() => setIframeLoaded(true)}
                allow="autoplay; fullscreen"
                style={{ width: '100%', height: '100%', border: 'none', background: '#05050a' }}
              />
            ) : (
              <div className="text-center p-8 max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
                  <FileArchive className="w-7 h-7 text-amber-400" />
                </div>
                <p className="text-sm font-bold text-slate-200">
                  Nenhuma prévia carregada ainda
                </p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Envie um arquivo <strong>.ZIP</strong> ou informe uma <strong>URL</strong> na coluna à direita e clique em{' '}
                  <strong>Validar e Testar Prévia</strong>. O jogo será executado aqui de verdade.
                </p>
              </div>
            )}
          </div>

          {/* Simulation Test Controls */}
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-300">
              <strong className="text-white">Testar Interação:</strong>{' '}
              {iframeLoaded ? (
                <span className="text-emerald-400 font-semibold">Jogo carregado no iframe</span>
              ) : previewUrl ? (
                <span className="text-amber-300">Carregando prévia...</span>
              ) : (
                <span className="text-slate-500">Valide o jogo para testar eventos</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={!previewUrl}
                onClick={() => sendTestEventToPreview('gift')}
                className="admin-btn-secondary"
              >
                <Gift className="w-3.5 h-3.5 text-pink-400" />
                Simular Presente
              </button>
              <button
                type="button"
                disabled={!previewUrl}
                onClick={() => sendTestEventToPreview('like')}
                className="admin-btn-secondary"
              >
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                Simular Curtida
              </button>
              <button
                type="button"
                disabled={!previewUrl}
                onClick={() => sendTestEventToPreview('comment')}
                className="admin-btn-secondary"
              >
                <MessageCircle className="w-3.5 h-3.5 text-cyan-400" />
                Simular Chat
              </button>
            </div>
          </div>

          {validationMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{validationMessage}</p>
                {entryHtml && (
                  <p className="text-[11px] text-emerald-200/80 mt-0.5 font-mono">
                    Entrada: {entryHtml} · Arquivos: {fileCount}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: FORMULÁRIO DE CADASTRO E CONFIGURAÇÃO */}
        <form onSubmit={handlePublish} className="admin-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Dados e Arquivos do Jogo
            </h3>
            <span className="text-[11px] text-slate-400">Publicação Global</span>
          </div>

          {/* Tipo de Origem: ZIP ou Link */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-900/70 border border-slate-700/60">
            <button
              type="button"
              onClick={() => {
                setSourceType('zip');
                resetValidation();
                setError('');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                sourceType === 'zip'
                  ? 'bg-amber-500 text-black'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Arquivo ZIP (HTML5/3D)
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceType('link');
                resetValidation();
                setError('');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                sourceType === 'link'
                  ? 'bg-amber-500 text-black'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Link Externo (URL)
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload ZIP ou Link + Botão Validar */}
          {sourceType === 'zip' ? (
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/70 border border-slate-700/60">
              <label className="block text-xs font-bold text-slate-200">
                1. Arquivo ZIP do Jogo (obrigatório conter index.html)
              </label>
              <input
                type="file"
                accept=".zip"
                onChange={(e) => {
                  setZipFile(e.target.files?.[0] || null);
                  resetValidation();
                }}
                className="admin-input text-xs"
              />
              <button
                type="button"
                onClick={handleValidateZip}
                disabled={validating || !zipFile}
                className="admin-btn-secondary w-full"
              >
                <Play className="w-3.5 h-3.5 text-amber-400" />
                {validating ? 'Extraindo e Validando ZIP...' : 'Validar ZIP e Carregar Prévia Real'}
              </button>
            </div>
          ) : (
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/70 border border-slate-700/60">
              <label className="block text-xs font-bold text-slate-200">
                1. URL do Jogo Web (HTTP/HTTPS compatível com iframe)
              </label>
              <input
                type="url"
                placeholder="https://meujogo.com/index.html"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  resetValidation();
                }}
                className="admin-input"
              />
              <button
                type="button"
                onClick={handleValidateLink}
                disabled={validating || !linkUrl.trim()}
                className="admin-btn-secondary w-full"
              >
                <Play className="w-3.5 h-3.5 text-amber-400" />
                {validating ? 'Testando disponibilidade e iframe...' : 'Validar Link e Carregar Prévia Real'}
              </button>
            </div>
          )}

          {/* Nome e Versão */}
          <div className="grid grid-cols-3 gap-3">
            <div style={{ gridColumn: 'span 2' }}>
              <label className="block text-xs font-bold text-slate-300 mb-1">Nome do Jogo *</label>
              <input
                type="text"
                required
                placeholder="Ex: Batalha Galáctica 3D"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="admin-input"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Versão</label>
              <input
                type="text"
                placeholder="1.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="admin-input font-mono"
              />
            </div>
          </div>

          {/* Categoria e Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="admin-select"
              >
                <option value="3D Interativo">3D Interativo</option>
                <option value="Competitivo">Competitivo</option>
                <option value="Simulação">Simulação</option>
                <option value="Arcade">Arcade</option>
                <option value="Quiz / Chat">Quiz / Chat</option>
                <option value="Web Link">Web Link</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Status Inicial</label>
              <select
                value={isActive ? 'published' : 'disabled'}
                onChange={(e) => setIsActive(e.target.value === 'published')}
                className="admin-select"
              >
                <option value="published">Publicado (Global)</option>
                <option value="disabled">Desativado (Rascunho)</option>
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Descrição</label>
            <textarea
              rows={3}
              placeholder="Explique como os presentes, comentários e curtidas do TikTok interagem com o jogo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="admin-textarea resize-none"
            />
          </div>

          {/* Upload de Capa e Miniatura */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                Capa do Jogo
              </label>
              <input type="file" accept="image/*" onChange={handleCoverSelect} className="text-[11px] text-slate-300 w-full" />
              {coverPreview && (
                <img
                  src={coverPreview}
                  alt="Prévia capa"
                  className="w-full rounded-lg object-cover border border-slate-700/60"
                  style={{ height: '72px' }}
                />
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                Miniatura (Thumb)
              </label>
              <input type="file" accept="image/*" onChange={handleThumbSelect} className="text-[11px] text-slate-300 w-full" />
              {thumbnailPreview && (
                <img
                  src={thumbnailPreview}
                  alt="Prévia miniatura"
                  className="w-full rounded-lg object-cover border border-slate-700/60"
                  style={{ height: '72px' }}
                />
              )}
            </div>
          </div>

          {/* Destaque Checkbox */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 cursor-pointer">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-xs font-bold text-slate-200">
              Exibir selo de DESTAQUE na biblioteca global dos usuários
            </span>
          </label>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !validated}
            className="admin-btn-primary w-full py-3"
          >
            <Sparkles className="w-4 h-4" />
            {submitting
              ? 'Publicando na Biblioteca Global...'
              : validated
              ? isActive
                ? 'Publicar Jogo na Biblioteca Global'
                : 'Salvar Jogo como Desativado'
              : 'Valide o Jogo Antes de Publicar'}
          </button>
        </form>
      </div>
    </div>
  );
};
