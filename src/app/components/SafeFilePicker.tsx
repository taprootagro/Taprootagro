import { useRef, useCallback, useEffect } from 'react';

/**
 * SafeFilePicker — 双保险文件选择器
 *
 * 国产浏览器（小米/华为/OPPO/vivo）在 PWA standalone 模式下
 * 会静默拦截 JS 编程式 input.click()。本组件采用双保险策略：
 *
 * 【方案 A — 原生层（主）】
 *   透明 <input type="file"> 叠在按钮上方，用户物理点击直接
 *   命中真实 input，浏览器无法拦截。这是最古老最可靠的手法。
 *
 * 【方案 B — JS 兜底（备）】
 *   点击后 1500ms 延迟调用 .click()，之后每隔一段时间检测
 *   文件选择器是否真的弹出（通过 hasFocus / visibilityState），
 *   未弹出则继续重试，最多 3 次。
 *
 * 两条路同时生效，谁先触发谁赢。
 *
 * 用法：
 *   <SafeFilePicker accept="image/*" capture="environment" onChange={handleFile}>
 *     <button>拍照</button>
 *   </SafeFilePicker>
 */

interface SafeFilePickerProps {
  /** 接受的文件类型 */
  accept?: string;
  /** 相机模式：environment=后置, user=前置 */
  capture?: 'environment' | 'user';
  /** 文件选中回调 */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** 子元素（按钮等） */
  children: React.ReactNode;
  /** 额外 className */
  className?: string;
}

/** 检测文件选择器是否已弹出 */
function pickerLikelyOpened(el: HTMLInputElement): boolean {
  if (el.files && el.files.length > 0) return true;
  if (document.visibilityState === 'hidden') return true;
  if (!document.hasFocus()) return true;
  return false;
}

const RETRY_DELAYS = [500, 1000, 1500];

export function SafeFilePicker({
  accept,
  capture,
  onChange,
  children,
  className = '',
}: SafeFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const retryTimers = useRef<number[]>([]);

  // 清理定时器
  useEffect(() => {
    return () => {
      retryTimers.current.forEach(clearTimeout);
    };
  }, []);

  /** 方案 B：JS 编程式重试链 */
  const startRetryChain = useCallback(() => {
    // 清除之前的重试
    retryTimers.current.forEach(clearTimeout);
    retryTimers.current = [];

    const el = inputRef.current;
    if (!el) return;

    // 首次 1500ms 后 click
    const firstTimer = window.setTimeout(() => {
      const currentEl = inputRef.current;
      if (!currentEl) return;

      // 如果方案 A 已经触发了选择器，不再 click
      if (pickerLikelyOpened(currentEl)) return;

      console.warn('[SafeFilePicker] 方案A未触发，方案B首次 click');
      currentEl.click();

      // 后续重试
      let retryIndex = 0;
      function scheduleRetry() {
        if (retryIndex >= RETRY_DELAYS.length) return;
        const delay = RETRY_DELAYS[retryIndex];
        retryIndex++;
        const timer = window.setTimeout(() => {
          const retryEl = inputRef.current;
          if (!retryEl) return;
          if (pickerLikelyOpened(retryEl)) return;
          console.warn(`[SafeFilePicker] 方案B第 ${retryIndex} 次重试`);
          retryEl.click();
          scheduleRetry();
        }, delay);
        retryTimers.current.push(timer);
      }
      scheduleRetry();
    }, 1500);

    retryTimers.current.push(firstTimer);
  }, []);

  /** 容器点击 → 同时触发方案 A（原生已处理）+ 方案 B */
  const handleWrapperClick = useCallback(() => {
    startRetryChain();
  }, [startRetryChain]);

  /** input onChange 触发后清除重试 */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      retryTimers.current.forEach(clearTimeout);
      retryTimers.current = [];
      onChange(e);
    },
    [onChange]
  );

  return (
    <div
      className={`relative ${className}`}
      onClick={handleWrapperClick}
      style={{ cursor: 'pointer' }}
    >
      {/* 子元素（按钮等），pointer-events-none 让点击穿透到 input */}
      <div className="pointer-events-none">{children}</div>

      {/* 方案 A：透明真实 input 覆盖整个按钮区域 */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ zIndex: 10 }}
        tabIndex={-1}
      />
    </div>
  );
}
