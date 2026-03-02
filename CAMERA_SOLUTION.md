# 国产手机PWA摄像头调用解决方案

## 问题背景

在国产手机（小米/OPPO/vivo/华为）的PWA桌面模式下，使用 `<input type="file" accept="image/*" capture="environment">` 调用摄像头时会遇到以下问题：

1. **capture属性不支持**：国产浏览器在PWA standalone模式下不支持或会拦截 `capture` 属性
2. **React合成事件被拦截**：直接使用 `input.click()` 会被浏览器安全策略静默拦截
3. **桌面模式权限限制**：PWA安装后以桌面模式运行时，媒体权限控制更严格

## 解决方案

我们提供了**三层降级策略**来确保在任何环境下都能获取图片：

### 方案对比

| 方案 | 兼容性 | 用户体验 | 适用场景 |
|------|--------|----------|----------|
| **方案1: HTML5 Camera** | 现代浏览器 | ⭐⭐⭐⭐⭐ 最佳 | 支持getUserMedia的设备 |
| **方案2: Input Simple** | ⭐⭐⭐⭐⭐ 最佳 | ⭐⭐⭐ 良好 | **国产手机推荐** |
| **方案3: Input Capture** | 部分浏览器 | ⭐⭐⭐⭐ 优秀 | iOS/Chrome Android |

---

## 方案1: HTML5 Camera（高级方案）

使用 `getUserMedia` API 直接调用摄像头，提供实时预览和拍照功能。

### 优点
- ✅ 实时预览摄像头画面
- ✅ 可以切换前后置摄像头
- ✅ 用户体验最佳
- ✅ 可以在拍照前调整角度

### 缺点
- ❌ 需要用户授权摄像头权限
- ❌ 某些PWA桌面模式权限受限
- ❌ 国产浏览器可能不支持

### 使用方法

```tsx
import { HTML5CameraCapture } from './components/HTML5CameraCapture';
import { supportsGetUserMedia } from './utils/cameraUtils';

function MyComponent() {
  const [showCamera, setShowCamera] = useState(false);

  const handleCapture = (imageData: string) => {
    console.log('拍照成功！', imageData);
    // 处理图片...
  };

  return (
    <>
      <button onClick={() => setShowCamera(true)}>
        打开摄像头
      </button>

      {showCamera && (
        <HTML5CameraCapture
          onCapture={handleCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  );
}
```

---

## 方案2: Input Simple（推荐方案）★★★★★

**移除 capture 属性，只用 `accept="image/*"`**，让系统自动决定调用相机还是相册。

### 优点
- ✅ **兼容性最好**（支持所有浏览器）
- ✅ 国产手机PWA桌面模式完美支持
- ✅ 不需要额外权限
- ✅ 系统会根据设备能力自动提供相机/相册选项

### 缺点
- ⚠️ 无法强制调起相机（由系统决定）
- ⚠️ 部分设备可能默认打开相册而非相机

### 使用方法

这是 `CameraCapture` 组件现在使用的方案：

```tsx
import { CameraCapture } from './components/CameraCapture';

function MyComponent() {
  const [showPicker, setShowPicker] = useState(false);

  const handleCapture = (imageData: string) => {
    console.log('图片选择成功！', imageData);
    // 处理图片...
  };

  return (
    <>
      <button onClick={() => setShowPicker(true)}>
        选择图片
      </button>

      {showPicker && (
        <CameraCapture
          onCapture={handleCapture}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}
```

**核心实现**：

```tsx
// ✅ 正确：移除 capture 属性
<input
  ref={cameraInputRef}
  type="file"
  accept="image/*"
  onChange={handleFile}
  className="hidden"
/>

// ❌ 错误：国产浏览器会拦截
<input
  ref={cameraInputRef}
  type="file"
  accept="image/*"
  capture="environment"  // 国产浏览器不支持！
  onChange={handleFile}
  className="hidden"
/>
```

---

## 方案3: Input Capture（传统方案）

使用 `capture="environment"` 属性尝试直接调起后置相机。

### 优点
- ✅ iOS Safari 支持良好
- ✅ Chrome Android 原生支持
- ✅ 可以指定前置/后置相机

### 缺点
- ❌ **国产浏览器不支持**
- ❌ PWA桌面模式可能被拦截

### 使用场景
仅在检测到支持的浏览器时使用：

```tsx
import { supportsCaptureAttribute } from './utils/cameraUtils';

// 根据设备能力动态选择方案
const useCaptureAttr = supportsCaptureAttribute();

<input
  ref={cameraInputRef}
  type="file"
  accept="image/*"
  {...(useCaptureAttr && { capture: 'environment' })}
  onChange={handleFile}
  className="hidden"
/>
```

---

## 原生事件触发（关键技术）

国产浏览器在React合成事件中会静默拦截文件选择器，必须使用**原生事件**触发。

### 问题代码

```tsx
// ❌ 错误：React合成事件，国产浏览器会拦截
<button onClick={() => inputRef.current?.click()}>
  拍照
</button>
```

### 解决方案

使用 `safeInputClick` 工具函数：

```tsx
import { safeInputClick } from './utils/cameraUtils';

// ✅ 正确：使用原生事件 + 延迟触发
<button onClick={() => safeInputClick(inputRef.current, 1500)}>
  拍照
</button>
```

**工具函数实现**：

```typescript
/**
 * 使用原生事件触发 input.click()，绕过React合成事件拦截
 * 
 * @param inputElement - file input 元素
 * @param delay - 延迟触发时间（ms），国产浏览器需要至少1500ms
 */
export function safeInputClick(
  inputElement: HTMLInputElement | null, 
  delay = 1500
): Promise<void> {
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
```

