import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipState {
  visible: boolean;
  content: string;
  title?: string;
  theme?: "cyan" | "purple" | "amber" | "emerald" | "rose" | "zinc";
  x: number;
  y: number;
  position: "top" | "bottom";
}

export function GlobalTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    let currentTarget: HTMLElement | null = null;

    const handleOpen = (target: HTMLElement) => {
      const tooltipEl = target.closest("[data-tooltip], [title]") as HTMLElement | null;
      if (!tooltipEl) return;

      let content = tooltipEl.getAttribute("data-tooltip");
      let title = tooltipEl.getAttribute("data-tooltip-title") || undefined;
      let theme = (tooltipEl.getAttribute("data-tooltip-theme") as TooltipState["theme"]) || "cyan";

      if (!content) {
        const rawTitle = tooltipEl.getAttribute("title");
        if (rawTitle && rawTitle.trim().length > 0) {
          content = rawTitle;
          tooltipEl.setAttribute("data-original-title", rawTitle);
          tooltipEl.removeAttribute("title");
        }
      }

      if (!content || content.trim().length === 0) return;

      currentTarget = tooltipEl;
      const rect = tooltipEl.getBoundingClientRect();

      const spaceAbove = rect.top;
      const placement = spaceAbove > 100 ? "top" : "bottom";

      const x = Math.max(120, Math.min(window.innerWidth - 120, rect.left + rect.width / 2));
      const y = placement === "top" ? rect.top - 8 : rect.bottom + 8;

      setTooltip({
        visible: true,
        content,
        title,
        theme,
        x,
        y,
        position: placement
      });
    };

    const handleClose = () => {
      if (currentTarget) {
        const originalTitle = currentTarget.getAttribute("data-original-title");
        if (originalTitle) {
          currentTarget.setAttribute("title", originalTitle);
          currentTarget.removeAttribute("data-original-title");
        }
        currentTarget = null;
      }
      setTooltip(null);
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        handleOpen(target);
      }
    };

    const onMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget;
      if (currentTarget && (!related || !(related instanceof Node) || !currentTarget.contains(related))) {
        handleClose();
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tooltipEl = target.closest("[data-tooltip], [title]") as HTMLElement | null;
        if (tooltipEl) {
          handleOpen(tooltipEl);
        } else {
          handleClose();
        }
      }
    };

    const onScroll = () => {
      handleClose();
    };

    document.addEventListener("mouseover", onMouseOver, { passive: true });
    document.addEventListener("mouseout", onMouseOut, { passive: true });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("scroll", onScroll);
      handleClose();
    };
  }, []);

  if (!tooltip || !tooltip.visible) return null;

  const themeStyles = {
    cyan: "border-cyan-500/60 text-cyan-300 shadow-[0_10px_30px_rgba(6,182,212,0.3)]",
    purple: "border-purple-500/60 text-purple-300 shadow-[0_10px_30px_rgba(168,85,247,0.3)]",
    amber: "border-amber-500/60 text-amber-300 shadow-[0_10px_30px_rgba(245,158,11,0.3)]",
    emerald: "border-emerald-500/60 text-emerald-300 shadow-[0_10px_30px_rgba(16,185,129,0.3)]",
    rose: "border-rose-500/60 text-rose-300 shadow-[0_10px_30px_rgba(244,63,94,0.3)]",
    zinc: "border-zinc-700/80 text-zinc-300 shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
  }[tooltip.theme || "cyan"];

  return createPortal(
    <div
      className={`fixed z-[99999] pointer-events-none transition-all duration-150 ease-out flex flex-col gap-1 px-3 py-2 rounded-xl border bg-zinc-950/95 backdrop-blur-md max-w-xs sm:max-w-md text-left ${themeStyles}`}
      style={{
        left: `${tooltip.x}px`,
        top: `${tooltip.y}px`,
        transform: tooltip.position === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)"
      }}
    >
      {tooltip.title && (
        <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-90 border-b border-zinc-800/80 pb-1 font-mono">
          {tooltip.title}
        </div>
      )}
      <div className="text-xs font-medium text-zinc-100 leading-relaxed font-sans whitespace-pre-wrap break-words">
        {tooltip.content}
      </div>
    </div>,
    document.body
  );
}
