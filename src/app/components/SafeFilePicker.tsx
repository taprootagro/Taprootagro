import { useRef, useCallback, useEffect, useId } from 'react';

/**
 * SafeFilePicker — 三重保险文件选择器
 *
 * 国产浏览器（小米/华为/OPPO/vivo）在 PWA standalone 模式下
 * 会静默拦截：
 *   - JS 编程式 input.click()（用户手势可信上下文丢失）
 *   - opacity:0 的透明 input 点击（反 clickjacking 策略）
 *
 * 本组件采用三层保险策略：
 *
 * 【方案 A — <label> 原生关联（主力）】
 *   整个按钮区域包裹在 <label htmlFor={inputId}> 中，
 *   用户点击 label 时浏览器内部原生激活关联 input，
 *   不经过任何 JS，属于 HTML 规范行为，
 *   任何浏览器都不可能拦截（否则违反 HTML 标准）。
 *   input 用 sr-only 样式隐藏（clip:rect 技术，非 display:none 非 opacity:0）。
 *
 * 【方案 B — 透明 overlay（备用）】
 *   透明 <input type="file"> 叠在按钮上方，
 *   用户物理点击直接命中真实 input。
 *   用 opacity:0.01（非 0，绕过部分浏览器的 opacity:0 拦截）。
 *
 * 【方案 C — JS 编程式重试（兜底）】
 *   点击后 1500ms 延迟调用 .click()，之后检测选择器是否弹出，
 *   未弹出则继续重试最多 3 次。
 *
 * 三条路同时生效，谁先触发谁赢。
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

/**
 * sr-only 隐藏样式（clip:rect 技术）
 * - 不用 display:none（浏览器忽略关联 label 点击）
 * - 不用 visibility:hidden（同上）
 * - 不用 opacity:0（小米浏览器可能拦截）
 * - 不用 width:0/height:0（部分浏览器忽略）
 * 
 * 用 position:absolute + clip:rect(0,0,0,0) + 1px 尺寸
 * 元素在 DOM 中"存在"但视觉不可见，label 点击能正常激活
 */
const SR_ONLY_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export function SafeFilePicker({
  accept,
  capture,
  onChange,
  children,
  className = '',
}: SafeFilePickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLInputElement>(null);
  const retryTimers = useRef<number[]>([]);
  // 防止 label 和 overlay 重复触发
  const pickerTriggered = useRef(false);

  // 清理定时器
  useEffect(() => {
    return () => {
      retryTimers.current.forEach(clearTimeout);
    };
  }, []);

  /** 方案 C：JS 编程式重试链 */
  const startRetryChain = useCallback(() => {
    retryTimers.current.forEach(clearTimeout);
    retryTimers.current = [];

    const el = inputRef.current;
    if (!el) return;

    const firstTimer = window.setTimeout(() => {
      const currentEl = inputRef.current;
      if (!currentEl || pickerTriggered.current) return;

      if (pickerLikelyOpened(currentEl)) {
        pickerTriggered.current = true;
        return;
      }

      console.warn('[SafeFilePicker] 方案A/B未触发，方案C首次 click');
      currentEl.click();

      let retryIndex = 0;
      function scheduleRetry() {
        if (retryIndex >= RETRY_DELAYS.length) return;
        const delay = RETRY_DELAYS[retryIndex];
        retryIndex++;
        const timer = window.setTimeout(() => {
          const retryEl = inputRef.current;
          if (!retryEl || pickerTriggered.current) return;
          if (pickerLikelyOpened(retryEl)) {
            pickerTriggered.current = true;
            return;
          }
          console.warn(`[SafeFilePicker] 方案C第 ${retryIndex} 次重试`);
          retryEl.click();
          scheduleRetry();
        }, delay);
        retryTimers.current.push(timer);
      }
      scheduleRetry();
    }, 1500);

    retryTimers.current.push(firstTimer);
  }, []);

  /** label 被点击时启动方案 C 兜底 */
  const handleLabelClick = useCallback(() => {
    pickerTriggered.current = false;
    startRetryChain();
  }, [startRetryChain]);

  /** 任意 input onChange 触发后清除重试 + 标记已触发 */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      pickerTriggered.current = true;
      retryTimers.current.forEach(clearTimeout);
      retryTimers.current = [];
      onChange(e);
      // 清空 input 以允许同一文件再次选择
      e.target.value = '';
    },
    [onChange]
  );

  return (
    // 方案 A：<label> 原生关联 — 点击 label 浏览器自动激活 input
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <label
      htmlFor={inputId}
      className={`relative block cursor-pointer ${className}`}
      onClick={handleLabelClick}
    >
      {/* 子元素（按钮外观），pointer-events-none 防止内部 button 吞掉事件 */}
      <div className="pointer-events-none">{children}</div>

      {/* 方案 A 的 input：sr-only 隐藏，由 label htmlFor 原生激活 */}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        onChange={handleChange}
        style={SR_ONLY_STYLE}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* 方案 B：透明 overlay input，用户物理点击直接命中 */}
      {/* opacity:0.01 而非 0，绕过部分浏览器的 opacity:0 拦截 */}
      <input
        ref={overlayRef}
        type="file"
        accept={accept}
        capture={capture}
        onChange={handleChange}
        className="absolute inset-0 w-full h-full cursor-pointer"
        style={{ zIndex: 10, opacity: 0.01 }}
        tabIndex={-1}
        aria-hidden="true"
      />
    </label>
  );
}
