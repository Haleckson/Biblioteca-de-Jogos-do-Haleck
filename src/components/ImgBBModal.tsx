/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Key, CheckCircle2, AlertCircle, ExternalLink, X, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { getCustomImgBBKey, setCustomImgBBKey } from "../utils/imgbb";

interface ImgBBModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImgBBModal({ isOpen, onClose }: ImgBBModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

  useEffect(() => {
    if (isOpen) {
      setApiKey(getCustomImgBBKey());
      setStatus({ type: "idle" });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndSave = async () => {
    const trimmed = apiKey.trim();
    setStatus({ type: "loading", message: "Testando a chave de API com o ImgBB..." });

    // Test the key using a tiny 1x1 transparent GIF base64
    const testImage = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    try {
      const res = await fetch("/api/upload-imgbb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: testImage,
          name: "test_key_validation",
          userApiKey: trimmed
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.url) {
        setCustomImgBBKey(trimmed);
        setStatus({
          type: "success",
          message: trimmed
            ? "Sua chave de API do ImgBB foi validada e salva com sucesso!"
            : "Chave removida. O aplicativo usará as variáveis de ambiente do sistema."
        });

        // Optionally delete the test image from ImgBB if deleteUrl was returned
        if (data.deleteUrl) {
          fetch("/api/delete-imgbb", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deleteUrl: data.deleteUrl })
          }).catch(() => {});
        }
      } else {
        const errorMsg = data?.error || data?.details || "Chave recusada pela API do ImgBB.";
        setStatus({
          type: "error",
          message: `Falha na validação: ${errorMsg}`
        });
      }
    } catch (err: any) {
      setStatus({
        type: "error",
        message: `Erro ao conectar com o serviço: ${err?.message || err}`
      });
    }
  };

  const handleRemoveKey = () => {
    setCustomImgBBKey("");
    setApiKey("");
    setStatus({
      type: "success",
      message: "Chave personalizada removida."
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl bg-[#0a0a10] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl text-white space-y-5 overflow-hidden cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          title="Fechar"
        >
          <X size={18} />
        </button>

        {/* Header Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Key size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide">Configurar Chave ImgBB</h3>
            <p className="text-xs text-gray-400">Chave de API para upload ilimitado de imagens</p>
          </div>
        </div>

        {/* Informative Box */}
        <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-xs text-cyan-200/90 leading-relaxed space-y-2">
          <p>
            O ImgBB oferece contas e chaves de API 100% gratuitas. Para evitar limites de cota da chave compartilhada, insira sua própria chave de API.
          </p>
          <a
            href="https://api.imgbb.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-cyan-400 font-bold hover:underline"
          >
            Obter chave gratuita em api.imgbb.com
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Input Form */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
            Chave de API (32 caracteres)
          </label>
          <div className="relative">
            <input
              type="text"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setStatus({ type: "idle" });
              }}
              placeholder="Cole sua chave aqui (ex: f372a593e8a4...)"
              className="w-full bg-[#12131d] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono transition-all"
            />
          </div>
        </div>

        {/* Status Messages */}
        {status.type === "loading" && (
          <div className="flex items-center gap-2 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-xs text-cyan-300 animate-pulse">
            <Loader2 size={16} className="animate-spin text-cyan-400" />
            <span>{status.message}</span>
          </div>
        )}

        {status.type === "success" && (
          <div className="flex items-start gap-2.5 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <span>{status.message}</span>
          </div>
        )}

        {status.type === "error" && (
          <div className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{status.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-800">
          {getCustomImgBBKey() ? (
            <button
              onClick={handleRemoveKey}
              className="px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              Remover Chave
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handleTestAndSave}
              disabled={status.type === "loading"}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-950/50 hover:shadow-cyan-500/20 transition-all disabled:opacity-50"
            >
              {status.type === "loading" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              Testar e Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
