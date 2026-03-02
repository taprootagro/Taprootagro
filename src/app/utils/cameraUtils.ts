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
 * 检测是否为国产浏览器
 */
export function isChineseBrowser(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /miui|xiaomi|oppo|vivo|huawei|honor|oneplus/.test(ua);
}

/**
 * 使用原生事件触发 input.click()，绕过React合成事件拦截
 * 
 * 国产浏览器在React合成事件中会静默拦截文件选择器，
 * 必须使用原生 MouseEvent 才能触发
 * 
 * @param inputElement - file input 元素
 * @param delay - 延迟触发时间（ms），国产浏览器需要至少1500ms
 */
export function safeInputClick(inputElement: HTMLInputElement | null, delay = 1500): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!inputElement) {
      reject(new Error('Input element is null'));
      return;
    }

    // 对于国产浏览器，使用更长延迟
    const actualDelay = isChineseBrowser() ? Math.max(delay, 1500) : delay;

    setTimeout(() => {
      try {
        // 方法1: 原生 MouseEvent（最兼容）
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        inputElement.dispatchEvent(event);

        // 方法2: 如果方法1失败，直接调用 click
        setTimeout(() => {
          inputElement.click();
          resolve();
        }, 100);
      } catch (err) {
        reject(err);
      }
    }, actualDelay);
  });
}

/**
 * 渐进式重试策略：500ms → 1000ms → 1500ms
 * 最多重试3次
 */
export function safeInputClickWithRetry(
  inputElement: HTMLInputElement | null,
  onRetry?: (attemptNum: number) => void
): Promise<void> {
  const delays = [500, 1000, 1500];
  
  return new Promise((resolve, reject) => {
    let attemptCount = 0;

    const tryClick = () => {
      attemptCount++;
      const currentDelay = delays[Math.min(attemptCount - 1, delays.length - 1)];
      
      onRetry?.(attemptCount);
      
      safeInputClick(inputElement, currentDelay)
        .then(resolve)
        .catch((err) => {
          if (attemptCount >= 3) {
            reject(err);
          } else {
            // 等待一段时间后重试
            setTimeout(tryClick, currentDelay);
          }
        });
    };

    tryClick();
  });
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
 * 检测当前运行模式
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
