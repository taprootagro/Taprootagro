/**
 * safeInputClick — 安全触发 <input type="file"> 的 .click()
 *
 * 问题背景：
 * 国产浏览器（小米 MIUI / 华为 / OPPO / vivo / 三星 Internet 等）
 * 在 React 合成事件的 onClick 中直接调用 input.click() 时，
 * 浏览器可能因"用户手势可信上下文"丢失而静默拦截文件选择器。
 *
 * 策略（渐进式重试）：
 * 1. 首次延迟 1500ms 调用 .click()
 * 2. 300ms 后检测页面是否仍可见且持有焦点（即文件选择器未弹出）
 * 3. 若未弹出，以递增间隔重试（2000 → 2500 → 3000ms），最多再试 3 次
 * 4. 一旦检测到页面失焦/不可见（选择器已弹出）或 input 已有文件，立即停止
 *
 * 检测原理：
 * 原生文件选择器弹出后，页面会触发以下任一信号：
 *   - document.visibilityState 变为 "hidden"（iOS / 部分 Android）
 *   - document.hasFocus() 返回 false（大多数 Android）
 *   - input.files.length > 0（用户已选完文件返回）
 *
 * 用法：
 *   import { safeInputClick } from '../utils/safeInputClick';
 *   onClick={() => safeInputClick(inputRef)}
 */

/** 检测文件选择器是否已弹出 */
function pickerLikelyOpened(el: HTMLInputElement): boolean {
  // 用户已选了文件
  if (el.files && el.files.length > 0) return true;
  // 页面不可见（选择器覆盖了页面）
  if (document.visibilityState === 'hidden') return true;
  // 页面失焦（选择器获得了焦点）
  if (!document.hasFocus()) return true;
  return false;
}

/** 重试间隔序列（ms），首次 click 后依次等待这些时间再检测+重试 */
const RETRY_DELAYS = [500, 1000, 1500];

export function safeInputClick(
  ref: React.RefObject<HTMLInputElement | null>
): void {
  const el = ref.current;
  if (!el) return;

  // ── 首次尝试：1500ms 后 click ──
  setTimeout(() => {
    if (!ref.current) return;
    ref.current.click();

    // ── 异步重试链 ──
    let retryIndex = 0;

    function scheduleRetry() {
      if (retryIndex >= RETRY_DELAYS.length) return; // 用完重试次数
      const delay = RETRY_DELAYS[retryIndex];
      retryIndex++;

      setTimeout(() => {
        const currentEl = ref.current;
        if (!currentEl) return; // 组件已卸载

        // 如果选择器已经弹出或有文件了，不再重试
        if (pickerLikelyOpened(currentEl)) return;

        // 选择器未弹出，再 click 一次
        console.warn(
          `[safeInputClick] 文件选择器未弹出，第 ${retryIndex} 次重试`
        );
        currentEl.click();

        // 继续下一轮检测
        scheduleRetry();
      }, delay);
    }

    scheduleRetry();
  }, 1500);
}

/**
 * safeDynamicInputClick — 用于动态创建的 input 元素（非 ref）
 * 例如 RichTextEditor 中 document.createElement("input") 的场景
 */
export function safeDynamicInputClick(input: HTMLInputElement): void {
  setTimeout(() => {
    input.click();

    let retryIndex = 0;

    function scheduleRetry() {
      if (retryIndex >= RETRY_DELAYS.length) return;
      const delay = RETRY_DELAYS[retryIndex];
      retryIndex++;

      setTimeout(() => {
        if (pickerLikelyOpened(input)) return;
        console.warn(
          `[safeInputClick] 动态input选择器未弹出，第 ${retryIndex} 次重试`
        );
        input.click();
        scheduleRetry();
      }, delay);
    }

    scheduleRetry();
  }, 1500);
}
