/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Checks if a URL is a valid YouTube link and extracts the embeddable format.
 */
export function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  
  // Regular expressions to match different YouTube URL variants
  // E.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ
  // E.g., https://youtu.be/dQw4w9WgXcQ
  // E.g., https://www.youtube.com/embed/dQw4w9WgXcQ
  // E.g., https://m.youtube.com/watch?v=dQw4w9WgXcQ
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  
  return null;
}

/**
 * Returns true if the URL is a YouTube link.
 */
export function isYoutubeUrl(url: string): boolean {
  return !!getYoutubeEmbedUrl(url);
}
