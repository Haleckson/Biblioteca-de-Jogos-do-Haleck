import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ThumbsUp,
  ThumbsDown,
  X,
  Check,
  Plus,
  Trash2,
  ArrowUpDown,
  Info,
  Sparkles,
  Edit3,
  Layers,
  Eye,
  FileText,
  ChevronUp,
  ChevronDown,
  ArrowLeftRight,
  Gamepad2,
  Palette,
  Music,
  BookOpen,
  Zap,
  Clock,
  Users,
  Swords,
  MessageSquareQuote,
  Filter,
} from "lucide-react";
import { splitEntities, parseProConTopic } from "../types";
import { useBodyScrollLock } from "../lib/bodyScrollLock";
import {
  PRO_CON_CATEGORIES,
  ProConCategoryMeta,
  ProConStructuredItem,
  detectProConCategory,
  parseRawToStructuredItems,
  stringifyStructuredItems,
} from "../utils/proConCategories";

interface ProsConsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPros: string;
  initialCons: string;
  gameTitle?: string;
  onSave: (newPros: string, newCons: string) => void;
}

// Renderizador do ícone da categoria
function CategoryIcon({ iconName, size = 14, className = "" }: { iconName: string; size?: number; className?: string }) {
  switch (iconName) {
    case "Gamepad2":
      return <Gamepad2 size={size} className={className} />;
    case "Palette":
      return <Palette size={size} className={className} />;
    case "Music":
      return <Music size={size} className={className} />;
    case "BookOpen":
      return <BookOpen size={size} className={className} />;
    case "Zap":
      return <Zap size={size} className={className} />;
    case "Clock":
      return <Clock size={size} className={className} />;
    case "Users":
      return <Users size={size} className={className} />;
    case "Swords":
      return <Swords size={size} className={className} />;
    case "Sparkles":
    default:
      return <Sparkles size={size} className={className} />;
  }
}

