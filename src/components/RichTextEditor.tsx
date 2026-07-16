import React, { useRef, useEffect, useState } from "react";
import { Bold, Italic, Underline, Link, List, ListOrdered, Sparkles, Palette, RotateCcw, Indent } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder = "Escreva aqui..." }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
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
        className="w-full px-4 py-3 min-h-[140px] text-white text-sm outline-none focus:outline-none leading-relaxed prose prose-invert max-w-none prose-sm overflow-y-auto"
        placeholder={placeholder}
        style={{ WebkitUserModify: "read-write" }}
      />
    </div>
  );
}
