import { useEffect } from "react";
import { DesktopIconConfig } from "./useHomeConfig";

/**
 * useDynamicIcon
 * 
 * Reads the desktopIcon config and dynamically updates:
 * 1. <link rel="icon"> — from icon192Url
 * 2. <link rel="apple-touch-icon"> — from icon192Url
 * 3. document.title — from appName
 * 
 * Icon URLs are directly used (no Canvas generation).
 * For already-installed PWAs on iOS, the user must remove
 * and re-add the app to the home screen to see the updated icon.
 */
export function useDynamicIcon(iconConfig: DesktopIconConfig) {
  useEffect(() => {
    const { icon192Url, appName } = iconConfig;

    // Update document title
    if (appName) {
      document.title = appName;
    }

    if (!icon192Url) return;

    // Update or create <link rel="icon">
    let iconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (iconLink) {
      iconLink.href = icon192Url;
    } else {
      iconLink = document.createElement("link");
      iconLink.rel = "icon";
      iconLink.href = icon192Url;
      document.head.appendChild(iconLink);
    }

    // Update or create <link rel="apple-touch-icon">
    let appleLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (appleLink) {
      appleLink.href = icon192Url;
    } else {
      appleLink = document.createElement("link");
      appleLink.rel = "apple-touch-icon";
      appleLink.setAttribute("sizes", "192x192");
      appleLink.href = icon192Url;
      document.head.appendChild(appleLink);
    }
  }, [iconConfig]);
}
