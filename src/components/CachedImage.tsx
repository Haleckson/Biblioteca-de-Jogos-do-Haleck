import React, { useState, useEffect } from "react";
import { getCachedImageUrl } from "../utils/imageCacheManager";

export interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackSrc?: string;
  onLoadingComplete?: () => void;
}

/**
 * Componente <img> com suporte automático ao CacheStorage e renderização em alta performance.
 * - Serve imagem do disco local instantaneamente (0ms) se já estiver no cache.
 * - Mantém 100% da resolução original do arquivo (sem compressão ou perda de qualidade).
 * - Trata erros de CORS com fallback gracioso para a URL padrão.
 */
export const CachedImage: React.FC<CachedImageProps> = ({
  src,
  fallbackSrc,
  alt = "",
  className = "",
  onLoadingComplete,
  onError,
  ...props
}) => {
  const [activeSrc, setActiveSrc] = useState<string>(src || "");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setActiveSrc("");
      setHasError(false);
      return;
    }

    let isMounted = true;
    setHasError(false);

    // Se já for data: ou blob:, utiliza diretamente
    if (src.startsWith("data:") || src.startsWith("blob:")) {
      setActiveSrc(src);
      return;
    }

    // Tenta obter a versão rápida do cache local
    getCachedImageUrl(src)
      .then((cachedUrl) => {
        if (isMounted) {
          setActiveSrc(cachedUrl);
        }
      })
      .catch(() => {
        if (isMounted) {
          setActiveSrc(src);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [src]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError && fallbackSrc && activeSrc !== fallbackSrc) {
      setHasError(true);
      setActiveSrc(fallbackSrc);
    }
    if (onError) {
      onError(e);
    }
  };

  return (
    <img
      src={activeSrc || src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      decoding="async"
      onLoad={onLoadingComplete}
      onError={handleError}
      {...props}
    />
  );
};

export default CachedImage;
