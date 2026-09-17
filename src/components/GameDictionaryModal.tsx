import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Plus,
  BookOpen,
  Trash2,
  Edit2,
  Sparkles,
  Search,
  Check,
  Type,
  Palette,
  Folder,
  CheckCircle2,
  Save,
  Info,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  FolderOpen,
  SortAsc,
} from "lucide-react";
import { Game, DictionaryItem, DictionaryFormat } from "../types";
import { formatToStyleObject, getDictionaryWordCount } from "../utils/dictionaryUtils";
import { TEXT_COLOR_OPTIONS, BG_COLOR_OPTIONS } from "../constants/editorColors";
import { useBodyScrollLock } from "../lib/bodyScrollLock";

interface GameDictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game;
  onUpdateGame: (updatedGame: Game) => void;
  onApplyToCurrentEditor?: () => void;
}

const PRESET_TEXT_COLORS = TEXT_COLOR_OPTIONS.map((c) => ({
  name: c.name,
  color: c.color,
}));

const PRESET_BG_COLORS = BG_COLOR_OPTIONS.map((c) => ({
  name: c.name,
  color: c.color,
}));

export default function GameDictionaryModal({
  isOpen,
  onClose,
  game,
  onUpdateGame,
  onApplyToCurrentEditor,
}: GameDictionaryModalProps) {
  useBodyScrollLock(isOpen);

  const [dictionary, setDictionary] = useState<DictionaryItem[]>(game?.dictionary || []);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewFilter, setViewFilter] = useState<"all" | "groups" | "standalone">("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<string | null>(null);

  // Collapsible groups state (key: groupName, value: true if expanded)
  // Default is COLLAPSED (empty object means all groups start collapsed)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Quick Inline Add state
  const [quickWordInputs, setQuickWordInputs] = useState<Record<string, string>>({});
  const [quickStandaloneInput, setQuickStandaloneInput] = useState("");

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [formType, setFormType] = useState<"word" | "group">("word");
  
  // Word item state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [variantsInput, setVariantsInput] = useState("");
  const [group, setGroup] = useState("");

  // Group creation / editing state
  const [groupNameInput, setGroupNameInput] = useState("");
  const [editingGroupOriginalName, setEditingGroupOriginalName] = useState<string | null>(null);
  const [applyFormatToExistingGroupWords, setApplyFormatToExistingGroupWords] = useState(true);

  // Styling state
  const [textColor, setTextColor] = useState("#22d3ee");
  const [bgColor, setBgColor] = useState("");
  const [bold, setBold] = useState(true);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [strikethrough, setStrikethrough] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const formInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (game?.dictionary) {
      setDictionary(game.dictionary);
    }
  }, [game?.dictionary]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const saveDictionaryToGame = (newDict: DictionaryItem[]) => {
    setDictionary(newDict);
    onUpdateGame({
      ...game,
      dictionary: newDict,
    });
  };

  const scrollToFormAndFocus = () => {
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      formInputRef.current?.focus();
    }, 50);
  };

  const resetForm = () => {
    setEditingId(null);
    setEditingGroupOriginalName(null);
    setTerm("");
    setVariantsInput("");
    setGroup("");
    setGroupNameInput("");
    setTextColor("#22d3ee");
    setBgColor("");
    setBold(true);
    setItalic(false);
    setUnderline(false);
    setStrikethrough(false);
    setIsEditing(false);
    setApplyFormatToExistingGroupWords(true);
  };

  const toggleGroupCollapse = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const expandAllGroups = (groupsList: string[]) => {
    const map: Record<string, boolean> = {};
    groupsList.forEach((g) => {
      map[g] = true;
    });
    setExpandedGroups(map);
  };

  const collapseAllGroups = () => {
    setExpandedGroups({});
  };

  // Open Form to create a Word (Standalone or inside a specified Group)
  const handleOpenCreateWord = (initialGroup: string = "") => {
    resetForm();
    setFormType("word");
    setGroup(initialGroup);

    if (initialGroup) {
      const groupItem = dictionary.find(
        (i) => i.group && i.group.trim().toLowerCase() === initialGroup.trim().toLowerCase()
      );
      if (groupItem) {
        setTextColor(groupItem.format.textColor || "#22d3ee");
        setBgColor(groupItem.format.bgColor || "");
        setBold(!!groupItem.format.bold);
        setItalic(!!groupItem.format.italic);
        setUnderline(!!groupItem.format.underline);
        setStrikethrough(!!groupItem.format.strikethrough);
      }
      // Ensure the group is expanded when adding a word to it
      setExpandedGroups((prev) => ({ ...prev, [initialGroup]: true }));
    }

    setIsEditing(true);
    scrollToFormAndFocus();
  };

  // Open Form to create a brand new Conjunto (Group)
  const handleOpenCreateGroup = () => {
    resetForm();
    setFormType("group");
    setGroupNameInput("");
    setTextColor("#22d3ee");
    setBgColor("");
    setBold(true);
    setIsEditing(true);
    scrollToFormAndFocus();
  };

  // Open Form to edit an existing Conjunto (Group)
  const handleEditGroup = (groupName: string) => {
    resetForm();
    setFormType("group");
    setEditingGroupOriginalName(groupName);
    setGroupNameInput(groupName);

    const groupItems = dictionary.filter(
      (i) => i.group && i.group.trim().toLowerCase() === groupName.trim().toLowerCase()
    );
    if (groupItems.length > 0) {
      const first = groupItems[0];
      setTextColor(first.format.textColor || "#22d3ee");
      setBgColor(first.format.bgColor || "");
      setBold(!!first.format.bold);
      setItalic(!!first.format.italic);
      setUnderline(!!first.format.underline);
      setStrikethrough(!!first.format.strikethrough);
    }

    setIsEditing(true);
    scrollToFormAndFocus();
  };

  // Open Form to edit a specific Word item
  const handleEditItem = (item: DictionaryItem) => {
    resetForm();
    setFormType("word");
    setEditingId(item.id);
    setTerm(item.term);
    setVariantsInput(item.variants ? item.variants.join(", ") : "");
    setGroup(item.group || "");
    setTextColor(item.format.textColor || "#22d3ee");
    setBgColor(item.format.bgColor || "");
    setBold(!!item.format.bold);
    setItalic(!!item.format.italic);
    setUnderline(!!item.format.underline);
    setStrikethrough(!!item.format.strikethrough);
    setIsEditing(true);
    scrollToFormAndFocus();
  };

  // Quick inline add word to group
  const handleQuickAddWordToGroup = (e: React.FormEvent, groupName: string) => {
    e.preventDefault();
    const rawVal = (quickWordInputs[groupName] || "").trim();
    if (!rawVal) return;

    const subTerms = rawVal.split(",").map((t) => t.trim()).filter(Boolean);
    if (subTerms.length === 0) return;

    const mainTerm = subTerms[0];
    const inlineVariants = subTerms.slice(1);

    const allNewTerms = [mainTerm, ...inlineVariants].map((t) => t.toLowerCase());
    let duplicateTermFound: string | null = null;

    dictionary.forEach((existingItem) => {
      const existingSubTerms: string[] = [];
      if (existingItem.term) {
        existingSubTerms.push(...existingItem.term.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean));
      }
      if (Array.isArray(existingItem.variants)) {
        existingSubTerms.push(...existingItem.variants.map((v) => v.toLowerCase().trim()).filter(Boolean));
      }
      for (const nTerm of allNewTerms) {
        if (existingSubTerms.includes(nTerm)) {
          duplicateTermFound = nTerm;
          break;
        }
      }
    });

    if (duplicateTermFound) {
      showToast(`⚠️ O termo ou variante "${duplicateTermFound}" já está cadastrado no dicionário!`);
      return;
    }

    // Find group format
    const groupItem = dictionary.find(
      (i) => i.group && i.group.trim().toLowerCase() === groupName.trim().toLowerCase()
    );
    const groupFormat: DictionaryFormat = groupItem?.format
      ? { ...groupItem.format }
      : {
          textColor: "#22d3ee",
          bold: true,
        };

    const newItem: DictionaryItem = {
      id: "dict_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      term: mainTerm,
      variants: inlineVariants.length > 0 ? inlineVariants : undefined,
      group: groupName,
      format: groupFormat,
    };

    const updatedDict = [...dictionary, newItem];
    saveDictionaryToGame(updatedDict);
    setQuickWordInputs((prev) => ({ ...prev, [groupName]: "" }));
    // Ensure folder is expanded to show the newly added word
    setExpandedGroups((prev) => ({ ...prev, [groupName]: true }));
    showToast(`✨ "${mainTerm}" adicionado ao conjunto "${groupName}"!`);
  };

  // Quick inline add standalone word
  const handleQuickAddStandaloneWord = (e: React.FormEvent) => {
    e.preventDefault();
    const rawVal = quickStandaloneInput.trim();
    if (!rawVal) return;

    const subTerms = rawVal.split(",").map((t) => t.trim()).filter(Boolean);
    if (subTerms.length === 0) return;

    const mainTerm = subTerms[0];
    const inlineVariants = subTerms.slice(1);

    const allNewTerms = [mainTerm, ...inlineVariants].map((t) => t.toLowerCase());
    let duplicateTermFound: string | null = null;

    dictionary.forEach((existingItem) => {
      const existingSubTerms: string[] = [];
      if (existingItem.term) {
        existingSubTerms.push(...existingItem.term.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean));
      }
      if (Array.isArray(existingItem.variants)) {
        existingSubTerms.push(...existingItem.variants.map((v) => v.toLowerCase().trim()).filter(Boolean));
      }
      for (const nTerm of allNewTerms) {
        if (existingSubTerms.includes(nTerm)) {
          duplicateTermFound = nTerm;
          break;
        }
      }
    });

    if (duplicateTermFound) {
      showToast(`⚠️ O termo ou variante "${duplicateTermFound}" já está cadastrado!`);
      return;
    }

    const newItem: DictionaryItem = {
      id: "dict_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      term: mainTerm,
      variants: inlineVariants.length > 0 ? inlineVariants : undefined,
      group: undefined,
      format: {
        textColor: "#22d3ee",
        bold: true,
      },
    };

    const updatedDict = [...dictionary, newItem];
    saveDictionaryToGame(updatedDict);
    setQuickStandaloneInput("");
    showToast(`✨ Palavra solta "${mainTerm}" adicionada ao dicionário!`);
  };

  // Submit Handler for Form (Words & Groups)
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const format: DictionaryFormat = {
      textColor: textColor || undefined,
      bgColor: bgColor || undefined,
      bold,
      italic,
      underline,
      strikethrough,
    };

    if (formType === "group") {
      const trimmedGroupName = groupNameInput.trim();
      if (!trimmedGroupName) {
        showToast("⚠️ Por favor, informe um nome para o conjunto.");
        return;
      }

      // Check for duplicate group name
      const groupExists = dictionary.some(
        (item) =>
          item.group &&
          item.group.trim().toLowerCase() === trimmedGroupName.toLowerCase() &&
          item.group.trim().toLowerCase() !== editingGroupOriginalName?.trim().toLowerCase()
      );

      if (groupExists) {
        showToast(`⚠️ Já existe um conjunto cadastrado como "${trimmedGroupName}".`);
        return;
      }

      let updatedDict = [...dictionary];

      if (editingGroupOriginalName) {
        const oldNameLower = editingGroupOriginalName.trim().toLowerCase();
        updatedDict = updatedDict.map((item) => {
          if (item.group && item.group.trim().toLowerCase() === oldNameLower) {
            return {
              ...item,
              group: trimmedGroupName,
              format: applyFormatToExistingGroupWords ? format : item.format,
            };
          }
          return item;
        });

        const hasHeader = updatedDict.some(
          (i) => i.group && i.group.trim().toLowerCase() === trimmedGroupName.toLowerCase() && (!i.term || i.term === "")
        );
        if (!hasHeader) {
          updatedDict.push({
            id: "group_def_" + Date.now(),
            term: "",
            group: trimmedGroupName,
            format,
          });
        }
        showToast(`✨ Conjunto "${trimmedGroupName}" atualizado!`);
      } else {
        const groupDefItem: DictionaryItem = {
          id: "group_def_" + Date.now(),
          term: "",
          group: trimmedGroupName,
          format,
        };
        updatedDict.push(groupDefItem);
        showToast(`✨ Conjunto "${trimmedGroupName}" criado!`);
      }

      saveDictionaryToGame(updatedDict);
      resetForm();
    } else {
      // FormType === "word"
      const trimmedTerm = term.trim();
      if (!trimmedTerm) {
        showToast("⚠️ Por favor, informe a palavra ou termo principal.");
        return;
      }

      // Parse variants from input
      const parsedVariants = variantsInput
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && v.toLowerCase() !== trimmedTerm.toLowerCase());

      const uniqueVariants: string[] = [];
      parsedVariants.forEach((v) => {
        if (!uniqueVariants.some((uv) => uv.toLowerCase() === v.toLowerCase())) {
          uniqueVariants.push(v);
        }
      });

      const allNewTerms = [
        ...trimmedTerm.split(",").map((t) => t.trim().toLowerCase()),
        ...uniqueVariants.map((v) => v.toLowerCase()),
      ].filter(Boolean);

      let duplicateTermFound: string | null = null;

      dictionary.forEach((existingItem) => {
        if (editingId && existingItem.id === editingId) return;

        const existingSubTerms: string[] = [];
        if (existingItem.term) {
          existingSubTerms.push(...existingItem.term.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean));
        }
        if (Array.isArray(existingItem.variants)) {
          existingSubTerms.push(...existingItem.variants.map((v) => v.toLowerCase().trim()).filter(Boolean));
        }

        for (const nTerm of allNewTerms) {
          if (existingSubTerms.includes(nTerm)) {
            duplicateTermFound = nTerm;
            break;
          }
        }
      });

      if (duplicateTermFound) {
        showToast(`⚠️ O termo ou variante "${duplicateTermFound}" já está cadastrado!`);
        return;
      }

      const trimmedGroup = group.trim() || undefined;
      const finalVariants = uniqueVariants.length > 0 ? uniqueVariants : undefined;
      let updatedDict = [...dictionary];

      if (editingId) {
        updatedDict = updatedDict.map((item) =>
          item.id === editingId
            ? { ...item, term: trimmedTerm, variants: finalVariants, group: trimmedGroup, format }
            : item
        );
        showToast(`✨ Palavra "${trimmedTerm}" atualizada!`);
      } else {
        const newItem: DictionaryItem = {
          id: "dict_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
          term: trimmedTerm,
          variants: finalVariants,
          group: trimmedGroup,
          format,
        };
        updatedDict.push(newItem);
        showToast(`✨ Palavra "${trimmedTerm}" salva no dicionário!`);
      }

      saveDictionaryToGame(updatedDict);
      resetForm();
    }
  };

  const handleDeleteItem = (id: string) => {
    const itemToDelete = dictionary.find((i) => i.id === id);
    const updatedDict = dictionary.filter((item) => item.id !== id);
    saveDictionaryToGame(updatedDict);
    showToast(`Palavra "${itemToDelete?.term || "item"}" removida.`);
    if (editingId === id) {
      resetForm();
    }
  };

  const handleDeleteGroup = (groupName: string) => {
    setDeleteConfirmGroup(groupName);
  };

  const confirmDeleteGroup = (groupName: string) => {
    const trimmedTarget = groupName.trim().toLowerCase();
    const updatedDict = dictionary.filter((item) => {
      if (!item.group) return true;
      return item.group.trim().toLowerCase() !== trimmedTarget;
    });
    setDictionary(updatedDict);
    saveDictionaryToGame(updatedDict);
    showToast(`Conjunto "${groupName}" e suas palavras foram excluídos com sucesso!`);
    if (
      editingGroupOriginalName &&
      editingGroupOriginalName.trim().toLowerCase() === trimmedTarget
    ) {
      resetForm();
    }
    setDeleteConfirmGroup(null);
  };

  const handleFinalSaveAndClose = () => {
    saveDictionaryToGame(dictionary);
    if (onApplyToCurrentEditor) {
      onApplyToCurrentEditor();
    }
    showToast("💾 Alterações salvas com sucesso!");
    onClose();
  };

  // Grouping logic for rendering - Alphabetically Sorted Groups
  const rawGroups = Array.from(
    new Set(
      dictionary
        .map((item) => item.group?.trim())
        .filter(Boolean) as string[]
    )
  );

  const allGroups = rawGroups.sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" }));

  const filteredDictionary = dictionary.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchesTerm = item.term.toLowerCase().includes(q);
    const matchesGroup = item.group && item.group.toLowerCase().includes(q);
    const matchesVariants =
      Array.isArray(item.variants) &&
      item.variants.some((v) => v.toLowerCase().includes(q));
    return matchesTerm || matchesGroup || matchesVariants;
  });

  const itemsByGroup: Record<string, DictionaryItem[]> = {};
  const standaloneItems: DictionaryItem[] = [];

  allGroups.forEach((gName) => {
    itemsByGroup[gName] = [];
  });

  filteredDictionary.forEach((item) => {
    if (item.group) {
      const matchedGroupKey = allGroups.find(
        (g) => g.toLowerCase() === item.group?.trim().toLowerCase()
      );
      const key = matchedGroupKey || item.group.trim();
      if (!itemsByGroup[key]) itemsByGroup[key] = [];
      if (item.term && item.term.trim() !== "") {
        itemsByGroup[key].push(item);
      }
    } else {
      if (item.term && item.term.trim() !== "") {
        standaloneItems.push(item);
      }
    }
  });

  // Sort words alphabetically inside each group
  Object.keys(itemsByGroup).forEach((gKey) => {
    itemsByGroup[gKey].sort((a, b) => a.term.localeCompare(b.term, "pt", { sensitivity: "base" }));
  });

  // Sort standalone words alphabetically
  standaloneItems.sort((a, b) => a.term.localeCompare(b.term, "pt", { sensitivity: "base" }));

  const totalRealWords = getDictionaryWordCount(dictionary);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md"
      /* Backdrop click intentionally does NOT close the modal per user requirements */
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ type: "spring", damping: 26, stiffness: 360 }}
        className="relative w-[90vw] h-[90vh] max-w-[95vw] max-h-[92vh] bg-zinc-950 border border-zinc-800/90 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Toast Notification */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-cyan-950 border border-cyan-400 text-cyan-200 text-xs font-bold shadow-2xl flex items-center gap-2"
            >
              <CheckCircle2 size={16} className="text-cyan-400 shrink-0" />
              <span>{toastMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400 shadow-md shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                Dicionário de Estilização — <span className="text-cyan-400">{game.name}</span>
              </h2>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Organize conjuntos e termos em ordem alfabética para destacar nomes, chefes, itens e locais no diário de bordo.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-all cursor-pointer"
            title="Fechar Janela"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
          
          {/* Action Bar & Search & Filters */}
          <div className="flex items-center justify-between gap-2.5 flex-wrap bg-zinc-900/70 p-3 rounded-2xl border border-zinc-800/80">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar palavra, frase ou conjunto (A-Z)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-cyan-500 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-0.5 rounded-full"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* View Filter Buttons */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setViewFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewFilter === "all" ? "bg-cyan-950 text-cyan-300 border border-cyan-500/30 shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                Todos ({allGroups.length + standaloneItems.length})
              </button>
              <button
                type="button"
                onClick={() => setViewFilter("groups")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewFilter === "groups" ? "bg-purple-950 text-purple-300 border border-purple-500/30 shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                Conjuntos ({allGroups.length})
              </button>
              <button
                type="button"
                onClick={() => setViewFilter("standalone")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewFilter === "standalone" ? "bg-cyan-950 text-cyan-300 border border-cyan-500/30 shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                Palavras Soltas ({standaloneItems.length})
              </button>
            </div>

            {/* Creation Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenCreateGroup}
                className="px-3 py-2 rounded-xl bg-purple-900/90 hover:bg-purple-800 border border-purple-500/40 text-purple-100 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95"
              >
                <Folder size={15} className="text-purple-300" />
                <span>＋ Criar Conjunto</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenCreateWord("")}
                className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95"
              >
                <Plus size={15} />
                <span>＋ Nova Palavra</span>
              </button>
            </div>
          </div>

          {/* Creation / Editing Form Panel */}
          <AnimatePresence>
            {isEditing && (
              <motion.form
                initial={{ opacity: 0, height: 0, scale: 0.98 }}
                animate={{ opacity: 1, height: "auto", scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                ref={formRef}
                onSubmit={handleSave}
                className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border-2 border-cyan-500/50 space-y-3.5 shadow-2xl overflow-hidden"
              >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <span className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-2">
                  <Sparkles size={16} />
                  {formType === "group" ? (
                    editingGroupOriginalName ? `Editar Conjunto "${editingGroupOriginalName}"` : "Criar Novo Conjunto de Palavras"
                  ) : (
                    editingId ? "Editar Palavra / Frase" : group ? `Adicionar Palavra ao Conjunto "${group}"` : "Cadastrar Nova Palavra Solta"
                  )}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-zinc-400 hover:text-white font-bold px-2 py-1 rounded hover:bg-zinc-800 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              {/* Form Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formType === "group" ? (
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Nome do Conjunto / Categoria *
                    </label>
                    <input
                      ref={formInputRef}
                      type="text"
                      value={groupNameInput}
                      onChange={(e) => setGroupNameInput(e.target.value)}
                      placeholder="Ex: Bosses Principais, Itens Lendários, Locais Importantes"
                      required
                      autoFocus
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 outline-none focus:border-cyan-500 font-bold"
                    />
                    {editingGroupOriginalName && (
                      <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs text-cyan-300">
                        <input
                          type="checkbox"
                          checked={applyFormatToExistingGroupWords}
                          onChange={(e) => setApplyFormatToExistingGroupWords(e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-950 text-cyan-500 focus:ring-cyan-500"
                        />
                        <span>Aplicar esta nova cor e estilização a todas as palavras já existentes neste conjunto</span>
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                          Palavra ou Termo Principal *
                        </label>
                        <input
                          ref={formInputRef}
                          type="text"
                          value={term}
                          onChange={(e) => setTerm(e.target.value)}
                          placeholder="Ex: Korok Seed ou Kakariko"
                          required
                          autoFocus
                          className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 outline-none focus:border-cyan-500 font-bold"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Nome principal para identificação no dicionário.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1 flex items-center justify-between">
                          <span className="text-cyan-400 font-extrabold">Variantes / Plurais / Sinônimos</span>
                          <span className="text-[9px] text-zinc-500 font-normal">Opcional</span>
                        </label>
                        <input
                          type="text"
                          value={variantsInput}
                          onChange={(e) => setVariantsInput(e.target.value)}
                          placeholder="Ex: Korok Seeds, Sementes Korok"
                          className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 outline-none focus:border-cyan-500 font-medium"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Separe por vírgula. Todas recebem o mesmo estilo!
                        </p>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                          Pertence ao Conjunto (Opcional)
                        </label>
                        <select
                          value={group}
                          onChange={(e) => {
                            const selectedG = e.target.value;
                            setGroup(selectedG);
                            if (selectedG) {
                              const groupItem = dictionary.find(
                                (i) => i.group && i.group.trim().toLowerCase() === selectedG.trim().toLowerCase()
                              );
                              if (groupItem) {
                                setTextColor(groupItem.format.textColor || "#22d3ee");
                                setBgColor(groupItem.format.bgColor || "");
                                setBold(!!groupItem.format.bold);
                                setItalic(!!groupItem.format.italic);
                              }
                            }
                          }}
                          className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 outline-none focus:border-cyan-500 font-bold cursor-pointer"
                        >
                          <option value="">Nenhum (Palavra Solta)</option>
                          {allGroups.map((gName) => (
                            <option key={gName} value={gName}>
                              📁 {gName}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Agrupe para herdar a cor e organizar em A-Z.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Formatting Controls - 3 Columns in Wide Modal */}
              <div className="pt-2.5 border-t border-zinc-800 space-y-2">
                <label className="block text-[10px] uppercase font-bold text-zinc-400">
                  {formType === "group" ? "Estilização Padrão para este Conjunto" : "Estilização e Formatação da Palavra"}
                </label>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {/* Column 1: Text Color Selection */}
                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
                    <span className="text-[11px] font-semibold text-zinc-300 block">
                      Cor do Texto
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PRESET_TEXT_COLORS.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => setTextColor(p.color)}
                          className={`px-2 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                            textColor === p.color
                              ? "border-cyan-400 bg-cyan-950/70 text-white font-bold shadow-sm"
                              : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-zinc-600 shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="text-[10px]">{p.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-900">
                      <span className="text-[10px] text-zinc-500">Cor Personalizada:</span>
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                      <span className="text-[10px] font-mono text-zinc-400 uppercase">{textColor}</span>
                    </div>
                  </div>

                  {/* Column 2: Background / Highlight Color Selection */}
                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
                    <span className="text-[11px] font-semibold text-zinc-300 block">
                      Cor de Fundo / Destaque
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PRESET_BG_COLORS.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => setBgColor(p.color)}
                          className={`px-2 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                            bgColor === p.color
                              ? "border-amber-400 bg-amber-950/70 text-white font-bold shadow-sm"
                              : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded border border-zinc-600 shrink-0"
                            style={{ backgroundColor: p.color || "transparent" }}
                          />
                          <span className="text-[10px]">{p.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-900">
                      <span className="text-[10px] text-zinc-500">Fundo Personalizado:</span>
                      <input
                        type="color"
                        value={bgColor || "#000000"}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                      {bgColor ? (
                        <button
                          type="button"
                          onClick={() => setBgColor("")}
                          className="text-[10px] text-rose-400 hover:text-rose-300 ml-auto cursor-pointer"
                        >
                          Remover fundo
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-zinc-500">Transparente</span>
                      )}
                    </div>
                  </div>

                  {/* Column 3: Font Styles & Integrated Live Preview */}
                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="text-[11px] font-semibold text-zinc-300 block mb-1.5">
                        Estilos de Tipografia
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setBold(!bold)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                            bold
                              ? "border-cyan-500 bg-cyan-950 text-cyan-300"
                              : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          N (Negrito)
                        </button>
                        <button
                          type="button"
                          onClick={() => setItalic(!italic)}
                          className={`px-2.5 py-1 rounded-lg border text-xs italic transition-all cursor-pointer ${
                            italic
                              ? "border-cyan-500 bg-cyan-950 text-cyan-300"
                              : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          I (Itálico)
                        </button>
                        <button
                          type="button"
                          onClick={() => setUnderline(!underline)}
                          className={`px-2.5 py-1 rounded-lg border text-xs underline transition-all cursor-pointer ${
                            underline
                              ? "border-cyan-500 bg-cyan-950 text-cyan-300"
                              : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          U (Sublinhado)
                        </button>
                        <button
                          type="button"
                          onClick={() => setStrikethrough(!strikethrough)}
                          className={`px-2.5 py-1 rounded-lg border text-xs line-through transition-all cursor-pointer ${
                            strikethrough
                              ? "border-cyan-500 bg-cyan-950 text-cyan-300"
                              : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          S (Tachado)
                        </button>
                      </div>
                    </div>

                    {/* Integrated Live Preview inside Column 3 */}
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-400 mb-1">
                        <span>Pré-visualização</span>
                        <span className="text-zinc-500 font-normal">Ao vivo</span>
                      </div>
                      <div className="text-xs truncate">
                        <span
                          style={formatToStyleObject({
                            textColor,
                            bgColor,
                            bold,
                            italic,
                            underline,
                            strikethrough,
                          })}
                          className="px-2 py-0.5 rounded font-medium inline-block max-w-full truncate"
                        >
                          {formType === "group" ? (groupNameInput.trim() || "Exemplo do Conjunto") : (term.trim() || "Exemplo de Palavra")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Save / Cancel Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
                >
                  <Check size={15} className="stroke-[3]" />
                  <span>
                    {formType === "group"
                      ? editingGroupOriginalName ? "Salvar Conjunto" : "Criar Conjunto"
                      : editingId ? "Salvar Palavra" : "Adicionar ao Dicionário"}
                  </span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

          {/* Dictionary Items Render Area */}
          {dictionary.length === 0 ? (
            <div className="py-14 text-center space-y-3.5 bg-zinc-900/30 rounded-2xl border border-zinc-800/80 p-6">
              <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-lg">
                <BookOpen size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-200">Seu Dicionário está Vazio</p>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 leading-relaxed">
                  Crie conjuntos para agrupar termos com estilo próprio em ordem alfabética ou cadastre palavras soltas!
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleOpenCreateGroup}
                  className="px-3.5 py-2 rounded-xl bg-purple-900/80 hover:bg-purple-800 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                >
                  <Folder size={15} /> Criar Primeiro Conjunto
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenCreateWord("")}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                >
                  <Plus size={15} /> Cadastrar Palavra Solta
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">

              {/* GROUPS / CONJUNTOS SECTION */}
              {(viewFilter === "all" || viewFilter === "groups") && (
                <div className="space-y-3">
                  {allGroups.length > 0 && (
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-zinc-800/80">
                      <div className="flex items-center gap-2 text-xs font-black text-purple-300 uppercase tracking-wider">
                        <Folder size={15} className="text-purple-400" />
                        <span>Conjuntos em Ordem Alfabética ({allGroups.length})</span>
                        <span className="text-[10px] text-zinc-500 normal-case font-mono flex items-center gap-1">
                          <SortAsc size={12} className="text-purple-400" /> A-Z
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => expandAllGroups(allGroups)}
                          className="text-[11px] font-semibold text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-950 border border-purple-500/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Expandir Todos
                        </button>
                        <button
                          type="button"
                          onClick={collapseAllGroups}
                          className="text-[11px] font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Recolher Todos
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {allGroups.map((groupName) => {
                      const groupWords = itemsByGroup[groupName] || [];
                      const sampleItem = dictionary.find((i) => i.group === groupName);
                      // Auto expand if search term is active, otherwise default to collapsed unless user expanded it
                      const isExpanded = searchTerm.trim() ? true : !!expandedGroups[groupName];

                      return (
                        <div
                          key={groupName}
                          className="rounded-2xl bg-zinc-900/70 border border-purple-500/30 hover:border-purple-500/50 transition-all shadow-md overflow-hidden"
                        >
                          {/* Group Card Header (Click to toggle collapse) */}
                          <div
                            onClick={() => toggleGroupCollapse(groupName)}
                            className="p-3 sm:p-3.5 bg-zinc-900 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-zinc-850 transition-colors select-none"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <motion.div
                                animate={{ rotate: isExpanded ? 90 : 0 }}
                                transition={{ duration: 0.2 }}
                                className="p-1 rounded-lg text-purple-400 hover:bg-purple-950/80 transition-colors"
                              >
                                <ChevronRight size={18} />
                              </motion.div>
                              
                              <div className="p-1.5 rounded-lg bg-purple-950 border border-purple-500/30 text-purple-300 shrink-0">
                                {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
                              </div>

                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <h3 className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[280px]">
                                  {groupName}
                                </h3>

                                <span className="px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 font-mono text-[10px] font-bold shrink-0">
                                  {groupWords.length} {groupWords.length === 1 ? "termo" : "termos"}
                                </span>

                                {sampleItem && (
                                  <span
                                    style={formatToStyleObject(sampleItem.format)}
                                    className="text-[10px] px-2 py-0.5 rounded border border-zinc-700/60 font-mono shrink-0"
                                  >
                                    Estilo
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Group Controls (Prevent collapse click when clicking controls) */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 shrink-0"
                            >
                              <button
                                type="button"
                                onClick={() => handleOpenCreateWord(groupName)}
                                className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                                title="Adicionar nova palavra dentro deste conjunto"
                              >
                                <Plus size={13} /> <span className="hidden sm:inline">＋ Palavra</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEditGroup(groupName)}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                                title="Editar nome e estilização do conjunto"
                              >
                                <Palette size={13} className="text-purple-400" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteGroup(groupName)}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 hover:text-rose-400 text-zinc-400 cursor-pointer transition-colors"
                                title="Excluir este conjunto"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Collapsible Body with Smooth Motion Transition */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25, ease: "easeInOut" }}
                                className="overflow-hidden border-t border-zinc-800/80 bg-zinc-950/40"
                              >
                                <div className="p-3 sm:p-4 space-y-3">
                                  {/* Quick inline word adder for this group */}
                                  <form
                                    onSubmit={(e) => handleQuickAddWordToGroup(e, groupName)}
                                    className="flex items-center gap-2"
                                  >
                                    <input
                                      type="text"
                                      value={quickWordInputs[groupName] || ""}
                                      onChange={(e) =>
                                        setQuickWordInputs({
                                          ...quickWordInputs,
                                          [groupName]: e.target.value,
                                        })
                                      }
                                      placeholder={`＋ Adicionar palavra rápida a "${groupName}" (Enter)...`}
                                      className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500 transition-colors"
                                    />
                                    <button
                                      type="submit"
                                      className="px-3 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-900 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                                    >
                                      <Plus size={13} /> <span>Adicionar</span>
                                    </button>
                                  </form>

                                  {/* Words inside this Group in 3-Column Grid */}
                                  {groupWords.length === 0 ? (
                                    <div className="p-3 rounded-xl bg-zinc-950/60 border border-dashed border-zinc-800/80 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                                      <Info size={14} className="text-purple-400 shrink-0" />
                                      <span>Nenhuma palavra cadastrada neste conjunto ainda. Adicione acima!</span>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                                      {groupWords.map((item) => (
                                        <motion.div
                                          key={item.id}
                                          layout
                                          initial={{ opacity: 0, scale: 0.97 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.97 }}
                                          transition={{ duration: 0.15 }}
                                          className="p-2.5 px-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-2 hover:border-purple-500/40 transition-all group"
                                        >
                                          <div className="flex flex-col gap-1 min-w-0 overflow-hidden flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span
                                                style={formatToStyleObject(item.format)}
                                                className="text-xs px-2.5 py-1 rounded border border-zinc-800/80 truncate font-medium max-w-full"
                                                title={`Termo Principal: ${item.term}`}
                                              >
                                                {item.term}
                                              </span>
                                              {Array.isArray(item.variants) && item.variants.length > 0 && (
                                                <div className="flex items-center gap-1 flex-wrap">
                                                  {item.variants.map((v, idx) => (
                                                    <span
                                                      key={idx}
                                                      className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-cyan-300/90 font-mono flex items-center gap-1"
                                                      title={`Variante: ${v}`}
                                                    >
                                                      <span className="text-cyan-400 font-bold text-[9px]">var</span>
                                                      <span>{v}</span>
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button
                                              type="button"
                                              onClick={() => handleEditItem(item)}
                                              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                              title="Editar palavra e variantes"
                                            >
                                              <Edit2 size={13} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteItem(item.id)}
                                              className="p-1.5 rounded-lg hover:bg-rose-950 hover:text-rose-400 text-zinc-500 transition-colors cursor-pointer"
                                              title="Excluir palavra"
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          </div>
                                        </motion.div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STANDALONE WORDS SECTION */}
              {(viewFilter === "all" || viewFilter === "standalone") && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-zinc-800/80">
                    <div className="flex items-center gap-2 text-xs font-black text-cyan-300 uppercase tracking-wider">
                      <Type size={15} className="text-cyan-400" />
                      <span>Palavras Soltas em Ordem Alfabética ({standaloneItems.length})</span>
                      <span className="text-[10px] text-zinc-500 normal-case font-mono flex items-center gap-1">
                        <SortAsc size={12} className="text-cyan-400" /> A-Z
                      </span>
                    </div>

                    <form
                      onSubmit={handleQuickAddStandaloneWord}
                      className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md ml-auto"
                    >
                      <input
                        type="text"
                        value={quickStandaloneInput}
                        onChange={(e) => setQuickStandaloneInput(e.target.value)}
                        placeholder="＋ Adição rápida de palavra solta (Enter)..."
                        className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-cyan-500 transition-colors"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                      >
                        <Plus size={13} /> <span>Adicionar</span>
                      </button>
                    </form>
                  </div>

                  {standaloneItems.length === 0 ? (
                    <div className="p-3 rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800/80 text-center text-xs text-zinc-500">
                      Nenhuma palavra solta cadastrada.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                      {standaloneItems.map((item) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          className="p-2.5 px-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-2 hover:border-cyan-500/40 transition-all group"
                        >
                          <div className="flex flex-col gap-1 min-w-0 overflow-hidden flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                style={formatToStyleObject(item.format)}
                                className="text-xs px-2.5 py-1 rounded border border-zinc-800/80 truncate font-medium max-w-full"
                                title={`Termo Principal: ${item.term}`}
                              >
                                {item.term}
                              </span>
                              {Array.isArray(item.variants) && item.variants.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {item.variants.map((v, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-cyan-300/90 font-mono flex items-center gap-1"
                                      title={`Variante: ${v}`}
                                    >
                                      <span className="text-cyan-400 font-bold text-[9px]">var</span>
                                      <span>{v}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleEditItem(item)}
                              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              title="Editar palavra e variantes"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-950 hover:text-rose-400 text-zinc-500 transition-colors cursor-pointer"
                              title="Excluir palavra"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="text-xs text-zinc-400 font-mono flex items-center gap-3">
            <span>
              Total de Termos Ativos: <strong className="text-cyan-400 font-black">{totalRealWords}</strong>
            </span>
            <span>•</span>
            <span>
              Conjuntos: <strong className="text-purple-400 font-black">{allGroups.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onApplyToCurrentEditor && (
              <button
                type="button"
                onClick={() => {
                  onApplyToCurrentEditor();
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl bg-cyan-950 border border-cyan-500/40 hover:bg-cyan-900 text-cyan-300 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={14} /> Aplicar no Editor Atual
              </button>
            )}
            <button
              type="button"
              onClick={handleFinalSaveAndClose}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-extrabold text-xs transition-all cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
            >
              <Save size={15} />
              <span>Salvar e Concluir</span>
            </button>
          </div>
        </div>

        {/* Custom Group Deletion Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirmGroup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
              onClick={(e) => {
                if (e.target === e.currentTarget) setDeleteConfirmGroup(null);
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl max-w-md w-full space-y-3.5 shadow-2xl cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 text-rose-400">
                  <Trash2 size={22} />
                  <h4 className="text-base font-black text-white">Excluir Conjunto</h4>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Deseja realmente excluir o conjunto <strong className="text-cyan-400">"{deleteConfirmGroup}"</strong> e todas as palavras associadas cadastradas dentro dele?
                </p>
                <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmGroup(null)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDeleteGroup(deleteConfirmGroup)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer shadow-lg active:scale-95"
                  >
                    Sim, Excluir Conjunto
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

