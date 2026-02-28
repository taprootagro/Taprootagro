/**
 * YOLO 11n ONNX 推理引擎
 *
 * 使用方法：
 * 1. 训练 YOLO 11n 模型（病虫害数据集）
 * 2. 导出：yolo export model=best.pt format=onnx imgsz=640 opset=17
 * 3. 将 best.onnx 重命名为 yolo11n.onnx 放到 /public/models/yolo11n.onnx
 * 4. 将类别名称写入 /public/models/labels.json，格式：["稻瘟病","白粉病","蚜虫",...]
 *
 * 支持两种 YOLO 输出格式：
 * - 检测模式：输出 [1, 4+nc, 8400]，自动做 NMS
 * - 分类模式：输出 [1, nc]，直接取 topK
 *
 * ONNX Runtime 从 CDN 按需加载，不打包进构建产物（~24MB WASM）
 */

// ===== CDN 动态加载 ONNX Runtime =====
const ORT_CDN_VERSION = '1.21.0';
const ORT_CDN_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_CDN_VERSION}/dist`;
const ORT_CDN_JS = `${ORT_CDN_BASE}/ort.min.js`;

// 全局类型声明
declare global {
  interface Window { ort?: any; }
}

type OrtModule = {
  env: { wasm: { numThreads: number; wasmPaths: string } };
  InferenceSession: {
    create(path: string, opts: any): Promise<any>;
  };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => any;
};

let ortLoadPromise: Promise<OrtModule> | null = null;

/**
 * 从 CDN 动态加载 onnxruntime-web，仅在首次调用时下载
 * WASM 文件也从同一 CDN 路径自动加载
 */
async function loadOrt(): Promise<OrtModule> {
  if (window.ort) return window.ort as OrtModule;

  if (!ortLoadPromise) {
    ortLoadPromise = new Promise<OrtModule>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = ORT_CDN_JS;
      script.async = true;
      script.onload = () => {
        if (window.ort) {
          // 让 WASM 文件也从 CDN 加载，而不是从本站加载
          window.ort.env.wasm.wasmPaths = `${ORT_CDN_BASE}/`;
          resolve(window.ort as OrtModule);
        } else {
          reject(new Error('ONNX Runtime loaded but window.ort is undefined'));
        }
      };
      script.onerror = () => {
        ortLoadPromise = null;
        reject(new Error('Failed to load ONNX Runtime from CDN'));
      };
      document.head.appendChild(script);
    });
  }

  return ortLoadPromise;
}

// ===== 配置 =====
const MODEL_PATH = '/models/yolo11n.onnx';
const LABELS_PATH = '/models/labels.json';
const INPUT_SIZE = 640;           // YOLO 11n 默认输入尺寸
const CONF_THRESHOLD = 0.25;      // 置信度阈值
const IOU_THRESHOLD = 0.45;       // NMS IoU 阈值
const MAX_DETECTIONS = 20;        // 最大检测数

// ===== 接口 =====
export interface Detection {
  className: string;
  score: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2] 归一化坐标 0-1
}

// ===== 检测器 =====
export class YOLODetector {
  private session: any = null;
  private ort: OrtModule | null = null;
  private labels: string[] = [];
  private _isLoaded = false;
  private _mode: 'detect' | 'classify' = 'detect';
  private onProgress?: (progress: number, status: string) => void;

  setProgressCallback(cb: (progress: number, status: string) => void) {
    this.onProgress = cb;
  }

  async loadModel(): Promise<void> {
    try {
      // 0. 先检查模型文件是否存在
      this.onProgress?.(5, 'Checking model file...');
      const checkResp = await fetch(MODEL_PATH, { method: 'HEAD' });
      // Vite dev server 的 SPA fallback 会对不存在的文件返回 200 + text/html
      const contentType = checkResp.headers.get('content-type') || '';
      if (!checkResp.ok || contentType.includes('text/html')) {
        throw new Error('MODEL_NOT_FOUND');
      }

      // 1. 加载类别标签
      this.onProgress?.(10, 'Loading labels...');
      try {
        const resp = await fetch(LABELS_PATH);
        if (resp.ok) {
          this.labels = await resp.json();
        }
      } catch {
        console.warn('[YOLO] labels.json not found, will use numeric class IDs');
      }

      // 2. 加载 ONNX 模型
      this.onProgress?.(20, 'Loading ONNX Runtime from CDN...');

      // 从 CDN 动态加载 ONNX Runtime（首次约下载 ~1.5MB JS + 按需 ~8MB WASM）
      this.ort = await loadOrt();
      this.ort.env.wasm.numThreads = 1;

      this.onProgress?.(40, 'Loading model...');
      this.session = await this.ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      // 3. 判断输出格式
      const outputNames = this.session.outputNames;
      console.log('[YOLO] Output nodes:', outputNames);

      this._isLoaded = true;
      this.onProgress?.(100, 'Ready');
      console.log(`[YOLO] Model loaded | ${this.labels.length} classes`);
    } catch (error: any) {
      this._isLoaded = false;
      // MODEL_NOT_FOUND is an expected state, not a crash
      const msg = error?.message || String(error);
      if (msg.includes('MODEL_NOT_FOUND')) {
        console.log('[YOLO] No model file found at', MODEL_PATH);
      } else {
        console.warn('[YOLO] Model load failed:', error);
      }
      throw error;
    }
  }

  async detect(image: HTMLImageElement | HTMLCanvasElement): Promise<Detection[]> {
    if (!this._isLoaded || !this.session) throw new Error('Model not loaded');

    // 预处理：resize + normalize → [1, 3, 640, 640]
    const input = this.preprocess(image);

    // 推理
    const inputName = this.session.inputNames[0];
    const tensor = new this.ort!.Tensor('float32', input.data, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const results = await this.session.run({ [inputName]: tensor });

    // 后处理
    const outputName = this.session.outputNames[0];
    const output = results[outputName];
    const shape = output.dims;
    const data = output.data as Float32Array;

    console.log('[YOLO] Output shape:', shape);

    // 判断模式并处理
    if (shape.length === 3 && shape[2]! > shape[1]!) {
      // 检测模式: [1, 4+nc, N] (e.g. [1, 84, 8400])
      this._mode = 'detect';
      return this.postprocessDetection(data, shape as number[], input.scale, input.padX, input.padY);
    } else if (shape.length === 2 || (shape.length === 3 && shape[2]! <= shape[1]!)) {
      // 分类模式: [1, nc] 或 [1, nc, 1]
      this._mode = 'classify';
      return this.postprocessClassification(data);
    } else {
      console.warn('[YOLO] Unknown output format, trying detection mode');
      return this.postprocessDetection(data, shape as number[], input.scale, input.padX, input.padY);
    }
  }

  /** 图像预处理：letterbox resize + CHW + normalize */
  private preprocess(image: HTMLImageElement | HTMLCanvasElement) {
    const srcW = image instanceof HTMLImageElement ? (image.naturalWidth || image.width) : image.width;
    const srcH = image instanceof HTMLImageElement ? (image.naturalHeight || image.height) : image.height;

    // Letterbox：等比缩放 + 灰色填充
    const scale = Math.min(INPUT_SIZE / srcW, INPUT_SIZE / srcH);
    const newW = Math.round(srcW * scale);
    const newH = Math.round(srcH * scale);
    const padX = (INPUT_SIZE - newW) / 2;
    const padY = (INPUT_SIZE - newH) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const ctx = canvas.getContext('2d')!;

    // 灰色底（114/255）
    ctx.fillStyle = '#727272';
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    ctx.drawImage(image, padX, padY, newW, newH);

    const imgData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const pixels = imgData.data;

    // RGBA → CHW float32 [R...][G...][B...], 归一化到 0-1
    const floatData = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const area = INPUT_SIZE * INPUT_SIZE;
    for (let i = 0; i < area; i++) {
      floatData[i]            = pixels[i * 4]     / 255;  // R
      floatData[i + area]     = pixels[i * 4 + 1] / 255;  // G
      floatData[i + area * 2] = pixels[i * 4 + 2] / 255;  // B
    }

    return { data: floatData, scale, padX, padY };
  }

  /** 检测后处理：解码 + NMS */
  private postprocessDetection(
    data: Float32Array,
    shape: number[],
    scale: number,
    padX: number,
    padY: number
  ): Detection[] {
    const [_, rows, cols] = shape; // [1, 4+nc, 8400]
    const nc = rows - 4;           // 类别数

    if (nc <= 0) return [];

    // 填充标签
    this.ensureLabels(nc);

    // 解析所有候选框
    const candidates: Detection[] = [];

    for (let i = 0; i < cols; i++) {
      // 提取 bbox（中心坐标格式）
      const cx = data[0 * cols + i];
      const cy = data[1 * cols + i];
      const w  = data[2 * cols + i];
      const h  = data[3 * cols + i];

      // 找最大类别分数
      let maxScore = 0;
      let maxIdx = 0;
      for (let c = 0; c < nc; c++) {
        const score = data[(4 + c) * cols + i];
        if (score > maxScore) {
          maxScore = score;
          maxIdx = c;
        }
      }

      if (maxScore < CONF_THRESHOLD) continue;

      // 转为 xyxy + 还原到原图坐标（归一化 0-1）
      const x1 = (cx - w / 2 - padX) / (INPUT_SIZE - 2 * padX);
      const y1 = (cy - h / 2 - padY) / (INPUT_SIZE - 2 * padY);
      const x2 = (cx + w / 2 - padX) / (INPUT_SIZE - 2 * padX);
      const y2 = (cy + h / 2 - padY) / (INPUT_SIZE - 2 * padY);

      candidates.push({
        className: this.labels[maxIdx] || `Class ${maxIdx}`,
        score: maxScore,
        bbox: [
          Math.max(0, Math.min(1, x1)),
          Math.max(0, Math.min(1, y1)),
          Math.max(0, Math.min(1, x2)),
          Math.max(0, Math.min(1, y2)),
        ],
      });
    }

    // 按分数排序
    candidates.sort((a, b) => b.score - a.score);

    // NMS
    return this.nms(candidates).slice(0, MAX_DETECTIONS);
  }

  /** 分类后处理 */
  private postprocessClassification(data: Float32Array): Detection[] {
    const nc = data.length;
    this.ensureLabels(nc);

    const indexed = Array.from(data).map((score, i) => ({ score, i }));
    indexed.sort((a, b) => b.score - a.score);

    return indexed
      .slice(0, 5)
      .filter(x => x.score > 0.01)
      .map(x => ({
        className: this.labels[x.i] || `Class ${x.i}`,
        score: x.score,
        bbox: [0, 0, 1, 1] as [number, number, number, number],
      }));
  }

  /** NMS */
  private nms(boxes: Detection[]): Detection[] {
    const kept: Detection[] = [];
    const used = new Set<number>();

    for (let i = 0; i < boxes.length; i++) {
      if (used.has(i)) continue;
      kept.push(boxes[i]);

      for (let j = i + 1; j < boxes.length; j++) {
        if (used.has(j)) continue;
        if (this.iou(boxes[i].bbox, boxes[j].bbox) > IOU_THRESHOLD) {
          used.add(j);
        }
      }
    }
    return kept;
  }

  /** IoU 计算 */
  private iou(a: number[], b: number[]): number {
    const x1 = Math.max(a[0], b[0]);
    const y1 = Math.max(a[1], b[1]);
    const x2 = Math.min(a[2], b[2]);
    const y2 = Math.min(a[3], b[3]);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const areaA = (a[2] - a[0]) * (a[3] - a[1]);
    const areaB = (b[2] - b[0]) * (b[3] - b[1]);
    return inter / (areaA + areaB - inter + 1e-6);
  }

  /** 确保标签数组够用 */
  private ensureLabels(nc: number) {
    while (this.labels.length < nc) {
      this.labels.push(`Class ${this.labels.length}`);
    }
  }

  isLoaded() { return this._isLoaded; }
  getMode() { return this._mode; }
  getLabels() { return [...this.labels]; }
}