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
 * 重要：图标如果是 SVG，会通过 canvas 转为 PNG data URL，
 * 因为 Chrome/小米/Samsung 等浏览器要求 manifest 中有 PNG 图标
 * 才能触发 beforeinstallprompt 事件。
 * 
 * 时序：config 加载完成 → 生成 blob → 替换 link → 用户添加到桌面 → 正确图标
 */
export function useDynamicManifest() {
  const { config } = useHomeConfig();

  useEffect(() => {
    if (!config) return;

    const { desktopIcon, appBranding } = config;

    // 如果没有自定义图标配置，保持 index.html 中早期脚本生成的 PNG manifest
    if (!desktopIcon?.icon192Url && !desktopIcon?.icon512Url) return;

    const appName = desktopIcon?.appName || appBranding?.appName || "TaprootAgro";
    const icon192 = desktopIcon.icon192Url;
    const icon512 = desktopIcon.icon512Url || icon192;

    let cancelled = false;
    let blobUrl = "";

    // 异步处理：如果图标是 SVG，转为 PNG
    buildManifestIcons(icon192, icon512).then((icons) => {
      if (cancelled) return;

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
      updateMetaTag("apple-mobile-web-app-title", appName);
      updateMetaTag("application-name", appName);
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
