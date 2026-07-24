import React, { useState, useEffect } from "react";
import { Game } from "../types";
import {
  signInWithGmail,
  isGmailAuthenticated,
  getGmailAccessToken,
  getGmailUserEmail,
  signOutGmail,
  sendGmailEmail,
  formatGameEmailHtml,
  formatLibraryReportHtml,
} from "../utils/gmail";
import { Mail, Send, X, CheckCircle, Loader2, AlertCircle, LogOut } from "lucide-react";

interface GmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  game?: Game | null;
  gamesListForReport?: Game[];
  triggerAlert: (title: string, message: string) => void;
}

export default function GmailModal({
  isOpen,
  onClose,
  game,
  gamesListForReport = [],
  triggerAlert,
}: GmailModalProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Choose between sending the specific game's diary or the general library report
  const [reportType, setReportType] = useState<"game" | "library">(game ? "game" : "library");
  const [customSubject, setCustomSubject] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);

  // Check connection state on load
  useEffect(() => {
    const authStatus = isGmailAuthenticated();
    setIsConnected(authStatus);
    if (authStatus) {
      const email = getGmailUserEmail();
      setUserEmail(email);
      if (email && !recipient) {
        setRecipient(email);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (game) {
      setReportType("game");
      setCustomSubject(`Diário de Jogatina: ${game.name}`);
    } else {
      setReportType("library");
      setCustomSubject("Relatório Geral de Status da Biblioteca");
    }
    setSendSuccess(false);
  }, [game, isOpen]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const token = await signInWithGmail();
      if (token) {
        setIsConnected(true);
        const email = getGmailUserEmail();
        setUserEmail(email);
        if (email) {
          setRecipient(email);
        }
      }
    } catch (err: any) {
      console.error("Erro ao conectar ao Gmail:", err);
      triggerAlert("Falha na Autenticação", err.message || "Erro desconhecido ao autenticar com o Google.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await signOutGmail();
    setIsConnected(false);
    setUserEmail(null);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return;
    if (!recipient.trim()) {
      triggerAlert("Campos Obrigatórios", "Informe o e-mail do destinatário.");
      return;
    }

    // MANDATORY Confirmation Dialog before sending emails on behalf of the user
    const confirmed = window.confirm(
      `Confirmação de Envio:\n\n` +
      `Deseja enviar este e-mail através da sua conta Gmail (${userEmail})?\n` +
      `Destinatário: ${recipient}\n` +
      `Assunto: ${customSubject}`
    );
    if (!confirmed) return;

    setIsSending(true);
    try {
      let htmlContent = "";
      if (reportType === "game" && game) {
        htmlContent = formatGameEmailHtml(game);
      } else {
        htmlContent = formatLibraryReportHtml(gamesListForReport);
      }

      await sendGmailEmail(recipient, customSubject, htmlContent);
      setSendSuccess(true);
    } catch (err: any) {
      console.error("Erro ao enviar e-mail:", err);
      triggerAlert("Erro ao Enviar", err.message || "Não foi possível enviar o e-mail via Gmail API.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl rounded-3xl border border-zinc-800 bg-[#080a10]/95 shadow-2xl overflow-hidden text-white z-10">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/40">
          <div className="flex items-center gap-2">
            <Mail className="text-cyan-400 w-5 h-5" />
            <span className="font-orbitron tracking-widest text-sm font-black uppercase text-cyan-300">
              Enviar via Gmail
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Connection Status card */}
          <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            {isConnected ? (
              <>
                <div className="flex items-center gap-2.5 min-w-0 self-start sm:self-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-950" />
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Gmail Conectado</p>
                    <p className="text-sm font-medium text-white truncate max-w-[200px] sm:max-w-xs">{userEmail}</p>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-red-950/20 hover:text-red-400 border border-zinc-800 hover:border-red-900/30 text-xs text-zinc-400 font-bold transition-all flex items-center gap-1.5 cursor-pointer self-end sm:self-center"
                >
                  <LogOut size={12} />
                  <span>Desconectar</span>
                </button>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="text-zinc-500 w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Conta do Google</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Conecte sua conta para poder enviar relatórios e diários em HTML diretamente do seu Gmail.</p>
                  </div>
                </div>
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shrink-0 cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 inline-block fill-current">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                      <span>Conectar Gmail</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Success screen */}
          {sendSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl animate-bounce">
                <CheckCircle size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold font-orbitron text-white">E-mail Enviado!</h3>
                <p className="text-sm text-zinc-400">O diário / relatório foi enviado com sucesso via Gmail para <strong className="text-zinc-200">{recipient}</strong>.</p>
              </div>
              <button
                onClick={() => setSendSuccess(false)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 font-bold transition-all cursor-pointer"
              >
                Enviar Outro E-mail
              </button>
            </div>
          ) : (
            /* Main Form */
            <form onSubmit={handleSendEmail} className="space-y-4">
              {/* Report selection if game is provided (otherwise always library) */}
              {game && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-zinc-400 font-bold block mb-1.5">
                    O que você quer enviar?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReportType("game");
                        setCustomSubject(`Diário de Jogatina: ${game.name}`);
                      }}
                      className={`px-4 py-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                        reportType === "game"
                          ? "bg-cyan-950/30 border-cyan-500/50 text-cyan-200"
                          : "bg-zinc-950/30 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                      }`}
                    >
                      Diário de {game.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReportType("library");
                        setCustomSubject("Relatório Geral de Status da Biblioteca");
                      }}
                      className={`px-4 py-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                        reportType === "library"
                          ? "bg-cyan-950/30 border-cyan-500/50 text-cyan-200"
                          : "bg-zinc-950/30 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                      }`}
                    >
                      Relatório Geral ({gamesListForReport.length} jogos)
                    </button>
                  </div>
                </div>
              )}

              {/* Recipient Input */}
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-widest text-zinc-400 font-bold block">
                  E-mail do Destinatário
                </label>
                <input
                  type="email"
                  placeholder="exemplo@gmail.com"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  disabled={!isConnected || isSending}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-950/65 border border-zinc-800/80 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-sm text-white placeholder-zinc-600 outline-none transition-all disabled:opacity-50"
                />
              </div>

              {/* Subject Input */}
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-widest text-zinc-400 font-bold block">
                  Assunto do E-mail
                </label>
                <input
                  type="text"
                  placeholder="Assunto"
                  required
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  disabled={!isConnected || isSending}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-950/65 border border-zinc-800/80 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-sm text-white placeholder-zinc-600 outline-none transition-all disabled:opacity-50"
                />
              </div>

              {/* Preview Notes */}
              <div className="p-3.5 rounded-2xl bg-zinc-950/35 border border-dashed border-zinc-900/80 text-xs text-zinc-500 leading-relaxed">
                <span className="font-bold text-zinc-400 uppercase tracking-wider block mb-1">Visualização do Conteúdo</span>
                {reportType === "game" && game ? (
                  <span>
                    Será enviado um e-mail com as informações de <strong className="text-zinc-300">{game.name}</strong> ({game.platform || "PC"}), sua nota pessoal ({game.rating}/5) e as <strong className="text-zinc-300">{game.diary?.length || 0} anotações</strong> registradas em seu diário com as imagens anexas.
                  </span>
                ) : (
                  <span>
                    Será enviado um resumo estatístico consolidado de todos os <strong className="text-zinc-300">{gamesListForReport.length} jogos</strong> da sua biblioteca, incluindo distribuições de status, tempo total de jogo acumulado e sua lista de jogos favoritos.
                  </span>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-2">
                {isConnected ? (
                  <button
                    type="submit"
                    disabled={isSending}
                    className="w-full py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSending ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Enviando via Gmail...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Confirmar e Enviar E-mail</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="text-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium">
                    ⚠️ Por favor, conecte sua Conta do Google acima para habilitar o envio por e-mail.
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
