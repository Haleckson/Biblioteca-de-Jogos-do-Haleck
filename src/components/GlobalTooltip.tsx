/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";

interface TooltipLink {
  url: string;
  label?: string;
  isWowhead?: boolean;
}

interface TooltipState {
  visible: boolean;
  content: string;
  title?: string;
  theme?: "cyan" | "purple" | "amber" | "emerald" | "rose" | "zinc";
  x: number;
  y: number;
  position: "top" | "bottom";
  link?: TooltipLink;
}

const HIDE_DELAY_MS = 320;

/**
 * Parses plain text containing markdown links [Text](url) or raw URLs (https://...)
 * into an array of React elements with clickable anchor tags.
 */
function renderContentWithLinks(text: string) {
  if (!text) return null;

  // Regex matching Markdown link [label](url) or standalone URL
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // Markdown link
      const label = match[1];
      const url = match[2];
      const isWowhead = url.includes("wowhead.com");
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 hover:brightness-110 cursor-pointer transition-all"
        >
          <span>{label}</span>
          <ExternalLink className="w-3 h-3 inline-block shrink-0 opacity-80" />
        </a>
      );
    } else if (match[3]) {
      // Raw URL
      const url = match[3];
      const isWowhead = url.includes("wowhead.com");
      const displayLabel = isWowhead ? "Ver no Wowhead" : url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 32) + "...";
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 hover:brightness-110 cursor-pointer transition-all"
        >
          <span>{displayLabel}</span>
          <ExternalLink className="w-3 h-3 inline-block shrink-0 opacity-80" />
        </a>
      );
    }

    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

