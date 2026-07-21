/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sanitizes HTML strings to remove unwanted background highlights and colors (often from copy-pasting),
 * while keeping our official rich text editor's color palette and background highlights.
 */
export function cleanHTMLText(html: string): string {
  if (!html) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    // Allowed background highlights from the editor
    const allowedBgs = [
      "#991b1b", "rgb(153, 27, 27)", 
      "#78350f", "rgb(120, 53, 15)", 
      "#064e3b", "rgb(6, 78, 59)", 
      "#1e3a8a", "rgb(30, 58, 138)", 
      "#581c87", "rgb(88, 28, 135)"
    ];

    // Allowed text colors from the editor
    const allowedColors = [
      "#22d3ee", "rgb(34, 211, 238)", 
      "#34d399", "rgb(52, 211, 153)", 
      "#fbbf24", "rgb(251, 191, 36)", 
      "#f43f5e", "rgb(244, 63, 94)", 
      "#c084fc", "rgb(192, 132, 252)", 
      "#ffffff", "rgb(255, 255, 255)"
    ];

    const cleanElement = (el: HTMLElement) => {
      const bg = el.style.backgroundColor || el.style.background;
      const color = el.style.color;
      
      // Clear all styles first
      el.removeAttribute("style");
      
      // Restore only if they match our allowed custom highlights
      if (bg) {
        const lowerBg = bg.toLowerCase();
        const matchedBg = allowedBgs.find(b => lowerBg.includes(b.toLowerCase()));
        if (matchedBg) {
          el.style.backgroundColor = matchedBg;
        }
      }
      
      if (color) {
        const lowerColor = color.toLowerCase();
        const matchedColor = allowedColors.find(c => lowerColor.includes(c.toLowerCase()));
        if (matchedColor) {
          el.style.color = matchedColor;
        }
      }
      
      // Clean children recursively
      for (let i = 0; i < el.children.length; i++) {
        cleanElement(el.children[i] as HTMLElement);
      }
    };
    
    doc.body.childNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        cleanElement(node as HTMLElement);
      }
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.error("Erro ao sanitizar estilos do HTML:", e);
    return html;
  }
}
