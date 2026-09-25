import React, { useRef, useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Link,
  List,
  ListOrdered,
  Palette,
  RotateCcw,
  Indent,
  AlignJustify,
  Minimize2,
  CheckCircle2,
  Type,
  Sliders,
  ChevronDown,
  Sparkles,
  BookOpen,
  Settings,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cleanHTMLText } from "../utils/htmlSanitizer";
import { Game } from "../types";
import { applyDictionaryToHtml, getDictionaryWordCount } from "../utils/dictionaryUtils";
import GameDictionaryModal from "./GameDictionaryModal";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  gameName?: string;
  game?: Game;
  onUpdateGame?: (updatedGame: Game) => void;
  onOpenDictionaryModal?: () => void;
}

type LineSpacingOption = "ultratight" | "tight" | "normal" | "relaxed" | "loose";
type ParagraphGapOption = "none" | "small" | "normal" | "large" | "xlarge";

const LINE_SPACING_MAP: Record<LineSpacingOption, string> = {
  ultratight: "1.1",
  tight: "1.25",
  normal: "1.5",
  relaxed: "1.8",
  loose: "2.2",
};

const LINE_SPACING_LABELS: Record<LineSpacingOption, string> = {
  ultratight: "1.1x (Ultra Compacta)",
  tight: "1.25x (Compacta)",
  normal: "1.5x (Normal)",
  relaxed: "1.8x (Ampla)",
  loose: "2.2x (Ultra Ampla)",
};

const PARAGRAPH_GAP_MAP: Record<ParagraphGapOption, string> = {
  none: "0px",
  small: "6px",
  normal: "12px",
  large: "20px",
  xlarge: "32px",
};

const PARAGRAPH_GAP_LABELS: Record<ParagraphGapOption, string> = {
  none: "0px (Sem espaço)",
  small: "6px (Pequeno)",
  normal: "12px (Médio)",
  large: "20px (Amplo)",
  xlarge: "32px (Ultra Amplo)",
};

