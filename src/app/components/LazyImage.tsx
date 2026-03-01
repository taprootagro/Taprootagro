import { useEffect, useRef, useState } from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
}

/**
 * 懒加载图片组件 - 针对老设备优化
 * - 使用 Intersection Observer 延迟加载
 * - 显示占位符减少抖动
 * - 渐进式加载提升体验
 * - 加载失败自动显示回退占位图
 */

const PLACEHOLDER_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23e5e7eb'/%3E%3C/svg%3E";

const ERROR_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f3f4f6'/%3E%3Ctext x='200' y='150' text-anchor='middle' dominant-baseline='central' font-family='sans-serif' font-size='14' fill='%239ca3af'%3E%E5%9B%BE%E7%89%87%E5%8A%A0%E8%BD%BD%E5%A4%B1%E8%B4%A5%3C/text%3E%3C/svg%3E";

export function LazyImage({
  src,
  alt,
  className = "",
  placeholder = PLACEHOLDER_SVG,
}: LazyImageProps) {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // src 变更时重置状态
    setHasError(false);
    setImageLoaded(false);
    setImageSrc(placeholder);

    if (!src) {
      setImageSrc(ERROR_SVG);
      setImageLoaded(true);
      return;
    }

    // 检查浏览器是否支持 IntersectionObserver
    if (!("IntersectionObserver" in window)) {
      // 老设备不支持，直接加载图片
      setImageSrc(src);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            if (imgRef.current) {
              observer.unobserve(imgRef.current);
            }
          }
        });
      },
      {
        rootMargin: "50px", // 提前50px开始加载
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImageSrc(ERROR_SVG);
      setImageLoaded(true); // 显示回退图，不要卡在 opacity-0
    }
  };

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`${className} ${
        imageLoaded ? "opacity-100" : "opacity-0"
      } transition-opacity duration-300`}
      onLoad={() => setImageLoaded(true)}
      onError={handleError}
      loading="lazy" // 原生懒加载作为后备
    />
  );
}