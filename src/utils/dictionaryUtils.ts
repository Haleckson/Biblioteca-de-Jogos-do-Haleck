import { DictionaryItem, DictionaryFormat } from "../types";
import type { CSSProperties } from "react";
import { convertMarkdownToHtml } from "./htmlSanitizer";

export interface DictionaryApplyResult {
  updatedHtml: string;
  replacementsCount: number;
  replacedTerms: string[];
}

/**
 * Calculates the total active words/terms registered in a dictionary.
 * Takes into account standalone terms, terms inside groups, and comma-separated phrases.
 */
export function getDictionaryWordCount(dictionary?: DictionaryItem[]): number {
  if (!dictionary || dictionary.length === 0) return 0;
  let count = 0;
  dictionary.forEach((item) => {
    if (item.term && item.term.trim() !== "") {
      const splitTerms = item.term
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      count += splitTerms.length;
    }
    if (Array.isArray(item.variants)) {
      item.variants.forEach((v) => {
        if (v && v.trim() !== "") {
          const splitV = v
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          count += splitV.length;
        }
      });
    }
  });
  return count;
}

/**
 * Helper to clean up empty inline styling elements left behind when extracting ranges
 */
function cleanupEmptyInlineElements(container: HTMLElement) {
  const selectors = "b, i, u, s, strike, strong, em, font, span:not([data-dict-term])";
  let found = true;
  while (found) {
    found = false;
    const elements = container.querySelectorAll(selectors);
    elements.forEach((el) => {
      if (!el.textContent || el.textContent.trim() === "") {
        if (el.children.length === 0) {
          el.remove();
          found = true;
        }
      }
    });
  }
}

/**
 * Creates a styled span element for a matched dictionary term,
 * explicitly setting styles so that existing inline or parent formatting is overridden.
 */
const createStyledElement = (matchedText: string, format: DictionaryFormat): HTMLElement => {
  const span = document.createElement("span");
  span.setAttribute("data-dict-term", matchedText.toLowerCase().replace(/\u00a0/g, " "));

  let styleStr = "";
  if (format.textColor) styleStr += `color: ${format.textColor}; `;
  if (format.bgColor) styleStr += `background-color: ${format.bgColor}; `;

  // Explicitly set font-weight
  if (format.bold) {
    styleStr += `font-weight: bold; `;
  } else if (format.bold === false) {
    styleStr += `font-weight: normal; `;
  }

  // Explicitly set font-style
  if (format.italic) {
    styleStr += `font-style: italic; `;
  } else if (format.italic === false) {
    styleStr += `font-style: normal; `;
  }

  const decorations: string[] = [];
  if (format.underline) decorations.push("underline");
  if (format.strikethrough) decorations.push("line-through");
  if (decorations.length > 0) {
    styleStr += `text-decoration: ${decorations.join(" ")}; `;
  }

  if (styleStr) {
    span.setAttribute("style", styleStr.trim());
  }

  span.textContent = matchedText;
  return span;
};

function isWordChar(char: string): boolean {
  if (!char) return false;
  return /[\p{L}\p{N}_]/u.test(char);
}

/**
 * Finds the index of an isolated term in fullText (case-insensitive)
 * ensuring the match is not a substring inside another word.
 */
function findIsolatedTermIndex(fullText: string, termLower: string, termLen: number): number {
  const fullTextLower = fullText.toLowerCase();
  let searchFrom = 0;
  while (searchFrom <= fullTextLower.length - termLen) {
    const idx = fullTextLower.indexOf(termLower, searchFrom);
    if (idx === -1) return -1;

    const charBefore = idx > 0 ? fullText[idx - 1] : "";
    const charAfter = idx + termLen < fullText.length ? fullText[idx + termLen] : "";

    if (!isWordChar(charBefore) && !isWordChar(charAfter)) {
      return idx;
    }
    searchFrom = idx + 1;
  }
  return -1;
}

