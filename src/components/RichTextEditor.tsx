import React, { useRef, useEffect, useState } from "react";
import { Bold, Italic, Underline, Link, List, ListOrdered, Sparkles, Palette, RotateCcw, Indent, Loader2, Check, Copy, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cleanHTMLText } from "../utils/htmlSanitizer";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  gameName?: string;
}

export default function RichTextEditor({ value, onChange, placeholder = "Escreva aqui...", gameName }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // AI Text Correction states
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionData, setCorrectionData] = useState<{
    correctedText: string;
    explanation: string;
    changes?: string[];
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editableSuggestedText, setEditableSuggestedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAICorrection = async () => {
    if (!value || !value.trim() || value === "<p></p>" || value === "<p><br></p>" || value === "<br>") {
      setErrorMsg("Por favor, digite algum texto primeiro no diário de jogatina para poder corrigi-lo.");
      return;
    }

    setIsCorrecting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/correct-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: value,
          gameName: gameName || ""
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Erro ao conectar com o serviço de IA.");
      }

      const data = await res.json();
      setCorrectionData(data);
      setEditableSuggestedText(data.correctedText);
      setShowPreview(true);
    } catch (err: any) {
      console.error("Erro na correção por IA:", err);
      setErrorMsg(err.message);
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleCopy = () => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = editableSuggestedText;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const [tabSize, setTabSize] = useState<number>(() => {
    return Number(localStorage.getItem("editor_tab_size")) || 4;
  });

  const handleTabSizeChange = (size: number) => {
    setTabSize(size);
    localStorage.setItem("editor_tab_size", String(size));
  };

  // Sync content with the value prop
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }
  }, [value]);

  useEffect(() => {
    // Set default paragraph separator to p tag on mount
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch (e) {
      console.warn("Could not set defaultParagraphSeparator", e);
    }
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const spaces = "&nbsp;".repeat(tabSize);
      try {
        document.execCommand("insertHTML", false, spaces);
      } catch (err) {
        // Fallback if insertHTML is not supported
        const range = window.getSelection()?.getRangeAt(0);
        if (range) {
          const tabNode = document.createTextNode("\u00a0".repeat(tabSize));
          range.insertNode(tabNode);
          range.setStartAfter(tabNode);
          range.setEndAfter(tabNode);
        }
      }
      handleInput();
    }
  };

  const handleFocus = () => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch (e) {}
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");

    if (html) {
      const cleaned = cleanHTMLText(html);
      try {
        document.execCommand("insertHTML", false, cleaned);
      } catch (err) {
        // Fallback
        const range = window.getSelection()?.getRangeAt(0);
        if (range) {
          const fragment = range.createContextualFragment(cleaned);
          range.deleteContents();
          range.insertNode(fragment);
        }
      }
    } else if (text) {
      const cleanText = text.replace(/\r\n/g, "<br>").replace(/\n/g, "<br>");
      try {
        document.execCommand("insertHTML", false, cleanText);
      } catch (err) {
        const range = window.getSelection()?.getRangeAt(0);
        if (range) {
          const textNode = document.createTextNode(text);
          range.deleteContents();
          range.insertNode(textNode);
        }
      }
    }
    handleInput();
  };

  const executeCommand = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    handleInput();
  };

  const handleAddLink = () => {
    const url = prompt("Digite o link (ex: https://google.com):");
    if (url) {
      executeCommand("createLink", url);
    }
  };

  const textColorOptions = [
    { name: "Padrão", color: "#ffffff" },
    { name: "Ciano", color: "#22d3ee" },
    { name: "Esmeralda", color: "#34d399" },
    { name: "Âmbar", color: "#fbbf24" },
    { name: "Rosa", color: "#f43f5e" },
    { name: "Roxo", color: "#c084fc" },
  ];

  const bgColorOptions = [
    { name: "Sem fundo", color: "transparent" },
    { name: "Fundo Vermelho", color: "#991b1b" },
    { name: "Fundo Amarelo", color: "#78350f" },
    { name: "Fundo Verde", color: "#064e3b" },
    { name: "Fundo Azul", color: "#1e3a8a" },
    { name: "Fundo Roxo", color: "#581c87" },
  ];

  return (
    <div className="border border-zinc-800 rounded-2xl bg-zinc-950/80 backdrop-blur-md overflow-hidden focus-within:ring-2 focus-within:ring-cyan-500/50 transition-all flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-zinc-900 border-b border-zinc-800/80 select-none">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("bold");
          }}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
          title="Negrito"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("italic");
          }}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
          title="Itálico"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("underline");
          }}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
          title="Sublinhado"
        >
          <Underline size={15} />
        </button>

        <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("insertUnorderedList");
          }}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
          title="Lista"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("insertOrderedList");
          }}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
          title="Lista Numerada"
        >
          <ListOrdered size={15} />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleAddLink();
          }}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
          title="Link"
        >
          <Link size={15} />
        </button>

        <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

        {/* Text Color Dropdown */}
        <div className="relative group/color">
          <button
            type="button"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors flex items-center gap-1"
            title="Cor do Texto"
          >
            <Palette size={15} />
            <span className="text-[10px] font-bold text-zinc-500">A</span>
          </button>
          <div className="absolute left-0 mt-1 hidden group-hover/color:flex flex-col gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 shadow-xl z-30 min-w-[120px]">
            <p className="text-[9px] font-black uppercase text-zinc-500 px-2 py-0.5 tracking-wider">Cor da letra</p>
            {textColorOptions.map((opt) => (
              <button
                key={opt.name}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  executeCommand("foreColor", opt.color);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800 text-xs text-zinc-300 w-full text-left"
              >
                <span className="w-3 h-3 rounded-full border border-zinc-700" style={{ backgroundColor: opt.color }} />
                <span>{opt.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Background Highlight Dropdown */}
        <div className="relative group/bg">
          <button
            type="button"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors flex items-center gap-1"
            title="Destaque de Fundo"
          >
            <Sparkles size={14} />
            <span className="text-[10px] font-bold text-zinc-500">BG</span>
          </button>
          <div className="absolute left-0 mt-1 hidden group-hover/bg:flex flex-col gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 shadow-xl z-30 min-w-[140px]">
            <p className="text-[9px] font-black uppercase text-zinc-500 px-2 py-0.5 tracking-wider">Destaque de fundo</p>
            {bgColorOptions.map((opt) => (
              <button
                key={opt.name}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  executeCommand("hiliteColor", opt.color);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800 text-xs text-zinc-300 w-full text-left"
              >
                <span className="w-3 h-3 rounded-full border border-zinc-700" style={{ backgroundColor: opt.color }} />
                <span>{opt.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

        {/* AI Text Corrector Button */}
        <button
          type="button"
          onClick={handleAICorrection}
          disabled={isCorrecting}
          className={`px-2.5 py-1.5 rounded-xl text-purple-300 hover:text-white bg-purple-950/20 hover:bg-purple-900/30 border border-purple-500/30 hover:border-purple-400 transition-all flex items-center gap-1.5 cursor-pointer select-none shrink-0 shadow-sm shadow-purple-950/30 relative overflow-hidden group/ai-btn ${isCorrecting ? "opacity-80 animate-pulse" : ""}`}
          title="Corrigir ortografia, gramática e termos específicos do jogo com IA"
        >
          {/* Subtle animated light sweep */}
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/10 to-transparent -translate-x-full group-hover/ai-btn:animate-[shimmer_1.5s_infinite]" />
          
          {isCorrecting ? (
            <Loader2 size={14} className="animate-spin text-purple-400" />
          ) : (
            <Sparkles size={14} className="text-purple-400 animate-pulse" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-wider">Corretor IA</span>
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500"></span>
          </span>
        </button>

        {/* Tab Size Selector */}
        <div className="relative group/tab ml-auto">
          <button
            type="button"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors flex items-center gap-1"
            title="Espaços de recuo do parágrafo (Tecla Tab)"
          >
            <Indent size={14} />
            <span className="text-[10px] font-bold text-zinc-400">Tab: {tabSize}</span>
          </button>
          <div className="absolute right-0 mt-1 hidden group-hover/tab:flex flex-col gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 shadow-xl z-30 min-w-[100px]">
            <p className="text-[9px] font-black uppercase text-zinc-500 px-2 py-0.5 tracking-wider">Espaços do Tab</p>
            {[2, 4, 6, 8].map((size) => (
              <button
                key={size}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleTabSizeChange(size);
                }}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-800 text-xs w-full text-left transition-colors ${
                  tabSize === size ? "text-cyan-400 font-bold" : "text-zinc-300"
                }`}
              >
                <span>{size} espaços</span>
                {tabSize === size && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            executeCommand("removeFormat");
          }}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
          title="Limpar formatação"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Editable Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onPaste={handlePaste}
        className="w-full px-4 py-3 min-h-[140px] text-white text-sm outline-none focus:outline-none leading-relaxed prose prose-invert max-w-none prose-sm overflow-y-auto"
        placeholder={placeholder}
        style={{ WebkitUserModify: "read-write" }}
      />

      <AnimatePresence>
        {showPreview && correctionData && (
          <div key="ai-correction-modal" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#0b0e14] border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl relative"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950/60 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-purple-400 font-bold flex items-center gap-1.5">
                    <Sparkles size={11} className="text-purple-400 animate-pulse" />
                    Revisão Inteligente por IA
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-zinc-100 mt-1">
                    Comparativo & Ajustes {gameName ? `• ${gameName}` : ""}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="h-8 w-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Scrollable Contents */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Original text */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold px-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                      Texto Original
                    </span>
                    <div 
                      className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-4 h-[240px] overflow-y-auto text-sm text-zinc-400 leading-relaxed prose prose-invert prose-sm max-w-none select-none pointer-events-none opacity-80"
                      dangerouslySetInnerHTML={{ __html: cleanHTMLText(value) }}
                    />
                  </div>

                  {/* Right: Suggested text */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-purple-400 font-bold px-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                        Sugestão Corrigida (Você pode editar aqui)
                      </span>
                      <span className="text-[9px] text-zinc-500 uppercase font-black">Interativo</span>
                    </span>
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => setEditableSuggestedText(e.currentTarget.innerHTML)}
                      onInput={(e) => setEditableSuggestedText(e.currentTarget.innerHTML)}
                      className="bg-zinc-950 border border-purple-500/30 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/50 rounded-2xl p-4 h-[240px] overflow-y-auto text-sm text-zinc-100 outline-none leading-relaxed prose prose-invert prose-sm max-w-none scrollbar-thin"
                      dangerouslySetInnerHTML={{ __html: cleanHTMLText(correctionData.correctedText) }}
                      style={{ WebkitUserModify: "read-write" }}
                    />
                  </div>
                </div>

                {/* Feedback / Explanation of changes */}
                <div className="bg-purple-950/10 border border-purple-500/10 rounded-2xl p-4 space-y-3 text-left">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">O que a IA ajustou?</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {correctionData.explanation}
                  </p>
                  {correctionData.changes && correctionData.changes.length > 0 && (
                    <div className="pt-2 border-t border-purple-500/10">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">Alterações específicas detectadas:</div>
                      <div className="flex flex-wrap gap-2">
                        {correctionData.changes.map((change, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-lg bg-purple-950/30 border border-purple-900/30 text-purple-300 text-[11px] font-mono">
                            {change}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 sm:p-5 border-t border-zinc-850 bg-zinc-950/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check size={13} className="text-emerald-400" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copiar Texto Corrigido</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreview(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold hover:text-white text-xs cursor-pointer transition-all active:scale-95"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(editableSuggestedText);
                      setShowPreview(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-extrabold text-xs cursor-pointer hover:opacity-95 active:scale-95 transition-all shadow-lg shadow-purple-950/35"
                  >
                    Aplicar Correção
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {errorMsg && (
          <div key="ai-correction-error-modal" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#0b0e14] border border-red-500/30 rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative"
            >
              <div className="p-4 sm:p-5 border-b border-zinc-850 bg-red-950/10 flex items-center gap-3 shrink-0">
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                  <AlertCircle size={20} className="animate-pulse" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-red-400 font-bold">
                    Ops! Algo deu errado
                  </div>
                  <h3 className="text-sm font-extrabold text-zinc-100 mt-0.5">
                    Falha na Correção por IA
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="h-8 w-8 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer ml-auto"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto max-h-[50vh] text-left space-y-4">
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {errorMsg}
                </p>
                {errorMsg.includes("créditos de pagamento antecipado") && (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-[11px] text-amber-200/80 leading-relaxed">
                    <strong>Dica:</strong> Como este app está rodando no AI Studio Sandbox, você pode configurar o faturamento do seu projeto ou adicionar uma chave do Gemini válida nas configurações de secrets/ambiente para contornar limites de cota.
                  </div>
                )}
              </div>

              <div className="p-4 bg-zinc-950/60 border-t border-zinc-850 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-xs cursor-pointer hover:opacity-95 active:scale-95 transition-all shadow-md"
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
