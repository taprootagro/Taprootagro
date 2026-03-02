/**
 * safeInputClick — 安全触发 <input type="file"> 的 .click()
 *
 * 问题背景：
 * 国产浏览器（小米 MIUI / 华为 / OPPO / vivo / 三星 Internet 等）
 * 在 React 合成事件的 onClick 中直接调用 input.click() 时，
 * 浏览器可能因"用户手势可信上下文"丢失而静默拦截文件选择器。
 *
 * 解决方案：
 * setTimeout 将 .click() 推到下一个宏任务，绕过部分浏览器的安全策略。
 * 延迟 10ms 在实测中兼容性最好（0ms 在某些设备上仍被拦截）。
 *
 * 用法：
 *   import { safeInputClick } from '../utils/safeInputClick';
 *   onClick={() => safeInputClick(inputRef)}
 */
export function safeInputClick(
  ref: React.RefObject<HTMLInputElement | null>
): void {
  // 先尝试同步 click（标准浏览器走快路径）
  // 如果失败（国产浏览器），setTimeout 兜底
  const el = ref.current;
  if (!el) return;

  // 用 setTimeout 延迟，兼容国产浏览器
  setTimeout(() => {
    el.click();
  }, 10);
}
