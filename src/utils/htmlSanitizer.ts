/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TEXT_COLOR_OPTIONS, BG_COLOR_OPTIONS } from "../constants/editorColors";

/**
 * Converts Markdown formatting syntax (e.g., ***bold italic***, **bold**, *italic*, ~~strike~~)
 * into semantic HTML tags (<strong>, <em>, <del>).
 */
export function convertMarkdownToHtml(text: string): string {
  if (!text) return "";
  let result = text;
  // ***bold italic***
  result = result.replace(/\*\*\*([^\*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  // **bold**
  result = result.replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>");
  // *italic*
  result = result.replace(/\*([^\*]+)\*/g, "<em>$1</em>");
  // ___bold italic___
  result = result.replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>");
  // __bold__
  result = result.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // _italic_
  result = result.replace(/_([^_]+)_/g, "<em>$1</em>");
  // ~~strikethrough~~
  result = result.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return result;
}

/**
 * Sanitizes HTML strings while keeping dictionary highlights and custom text formatting intact.
 */
export function cleanHTMLText(html: string): string {
  if (!html) return "";
  try {
    // First convert any inline markdown tokens to HTML tags
    const markdownConverted = convertMarkdownToHtml(html);

    const parser = new DOMParser();
    const doc = parser.parseFromString(markdownConverted, "text/html");

    // Collect color options from constants + dynamic hex/rgb values
    const paletteColors = TEXT_COLOR_OPTIONS.map((c) => c.color.toLowerCase()).filter(Boolean);
    const paletteBgs = BG_COLOR_OPTIONS.map((c) => c.color.toLowerCase()).filter(Boolean);

    const cleanElement = (el: HTMLElement) => {
      // Don't modify dictionary spans with data-dict-term
      if (el.getAttribute("data-dict-term")) {
        return;
      }

      let bg = el.style.backgroundColor || el.style.background;
      if (!bg && el.getAttribute("bgcolor")) {
        bg = el.getAttribute("bgcolor") || "";
      }

      let color = el.style.color;
      if (!color && el.getAttribute("color")) {
        color = el.getAttribute("color") || "";
      }

      const fontWeight = el.style.fontWeight;
      const fontStyle = el.style.fontStyle;
      const textDecoration = el.style.textDecoration;
      const textIndent = el.style.textIndent || el.style.marginLeft;
      const lineHeight = el.style.lineHeight;
      const marginBottom = el.style.marginBottom;
      const marginTop = el.style.marginTop;

      // Ensure indented paragraphs get tab space
      if (textIndent && parseFloat(textIndent) > 0) {
        const firstChild = el.firstChild;
        if (firstChild && firstChild.nodeType === Node.TEXT_NODE && firstChild.nodeValue) {
          if (!firstChild.nodeValue.startsWith("\u00a0") && !firstChild.nodeValue.startsWith("\t")) {
            firstChild.nodeValue = "\u00a0\u00a0\u00a0\u00a0" + firstChild.nodeValue;
          }
        }
      }

      // Preserve valid styles
      const preservedStyle: string[] = [];

      if (bg && bg !== "transparent") {
        preservedStyle.push(`background-color: ${bg}`);
      }

      if (color) {
        preservedStyle.push(`color: ${color}`);
      }

      if (fontWeight) {
        preservedStyle.push(`font-weight: ${fontWeight}`);
      }

      if (fontStyle) {
        preservedStyle.push(`font-style: ${fontStyle}`);
      }

      if (textDecoration) {
        preservedStyle.push(`text-decoration: ${textDecoration}`);
      }

      if (lineHeight) {
        preservedStyle.push(`line-height: ${lineHeight}`);
      }

      if (marginBottom) {
        preservedStyle.push(`margin-bottom: ${marginBottom}`);
      }

      if (marginTop) {
        preservedStyle.push(`margin-top: ${marginTop}`);
      }

      if (textIndent) {
        preservedStyle.push(`text-indent: ${textIndent}`);
      }

      if (el.tagName.toLowerCase() === "font") {
        el.removeAttribute("color");
        el.removeAttribute("bgcolor");
        el.removeAttribute("size");
        el.removeAttribute("face");
      }

      el.removeAttribute("style");
      if (preservedStyle.length > 0) {
        el.setAttribute("style", preservedStyle.join("; "));
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
