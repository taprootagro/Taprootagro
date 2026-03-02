/**
 * safeDynamicInputClick — 用于动态创建的 input 元素（非 ref）
 *
 * 仅供 RichTextEditor 等动态创建 input 的场景使用。
 * 对于可以用组件包裹的场景，请改用 SafeFilePicker 组件（三重保险）。
 *
 * 策略：1500ms 首次延迟 + 异步重试链（最多 3 次）
 * 通过 document.hasFocus() / visibilityState 检测选择器是否已弹出。
 */

/** 检测文件选择器是否已弹出 */
function pickerLikelyOpened(el: HTMLInputElement): boolean {
  if (el.files && el.files.length > 0) return true;
  if (document.visibilityState === 'hidden') return true;
  if (!document.hasFocus()) return true;
  return false;
}

const RETRY_DELAYS = [500, 1000, 1500];

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
          `[safeDynamicInputClick] 选择器未弹出，第 ${retryIndex} 次重试`
        );
        input.click();
        scheduleRetry();
      }, delay);
    }

    scheduleRetry();
  }, 1500);
}