---

## 智能策略选择

使用 `getRecommendedCameraStrategy` 函数根据设备自动选择最佳方案：

```tsx
import { getRecommendedCameraStrategy } from './utils/cameraUtils';

const strategy = getRecommendedCameraStrategy();

switch (strategy) {
  case 'getUserMedia':
    // 使用 HTML5CameraCapture
    return <HTML5CameraCapture onCapture={handleCapture} onClose={onClose} />;
    
  case 'input-capture':
    // 使用带 capture 属性的 input
    return <input type="file" accept="image/*" capture="environment" />;
    
  case 'input-simple':
  default:
    // 使用不带 capture 属性的 input（国产手机推荐）
    return <CameraCapture onCapture={handleCapture} onClose={onClose} />;
}
```

**策略逻辑**：

```typescript
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
```

---

## 工具函数参考

所有工具函数位于 `/src/app/utils/cameraUtils.ts`：

### 设备检测

```typescript
// 检测是否支持 getUserMedia
supportsGetUserMedia(): boolean

// 检测是否支持 capture 属性
supportsCaptureAttribute(): boolean

// 检测是否为国产浏览器
isChineseBrowser(): boolean

// 获取PWA显示模式
getPWADisplayMode(): 'standalone' | 'browser'
```

### 事件触发

```typescript
// 安全触发input点击（原生事件）
safeInputClick(inputElement, delay): Promise<void>

// 带重试的安全触发
safeInputClickWithRetry(inputElement, onRetry): Promise<void>
```

### 摄像头操作

```typescript
// 获取摄像头流
getCameraStream(facingMode): Promise<MediaStream>

// 停止摄像头流
stopCameraStream(stream): void

// 从video捕获当前帧
captureVideoFrame(video, quality): string
```

---

## 最佳实践

### 1. 国产手机优先兼容

对于面向中国/非洲市场的应用，**优先使用 Input Simple 方案**：

```tsx
// ✅ 推荐：兼容性最好
<CameraCapture onCapture={handleCapture} onClose={onClose} />
```

### 2. 渐进增强策略

在支持的设备上提供更好的体验：

```tsx
const [strategy, setStrategy] = useState<'simple' | 'advanced'>('simple');

useEffect(() => {
  // 检测设备能力
  if (supportsGetUserMedia() && !isChineseBrowser()) {
    setStrategy('advanced');
  }
}, []);

return strategy === 'advanced' 
  ? <HTML5CameraCapture {...props} />
  : <CameraCapture {...props} />;
```

### 3. 用户友好的错误处理

```tsx
const handleCapture = (imageData: string) => {
  if (!imageData) {
    alert('图片获取失败，请重试');
    return;
  }
  // 处理图片...
};
```

### 4. 防止重复触发

```tsx
const [isClicking, setIsClicking] = useState(false);

const handleClick = () => {
  if (isClicking) return;
  setIsClicking(true);
  safeInputClick(inputRef.current);
  setTimeout(() => setIsClicking(false), 500);
};
```

---

## 已更新的文件

本次更新已修改以下文件，移除了 `capture` 属性：

1. ✅ `/src/app/components/CameraCapture.tsx`
2. ✅ `/src/app/components/QRScannerCapture.tsx`
3. ✅ `/src/app/components/AIAssistantPage.tsx`

新增文件：

1. ✨ `/src/app/utils/cameraUtils.ts` - 相机工具函数库
2. ✨ `/src/app/components/HTML5CameraCapture.tsx` - HTML5高级拍照组件

---

## 测试建议

### 测试设备清单

- ✅ 小米手机（MIUI浏览器）
- ✅ OPPO手机（OPPO浏览器）
- ✅ vivo手机（vivo浏览器）
- ✅ 华为手机（华为浏览器）
- ✅ iPhone（Safari）
- ✅ Android（Chrome）

### 测试场景

1. **浏览器模式**
   - 访问网页直接使用

2. **PWA桌面模式**
   - 安装到桌面后使用
   - 检查权限提示

3. **图片获取**
   - 点击"拍照"按钮
   - 选择相机或相册
   - 确认图片正常上传

---

## 常见问题

### Q1: 为什么要移除 capture 属性？

**A**: 国产浏览器（小米/OPPO/vivo）在PWA桌面模式下不支持 `capture` 属性，会导致文件选择器完全无法打开。移除后由系统决定调用相机还是相册，兼容性最好。

### Q2: 用户点击后没有反应怎么办？

**A**: 使用 `safeInputClick` 工具函数，它会：
1. 使用原生MouseEvent代替React合成事件
2. 延迟1500ms触发（国产浏览器需要）
3. 双重保险：先触发event，再调用click()

### Q3: 如何强制调用相机而不是相册？

**A**: 在国产手机上无法强制，只能通过按钮文案引导用户：

```tsx
<button>拍照</button>  // 用户会理解应该选择相机
<button>从相册选择</button>  // 用户会理解应该选择相册
```

### Q4: HTML5CameraCapture 什么时候用？

**A**: 仅在以下条件全部满足时使用：
- 非国产浏览器
- 支持 getUserMedia
- 用户已授权摄像头权限
- 需要实时预览功能

---

## 总结

对于TaprootAgro这样面向非洲低端设备的PWA应用，**强烈推荐使用 Input Simple 方案（已默认启用）**：

- ✅ 移除 `capture` 属性
- ✅ 使用 `safeInputClick` 触发
- ✅ 提供"拍照"和"从相册选择"两个选项
- ✅ 让系统决定调用相机还是相册

这样可以确保在小米、OPPO、vivo等国产手机的PWA桌面模式下都能正常工作！
