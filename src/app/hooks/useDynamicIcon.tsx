import { useEffect } from "react";
import { DesktopIconConfig } from "./useHomeConfig";

/**
 * useDynamicIcon
 * 
 * Reads the desktopIcon config and dynamically updates:
 * 1. <link rel="icon"> (browser tab favicon) — SVG data URI
 * 2. <link rel="apple-touch-icon"> — Canvas-generated PNG data URI
 * 
 * This ensures that when the user edits the icon text/colors in
 * DesktopIconEditor and saves, the change takes effect at runtime
 * without needing to manually replace static files in /public/.
 * 
 * NOTE: For already-installed PWAs on iOS, the user must remove
 * and re-add the app to the home screen to see the updated icon.
 */
export function useDynamicIcon(iconConfig: DesktopIconConfig) {
  useEffect(() => {
    if (iconConfig.mode !== "text") return; // custom mode needs image URL, skip

    const { text, backgroundColor, textColor, fontSize, borderEnabled, borderColor, cornerRadius } = iconConfig;

    // --- 1. Generate inline SVG and set as favicon ---
    const size = 192;
    const r = size * (cornerRadius / 100);
    const fs = Math.round(size * fontSize);
    const yPos = Math.round(size * 0.56); // slight offset for CJK vertical centering

    // Escape text for SVG
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    let borderSvg = "";
    if (borderEnabled) {
      const inset = Math.round(size * 0.052);
      const innerR = Math.round(r * 0.85);
      const sw = Math.round(size * 0.021);
      borderSvg = `<rect x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" fill="none" stroke="${borderColor}" stroke-width="${sw}" rx="${innerR}"/>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${backgroundColor}" rx="${Math.round(r)}"/>
  ${borderSvg}
  <text x="${size / 2}" y="${yPos}" font-family="PingFang SC,Microsoft YaHei,Noto Sans SC,sans-serif" font-size="${fs}" font-weight="bold" fill="${textColor}" text-anchor="middle" dominant-baseline="central">${escaped}</text>
</svg>`;

    const svgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    // Update or create <link rel="icon" type="image/svg+xml">
    let svgLink = document.querySelector('link[rel="icon"][type="image/svg+xml"]') as HTMLLinkElement | null;
    if (svgLink) {
      svgLink.href = svgDataUri;
    } else {
      svgLink = document.createElement("link");
      svgLink.rel = "icon";
      svgLink.type = "image/svg+xml";
      svgLink.href = svgDataUri;
      document.head.appendChild(svgLink);
    }

    // --- 2. Generate PNG via Canvas for apple-touch-icon ---
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 192;
      canvas.height = 192;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw rounded rect background
        const drawRoundedRect = (x: number, y: number, w: number, h: number, radius: number) => {
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + w - radius, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
          ctx.lineTo(x + w, y + h - radius);
          ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
          ctx.lineTo(x + radius, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
        };

        drawRoundedRect(0, 0, 192, 192, r);
        ctx.fillStyle = backgroundColor;
        ctx.fill();

        if (borderEnabled) {
          const inset = 192 * 0.052;
          const innerR = r * 0.85;
          drawRoundedRect(inset, inset, 192 - inset * 2, 192 - inset * 2, innerR);
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 192 * 0.021;
          ctx.stroke();
        }

        if (text) {
          const canvasFs = 192 * fontSize;
          ctx.font = `bold ${canvasFs}px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Noto Sans", sans-serif`;
          ctx.fillStyle = textColor;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, 96, 192 * 0.52);
        }

        const pngDataUri = canvas.toDataURL("image/png");

        // Update <link rel="apple-touch-icon">
        let appleLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
        if (appleLink) {
          appleLink.href = pngDataUri;
        } else {
          appleLink = document.createElement("link");
          appleLink.rel = "apple-touch-icon";
          appleLink.setAttribute("sizes", "192x192");
          appleLink.href = pngDataUri;
          document.head.appendChild(appleLink);
        }

        // Also update <link rel="icon" type="image/png">
        let pngLink = document.querySelector('link[rel="icon"][type="image/png"]') as HTMLLinkElement | null;
        if (pngLink) {
          pngLink.href = pngDataUri;
        }
      }
    } catch {
      // Canvas not available, favicon SVG is still set
    }
  }, [iconConfig]);
}