/**
 * Processes a single dictionary term across the entire container,
 * searching text nodes even if phrases span across inline formatting tags,
 * and replacing matches using DOM Ranges to overwrite any prior inline formatting.
 */
function processTermInContainer(
  container: HTMLElement,
  term: string,
  format: DictionaryFormat
): { count: number; matchedText: string | null } {
  const termNorm = term.replace(/\u00a0/g, " ").trim();
  if (!termNorm) return { count: 0, matchedText: null };

  const termLower = termNorm.toLowerCase();
  let totalMatches = 0;
  let firstMatchedText: string | null = null;

  // Loop to find all unformatted instances of term in the container
  while (true) {
    const textNodeEntries: { node: Text; startOffset: number; endOffset: number }[] = [];
    let fullText = "";

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text;
        const parent = textNode.parentElement;
        // Skip text nodes that are already inside a dictionary span
        if (parent && parent.closest("span[data-dict-term]")) {
          return;
        }
        const val = (textNode.nodeValue || "").replace(/\u00a0/g, " ");
        const start = fullText.length;
        fullText += val;
        const end = fullText.length;
        textNodeEntries.push({ node: textNode, startOffset: start, endOffset: end });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName;
        if (tag === "SCRIPT" || tag === "STYLE") return;
        // If element is already a formatted dictionary span, skip walking its subtree
        if (el.getAttribute && el.getAttribute("data-dict-term")) return;

        for (let child = el.firstChild; child; child = child.nextSibling) {
          walk(child);
        }
      }
    };

    walk(container);

    if (fullText.length === 0) break;

    const matchIndex = findIsolatedTermIndex(fullText, termLower, termNorm.length);
    if (matchIndex === -1) break;

    const matchStart = matchIndex;
    const matchEnd = matchIndex + termNorm.length;

    const startNodeObj = textNodeEntries.find(
      (e) => matchStart >= e.startOffset && matchStart < e.endOffset
    );
    const endNodeObj = textNodeEntries.find(
      (e) => matchEnd > e.startOffset && matchEnd <= e.endOffset
    );

    if (!startNodeObj || !endNodeObj) {
      break;
    }

    const startNode = startNodeObj.node;
    const startOffsetInNode = matchStart - startNodeObj.startOffset;

    const endNode = endNodeObj.node;
    const endOffsetInNode = matchEnd - endNodeObj.startOffset;

    try {
      const range = document.createRange();
      range.setStart(startNode, startOffsetInNode);
      range.setEnd(endNode, endOffsetInNode);

      const matchedText = range.toString() || termNorm;
      if (!firstMatchedText) firstMatchedText = matchedText;

      const styledSpan = createStyledElement(matchedText, format);

      // Extract contents removes the text/nodes within the range
      range.extractContents();

      // Insert the clean dictionary-styled span
      range.insertNode(styledSpan);

      totalMatches++;
    } catch (e) {
      console.error("Failed to apply dictionary format range:", termNorm, e);
      break;
    }

    cleanupEmptyInlineElements(container);
    container.normalize();
  }

  return { count: totalMatches, matchedText: firstMatchedText };
}

/**
 * Applies a game's formatting dictionary to an HTML string.
 * - Converts markdown inline formatting first.
 * - Unwraps previous dictionary spans so new styles and terms are applied freshly in real time.
 * - Matches terms/phrases case-insensitively, preserving original casing.
 * - Inherits group default formats if an item belongs to a group.
 * - Sorts terms by length descending so longer phrases like "Kakariko Village" are matched before "Kakariko".
 * - Safely replaces matched words across HTML nodes, overwriting existing inline formatting.
 */
