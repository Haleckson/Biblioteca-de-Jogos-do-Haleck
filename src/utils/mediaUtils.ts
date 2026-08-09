/**
 * Utility functions for media file detection and MIME type resolution.
 */

export function isVideoFile(file: { name?: string; type?: string }): boolean {
  if (file.type && file.type.startsWith("video/")) return true;
  const name = file.name ? file.name.toLowerCase() : "";
  const videoExtensions = [
    ".mp4", ".mkv", ".webm", ".mov", ".avi", ".wmv", ".flv", 
    ".m4v", ".3gp", ".ogv", ".ts", ".mts", ".m2ts", ".vob", ".m4p", ".mpg", ".mpeg"
  ];
  return videoExtensions.some((ext) => name.endsWith(ext));
}

export function isImageFile(file: { name?: string; type?: string }): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  const name = file.name ? file.name.toLowerCase() : "";
  const imageExtensions = [
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico", ".tiff", ".avif"
  ];
  return imageExtensions.some((ext) => name.endsWith(ext));
}

export function getVideoMimeType(file: { name?: string; type?: string }): string {
  if (file.type && file.type.startsWith("video/")) {
    const rawType = file.type.toLowerCase();
    if (rawType.includes("matroska") || rawType.includes("mkv")) return "video/mp4";
    return file.type;
  }
  const name = file.name ? file.name.toLowerCase() : "";
  if (name.endsWith(".mkv")) return "video/mp4";
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".avi")) return "video/x-msvideo";
  if (name.endsWith(".wmv")) return "video/x-ms-wmv";
  if (name.endsWith(".flv")) return "video/x-flv";
  if (name.endsWith(".m4v")) return "video/mp4";
  if (name.endsWith(".3gp")) return "video/3gpp";
  if (name.endsWith(".ogv")) return "video/ogg";
  if (name.endsWith(".ts")) return "video/mp2t";
  return "video/mp4"; // Default for YouTube API compatibility
}