export function GlobalTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOverTooltipRef = useRef<boolean>(false);
  const currentTargetRef = useRef<HTMLElement | null>(null);
  const tooltipContainerRef = useRef<HTMLDivElement | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const startHideTimer = useCallback((delay = HIDE_DELAY_MS) => {
    clearHideTimer();
    hideTimeoutRef.current = setTimeout(() => {
      // If the cursor is currently over the tooltip itself, do not close!
      if (isOverTooltipRef.current) return;

      if (currentTargetRef.current) {
        const originalTitle = currentTargetRef.current.getAttribute("data-original-title");
        if (originalTitle) {
          currentTargetRef.current.setAttribute("title", originalTitle);
          currentTargetRef.current.removeAttribute("data-original-title");
        }
        currentTargetRef.current = null;
      }
      setTooltip(null);
    }, delay);
  }, [clearHideTimer]);

  useEffect(() => {
    const handleOpen = (target: HTMLElement) => {
      const tooltipEl = target.closest("[data-tooltip], [title]") as HTMLElement | null;
      if (!tooltipEl) return;

      let content = tooltipEl.getAttribute("data-tooltip");
      const title = tooltipEl.getAttribute("data-tooltip-title") || undefined;
      const theme = (tooltipEl.getAttribute("data-tooltip-theme") as TooltipState["theme"]) || "cyan";

      if (!content) {
        const rawTitle = tooltipEl.getAttribute("title");
        if (rawTitle && rawTitle.trim().length > 0) {
          content = rawTitle;
          tooltipEl.setAttribute("data-original-title", rawTitle);
          tooltipEl.removeAttribute("title");
        }
      }

      if (!content || content.trim().length === 0) return;

      // Check for direct link metadata on the element (e.g. data-wowhead-url or data-tooltip-url)
      const directUrl =
        tooltipEl.getAttribute("data-wowhead-url") ||
        tooltipEl.getAttribute("data-tooltip-url") ||
        tooltipEl.getAttribute("data-tooltip-link") ||
        undefined;
      const directLabel =
        tooltipEl.getAttribute("data-wowhead-label") ||
        tooltipEl.getAttribute("data-tooltip-label") ||
        (directUrl && directUrl.includes("wowhead.com") ? "Ver no Wowhead" : "Acessar link");

      let linkObj: TooltipLink | undefined = undefined;
      if (directUrl) {
        linkObj = {
          url: directUrl,
          label: directLabel,
          isWowhead: directUrl.includes("wowhead.com"),
        };
      }

      currentTargetRef.current = tooltipEl;
      clearHideTimer();

      const rect = tooltipEl.getBoundingClientRect();
      const spaceAbove = rect.top;
      const placement = spaceAbove > 110 ? "top" : "bottom";

      const x = Math.max(130, Math.min(window.innerWidth - 130, rect.left + rect.width / 2));
      const y = placement === "top" ? rect.top - 8 : rect.bottom + 8;

      setTooltip({
        visible: true,
        content,
        title,
        theme,
        x,
        y,
        position: placement,
        link: linkObj,
      });
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // If hovering inside the tooltip container, cancel hiding
      if (tooltipContainerRef.current && tooltipContainerRef.current.contains(target)) {
        isOverTooltipRef.current = true;
        clearHideTimer();
        return;
      }

      const tooltipEl = target.closest("[data-tooltip], [title]") as HTMLElement | null;
      if (tooltipEl) {
        handleOpen(tooltipEl);
      }
    };

    const onMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const related = e.relatedTarget as Node | null;

      // If cursor is moving into the tooltip, do not trigger hide
      if (
        tooltipContainerRef.current &&
        related &&
        (tooltipContainerRef.current === related || tooltipContainerRef.current.contains(related))
      ) {
        return;
      }

      // If cursor is leaving the current target element
      if (currentTargetRef.current && (!related || !currentTargetRef.current.contains(related))) {
        startHideTimer(HIDE_DELAY_MS);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (tooltipContainerRef.current && tooltipContainerRef.current.contains(target)) {
        return;
      }

      const tooltipEl = target.closest("[data-tooltip], [title]") as HTMLElement | null;
      if (tooltipEl) {
        handleOpen(tooltipEl);
      } else {
        startHideTimer(80);
      }
    };

    const onScroll = () => {
      // On scroll, only close if mouse is not directly hovering over the tooltip
      if (!isOverTooltipRef.current) {
        startHideTimer(100);
      }
    };

    document.addEventListener("mouseover", onMouseOver, { passive: true });
    document.addEventListener("mouseout", onMouseOut, { passive: true });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      clearHideTimer();
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("scroll", onScroll);
    };
  }, [clearHideTimer, startHideTimer]);

  if (!tooltip || !tooltip.visible) return null;

  const themeStyles = {
    cyan: "border-cyan-500/60 text-cyan-300 shadow-[0_12px_32px_rgba(6,182,212,0.35)]",
    purple: "border-purple-500/60 text-purple-300 shadow-[0_12px_32px_rgba(168,85,247,0.35)]",
    amber: "border-amber-500/60 text-amber-300 shadow-[0_12px_32px_rgba(245,158,11,0.35)]",
    emerald: "border-emerald-500/60 text-emerald-300 shadow-[0_12px_32px_rgba(16,185,129,0.35)]",
    rose: "border-rose-500/60 text-rose-300 shadow-[0_12px_32px_rgba(244,63,94,0.35)]",
    zinc: "border-zinc-700/80 text-zinc-300 shadow-[0_12px_32px_rgba(0,0,0,0.85)]",
  }[tooltip.theme || "cyan"];

  const handleTooltipMouseEnter = () => {
    isOverTooltipRef.current = true;
    clearHideTimer();
  };

  const handleTooltipMouseLeave = (e: React.MouseEvent) => {
    isOverTooltipRef.current = false;
    const related = e.relatedTarget as Node | null;
    if (currentTargetRef.current && related && currentTargetRef.current.contains(related)) {
      return;
    }
    startHideTimer(250);
  };

  return createPortal(
    <div
      ref={tooltipContainerRef}
      onMouseEnter={handleTooltipMouseEnter}
      onMouseLeave={handleTooltipMouseLeave}
      className={`fixed z-[99999] pointer-events-auto select-text transition-opacity duration-150 ease-out flex flex-col gap-1.5 px-3 py-2.5 rounded-xl border bg-zinc-950/95 backdrop-blur-md max-w-xs sm:max-w-md text-left cursor-default ${themeStyles}`}
      style={{
        left: `${tooltip.x}px`,
        top: `${tooltip.y}px`,
        transform: tooltip.position === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      }}
    >
      {tooltip.title && (
        <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-90 border-b border-zinc-800/80 pb-1 font-mono flex items-center justify-between gap-2">
          <span>{tooltip.title}</span>
          {tooltip.link?.isWowhead && (
            <span className="text-[9px] text-amber-400 font-bold uppercase tracking-widest bg-amber-950/60 px-1 rounded border border-amber-500/40">
              Wowhead
            </span>
          )}
        </div>
      )}

      <div className="text-xs font-medium text-zinc-100 leading-relaxed font-sans whitespace-pre-wrap break-words">
        {renderContentWithLinks(tooltip.content)}
      </div>

      {tooltip.link && (
        <div className="pt-1.5 mt-0.5 border-t border-zinc-800/80 flex items-center justify-end">
          <a
            href={tooltip.link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 hover:text-white hover:bg-cyan-900/60 hover:border-cyan-400 transition-all cursor-pointer shadow-sm group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 group-hover:scale-125 transition-transform shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
            <span>{tooltip.link.label || "Ver no Wowhead"}</span>
            <ExternalLink className="w-3 h-3 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </a>
        </div>
      )}
    </div>,
    document.body
  );
}