export function applyDictionaryToHtml(
  html: string,
  dictionary: DictionaryItem[] | undefined
): DictionaryApplyResult {
  if (!html || !dictionary || dictionary.length === 0) {
    return { updatedHtml: html, replacementsCount: 0, replacedTerms: [] };
  }

  // Convert any markdown syntax in raw HTML first
  const parsedHtml = convertMarkdownToHtml(html);

  interface ExpandedTerm {
    term: string;
    format: DictionaryFormat;
  }

  const expandedTerms: ExpandedTerm[] = [];

  // Map to store group default formats for inheritance (normalized group keys)
  const groupFormats: Record<string, DictionaryFormat> = {};
  dictionary.forEach((item) => {
    if (item.group && item.format) {
      const gKey = item.group.trim().toLowerCase();
      if (
        !groupFormats[gKey] ||
        item.format.textColor ||
        item.format.bgColor ||
        item.format.bold
      ) {
        groupFormats[gKey] = { ...item.format };
      }
    }
  });

  dictionary.forEach((item) => {
    const rawTerms: string[] = [];

    if (item.term && item.term.trim() !== "") {
      rawTerms.push(
        ...item.term
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      );
    }

    if (Array.isArray(item.variants)) {
      item.variants.forEach((v) => {
        if (v && v.trim() !== "") {
          rawTerms.push(
            ...v
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          );
        }
      });
    }

    rawTerms.forEach((t) => {
      let termFormat = item.format ? { ...item.format } : {};

      // If word belongs to a group, inherit group format as fallback if item format is missing fields
      if (item.group) {
        const gKey = item.group.trim().toLowerCase();
        if (groupFormats[gKey]) {
          const gF = groupFormats[gKey];
          termFormat = {
            textColor: termFormat.textColor || gF.textColor,
            bgColor: termFormat.bgColor || gF.bgColor,
            bold: termFormat.bold !== undefined ? termFormat.bold : gF.bold,
            italic: termFormat.italic !== undefined ? termFormat.italic : gF.italic,
            underline: termFormat.underline !== undefined ? termFormat.underline : gF.underline,
            strikethrough:
              termFormat.strikethrough !== undefined ? termFormat.strikethrough : gF.strikethrough,
          };
        }
      }

      expandedTerms.push({ term: t, format: termFormat });
    });
  });

  if (expandedTerms.length === 0) {
    return { updatedHtml: parsedHtml, replacementsCount: 0, replacedTerms: [] };
  }

  // Sort longest term first to prioritize exact long phrase matches
  expandedTerms.sort((a, b) => b.term.length - a.term.length);

  const container = document.createElement("div");
  container.innerHTML = parsedHtml;

  // Step 1: Unwrap previous dictionary spans so fresh application works in real-time
  const existingSpans = container.querySelectorAll("span[data-dict-term]");
  existingSpans.forEach((span) => {
    const parent = span.parentNode;
    if (parent) {
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    }
  });
  container.normalize();

  let totalReplacements = 0;
  const replacedTermsSet = new Set<string>();

  // Step 2: Apply each term in length order
  expandedTerms.forEach(({ term, format }) => {
    const res = processTermInContainer(container, term, format);
    if (res.count > 0) {
      totalReplacements += res.count;
      if (res.matchedText) {
        replacedTermsSet.add(res.matchedText);
      }
    }
  });

  return {
    updatedHtml: container.innerHTML,
    replacementsCount: totalReplacements,
    replacedTerms: Array.from(replacedTermsSet),
  };
}

/**
 * Returns inline CSS style object for previewing a DictionaryFormat in React
 */
export function formatToStyleObject(format: DictionaryFormat): CSSProperties {
  const style: CSSProperties = {};
  if (format.textColor) style.color = format.textColor;
  if (format.bgColor) style.backgroundColor = format.bgColor;
  if (format.bold) style.fontWeight = "bold";
  if (format.italic) style.fontStyle = "italic";

  const decorations: string[] = [];
  if (format.underline) decorations.push("underline");
  if (format.strikethrough) decorations.push("line-through");
  if (decorations.length > 0) style.textDecoration = decorations.join(" ");

  return style;
}
