import { useEffect } from "react";
import { useHomeConfig } from "./useHomeConfig";

/**
 * useDynamicManifest — 动态 PWA Manifest 生成器
 * 
 * 解决白牌模式下的图标问题：
 * 静态 manifest.json 里的图标是默认的叶子 SVG，
 * 但每个白牌公司在 ConfigManager 里配置了自己的 desktopIcon.icon192Url / icon512Url。
 * 
 * 本 hook 在运行时读取配置，生成动态 manifest blob URL，
 * 替换 <link rel="manifest"> 的 href。
 * 这样用户点击"添加到主屏幕"时，浏览器会读取到正确的品牌图标。
 * 
 * 时序：config 加载完成 → 生成 blob → 替换 link → 用户添加到桌面 → 正确图标
 */
export function useDynamicManifest() {
  const { config } = useHomeConfig();

  useEffect(() => {
    if (!config) return;

    const { desktopIcon, appBranding } = config;

    // 如果没有自定义图标配置，保持默认静态 manifest
    if (!desktopIcon?.icon192Url && !desktopIcon?.icon512Url) return;

    const appName = desktopIcon?.appName || appBranding?.appName || "TaprootAgro";
    const icon192 = desktopIcon.icon192Url;
    const icon512 = desktopIcon.icon512Url || icon192;

    // 构建动态 manifest 对象
    const dynamicManifest = {
      id: "/",
      name: appName,
      short_name: appName,
      description: appBranding?.slogan || "Smart agriculture platform",
      start_url: "/",
      scope: "/",
      display: "standalone" as const,
      background_color: "#059669",
      theme_color: "#059669",
      orientation: "portrait" as const,
      prefer_related_applications: false,
      icons: [
        // any purpose — 普通图标
        ...(icon192
          ? [
              {
                src: icon192,
                sizes: "192x192",
                type: detectMimeType(icon192),
                purpose: "any" as const,
              },
            ]
          : []),
        ...(icon512
          ? [
              {
                src: icon512,
                sizes: "512x512",
                type: detectMimeType(icon512),
                purpose: "any" as const,
              },
            ]
          : []),
        // maskable purpose — 自适应图标（Android）
        ...(icon192
          ? [
              {
                src: icon192,
                sizes: "192x192",
                type: detectMimeType(icon192),
                purpose: "maskable" as const,
              },
            ]
          : []),
        ...(icon512
          ? [
              {
                src: icon512,
                sizes: "512x512",
                type: detectMimeType(icon512),
                purpose: "maskable" as const,
              },
            ]
          : []),
      ],
      categories: ["productivity", "agriculture", "business"],
      lang: "en",
      dir: "ltr",
    };

    // 创建 Blob URL
    const blob = new Blob([JSON.stringify(dynamicManifest)], {
      type: "application/json",
    });
    const blobUrl = URL.createObjectURL(blob);

    // 替换 <link rel="manifest">
    const existingLink = document.querySelector(
      'link[rel="manifest"]'
    ) as HTMLLinkElement | null;

    if (existingLink) {
      existingLink.href = blobUrl;
    } else {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = blobUrl;
      document.head.appendChild(link);
    }

    // 同时更新 apple-touch-icon（iOS 不读 manifest 的 icons）
    updateAppleTouchIcon(icon192);

    // 更新 apple-mobile-web-app-title
    updateMetaTag("apple-mobile-web-app-title", appName);
    updateMetaTag("application-name", appName);

    // 清理 blob URL
    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [config]);
}

/** 根据 URL 后缀推断 MIME 类型 */
function detectMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".svg")) return "image/svg+xml";
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  // 默认 png（大多数外链图片如 unsplash 返回 JPEG，但声明 png 更安全）
  return "image/png";
}

/** 更新或创建 apple-touch-icon link */
function updateAppleTouchIcon(iconUrl: string) {
  let link = document.querySelector(
    'link[rel="apple-touch-icon"]'
  ) as HTMLLinkElement | null;
  if (link) {
    link.href = iconUrl;
  } else {
    link = document.createElement("link");
    link.rel = "apple-touch-icon";
    link.href = iconUrl;
    document.head.appendChild(link);
  }
}

/** 更新 meta 标签内容 */
function updateMetaTag(name: string, content: string) {
  let meta = document.querySelector(
    `meta[name="${name}"]`
  ) as HTMLMetaElement | null;
  if (meta) {
    meta.content = content;
  }
}