export default function ProsConsModal({
  isOpen,
  onClose,
  initialPros,
  initialCons,
  gameTitle,
  onSave,
}: ProsConsModalProps) {
  useBodyScrollLock(isOpen);

  // Itens estruturados
  const [prosItems, setProsItems] = useState<ProConStructuredItem[]>([]);
  const [consItems, setConsItems] = useState<ProConStructuredItem[]>([]);

  // Textos brutos para modo avançado
  const [prosRawText, setProsRawText] = useState("");
  const [consRawText, setConsRawText] = useState("");

  // Modos de visualização do modal
  // "cards": visualizador estruturado com cards, categorias e edição fácil
  // "preview": idêntico à exibição na página do jogo
  // "raw": textareas com texto bruto
  const [viewMode, setViewMode] = useState<"cards" | "preview" | "raw">("cards");

  // Filtro de exibição no modo cards: "all" (ambos), "pros" (somente prós), "cons" (somente contras)
  const [sideFilter, setSideFilter] = useState<"all" | "pros" | "cons">("all");

  // Filtro por categoria (ou "all" para todas)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Agrupamento por categoria ativo?
  const [groupByCategory, setGroupByCategory] = useState(false);

  // Estado para edição inline de um item específico: ID do item sendo editado
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTopic, setEditTopic] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editCategory, setEditCategory] = useState("geral");

  // Formulário de Adição Rápida
  const [newItemType, setNewItemType] = useState<"pro" | "con">("pro");
  const [newTopic, setNewTopic] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newCategory, setNewCategory] = useState<string>("geral");
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Sincronização inicial ao abrir
  useEffect(() => {
    if (isOpen) {
      const pItems = parseRawToStructuredItems(initialPros || "", "pro", splitEntities, parseProConTopic);
      const cItems = parseRawToStructuredItems(initialCons || "", "con", splitEntities, parseProConTopic);
      setProsItems(pItems);
      setConsItems(cItems);
      setProsRawText(initialPros || "");
      setConsRawText(initialCons || "");
      setEditingItemId(null);
      setIsAddingNew(false);
      setNewTopic("");
      setNewNote("");
      setSelectedCategoryFilter("all");
    }
  }, [isOpen, initialPros, initialCons]);

  // Sincroniza texto bruto para itens estruturados quando o usuário altera na aba "raw"
  const handleRawTextChange = (newProsText: string, newConsText: string) => {
    setProsRawText(newProsText);
    setConsRawText(newConsText);
    const pItems = parseRawToStructuredItems(newProsText, "pro", splitEntities, parseProConTopic);
    const cItems = parseRawToStructuredItems(newConsText, "con", splitEntities, parseProConTopic);
    setProsItems(pItems);
    setConsItems(cItems);
  };

  // Salvar alterações finais
  const handleSave = () => {
    let finalPros = "";
    let finalCons = "";

    if (viewMode === "raw") {
      finalPros = prosRawText.trim();
      finalCons = consRawText.trim();
    } else {
      finalPros = stringifyStructuredItems(prosItems);
      finalCons = stringifyStructuredItems(consItems);
    }

    onSave(finalPros, finalCons);
    onClose();
  };

  // Adicionar novo item
  const handleAddNewItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const topicTrimmed = newTopic.trim();
    if (!topicTrimmed) return;

    const detectedCat = newCategory === "geral" 
      ? detectProConCategory(topicTrimmed, newNote).id 
      : newCategory;

    const newItem: ProConStructuredItem = {
      id: `${newItemType}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      topic: topicTrimmed,
      note: newNote.trim(),
      category: detectedCat,
      type: newItemType,
    };

    if (newItemType === "pro") {
      const updated = [...prosItems, newItem];
      setProsItems(updated);
      setProsRawText(stringifyStructuredItems(updated));
    } else {
      const updated = [...consItems, newItem];
      setConsItems(updated);
      setConsRawText(stringifyStructuredItems(updated));
    }

    setNewTopic("");
    setNewNote("");
    // Se o usuário adicionou por popup, fecha o form
    setIsAddingNew(false);
  };

  // Iniciar edição inline de um item
  const startEditingItem = (item: ProConStructuredItem) => {
    setEditingItemId(item.id);
    setEditTopic(item.topic);
    setEditNote(item.note);
    setEditCategory(item.category);
  };

  // Salvar edição inline
  const saveEditingItem = () => {
    if (!editingItemId) return;
    const topicTrimmed = editTopic.trim();
    if (!topicTrimmed) return;

    const updateItem = (item: ProConStructuredItem): ProConStructuredItem => {
      if (item.id !== editingItemId) return item;
      const cat = editCategory || detectProConCategory(topicTrimmed, editNote).id;
      return {
        ...item,
        topic: topicTrimmed,
        note: editNote.trim(),
        category: cat,
      };
    };

    const updatedPros = prosItems.map(updateItem);
    const updatedCons = consItems.map(updateItem);

    setProsItems(updatedPros);
    setConsItems(updatedCons);
    setProsRawText(stringifyStructuredItems(updatedPros));
    setConsRawText(stringifyStructuredItems(updatedCons));
    setEditingItemId(null);
  };

  // Alternar lado (converter de Pró para Contra ou vice-versa)
  const toggleItemSide = (item: ProConStructuredItem) => {
    if (item.type === "pro") {
      const updatedPros = prosItems.filter((i) => i.id !== item.id);
      const convertedItem: ProConStructuredItem = { ...item, type: "con" };
      const updatedCons = [...consItems, convertedItem];
      setProsItems(updatedPros);
      setConsItems(updatedCons);
      setProsRawText(stringifyStructuredItems(updatedPros));
      setConsRawText(stringifyStructuredItems(updatedCons));
    } else {
      const updatedCons = consItems.filter((i) => i.id !== item.id);
      const convertedItem: ProConStructuredItem = { ...item, type: "pro" };
      const updatedPros = [...prosItems, convertedItem];
      setProsItems(updatedPros);
      setConsItems(updatedCons);
      setProsRawText(stringifyStructuredItems(updatedPros));
      setConsRawText(stringifyStructuredItems(updatedCons));
    }
  };

  // Excluir item
  const deleteItem = (item: ProConStructuredItem) => {
    if (item.type === "pro") {
      const updated = prosItems.filter((i) => i.id !== item.id);
      setProsItems(updated);
      setProsRawText(stringifyStructuredItems(updated));
    } else {
      const updated = consItems.filter((i) => i.id !== item.id);
      setConsItems(updated);
      setConsRawText(stringifyStructuredItems(updated));
    }
    if (editingItemId === item.id) {
      setEditingItemId(null);
    }
  };

  // Mover item para cima/baixo na lista
  const moveItem = (item: ProConStructuredItem, direction: "up" | "down") => {
    const list = item.type === "pro" ? [...prosItems] : [...consItems];
    const index = list.findIndex((i) => i.id === item.id);
    if (index === -1) return;

    if (direction === "up" && index > 0) {
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
    } else if (direction === "down" && index < list.length - 1) {
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
    }

    if (item.type === "pro") {
      setProsItems(list);
      setProsRawText(stringifyStructuredItems(list));
    } else {
      setConsItems(list);
      setConsRawText(stringifyStructuredItems(list));
    }
  };

  // Ordenar alfabeticamente A-Z
  const sortListAZ = (type: "pro" | "con") => {
    if (type === "pro") {
      const sorted = [...prosItems].sort((a, b) =>
        a.topic.localeCompare(b.topic, "pt", { sensitivity: "base" })
      );
      setProsItems(sorted);
      setProsRawText(stringifyStructuredItems(sorted));
    } else {
      const sorted = [...consItems].sort((a, b) =>
        a.topic.localeCompare(b.topic, "pt", { sensitivity: "base" })
      );
      setConsItems(sorted);
      setConsRawText(stringifyStructuredItems(sorted));
    }
  };

  // Itens filtrados para exibição
  const filteredPros = useMemo(() => {
    if (selectedCategoryFilter === "all") return prosItems;
    return prosItems.filter((item) => item.category === selectedCategoryFilter);
  }, [prosItems, selectedCategoryFilter]);

  const filteredCons = useMemo(() => {
    if (selectedCategoryFilter === "all") return consItems;
    return consItems.filter((item) => item.category === selectedCategoryFilter);
  }, [consItems, selectedCategoryFilter]);

  // Lista de categorias presentes nos itens atuais (para filtros rápidos)
  const presentCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    prosItems.forEach((i) => ids.add(i.category));
    consItems.forEach((i) => ids.add(i.category));
    return ids;
  }, [prosItems, consItems]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="pros-cons-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md"
        >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ type: "spring", damping: 26, stiffness: 360 }}
          className="relative w-[92vw] h-[92vh] max-w-[1600px] max-h-[94vh] bg-zinc-950 border border-zinc-800/90 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar / Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-b border-zinc-800/80 bg-zinc-900/70 shrink-0">
            {/* Title & Stats */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-zinc-800 to-rose-500/20 border border-zinc-700/60 flex items-center justify-center shrink-0">
                <div className="flex items-center -space-x-1">
                  <ThumbsUp size={16} className="text-emerald-400" />
                  <ThumbsDown size={16} className="text-rose-400" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                    Editor de Prós e Contras
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <ThumbsUp size={11} /> +{prosItems.length} Prós
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-950/90 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                      <ThumbsDown size={11} /> -{consItems.length} Contras
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  {gameTitle ? `Ficha: ${gameTitle}` : "Gerencie tópicos categorizados com notas e tooltips interativos"}
                </p>
              </div>
            </div>

            {/* Top Right: Modes & Actions */}
            <div className="flex items-center gap-2.5 flex-wrap justify-between sm:justify-end">
              {/* View Modes Switcher */}
              <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === "cards"
                      ? "bg-gradient-to-r from-emerald-600/80 to-teal-600/80 text-white shadow-sm font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                  title="Modo Gerenciador com Cards e Categorias"
                >
                  <Layers size={13} />
                  <span>Cards & Categorias</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === "preview"
                      ? "bg-zinc-800 text-cyan-300 border border-cyan-500/30 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                  title="Prévia idêntica ao design da página do jogo"
                >
                  <Eye size={13} />
                  <span>Prévia do Jogo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("raw")}
                  className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === "raw"
                      ? "bg-zinc-800 text-amber-300 border border-amber-500/30 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                  title="Edição direta por texto bruto (Enter / Colchetes)"
                >
                  <FileText size={13} />
                  <span>Texto em Massa</span>
                </button>
              </div>

              {/* Botão Novo Ponto Rápido */}
              <button
                type="button"
                onClick={() => {
                  setIsAddingNew(!isAddingNew);
                  if (viewMode !== "cards") setViewMode("cards");
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus size={14} />
                <span>+ Novo Ponto</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                title="Fechar sem salvar"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Sub-Header Toolbar (somente no modo "cards") */}
          {viewMode === "cards" && (
            <div className="px-5 sm:px-6 py-2.5 bg-zinc-950/80 border-b border-zinc-800/60 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full scrollbar-none">
                <span className="text-zinc-500 font-mono text-[11px] flex items-center gap-1 shrink-0 mr-1">
                  <Filter size={11} /> Categoria:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                    selectedCategoryFilter === "all"
                      ? "bg-zinc-200 text-zinc-900 font-bold"
                      : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  Todas ({prosItems.length + consItems.length})
                </button>
                {PRO_CON_CATEGORIES.map((cat) => {
                  const countPros = prosItems.filter((i) => i.category === cat.id).length;
                  const countCons = consItems.filter((i) => i.category === cat.id).length;
                  const total = countPros + countCons;
                  if (total === 0 && !presentCategoryIds.has(cat.id)) return null;

                  const isSelected = selectedCategoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryFilter(isSelected ? "all" : cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? "bg-zinc-800 text-white ring-1 ring-zinc-500 font-bold"
                          : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                      }`}
                    >
                      <CategoryIcon iconName={cat.iconName} size={11} className={cat.textClass} />
                      <span>{cat.shortName}</span>
                      <span className="text-[10px] opacity-70 font-mono">({total})</span>
                    </button>
                  );
                })}
              </div>

              {/* View options: Agrupar por categoria & filtro de lados */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Side Toggle on Mobile/Tablet */}
                <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSideFilter("all")}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      sideFilter === "all" ? "bg-zinc-800 text-white font-bold" : "text-zinc-400"
                    }`}
                  >
                    Ambos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSideFilter("pros")}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      sideFilter === "pros" ? "bg-emerald-950 text-emerald-300 font-bold" : "text-zinc-400"
                    }`}
                  >
                    + Prós
                  </button>
                  <button
                    type="button"
                    onClick={() => setSideFilter("cons")}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      sideFilter === "cons" ? "bg-rose-950 text-rose-300 font-bold" : "text-zinc-400"
                    }`}
                  >
                    - Contras
                  </button>
                </div>

                {/* Agrupar por Categoria toggle */}
                <button
                  type="button"
                  onClick={() => setGroupByCategory(!groupByCategory)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    groupByCategory
                      ? "bg-zinc-800 text-cyan-300 border-cyan-500/40 font-bold"
                      : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800"
                  }`}
                  title="Agrupar tópicos por categoria temáticas"
                >
                  <Layers size={12} />
                  <span>Agrupar por Aspectos</span>
                </button>
              </div>
            </div>
          )}

          {/* Form de Adicionar Novo Ponto (Painel Retrátil no Topo) */}
          <AnimatePresence>
            {isAddingNew && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-zinc-900/90 border-b border-zinc-800 p-4 sm:p-5 overflow-hidden shrink-0"
              >
                <form onSubmit={handleAddNewItem} className="max-w-4xl mx-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider font-mono">
                      <Sparkles size={14} className="text-cyan-400" />
                      <span>Cadastrar Novo Ponto de Avaliação</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingNew(false)}
                      className="text-zinc-400 hover:text-white text-xs cursor-pointer p-1"
                    >
                      ✕ Fechar
                    </button>
                  </div>

                  {/* Tipo (Pró vs Contra) + Categoria */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Botões Pró vs Contra */}
                    <div className="flex rounded-xl p-1 bg-zinc-950 border border-zinc-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setNewItemType("pro")}
                        className={`px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          newItemType === "pro"
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-950"
                            : "text-zinc-400 hover:text-emerald-400"
                        }`}
                      >
                        <ThumbsUp size={13} />
                        <span>+ Ponto Positivo (Pró)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewItemType("con")}
                        className={`px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          newItemType === "con"
                            ? "bg-rose-600 text-white shadow-md shadow-rose-950"
                            : "text-zinc-400 hover:text-rose-400"
                        }`}
                      >
                        <ThumbsDown size={13} />
                        <span>- Ponto Negativo (Contra)</span>
                      </button>
                    </div>

                    {/* Seletor de Categoria */}
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <span className="text-xs text-zinc-400 font-medium shrink-0">Aspecto:</span>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-500"
                      >
                        <option value="geral">✨ Auto-detectar pelo tópico</option>
                        {PRO_CON_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Campos: Tópico e Explicação Tooltip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                        Tópico Principal (Visível no card)
                      </label>
                      <input
                        type="text"
                        value={newTopic}
                        onChange={(e) => setNewTopic(e.target.value)}
                        placeholder="Ex: Gráficos e Direção de Arte"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-zinc-600 outline-none focus:border-cyan-500"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Texto da Tooltip (Nota / Explicação Detalhada)</span>
                        <span className="text-[10px] text-zinc-500 font-normal lowercase">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Ex: Iluminação exuberante e texturas ricas a 60 FPS"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-zinc-600 outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Chips rápidos de tópicos comuns para agilizar preenchimento */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0">Sugestões rápidas:</span>
                    {[
                      { topic: "Jogabilidade", cat: "jogabilidade" },
                      { topic: "Combate", cat: "jogabilidade" },
                      { topic: "Gráficos", cat: "graficos" },
                      { topic: "Direção de Arte", cat: "graficos" },
                      { topic: "Trilha Sonora", cat: "audio" },
                      { topic: "Dublagem", cat: "audio" },
                      { topic: "História e Enredo", cat: "historia" },
                      { topic: "Personagens", cat: "historia" },
                      { topic: "Otimização e FPS", cat: "desempenho" },
                      { topic: "Bugs no Lançamento", cat: "desempenho" },
                      { topic: "Fator Replay", cat: "conteudo" },
                      { topic: "Duração Curta", cat: "conteudo" },
                      { topic: "Preço Elevado", cat: "geral" },
                    ].map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => {
                          setNewTopic(sug.topic);
                          setNewCategory(sug.cat);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-400 hover:text-cyan-300 transition-colors shrink-0 cursor-pointer"
                      >
                        + {sug.topic}
                      </button>
                    ))}
                  </div>

                  {/* Ações do Form */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setNewTopic("");
                        setNewNote("");
                        setIsAddingNew(false);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={!newTopic.trim()}
                      className={`px-4 py-1.5 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-40 ${
                        newItemType === "pro"
                          ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950"
                          : "bg-rose-600 hover:bg-rose-500 shadow-rose-950"
                      }`}
                    >
                      <Check size={14} />
                      <span>Inserir em {newItemType === "pro" ? "Prós" : "Contras"}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
            
            {/* ======================================================== */}
            {/* MODO 1: CARDS & CATEGORIAS (Modo Primário e Rico)        */}
            {/* ======================================================== */}
            {viewMode === "cards" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full items-start">
                
                {/* ----------------- COLUNA DE PRÓS ----------------- */}
                {(sideFilter === "all" || sideFilter === "pros") && (
                  <div className="bg-zinc-900/40 border border-emerald-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col space-y-4">
                    {/* Header da Coluna */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-emerald-500/20">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-400 shadow-sm">
                          <ThumbsUp size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-emerald-300 uppercase tracking-wider font-mono">
                              Pontos Positivos (+ Prós)
                            </h4>
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                              {filteredPros.length}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400">
                            Aspectos fortes, elogios e destaques da experiência
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => sortListAZ("pro")}
                          disabled={prosItems.length < 2}
                          className="p-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-emerald-300 text-[11px] font-medium flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
                          title="Ordenar alfabeticamente de A a Z"
                        >
                          <ArrowUpDown size={12} />
                          <span className="hidden sm:inline">A-Z</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNewItemType("pro");
                            setIsAddingNew(true);
                          }}
                          className="p-1.5 px-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>Adicionar</span>
                        </button>
                      </div>
                    </div>

                    {/* Lista de Cards de Prós */}
                    {filteredPros.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-zinc-950/40 border border-dashed border-zinc-800 text-center space-y-2">
                        <ThumbsUp size={24} className="mx-auto text-emerald-500/30" />
                        <p className="text-xs text-zinc-400 font-medium">
                          {selectedCategoryFilter === "all"
                            ? "Nenhum ponto positivo cadastrado ainda."
                            : "Nenhum ponto positivo nesta categoria."}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setNewItemType("pro");
                            setIsAddingNew(true);
                          }}
                          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          + Cadastrar primeiro ponto positivo
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {renderGroupedOrFlatItems(filteredPros, "pro")}
                      </div>
                    )}
                  </div>
                )}

                {/* ----------------- COLUNA DE CONTRAS ----------------- */}
                {(sideFilter === "all" || sideFilter === "cons") && (
                  <div className="bg-zinc-900/40 border border-rose-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col space-y-4">
                    {/* Header da Coluna */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-rose-500/20">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-rose-950/90 border border-rose-500/40 text-rose-400 shadow-sm">
                          <ThumbsDown size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-rose-300 uppercase tracking-wider font-mono">
                              Pontos Negativos (- Contras)
                            </h4>
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-500/30">
                              {filteredCons.length}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400">
                            Falhas, frustrações, bugs ou pontos fracos
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => sortListAZ("con")}
                          disabled={consItems.length < 2}
                          className="p-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-rose-300 text-[11px] font-medium flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
                          title="Ordenar alfabeticamente de A a Z"
                        >
                          <ArrowUpDown size={12} />
                          <span className="hidden sm:inline">A-Z</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNewItemType("con");
                            setIsAddingNew(true);
                          }}
                          className="p-1.5 px-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>Adicionar</span>
                        </button>
                      </div>
                    </div>

                    {/* Lista de Cards de Contras */}
                    {filteredCons.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-zinc-950/40 border border-dashed border-zinc-800 text-center space-y-2">
                        <ThumbsDown size={24} className="mx-auto text-rose-500/30" />
                        <p className="text-xs text-zinc-400 font-medium">
                          {selectedCategoryFilter === "all"
                            ? "Nenhum ponto negativo cadastrado ainda."
                            : "Nenhum ponto negativo nesta categoria."}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setNewItemType("con");
                            setIsAddingNew(true);
                          }}
                          className="text-xs font-bold text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          + Cadastrar primeiro ponto negativo
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {renderGroupedOrFlatItems(filteredCons, "con")}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* ======================================================== */}
            {/* MODO 2: PRÉVIA FIEL DO JOGO (Exatamente como em Detalhes) */}
            {/* ======================================================== */}
            {viewMode === "preview" && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex items-center gap-3">
                  <Eye size={20} className="text-cyan-400 shrink-0" />
                  <div className="text-xs text-zinc-300">
                    <span className="font-bold text-cyan-300">Exibição Idêntica à Página do Jogo: </span>
                    Esta é a renderização exata utilizada no painel principal do jogo. Passe o cursor sobre os itens para testar o funcionamento das tooltips flutuantes.
                  </div>
                </div>

                {/* Card Idêntico ao GameDetailDrawer */}
                <div className="bg-zinc-950/90 rounded-2xl p-6 border-2 border-emerald-500/50 shadow-xl shadow-emerald-500/10 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-emerald-500/30">
                    <ThumbsUp size={18} className="text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 text-sm uppercase tracking-wider font-extrabold font-mono">
                      Prós e Contras
                    </span>
                    <span className="ml-auto text-xs text-zinc-500 font-mono">
                      +{prosItems.length} / -{consItems.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* + Prós */}
                    <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                        <ThumbsUp size={14} className="text-emerald-400 shrink-0" />
                        <span>+ Prós (Pontos Positivos)</span>
                        {prosItems.length > 0 && (
                          <span className="text-[10px] text-emerald-400/60 font-mono font-normal">
                            ({prosItems.length})
                          </span>
                        )}
                      </div>

                      {prosItems.length > 0 ? (
                        <ul className="text-xs text-emerald-200/90 font-medium pl-1 space-y-2">
                          {prosItems.map((item, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-2 min-w-0">
                              <span className="text-emerald-400 font-bold shrink-0 mt-0.5">+</span>
                              <div
                                className="inline-flex items-center gap-1.5 min-w-0 flex-wrap cursor-help"
                                data-tooltip={item.note || item.topic}
                                data-tooltip-title={item.note ? `Pró: ${item.topic}` : undefined}
                                data-tooltip-theme="emerald"
                              >
                                <span className="break-words font-medium text-emerald-100 text-sm">
                                  {item.topic}
                                </span>
                                {item.note && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 font-mono text-[9px] uppercase tracking-wider shrink-0">
                                    info
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-zinc-500 italic py-2">
                          Nenhum ponto positivo cadastrado.
                        </p>
                      )}
                    </div>

                    {/* - Contras */}
                    <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400 font-mono">
                        <ThumbsDown size={14} className="text-rose-400 shrink-0" />
                        <span>- Contras (Pontos Negativos)</span>
                        {consItems.length > 0 && (
                          <span className="text-[10px] text-rose-400/60 font-mono font-normal">
                            ({consItems.length})
                          </span>
                        )}
                      </div>

                      {consItems.length > 0 ? (
                        <ul className="text-xs text-rose-200/90 font-medium pl-1 space-y-2">
                          {consItems.map((item, cIdx) => (
                            <li key={cIdx} className="flex items-start gap-2 min-w-0">
                              <span className="text-rose-400 font-bold shrink-0 mt-0.5">-</span>
                              <div
                                className="inline-flex items-center gap-1.5 min-w-0 flex-wrap cursor-help"
                                data-tooltip={item.note || item.topic}
                                data-tooltip-title={item.note ? `Contra: ${item.topic}` : undefined}
                                data-tooltip-theme="rose"
                              >
                                <span className="break-words font-medium text-rose-100 text-sm">
                                  {item.topic}
                                </span>
                                {item.note && (
                                  <span className="px-1.5 py-0.2 rounded bg-rose-900/80 text-rose-300 border border-rose-500/40 font-mono text-[9px] uppercase tracking-wider shrink-0">
                                    info
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-zinc-500 italic py-2">
                          Nenhum ponto negativo cadastrado.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* MODO 3: TEXTO EM MASSA (RAW / AVANÇADO)                  */}
            {/* ======================================================== */}
            {viewMode === "raw" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full">
                {/* Textarea de Prós */}
                <div className="bg-zinc-900/40 border border-emerald-500/30 rounded-2xl p-5 flex flex-col space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400 font-mono uppercase">
                    <span className="flex items-center gap-1.5">
                      <ThumbsUp size={14} /> + Prós (Uma linha por item)
                    </span>
                    <span className="text-zinc-500 text-[10px] lowercase">
                      sintaxe: Tópico [Nota Tooltip]
                    </span>
                  </div>
                  <textarea
                    value={prosRawText}
                    onChange={(e) => handleRawTextChange(e.target.value, consRawText)}
                    placeholder={"Exemplo:\nGráficos [Rodou a 60 FPS com Ray Tracing]\nTrilha Sonora [Músicas de chefe épicas e memoráveis]\nCombate fluído [Controles responsivos]"}
                    className="w-full flex-1 min-h-[300px] bg-zinc-950 border border-emerald-950 focus:border-emerald-500 rounded-xl p-4 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 outline-none leading-relaxed font-mono resize-y"
                  />
                  <p className="text-[11px] text-zinc-400">
                    O texto entre colchetes <code className="text-emerald-400 font-bold">[ ]</code> é extraído automaticamente como tooltip na visualização.
                  </p>
                </div>

                {/* Textarea de Contras */}
                <div className="bg-zinc-900/40 border border-rose-500/30 rounded-2xl p-5 flex flex-col space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-400 font-mono uppercase">
                    <span className="flex items-center gap-1.5">
                      <ThumbsDown size={14} /> - Contras (Uma linha por item)
                    </span>
                    <span className="text-zinc-500 text-[10px] lowercase">
                      sintaxe: Tópico [Nota Tooltip]
                    </span>
                  </div>
                  <textarea
                    value={consRawText}
                    onChange={(e) => handleRawTextChange(prosRawText, e.target.value)}
                    placeholder={"Exemplo:\nBugs [Quedas de quadros em áreas abertas]\nHistória curta [Campanha concluída em 6 horas]\nPreço elevado [Pouco conteúdo adicional]"}
                    className="w-full flex-1 min-h-[300px] bg-zinc-950 border border-rose-950 focus:border-rose-500 rounded-xl p-4 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 outline-none leading-relaxed font-mono resize-y"
                  />
                  <p className="text-[11px] text-zinc-400">
                    O texto entre colchetes <code className="text-rose-400 font-bold">[ ]</code> é extraído automaticamente como tooltip na visualização.
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/80 shrink-0">
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="hidden sm:inline">Total Cadastrado:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <ThumbsUp size={12} /> +{prosItems.length} Prós
              </span>
              <span>•</span>
              <span className="font-bold text-rose-400 flex items-center gap-1">
                <ThumbsDown size={12} /> -{consItems.length} Contras
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-medium text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Check size={16} />
                <span>Salvar Prós e Contras</span>
              </button>
            </div>
          </div>

        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );

  // Helper para renderizar itens de uma lista (Agrupados ou Lineares)
  function renderGroupedOrFlatItems(items: ProConStructuredItem[], side: "pro" | "con") {
    if (groupByCategory) {
      // Agrupamento por Categoria
      const groups: { [catId: string]: ProConStructuredItem[] } = {};
      items.forEach((item) => {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(item);
      });

      return Object.entries(groups).map(([catId, groupItems]) => {
        const catMeta = PRO_CON_CATEGORIES.find((c) => c.id === catId) || PRO_CON_CATEGORIES[0];
        return (
          <div key={catId} className="space-y-2 pt-1">
            <div className="flex items-center gap-2 px-1">
              <CategoryIcon iconName={catMeta.iconName} size={13} className={catMeta.textClass} />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
                {catMeta.name}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">({groupItems.length})</span>
            </div>
            <div className="space-y-2">
              {groupItems.map((item) => renderSingleCard(item, side))}
            </div>
          </div>
        );
      });
    }

    return items.map((item) => renderSingleCard(item, side));
  }

  // Renderizador de um Card Individual com suporte a Edição Inline, Tooltip Legível e Ações
  function renderSingleCard(item: ProConStructuredItem, side: "pro" | "con") {
    const isEditing = editingItemId === item.id;
    const catMeta = PRO_CON_CATEGORIES.find((c) => c.id === item.category) || PRO_CON_CATEGORIES[0];

    if (isEditing) {
      return (
        <div
          key={item.id}
          className={`p-3.5 rounded-2xl bg-zinc-950 border-2 shadow-lg space-y-3 ${
            side === "pro" ? "border-emerald-500/70" : "border-rose-500/70"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Edit3 size={13} className={side === "pro" ? "text-emerald-400" : "text-rose-400"} />
              <span>Editando {side === "pro" ? "Ponto Positivo" : "Ponto Negativo"}</span>
            </span>
            <div className="flex items-center gap-2">
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200 outline-none"
              >
                {PRO_CON_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shortName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Tópico Principal
              </label>
              <input
                type="text"
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs sm:text-sm text-white outline-none focus:border-cyan-500"
                placeholder="Ex: Gráficos exuberantes"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Explicação / Tooltip (Exibida ao passar o mouse)
              </label>
              <textarea
                rows={2}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs sm:text-sm text-white outline-none focus:border-cyan-500 resize-y"
                placeholder="Texto explicativo que o usuário verá no tooltip..."
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditingItemId(null)}
              className="px-3 py-1 rounded-xl text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveEditingItem}
              disabled={!editTopic.trim()}
              className={`px-4 py-1 rounded-xl text-xs font-bold text-white flex items-center gap-1 cursor-pointer transition-all ${
                side === "pro"
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950"
                  : "bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-950"
              }`}
            >
              <Check size={13} />
              <span>Salvar Item</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className={`group relative rounded-2xl p-3 sm:p-3.5 transition-all border ${
          side === "pro"
            ? "bg-emerald-950/20 hover:bg-emerald-950/30 border-emerald-500/25 hover:border-emerald-500/50"
            : "bg-rose-950/20 hover:bg-rose-950/30 border-rose-500/25 hover:border-rose-500/50"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Lado Esquerdo: Tag de Categoria + Tópico */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Badge da Categoria */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border ${catMeta.bgClass} ${catMeta.borderClass} ${catMeta.textClass}`}
              >
                <CategoryIcon iconName={catMeta.iconName} size={10} />
                <span>{catMeta.shortName}</span>
              </span>

              {/* Título do Tópico */}
              <span className="text-xs sm:text-sm font-bold text-zinc-100 break-words">
                {item.topic}
              </span>
            </div>

            {/* Texto da Tooltip / Explicação (Exibição Cristalina e Legível) */}
            {item.note ? (
              <div
                className="flex items-start gap-1.5 p-2 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-300 leading-relaxed cursor-help"
                data-tooltip={item.note}
                data-tooltip-title={`${side === "pro" ? "Pró" : "Contra"}: ${item.topic}`}
                data-tooltip-theme={side === "pro" ? "emerald" : "rose"}
                title="Passe o mouse para testar a tooltip"
              >
                <MessageSquareQuote size={13} className="text-zinc-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-zinc-200 text-[11px] sm:text-xs">{item.note}</span>
                </div>
                <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono text-[9px] uppercase tracking-wider shrink-0">
                  tooltip
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startEditingItem(item)}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 pt-0.5 cursor-pointer"
              >
                <Plus size={11} />
                <span>Adicionar explicação / tooltip...</span>
              </button>
            )}
          </div>

          {/* Lado Direito: Ações do Card */}
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            {/* Mover para Cima / Baixo */}
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => moveItem(item, "up")}
                className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Mover para cima"
              >
                <ChevronUp size={11} />
              </button>
              <button
                type="button"
                onClick={() => moveItem(item, "down")}
                className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Mover para baixo"
              >
                <ChevronDown size={11} />
              </button>
            </div>

            {/* Alternar Pró ↔ Contra */}
            <button
              type="button"
              onClick={() => toggleItemSide(item)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 transition-colors cursor-pointer"
              title={side === "pro" ? "Mover para Contras" : "Mover para Prós"}
            >
              <ArrowLeftRight size={13} />
            </button>

            {/* Editar Card */}
            <button
              type="button"
              onClick={() => startEditingItem(item)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Editar Tópico e Tooltip"
            >
              <Edit3 size={13} />
            </button>

            {/* Excluir Card */}
            <button
              type="button"
              onClick={() => deleteItem(item)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Excluir este ponto"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  }
}