import { TEXT_COLOR_OPTIONS, BG_COLOR_OPTIONS, ColorOption } from "../constants/editorColors";

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Escreva aqui...",
  gameName,
  game,
  onUpdateGame,
  onOpenDictionaryModal,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [isDictModalOpen, setIsDictModalOpen] = useState(false);

  type DropdownType = "text-color" | "bg-color" | "line-spacing" | "paragraph-gap" | "tab-size" | "dictionary" | null;
  const [activeDropdown, setActiveDropdown] = useState<DropdownType>(null);

  const [customTextColor, setCustomTextColor] = useState<string>("#22d3ee");
  const [customBgColor, setCustomBgColor] = useState<string>("#78350f");

  const handleApplyDictionary = () => {
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : value;
    const dict = game?.dictionary;
    const wordCount = getDictionaryWordCount(dict);

    if (!dict || wordCount === 0) {
      setNotificationMsg("O dicionário deste jogo está vazio. Clique no botão de livro (Dicionário) ao lado para cadastrar palavras!");
      setTimeout(() => setNotificationMsg(null), 4000);
      return;
    }

    const result = applyDictionaryToHtml(currentHtml, dict);
    if (editorRef.current) {
      editorRef.current.innerHTML = result.updatedHtml;
    }
    onChange(result.updatedHtml);

    if (result.replacementsCount > 0) {
      setNotificationMsg(`✨ Dicionário aplicado! ${result.replacementsCount} ${result.replacementsCount === 1 ? "palavra/frase formatada" : "palavras/frases formatadas"}.`);
    } else {
      setNotificationMsg("Nenhuma palavra cadastrada no dicionário foi encontrada no texto atual.");
    }
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && event.target && event.target instanceof Node && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Save selection whenever user selects text or moves cursor in editor
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.anchorNode && sel.anchorNode instanceof Node && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
    }
  };

  // Tab size defaults to 8 spaces (can still be changed by user anytime)
  const [tabSize, setTabSize] = useState<number>(() => {
    const saved = localStorage.getItem("editor_tab_size");
    return saved ? Number(saved) : 8;
  });

  const [autoTabIndent, setAutoTabIndent] = useState<boolean>(() => {
    const saved = localStorage.getItem("editor_auto_tab_indent");
    return saved === null ? true : saved === "true";
  });

  const [lineSpacing, setLineSpacing] = useState<LineSpacingOption>(() => {
    const saved = localStorage.getItem("editor_line_spacing");
    return (saved as LineSpacingOption) || "normal";
  });

  const [paragraphGap, setParagraphGap] = useState<ParagraphGapOption>(() => {
    const saved = localStorage.getItem("editor_paragraph_gap");
    return (saved as ParagraphGapOption) || "normal";
  });

  // Helper to remove leading spaces/nbsp/tabs from string
  const stripLeadingIndents = (str: string): string => {
    return str.replace(/^(?:&nbsp;|\u00a0|\t|\s)+/gi, "");
  };

  // Helper to detect if user has active text selection inside editorRef
  const getEditorSelection = () => {
    if (!editorRef.current) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

    const range = sel.getRangeAt(0);
    if (range.commonAncestorContainer && range.commonAncestorContainer instanceof Node && editorRef.current.contains(range.commonAncestorContainer)) {
      return { sel, range };
    }
    return null;
  };

  // Helper to get block elements (<p>, <div>, <li>) inside editorRef that intersect with selection, or all blocks if no selection
  const getTargetBlockElements = (): { blocks: HTMLElement[]; isSelection: boolean } => {
    if (!editorRef.current) return { blocks: [], isSelection: false };

    const selectionData = getEditorSelection();
    const allBlocks = Array.from(editorRef.current.querySelectorAll<HTMLElement>("p, div, li"));

    if (selectionData) {
      const { range } = selectionData;
      const selectedBlocks = allBlocks.filter((block) => {
        try {
          return range.intersectsNode(block as unknown as Node);
        } catch (e) {
          return false;
        }
      });

      if (selectedBlocks.length > 0) {
        return { blocks: selectedBlocks as HTMLElement[], isSelection: true };
      } else {
        let container: Node | null = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) {
          container = container.parentNode;
        }
        if (container && container !== editorRef.current && editorRef.current.contains(container)) {
          return { blocks: [container as HTMLElement], isSelection: true };
        }
      }
    }

    return { blocks: allBlocks as HTMLElement[], isSelection: false };
  };

  // Reliable color application
  const applyColor = (command: "foreColor" | "hiliteColor", color: string, colorName?: string) => {
    restoreSelection();
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch (e) {}

    const cmd = command === "hiliteColor" ? (document.queryCommandSupported("hiliteColor") ? "hiliteColor" : "backColor") : "foreColor";
    document.execCommand(cmd, false, color);

    // Convert any legacy <font> tags generated by execCommand into <span style="...">
    if (editorRef.current) {
      const fontTags = editorRef.current.querySelectorAll("font");
      fontTags.forEach((font) => {
        const fontColor = font.getAttribute("color") || font.style.color;
        const fontBg = font.getAttribute("bgcolor") || font.style.backgroundColor;
        const span = document.createElement("span");
        let styleStr = "";
        if (fontColor) styleStr += `color: ${fontColor}; `;
        if (fontBg) styleStr += `background-color: ${fontBg}; `;
        if (font.style.cssText) styleStr += font.style.cssText;
        if (styleStr) span.setAttribute("style", styleStr.trim());
        span.innerHTML = font.innerHTML;
        font.parentNode?.replaceChild(span, font);
      });
    }

    handleInput();
    saveSelection();

    if (colorName) {
      setNotificationMsg(`${command === "foreColor" ? "Cor do texto" : "Destaque"}: ${colorName}`);
      setTimeout(() => setNotificationMsg(null), 2500);
    }
  };

  const handleTabSizeChange = (size: number) => {
    setTabSize(size);
    localStorage.setItem("editor_tab_size", String(size));
    setActiveDropdown(null);
    setNotificationMsg(`Tamanho do recuo definido para ${size} espaços!`);
    setTimeout(() => setNotificationMsg(null), 2500);
  };

  const handleLineSpacingChange = (spacing: LineSpacingOption) => {
    setLineSpacing(spacing);
    localStorage.setItem("editor_line_spacing", spacing);
    const lh = LINE_SPACING_MAP[spacing];

    if (editorRef.current) {
      const { blocks, isSelection } = getTargetBlockElements();
      if (isSelection && blocks.length > 0) {
        blocks.forEach((el) => {
          el.style.lineHeight = lh;
        });
        setNotificationMsg(`Entrelinha (${lh}x) aplicada na seleção!`);
      } else {
        editorRef.current.style.lineHeight = lh;
        const allBlocks = editorRef.current.querySelectorAll("p, div, li");
        allBlocks.forEach((el) => {
          (el as HTMLElement).style.lineHeight = lh;
        });
        setNotificationMsg(`Entrelinha (${lh}x) aplicada em todo o texto!`);
      }
      handleInput();
    }
    setActiveDropdown(null);
    setTimeout(() => setNotificationMsg(null), 2500);
  };

  const handleParagraphGapChange = (gap: ParagraphGapOption) => {
    setParagraphGap(gap);
    localStorage.setItem("editor_paragraph_gap", gap);
    const gapVal = PARAGRAPH_GAP_MAP[gap];

    if (editorRef.current) {
      const { blocks, isSelection } = getTargetBlockElements();
      if (isSelection && blocks.length > 0) {
        blocks.forEach((el) => {
          el.style.marginBottom = gapVal;
        });
        setNotificationMsg(`Espaço (${gapVal}) aplicado na seleção!`);
      } else {
        const allBlocks = editorRef.current.querySelectorAll("p, div, li");
        if (allBlocks.length > 0) {
          allBlocks.forEach((el) => {
            (el as HTMLElement).style.marginBottom = gapVal;
          });
        } else {
          applyParagraphFormatToExistingText();
        }
        setNotificationMsg(`Espaço (${gapVal}) aplicado em todo o texto!`);
      }
      handleInput();
    }
    setActiveDropdown(null);
    setTimeout(() => setNotificationMsg(null), 2500);
  };

  const toggleAutoTabIndent = () => {
    setAutoTabIndent((prev) => {
      const next = !prev;
      localStorage.setItem("editor_auto_tab_indent", String(next));
      setNotificationMsg(next ? "Auto Recuo ao dar Enter: ATIVADO" : "Auto Recuo ao dar Enter: DESATIVADO");
      setTimeout(() => setNotificationMsg(null), 2500);
      return next;
    });
  };

  // Apply tab indent to selected text OR whole document
  const applyTabIndentToExistingText = () => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    if (!currentHtml || !currentHtml.trim() || currentHtml === "<p></p>" || currentHtml === "<br>") {
      return;
    }

    const tabSpaceHtml = "&nbsp;".repeat(tabSize);
    const { blocks, isSelection } = getTargetBlockElements();

    if (isSelection && blocks.length > 0) {
      blocks.forEach((p) => {
        const cleanContent = stripLeadingIndents(p.innerHTML);
        if (cleanContent && cleanContent !== "<br>") {
          p.innerHTML = tabSpaceHtml + cleanContent;
        }
      });
      handleInput();
      setNotificationMsg(`Recuo de ${tabSize} espaços aplicado na área selecionada!`);
    } else {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = currentHtml;

      const allBlocks = tempDiv.querySelectorAll("p, div, li");
      if (allBlocks.length > 0) {
        allBlocks.forEach((p) => {
          const cleanContent = stripLeadingIndents(p.innerHTML);
          if (cleanContent && cleanContent !== "<br>") {
            p.innerHTML = tabSpaceHtml + cleanContent;
          }
        });
        editorRef.current.innerHTML = tempDiv.innerHTML;
      } else {
        const lines = currentHtml.split(/(<br\s*\/?>)/i);
        const processed = lines.map((part, idx) => {
          const isLineStart = idx === 0 || (idx > 0 && /<br\s*\/?>/i.test(lines[idx - 1]));
          if (isLineStart && part && !/<br\s*\/?>/i.test(part)) {
            const cleanPart = stripLeadingIndents(part);
            if (cleanPart) {
              return tabSpaceHtml + cleanPart;
            }
          }
          return part;
        });
        editorRef.current.innerHTML = processed.join("");
      }

      handleInput();
      setNotificationMsg(`Recuo de ${tabSize} espaços aplicado em todo o texto!`);
    }
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  // Compact line breaks in selection OR whole text
  const applyCompactLineBreaksToExistingText = () => {
    if (!editorRef.current) return;
    const { blocks, isSelection } = getTargetBlockElements();

    if (isSelection && blocks.length > 0) {
      blocks.forEach((el) => {
        el.innerHTML = el.innerHTML.replace(/(<br\s*\/?>\s*){2,}/gi, "<br>");
      });
      handleInput();
      setNotificationMsg("Quebras de linha duplicadas compactadas na seleção!");
    } else {
      let html = editorRef.current.innerHTML;
      if (!html || !html.trim()) return;
      html = html.replace(/(<br\s*\/?>\s*){2,}/gi, "<br>");
      html = html.replace(/<p[^>]*>\s*(&nbsp;|<br\s*\/?>)?\s*<\/p>/gi, "");
      html = html.replace(/<div[^>]*>\s*(&nbsp;|<br\s*\/?>)?\s*<\/div>/gi, "");
      editorRef.current.innerHTML = html;
      handleInput();
      setNotificationMsg("Quebras de linha e parágrafos vazios compactados em todo o texto!");
    }
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  // Format text into structured paragraphs applying current tabSize (e.g. 8 spaces), line spacing, and gap
  const applyParagraphFormatToExistingText = () => {
    if (!editorRef.current) return;
    let html = editorRef.current.innerHTML;
    if (!html || !html.trim()) return;

    const tabSpaceHtml = "&nbsp;".repeat(tabSize);
    const lhVal = LINE_SPACING_MAP[lineSpacing];
    const gapVal = PARAGRAPH_GAP_MAP[paragraphGap];

    const { blocks, isSelection } = getTargetBlockElements();

    if (isSelection && blocks.length > 0) {
      blocks.forEach((p) => {
        let clean = stripLeadingIndents(p.innerHTML.replace(/^<p[^>]*>|<div[^>]*>|<\/p>|<\/div>$/gi, "").trim());
        if (clean && clean !== "<br>") {
          clean = tabSpaceHtml + clean;
          p.innerHTML = clean;
          p.style.lineHeight = lhVal;
          p.style.marginBottom = gapVal;
        }
      });
      handleInput();
      setNotificationMsg(`Parágrafos formatados na seleção com recuo de ${tabSize} espaços!`);
    } else {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;

      const paragraphs = tempDiv.innerHTML.split(/(?:<br\s*\/?>\s*){2,}|<\/p>|<\/div>/i);
      const newHtml = paragraphs
        .map((p) => {
          let clean = stripLeadingIndents(p.replace(/<p[^>]*>|<div[^>]*>/gi, "").trim());
          if (!clean) return "";
          clean = tabSpaceHtml + clean;
          return `<p style="line-height: ${lhVal}; margin-bottom: ${gapVal};">${clean}</p>`;
        })
        .filter(Boolean)
        .join("");

      if (newHtml) {
        editorRef.current.innerHTML = newHtml;
        handleInput();
        setNotificationMsg(`Texto formatado em parágrafos (Recuo: ${tabSize} esp | Entrelinha: ${lhVal}x | Espaço: ${gapVal})!`);
      }
    }
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  // Sync content with value prop
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }
  }, [value]);

  useEffect(() => {
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
    saveSelection();

    // Key combinations with Alt (Keyboard shortcuts for colors and formatting)
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
      if (e.code === "Digit1") {
        e.preventDefault();
        applyColor("foreColor", "#ffffff", "Padrão (Branco) [Alt+1]");
        return;
      } else if (e.code === "Digit2") {
        e.preventDefault();
        applyColor("foreColor", "#22d3ee", "Ciano [Alt+2]");
        return;
      } else if (e.code === "Digit3") {
        e.preventDefault();
        applyColor("foreColor", "#34d399", "Esmeralda [Alt+3]");
        return;
      } else if (e.code === "Digit4") {
        e.preventDefault();
        applyColor("foreColor", "#fbbf24", "Âmbar [Alt+4]");
        return;
      } else if (e.code === "Digit5") {
        e.preventDefault();
        applyColor("foreColor", "#f43f5e", "Vermelho [Alt+5]");
        return;
      } else if (e.code === "Digit6") {
        e.preventDefault();
        applyColor("foreColor", "#c084fc", "Roxo [Alt+6]");
        return;
      } else if (e.code === "Digit7") {
        e.preventDefault();
        applyColor("foreColor", "#3b82f6", "Azul [Alt+7]");
        return;
      } else if (e.code === "Digit8") {
        e.preventDefault();
        applyColor("foreColor", "#ec4899", "Rosa [Alt+8]");
        return;
      } else if (e.code === "Digit9") {
        e.preventDefault();
        applyColor("foreColor", "#84cc16", "Verde Lima [Alt+9]");
        return;
      } else if (e.code === "Digit0") {
        e.preventDefault();
        applyColor("hiliteColor", "transparent", "Sem Fundo [Alt+0]");
        return;
      } else if (e.key.toLowerCase() === "h") {
        e.preventDefault();
        applyColor("hiliteColor", "#78350f", "Destaque Amarelo [Alt+H]");
        return;
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        applyColor("foreColor", customTextColor, `Cor Personalizada do Texto [Alt+C] (${customTextColor})`);
        return;
      } else if (e.key.toLowerCase() === "x") {
        e.preventDefault();
        applyColor("hiliteColor", customBgColor, `Fundo Personalizado [Alt+X] (${customBgColor})`);
        return;
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        applyParagraphFormatToExistingText();
        return;
      } else if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleApplyDictionary();
        return;
      }
    }

    const tabSpaceHtml = "&nbsp;".repeat(tabSize);

    if (e.key === "Tab") {
      e.preventDefault();
      try {
        document.execCommand("insertHTML", false, tabSpaceHtml);
      } catch (err) {
        const range = window.getSelection()?.getRangeAt(0);
        if (range) {
          const tabNode = document.createTextNode("\u00a0".repeat(tabSize));
          range.insertNode(tabNode);
          range.setStartAfter(tabNode);
          range.setEndAfter(tabNode);
        }
      }
      handleInput();
    } else if (e.key === "Enter") {
      if (autoTabIndent) {
        e.preventDefault();
        document.execCommand("insertParagraph", false);
        if (tabSize > 0) {
          document.execCommand("insertHTML", false, tabSpaceHtml);
        }
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          let node: Node | null = sel.anchorNode;
          while (node && node !== editorRef.current) {
            if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName.toLowerCase() === "p") {
              (node as HTMLElement).style.lineHeight = LINE_SPACING_MAP[lineSpacing];
              (node as HTMLElement).style.marginBottom = PARAGRAPH_GAP_MAP[paragraphGap];
              break;
            }
            node = node.parentNode;
          }
        }
        handleInput();
      }
      // If autoTabIndent is false, let native browser Enter handle paragraph/line break without intercepting
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

    const tabSpaceHtml = "&nbsp;".repeat(tabSize);
    const lhVal = LINE_SPACING_MAP[lineSpacing];
    const gapVal = PARAGRAPH_GAP_MAP[paragraphGap];

    if (text) {
      const lines = text.split(/\r?\n/);
      const processedLines = lines.map((line) => {
        let l = line;
        if (l.startsWith("\t")) {
          l = tabSpaceHtml + l.slice(1);
        } else if (l.startsWith("    ")) {
          l = tabSpaceHtml + l.slice(4);
        } else if (autoTabIndent && l.trim().length > 0 && !l.startsWith("&nbsp;")) {
          l = tabSpaceHtml + l;
        }
        return l;
      });

      const formattedHtml = processedLines
        .filter((l) => l.trim().length > 0)
        .map((l) => `<p style="line-height: ${lhVal}; margin-bottom: ${gapVal};">${l}</p>`)
        .join("");

      try {
        document.execCommand("insertHTML", false, formattedHtml || processedLines.join("<br>"));
      } catch (err) {
        const range = window.getSelection()?.getRangeAt(0);
        if (range) {
          const fragment = range.createContextualFragment(formattedHtml);
          range.deleteContents();
          range.insertNode(fragment);
        }
      }
    } else if (html) {
      let cleaned = cleanHTMLText(html);
      if (autoTabIndent) {
        cleaned = cleaned.replace(/<p>/gi, `<p style="line-height: ${lhVal}; margin-bottom: ${gapVal};">${tabSpaceHtml}`);
      }
      try {
        document.execCommand("insertHTML", false, cleaned);
      } catch (err) {
        const range = window.getSelection()?.getRangeAt(0);
        if (range) {
          const fragment = range.createContextualFragment(cleaned);
          range.deleteContents();
          range.insertNode(fragment);
        }
      }
    }
    handleInput();
  };

  const executeCommand = (command: string, value: string = "") => {
    restoreSelection();
    document.execCommand(command, false, value);
    handleInput();
    saveSelection();
  };

  const handleAddLink = () => {
    const url = prompt("Digite o link (ex: https://google.com):");
    if (url) {
      executeCommand("createLink", url);
    }
  };

  return (
    <div className="border border-zinc-800 rounded-2xl bg-zinc-950/80 backdrop-blur-md overflow-hidden focus-within:ring-2 focus-within:ring-cyan-500/50 transition-all flex flex-col">
      {/* Categorized and Grouped Toolbar */}
      <div ref={dropdownRef} className="flex flex-wrap items-center gap-2 p-2 bg-zinc-900 border-b border-zinc-800/80 select-none text-xs">
        
        {/* GRUPO 1: Estilo de Texto e Cores */}
        <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/80">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand("bold");
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Negrito (Ctrl+B)"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand("italic");
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Itálico (Ctrl+I)"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand("underline");
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Sublinhado (Ctrl+U)"
          >
            <Underline size={14} />
          </button>

          {/* Text Color Dropdown */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
              }}
              onClick={() => setActiveDropdown(activeDropdown === "text-color" ? null : "text-color")}
              className={`p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1 cursor-pointer ${
                activeDropdown === "text-color" ? "bg-zinc-800 text-white" : ""
              }`}
              title="Cor do Texto (Atalhos: Alt+1 até Alt+9, Alt+C)"
            >
              <Palette size={14} className="text-cyan-400" />
            </button>
            {activeDropdown === "text-color" && (
              <div className="absolute left-0 top-full mt-2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/80 rounded-2xl p-3 shadow-2xl z-50 w-80 sm:w-[380px] max-w-[92vw] flex flex-col gap-2.5">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase text-cyan-400 tracking-wider font-mono">Paleta de Cores do Texto</p>
                  <span className="text-[10px] text-zinc-400 font-mono">Atalhos: Alt+1..9</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {TEXT_COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        applyColor("foreColor", opt.color, opt.name);
                        setActiveDropdown(null);
                      }}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-zinc-950/40 hover:bg-zinc-800/90 text-xs text-zinc-200 w-full text-left cursor-pointer transition-all border border-zinc-800/80 hover:border-cyan-500/50 group"
                    >
                      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                        <span className="w-3.5 h-3.5 rounded-full border border-zinc-600/80 shrink-0 shadow-sm group-hover:scale-110 transition-transform" style={{ backgroundColor: opt.color }} />
                        <span className="text-[11px] sm:text-xs font-medium text-zinc-200 truncate" title={opt.name}>{opt.name}</span>
                      </div>
                      {opt.shortcut && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-cyan-400 font-mono font-bold shrink-0 shadow-sm">
                          {opt.shortcut}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Color Picker Personalizado */}
                <div className="pt-2 mt-1 border-t border-zinc-800/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-cyan-400" />
                      Cor Personalizada
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-[10px] text-cyan-300 font-mono font-bold">
                      Atalhos: Alt+C
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-zinc-950/80 p-2 rounded-xl border border-zinc-800">
                    <div className="relative flex items-center justify-center shrink-0">
                      <input
                        type="color"
                        value={customTextColor}
                        onChange={(e) => setCustomTextColor(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                        title="Clique para escolher qualquer cor no seletor"
                      />
                    </div>

                    <input
                      type="text"
                      value={customTextColor}
                      onChange={(e) => setCustomTextColor(e.target.value)}
                      placeholder="#22d3ee"
                      className="w-24 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 font-mono text-center outline-none focus:border-cyan-500"
                    />

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        applyColor("foreColor", customTextColor, `Personalizada (${customTextColor})`);
                        setActiveDropdown(null);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black text-xs transition-all cursor-pointer shadow-sm text-center"
                      title="Aplicar esta cor ao texto selecionado (Atalho: Alt+C)"
                    >
                      Aplicar (Alt+C)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Highlight BG Color Dropdown */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
              }}
              onClick={() => setActiveDropdown(activeDropdown === "bg-color" ? null : "bg-color")}
              className={`p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1 cursor-pointer ${
                activeDropdown === "bg-color" ? "bg-zinc-800 text-white" : ""
              }`}
              title="Cor de Destaque / Fundo (Atalhos: Alt+H, Alt+0, Alt+X)"
            >
              <span className="w-3.5 h-3.5 rounded border border-zinc-600 bg-amber-600/80" />
            </button>
            {activeDropdown === "bg-color" && (
              <div className="absolute left-0 top-full mt-2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/80 rounded-2xl p-3 shadow-2xl z-50 w-80 sm:w-[380px] max-w-[92vw] flex flex-col gap-2.5">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider font-mono">Destaque de Fundo</p>
                  <span className="text-[10px] text-zinc-400 font-mono">Atalhos: Alt+H / Alt+0</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {BG_COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        applyColor("hiliteColor", opt.color, opt.name);
                        setActiveDropdown(null);
                      }}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-zinc-950/40 hover:bg-zinc-800/90 text-xs text-zinc-200 w-full text-left cursor-pointer transition-all border border-zinc-800/80 hover:border-amber-500/50 group"
                    >
                      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                        <span className="w-3.5 h-3.5 rounded border border-zinc-600/80 shrink-0 shadow-sm group-hover:scale-110 transition-transform" style={{ backgroundColor: opt.color }} />
                        <span className="text-[11px] sm:text-xs font-medium text-zinc-200 truncate" title={opt.name}>{opt.name}</span>
                      </div>
                      {opt.shortcut && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-amber-400 font-mono font-bold shrink-0 shadow-sm">
                          {opt.shortcut}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Color Picker Personalizado de Fundo */}
                <div className="pt-2 mt-1 border-t border-zinc-800/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-amber-400" />
                      Fundo Personalizado
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/30 text-[10px] text-amber-300 font-mono font-bold">
                      Atalho: Alt+X
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-zinc-950/80 p-2 rounded-xl border border-zinc-800">
                    <div className="relative flex items-center justify-center shrink-0">
                      <input
                        type="color"
                        value={customBgColor}
                        onChange={(e) => setCustomBgColor(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                        title="Clique para escolher qualquer cor no seletor"
                      />
                    </div>

                    <input
                      type="text"
                      value={customBgColor}
                      onChange={(e) => setCustomBgColor(e.target.value)}
                      placeholder="#78350f"
                      className="w-24 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 font-mono text-center outline-none focus:border-amber-500"
                    />

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        applyColor("hiliteColor", customBgColor, `Fundo Personalizado (${customBgColor})`);
                        setActiveDropdown(null);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs transition-all cursor-pointer shadow-sm text-center"
                      title="Aplicar esta cor de fundo ao texto selecionado (Atalho: Alt+X)"
                    >
                      Aplicar (Alt+X)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GRUPO: Dicionário de Formatação do Jogo */}
        <div className="flex items-center gap-1.5 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/80">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleApplyDictionary}
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-950 to-purple-950 hover:from-cyan-900 hover:to-purple-900 border border-cyan-500/40 text-cyan-300 hover:text-white font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Aplicar cores e formatações personalizadas do dicionário deste jogo ao texto (Atalho: Alt+D)"
          >
            <Sparkles size={13} className="text-cyan-400 animate-pulse shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider">Aplicar</span>
            <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
              {getDictionaryWordCount(game?.dictionary)}
            </span>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (onOpenDictionaryModal) {
                onOpenDictionaryModal();
              } else if (game && onUpdateGame) {
                setIsDictModalOpen(true);
              } else {
                setNotificationMsg("Dicionário de formatação de palavras do jogo.");
                setTimeout(() => setNotificationMsg(null), 3000);
              }
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer flex items-center gap-1"
            title="Gerenciar Palavras, Frases e Conjuntos do Dicionário"
          >
            <BookOpen size={14} className="text-purple-400" />
            <span className="text-[10px] font-bold text-zinc-300 hidden sm:inline">Dicionário</span>
          </button>
        </div>

        {/* GRUPO 2: Listas e Links */}
        <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/80">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand("insertUnorderedList");
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Lista com Marcadores"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand("insertOrderedList");
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Lista Numerada"
          >
            <ListOrdered size={14} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleAddLink();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Inserir Link"
          >
            <Link size={14} />
          </button>
        </div>

        {/* GRUPO 3: Espaçamento de Linhas e Parágrafos */}
        <div className="flex items-center gap-1.5 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/80">
          {/* Entrelinha Selector */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveDropdown(activeDropdown === "line-spacing" ? null : "line-spacing")}
              className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeDropdown === "line-spacing"
                  ? "bg-cyan-950/80 text-cyan-300 border-cyan-500/60"
                  : "bg-zinc-900 text-zinc-300 border-zinc-700/60 hover:text-white hover:bg-zinc-800"
              }`}
              title="Ajustar entrelinha na área selecionada ou em todo o texto"
            >
              <AlignJustify size={13} className="text-cyan-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Entrelinha: {LINE_SPACING_MAP[lineSpacing]}x
              </span>
            </button>

            {activeDropdown === "line-spacing" && (
              <div className="absolute left-0 top-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded-xl p-2 shadow-2xl z-50 min-w-[210px] flex flex-col gap-1">
                <p className="text-[9px] font-black uppercase text-zinc-500 px-2 py-0.5 tracking-wider">Entrelinha (Seleção / Geral)</p>
                {(
                  [
                    { id: "ultratight", name: "1.1x (Ultra Compacta)" },
                    { id: "tight", name: "1.25x (Compacta)" },
                    { id: "normal", name: "1.5x (Normal / Padrão)" },
                    { id: "relaxed", name: "1.8x (Ampla)" },
                    { id: "loose", name: "2.2x (Ultra Ampla)" }
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleLineSpacingChange(opt.id);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-xs w-full text-left transition-colors cursor-pointer ${
                      lineSpacing === opt.id ? "text-cyan-400 font-bold bg-cyan-950/40" : "text-zinc-300"
                    }`}
                  >
                    <span>{opt.name}</span>
                    {lineSpacing === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Espaço de Parágrafo Selector */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveDropdown(activeDropdown === "paragraph-gap" ? null : "paragraph-gap")}
              className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeDropdown === "paragraph-gap"
                  ? "bg-purple-950/80 text-purple-300 border-purple-500/60"
                  : "bg-zinc-900 text-zinc-300 border-zinc-700/60 hover:text-white hover:bg-zinc-800"
              }`}
              title="Ajustar distância vertical entre parágrafos (seleção ou todo o texto)"
            >
              <Type size={13} className="text-purple-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Espaço Parágrafo: {PARAGRAPH_GAP_MAP[paragraphGap]}
              </span>
            </button>

            {activeDropdown === "paragraph-gap" && (
              <div className="absolute left-0 top-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded-xl p-2 shadow-2xl z-50 min-w-[210px] flex flex-col gap-1">
                <p className="text-[9px] font-black uppercase text-zinc-500 px-2 py-0.5 tracking-wider">Distância entre Parágrafos</p>
                {(
                  [
                    { id: "none", name: "0px (Sem espaço extra)" },
                    { id: "small", name: "6px (Pequeno)" },
                    { id: "normal", name: "12px (Médio / Padrão)" },
                    { id: "large", name: "20px (Amplo)" },
                    { id: "xlarge", name: "32px (Ultra Amplo)" }
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleParagraphGapChange(opt.id);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-xs w-full text-left transition-colors cursor-pointer ${
                      paragraphGap === opt.id ? "text-purple-400 font-bold bg-purple-950/40" : "text-zinc-300"
                    }`}
                  >
                    <span>{opt.name}</span>
                    {paragraphGap === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* GRUPO 4: Recuo do Texto & Formatação Estrutural */}
        <div className="flex items-center gap-1.5 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/80">
          
          {/* Tamanho do Recuo Dropdown Selector (Default: 8 esp) */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveDropdown(activeDropdown === "tab-size" ? null : "tab-size")}
              className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeDropdown === "tab-size"
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/60"
                  : "bg-zinc-900 text-zinc-300 border-zinc-700/60 hover:text-white hover:bg-zinc-800"
              }`}
              title="Escolher a quantidade de espaços para o recuo de parágrafo (padrão 8 espaços)"
            >
              <Indent size={13} className="text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Recuo: {tabSize} esp
              </span>
              <ChevronDown size={11} className="text-zinc-500" />
            </button>

            {activeDropdown === "tab-size" && (
              <div className="absolute left-0 top-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded-xl p-2 shadow-2xl z-50 min-w-[180px] flex flex-col gap-1">
                <p className="text-[9px] font-black uppercase text-zinc-500 px-2 py-0.5 tracking-wider">Tamanho do Recuo (Tab)</p>
                {[2, 4, 6, 8, 10, 12, 16].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleTabSizeChange(size);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-xs w-full text-left transition-colors cursor-pointer ${
                      tabSize === size ? "text-emerald-400 font-bold bg-emerald-950/40" : "text-zinc-300"
                    }`}
                  >
                    <span>{size} Espaços {size === 8 ? "(Padrão)" : ""}</span>
                    {tabSize === size && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Botão de Auto Recuo integrado diretamente na barra de recuo */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleAutoTabIndent}
            className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              autoTabIndent
                ? "bg-cyan-950/60 text-cyan-300 border-cyan-500/40 hover:bg-cyan-900/60"
                : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300"
            }`}
            title="Ao teclar Enter, adiciona automaticamente o recuo de parágrafo no início da nova linha. Clique para Ativar/Desativar."
          >
            <Sliders size={13} className={autoTabIndent ? "text-cyan-400" : "text-zinc-500"} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Auto: {autoTabIndent ? "ON" : "OFF"}
            </span>
          </button>

          {/* Botão para aplicar Recuo (Seleção ou Todo o Texto) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={applyTabIndentToExistingText}
            className="px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer select-none bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40"
            title={`Aplica o recuo (${tabSize} espaços) no início dos parágrafos selecionados ou em todo o texto se nada estiver selecionado`}
          >
            <Indent size={13} className="text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider hidden xl:inline">Recuar Texto</span>
            <span className="text-[10px] font-bold uppercase tracking-wider xl:hidden">Recuar</span>
          </button>

          {/* Format Parágrafos */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={applyParagraphFormatToExistingText}
            className="px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer select-none bg-purple-950/50 hover:bg-purple-900/60 text-purple-300 border border-purple-500/40"
            title={`Organiza os parágrafos selecionados ou todo o texto aplicando o recuo ativo (${tabSize} esp), entrelinha (${LINE_SPACING_MAP[lineSpacing]}x) e espaço (${PARAGRAPH_GAP_MAP[paragraphGap]}) (Atalho: Alt+F)`}
          >
            <AlignJustify size={13} className="text-purple-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider hidden xl:inline">Format. Parágrafos</span>
            <span className="text-[10px] font-bold uppercase tracking-wider xl:hidden">Format.</span>
          </button>

          {/* Limpar Quebras Duplicadas */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={applyCompactLineBreaksToExistingText}
            className="px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer select-none bg-blue-950/50 hover:bg-blue-900/60 text-blue-300 border border-blue-500/40"
            title="Remover quebras de linha em branco consecutivas e parágrafos vazios"
          >
            <Minimize2 size={13} className="text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider hidden xl:inline">Limpar Quebras</span>
            <span className="text-[10px] font-bold uppercase tracking-wider xl:hidden">Limpar</span>
          </button>

          {/* Limpar Formatação */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand("removeFormat");
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Limpar formatação do texto selecionado"
          >
            <RotateCcw size={14} />
          </button>
        </div>

      </div>

      {/* Notification Toast */}
      <AnimatePresence>
        {notificationMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mx-3 mt-2 px-3 py-1.5 bg-emerald-950/90 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs text-emerald-200 shadow-lg"
          >
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span>{notificationMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editable Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onPaste={handlePaste}
        className="w-full px-4 py-3 min-h-[140px] text-white text-sm outline-none focus:outline-none prose prose-invert max-w-none prose-sm overflow-y-auto transition-all"
        data-placeholder={placeholder}
        style={{
          WebkitUserModify: "read-write",
          lineHeight: LINE_SPACING_MAP[lineSpacing] || "1.5",
        }}
      />

      {/* Game Dictionary Modal when triggered directly from editor */}
      {game && onUpdateGame && (
        <GameDictionaryModal
          isOpen={isDictModalOpen}
          onClose={() => setIsDictModalOpen(false)}
          game={game}
          onUpdateGame={onUpdateGame}
          onApplyToCurrentEditor={handleApplyDictionary}
        />
      )}
    </div>
  );
}
