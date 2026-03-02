/**
 * CameraUtils - PWA 相机调用工具集
 * 
 * 专为国产手机（小米/OPPO/vivo/华为）PWA桌面模式优化
 * 提供多层降级策略，确保在任何环境下都能获取图片
 */

/**
 * 检测设备是否支持 getUserMedia（直接调用摄像头）
 */
export function supportsGetUserMedia(): boolean {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
}

/**
 * 检测浏览器是否支持 input capture 属性
 * 国产浏览器桌面模式下通常不支持或会拦截
 */
export function supportsCaptureAttribute(): boolean {
  // 简单检测：Safari iOS、部分Android原生浏览器支持
  // 小米/OPPO/vivo自带浏览器通常不支持或拦截
  const ua = navigator.userAgent.toLowerCase();
  
  // iOS Safari 支持
  if (/iphone|ipad|ipod/.test(ua) && /safari/.test(ua)) {
    return true;
  }
  
  // Chrome Android 原生支持
  if (/android/.test(ua) && /chrome/.test(ua) && !/miui|oppo|vivo|huawei/.test(ua)) {
    return true;
  }
  
  // 国产浏览器默认不支持
  return false;
}

/**
 * 检测是否应该使用 capture 属性
 * 
 * 策略：
 * - 国产浏览器PWA模式：不使用（兼容性优先）
 * - iOS Safari：使用（用户体验优先）
 * - Chrome Android：使用（用户体验优先）
 * - 其他：根据设备判断
 */
export function shouldUseCapture(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  
  // 检测是否在PWA模式下运行
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://');
  
  // 国产浏览器 + PWA模式 = 不使用capture（会被拦截）
  if (isChineseBrowser() && isPWA) {
    return false;
  }
  
  // iOS Safari：始终支持
  if (/iphone|ipad|ipod/.test(ua) && /safari/.test(ua)) {
    return true;
  }
  
  // Chrome Android（非国产）：支持
  if (/android/.test(ua) && /chrome/.test(ua) && !isChineseBrowser()) {
    return true;
  }
  
  // 国产浏览器非PWA模式：可以尝试使用
  if (isChineseBrowser() && !isPWA) {
    return true;
  }
  
  // 默认：不使用（最安全）
  return false;
}

/**
 * 检测是否为国产浏览器
 */
export function isChineseBrowser(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /miui|xiaomi|oppo|vivo|huawei|honor|oneplus/.test(ua);
}

/**
 * 使用原生事件触发 input.click()，绕过React合成事件拦截
 * 
 * 关键：必须在用户手势的**同步代码**中立即触发，不能有任何延迟！
 * 否则浏览器会认为"这不是用户交互"而拒绝弹出文件选择器
 * 
 * @param inputElement - file input 元素
 */
export function safeInputClick(inputElement: HTMLInputElement | null): void {
  if (!inputElement) {
    console.warn('[safeInputClick] Input element is null');
    return;
  }

  try {
    // 🔥 关键：必须立即触发，不能有任何延迟！
    // 在用户点击事件的同步代码中执行，保持"用户手势上下文"
    inputElement.click();
  } catch (error) {
    console.error('[safeInputClick] Failed to trigger click:', error);
  }
}

/**
 * 直接调用 getUserMedia 获取摄像头流
 * 适用于支持的现代浏览器
 * 
 * @param facingMode - 'user'（前置） | 'environment'（后置）
 * @returns MediaStream
 */
export async function getCameraStream(
  facingMode: 'user' | 'environment' = 'environment'
): Promise<MediaStream> {
  if (!supportsGetUserMedia()) {
    throw new Error('getUserMedia not supported');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    return stream;
  } catch (err) {
    // 如果指定摄像头失败，尝试任意摄像头
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    return stream;
  }
}

/**
 * 停止摄像头流
 */
export function stopCameraStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach(track => track.stop());
}

/**
 * 从 video 元素捕获当前帧为 base64 图片
 * 
 * @param video - video 元素
 * @param quality - JPEG 质量 (0-1)
 * @returns base64 图片数据
 */
export function captureVideoFrame(video: HTMLVideoElement, quality = 0.85): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * 检测前运行模式
 */
export function getPWADisplayMode(): 'standalone' | 'browser' {
  // @ts-ignore - 检测 iOS standalone
  if (window.navigator.standalone) {
    return 'standalone';
  }
  
  // 检测 Android/Desktop PWA
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  
  return 'browser';
}

/**
 * 获取推荐的拍照策略
 * 
 * @returns 'getUserMedia' | 'input-simple' | 'input-capture'
 */
export function getRecommendedCameraStrategy(): 'getUserMedia' | 'input-simple' | 'input-capture' {
  // 国产浏览器：优先使用简单 input（无 capture）
  if (isChineseBrowser()) {
    return 'input-simple';
  }
  
  // PWA 桌面模式 + 支持 getUserMedia：优先使用 HTML5 Camera
  if (getPWADisplayMode() === 'standalone' && supportsGetUserMedia()) {
    return 'getUserMedia';
  }
  
  // iOS/Chrome：可以尝试 capture 属性
  if (supportsCaptureAttribute()) {
    return 'input-capture';
  }
  
  // 默认：简单 input
  return 'input-simple';
}