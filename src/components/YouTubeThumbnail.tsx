import React, { useState, useEffect } from "react";
import { Film } from "lucide-react";
import { getYoutubeVideoId } from "../utils/youtube";

interface YouTubeThumbnailProps {
  url: string;
  className?: string;
  alt?: string;
}

export function YouTubeThumbnail({
  url,
  className = "w-full h-full object-cover",
  alt = "Miniatura do YouTube"
}: YouTubeThumbnailProps) {
  const videoId = getYoutubeVideoId(url);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasFailedAll, setHasFailedAll] = useState(false);

  const candidates = videoId
    ? [
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/0.jpg`,
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        `https://img.youtube.com/vi/${videoId}/0.jpg`
      ]
    : [];

  useEffect(() => {
    setCandidateIndex(0);
    setHasFailedAll(false);
  }, [url]);

  const handleError = () => {
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((prev) => prev + 1);
    } else {
      setHasFailedAll(true);
    }
  };

  if (!videoId || hasFailedAll) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-red-950/20 to-zinc-950 flex flex-col items-center justify-center p-2 text-center border border-zinc-800/60 select-none">
        <div className="w-8 h-8 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center mb-1 shadow-sm">
          <Film size={16} />
        </div>
        <span className="text-[10px] font-bold text-zinc-300">Vídeo YouTube</span>
        <span className="text-[9px] text-zinc-500 font-mono mt-0.5 truncate max-w-[120px]">
          {videoId || "Sem ID"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={candidates[candidateIndex]}
      onError={handleError}
      className={className}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
