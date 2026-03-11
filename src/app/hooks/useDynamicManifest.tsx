import { useEffect } from "react";
import { useHomeConfig } from "./useHomeConfig";
import { storageSetJSON } from "../utils/safeStorage";

/**
 * useDynamicManifest — 动态 PWA Manifest 生成器（唯一的 manifest 来源）
 * 
 * index.html 不再生成默认 manifest（避免小米浏览器用默认图标弹安装提示）。
 * 本 hook 是 manifest 的唯一生成入口：
 * - 有远程自定义图标 → 用客户图标
 * - 没有自定义图标 → 用默认 /icon-192.svg 转 PNG 兜底
 * 
 * 重要：图标如果是 SVG，会通过 canvas 转为 PNG data URL，
 * 因为 Chrome/小米/Samsung 等浏览器要求 manifest 中有 PNG 图标
 * 才能触发 beforeinstallprompt 事件。
 * 
 * 图标缓存策略：
 * 成功转换后将 PNG data URL 缓存到 localStorage（key: __taproot_manifest_icon_cache__），
 * 下次访问时 index.html 内联脚本直接读取缓存，在 React 加载前就完成 manifest 替换。
 * 
 * 时序（首次访问）：
 *   HTML 加载 → 无 manifest → 浏览器不触发 beforeinstallprompt
 *   → React 加载 → config 就绪 → 本 hook 生成 manifest + 缓存图标
 *   → 浏览器重新评估可安装性 → beforeinstallprompt 触发（正确图标）
 * 
 * 时序（回访）：
 *   HTML 加载 → 内联脚本从 localStorage 读缓存 → 立即生成正确 manifest
 *   → beforeinstallprompt 立即触发（正确图标）
 */
// localStorage key for icon cache (shared with index.html inline script)
const ICON_CACHE_KEY = '__taproot_manifest_icon_cache__';
// 默认 SVG 图标路径（无自定义配置时的兜底）
const DEFAULT_ICON_SVG = '/icon-192.svg';

export function useDynamicManifest() {
  const { config } = useHomeConfig();

  useEffect(() => {
    if (!config) return;

    const { desktopIcon, appBranding } = config;

    const appName = desktopIcon?.appName || appBranding?.appName || "TaprootAgro";
    const slogan = appBranding?.slogan || "Smart agriculture platform";

    // 确定图标来源：自定义 > 默认 SVG
    const hasCustomIcon = !!(desktopIcon?.icon192Url || desktopIcon?.icon512Url);
    const icon192 = desktopIcon?.icon192Url || DEFAULT_ICON_SVG;
    const icon512 = desktopIcon?.icon512Url || icon192;

    let cancelled = false;
    let blobUrl = "";

    // 异步处理：如果图标是 SVG，转为 PNG
    buildManifestIcons(icon192, icon512).then((icons) => {
      if (cancelled) return;

      // 缓存图标 PNG data URLs 到 localStorage，供 index.html 内联脚本下次启动时使用
      // 这解决了小米浏览器在 React 加载前就触发 beforeinstallprompt 的时序问题
      try {
        const cacheData: Record<string, string> = { appName };
        for (const icon of icons) {
          if (icon.purpose === 'any') {
            if (icon.sizes === '192x192') cacheData.icon192 = icon.src;
            if (icon.sizes === '512x512') cacheData.icon512 = icon.src;
          }
        }
        if (cacheData.icon192 || cacheData.icon512) {
          storageSetJSON(ICON_CACHE_KEY, cacheData);
        }
      } catch { /* localStorage full or unavailable */ }

      const dynamicManifest = {
        id: "/",
        name: appName,
        short_name: appName,
        description: slogan,
        start_url: "/",
        scope: "/",
        display: "standalone" as const,
        background_color: "#059669",
        theme_color: "#059669",
        orientation: "portrait" as const,
        prefer_related_applications: false,
        icons,
        categories: ["productivity", "agriculture", "business"],
        lang: "en",
        dir: "ltr",
      };

      const blob = new Blob([JSON.stringify(dynamicManifest)], {
        type: "application/json",
      });
      blobUrl = URL.createObjectURL(blob);

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
      if (hasCustomIcon) {
        updateMetaTag("apple-mobile-web-app-title", appName);
        updateMetaTag("application-name", appName);
      }
    });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [config]);
}

/**
 * 构建 manifest icons 数组
 * 如果图标 URL 是 SVG，通过 canvas 转为 PNG data URL
 * 确保 beforeinstallprompt 在所有浏览器上正常触发
 */
async function buildManifestIcons(
  icon192: string,
  icon512: string
): Promise<Array<{ src: string; sizes: string; type: string; purpose: string }>> {
  const entries: Array<{ url: string; size: number }> = [];
  if (icon192) entries.push({ url: icon192, size: 192 });
  if (icon512 && icon512 !== icon192) entries.push({ url: icon512, size: 512 });

  const icons: Array<{ src: string; sizes: string; type: string; purpose: string }> = [];

  for (const { url, size } of entries) {
    let finalUrl = url;
    let mimeType = detectMimeType(url);

    // SVG 图标需要转 PNG，否则小米/Chrome 不触发 beforeinstallprompt
    if (mimeType === "image/svg+xml") {
      try {
        const pngDataUrl = await svgToPng(url, size);
        finalUrl = pngDataUrl;
        mimeType = "image/png";
      } catch {
        // 转换失败，仍用 SVG（至少能显示图标）
      }
    }

    icons.push({
      src: finalUrl,
      sizes: `${size}x${size}`,
      type: mimeType,
      purpose: "any",
    });
    icons.push({
      src: finalUrl,
      sizes: `${size}x${size}`,
      type: mimeType,
      purpose: "maskable",
    });
  }

  // 如果 icon512 和 icon192 相同，补上 512 尺寸
  if (icon512 === icon192 && icon192) {
    const existing512 = icons.find((i) => i.sizes === "512x512");
    if (!existing512) {
      let finalUrl = icon192;
      let mimeType = detectMimeType(icon192);
      if (mimeType === "image/svg+xml") {
        try {
          finalUrl = await svgToPng(icon192, 512);
          mimeType = "image/png";
        } catch {}
      }
      icons.push({ src: finalUrl, sizes: "512x512", type: mimeType, purpose: "any" });
      icons.push({ src: finalUrl, sizes: "512x512", type: mimeType, purpose: "maskable" });
    }
  }

  return icons;
}

/** 通过 canvas 将 SVG URL 渲染为 PNG data URL */
function svgToPng(svgUrl: string, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no canvas ctx")); return; }
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = svgUrl;
  });
}

/** 根据 URL 后缀推断 MIME 类型 */
function detectMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".svg")) return "image/svg+xml";
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
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