import { SecondaryView } from "./SecondaryView";
import { useLanguage } from "../hooks/useLanguage";
import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Upload, Loader, X, ScanLine, RefreshCw, AlertTriangle, FolderOpen, Play } from "lucide-react";
import { YOLODetector, Detection } from "../utils/yoloDetector";

interface AIAssistantPageProps {
  onClose: () => void;
}

type Status = 'idle' | 'loading' | 'ready' | 'no-model' | 'error';

export function AIAssistantPage({ onClose }: AIAssistantPageProps) {
  const { t } = useLanguage();
  const a = t.ai;

  // ===== 演示数据 =====
  const DEMO_SAMPLES = [
    {
      name: a.tomatoLeaf,
      image: 'https://images.unsplash.com/photo-1665815920359-c97294ac4e18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0b21hdG8lMjBsZWFmJTIwZGlzZWFzZSUyMGJsaWdodCUyMHNwb3RzfGVufDF8fHx8MTc3MjE3MDAyM3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      detections: [
        { className: a.tomatoEarlyBlight, score: 0.92, bbox: [0.08, 0.15, 0.55, 0.65] as [number, number, number, number] },
        { className: a.leafSpot, score: 0.78, bbox: [0.50, 0.40, 0.88, 0.85] as [number, number, number, number] },
      ],
    },
    {
      name: a.cornField,
      image: 'https://images.unsplash.com/photo-1723167006254-5a9e9b2600cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3JuJTIwY3JvcCUyMHJ1c3QlMjBkaXNlYXNlJTIwZmllbGR8ZW58MXx8fHwxNzcyMTcwMDIzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      detections: [
        { className: a.cornRust, score: 0.88, bbox: [0.12, 0.20, 0.58, 0.72] as [number, number, number, number] },
        { className: a.graySpot, score: 0.71, bbox: [0.48, 0.10, 0.92, 0.55] as [number, number, number, number] },
      ],
    },
    {
      name: a.riceField,
      image: 'https://images.unsplash.com/photo-1561504935-4e7d4516a2d1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaWNlJTIwcGFkZHklMjBmaWVsZCUyMGNyb3AlMjBjbG9zZXVwfGVufDF8fHx8MTc3MjE3MDAyM3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      detections: [
        { className: a.riceBlast, score: 0.95, bbox: [0.15, 0.25, 0.65, 0.78] as [number, number, number, number] },
        { className: a.sheathBlight, score: 0.82, bbox: [0.55, 0.35, 0.90, 0.90] as [number, number, number, number] },
        { className: a.brownPlanthopper, score: 0.67, bbox: [0.05, 0.60, 0.30, 0.88] as [number, number, number, number] },
      ],
    },
  ];

  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [detecting, setDetecting] = useState(false);
  const [results, setResults] = useState<Detection[]>([]);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [demoDetections, setDemoDetections] = useState<Detection[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const detectorRef = useRef<YOLODetector | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingDrawRef = useRef<{ img: HTMLImageElement; dets: Detection[] } | null>(null);

  // 加载模型
  const loadModel = useCallback(async () => {
    setStatus('loading');
    setProgress(0);
    setErrorMsg('');

    try {
      const detector = new YOLODetector();
      detector.setProgressCallback((p) => setProgress(p));
      await detector.loadModel();
      detectorRef.current = detector;
      setStatus('ready');
      setIsDemo(false);
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.log('🔍 Model load error:', msg);
      if (msg.includes('MODEL_NOT_FOUND') || msg.includes('404') || msg.includes('no such file') || msg.includes('Could not fetch') || msg.includes('Failed to fetch')) {
        setStatus('no-model');
      } else {
        setStatus('no-model');
      }
    }
  }, []);

  useEffect(() => {
    loadModel();
  }, []);

  // 选图
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImage(ev.target?.result as string);
      setResults([]);
      setDone(false);
    };
    reader.readAsDataURL(f);
  };

  // 真实识别
  const handleDetect = async () => {
    if (!image || !detectorRef.current) return;
    setDetecting(true);
    setResults([]);
    setDone(false);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = image;
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });

      const dets = await detectorRef.current.detect(img);
      setResults(dets);
      setDone(true);
      pendingDrawRef.current = { img, dets };
    } catch (err) {
      console.error(err);
      setDone(true);
    } finally {
      setDetecting(false);
    }
  };

  // 演示识别
  const handleDemoDetect = async (sample: typeof DEMO_SAMPLES[0]) => {
    setImage(sample.image);
    setDetecting(true);
    setResults([]);
    setDone(false);
    setDemoDetections(sample.detections);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = sample.image;
    await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); });

    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));

    pendingDrawRef.current = { img, dets: sample.detections };
    setResults(sample.detections);
    setDone(true);
    setDetecting(false);
  };

  // 画检测框
  const drawBoxes = (img: HTMLImageElement, dets: Detection[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const colors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

    dets.forEach((det, i) => {
      const [x1, y1, x2, y2] = det.bbox;
      const bx = x1 * w, by = y1 * h, bw = (x2 - x1) * w, bh = (y2 - y1) * h;
      const color = colors[i % colors.length];

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.004);
      ctx.setLineDash([]);
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = color + '15';
      ctx.fillRect(bx, by, bw, bh);

      const label = `${det.className} ${(det.score * 100).toFixed(0)}%`;
      const fontSize = Math.max(14, Math.min(w, h) * 0.025);
      ctx.font = `bold ${fontSize}px sans-serif`;
      const textW = ctx.measureText(label).width;
      const pad = fontSize * 0.35;
      const labelH = fontSize + pad * 2;

      const labelY = by - labelH > 0 ? by - labelH : by;

      ctx.fillStyle = color;
      ctx.beginPath();
      const r = 4;
      ctx.roundRect(bx, labelY, textW + pad * 2, labelH, [r, r, r, r]);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.fillText(label, bx + pad, labelY + fontSize + pad * 0.3);
    });
  };

  const reset = () => {
    setImage(null);
    setResults([]);
    setDone(false);
    setDemoDetections([]);
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  const enterDemo = () => {
    setIsDemo(true);
    setStatus('ready');
  };

  useEffect(() => {
    if (done && results.length > 0 && pendingDrawRef.current) {
      const pending = pendingDrawRef.current;
      const raf = requestAnimationFrame(() => {
        if (canvasRef.current) {
          drawBoxes(pending.img, pending.dets);
          pendingDrawRef.current = null;
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [done, results]);

  // ===== 渲染 =====
  return (
    <SecondaryView onClose={onClose} title={a.title} showTitle={true}>
      <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--app-bg)' }}>

        {/* 顶部状态 */}
        <div className="px-4 pt-2 pb-1">
          {status === 'loading' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <Loader className="w-3.5 h-3.5 text-emerald-600 animate-spin flex-shrink-0" />
                <span className="text-xs text-emerald-700 font-medium truncate min-w-0">{a.loadingModel}</span>
                <span className="text-[10px] text-emerald-500 ml-auto flex-shrink-0">{progress}%</span>
              </div>
              <div className="w-full bg-emerald-200 rounded-full h-1">
                <div className="bg-emerald-600 h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {status === 'ready' && !isDemo && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 min-w-0">
              <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
              <span className="text-xs text-emerald-700 font-medium truncate min-w-0">{a.modelReady}</span>
              <span className="text-[10px] text-emerald-500 ml-auto flex-shrink-0 whitespace-nowrap">{detectorRef.current?.getLabels().length || 0} {a.classes}</span>
            </div>
          )}
          {status === 'ready' && isDemo && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 min-w-0">
              <Play className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span className="text-xs text-amber-700 font-medium truncate min-w-0">{a.demoMode}</span>
              <span className="text-[10px] text-amber-500 ml-auto flex-shrink-0 whitespace-nowrap">{a.simulatedResults}</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <span className="text-xs text-red-600 truncate flex-1 min-w-0">{errorMsg || a.loadFailed}</span>
              <button onClick={loadModel} className="text-[10px] text-red-700 font-medium px-2 py-0.5 rounded bg-red-100 active:bg-red-200 flex-shrink-0 whitespace-nowrap">{a.retry}</button>
            </div>
          )}
        </div>

        {/* 主区域 */}
        {status === 'no-model' ? (
          <div className="flex-1 flex items-center justify-center px-5">
            <div className="w-full max-w-sm">
              <div className="text-center mb-5">
                <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">{a.noModel}</h3>
                <p className="text-xs text-gray-500">{a.noModelDesc}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-3.5 mb-4 space-y-2 overflow-hidden">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full text-center leading-5 text-[11px] font-bold flex-shrink-0">1</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-700 break-words">{a.step1}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5 break-all">yolo export model=best.pt format=onnx imgsz=640</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full text-center leading-5 text-[11px] font-bold flex-shrink-0">2</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-700 break-words">{a.step2}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5 break-all">public/models/yolo11n.onnx</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full text-center leading-5 text-[11px] font-bold flex-shrink-0">3</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-700 break-words">{a.step3}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5 break-all">public/models/labels.json</p>
                    <p className="text-[10px] text-gray-400 font-mono break-all">["{a.labelExample}"]</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button onClick={enterDemo} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium active:scale-[0.97] transition-transform flex items-center justify-center gap-2 px-4">
                  <Play className="w-4 h-4 flex-shrink-0" /><span className="truncate">{a.enterDemo}</span>
                </button>
                <button onClick={loadModel} className="w-full py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-medium active:scale-[0.97] transition-transform text-sm px-4 truncate">
                  {a.redetectModel}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pb-24">
            {!image ? (
              <div className="mt-5 space-y-3">
                <div className="text-center py-5">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                    <ScanLine className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mb-1">{a.photoDetect}</h3>
                  <p className="text-xs text-gray-500">{a.photoDetectDesc}</p>
                </div>

                {!isDemo && (
                  <>
                    <button
                      onClick={() => cameraRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3.5 rounded-2xl active:scale-[0.97] transition-transform"
                    >
                      <Camera className="w-5 h-5" /><span className="font-medium">{a.takePhoto}</span>
                    </button>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 bg-white border-2 border-emerald-500 text-emerald-600 py-3.5 rounded-2xl active:scale-[0.97] transition-transform"
                    >
                      <Upload className="w-5 h-5" /><span className="font-medium">{a.selectAlbum}</span>
                    </button>
                    <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
                    <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                  </>
                )}

                {/* 演示样本 */}
                {isDemo && (
                  <div className="space-y-2.5">
                    <p className="text-xs text-gray-500 font-medium">{a.selectSample}</p>
                    {DEMO_SAMPLES.map((sample, i) => (
                      <button
                        key={i}
                        onClick={() => handleDemoDetect(sample)}
                        disabled={detecting}
                        className="w-full bg-white rounded-xl shadow overflow-hidden flex items-center active:scale-[0.98] transition-transform disabled:opacity-50"
                      >
                        <img src={sample.image} alt={sample.name} className="w-20 h-20 object-cover flex-shrink-0" />
                        <div className="flex-1 px-3 text-left min-w-0 overflow-hidden">
                          <p className="text-sm font-bold text-gray-800 truncate">{sample.name}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sample.detections.length} {a.targets}</p>
                          <div className="flex flex-wrap gap-1 mt-1 overflow-hidden max-h-[36px]">
                            {sample.detections.map((d, j) => (
                              <span key={j} className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded truncate max-w-[120px]">{d.className}</span>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* 检测结果区域 */
              <div className="mt-3 space-y-3">
                <div className="relative bg-white rounded-2xl overflow-hidden shadow">
                  {done && results.length > 0 ? (
                    <canvas ref={canvasRef} className="w-full h-auto block" />
                  ) : (
                    <>
                      <img src={image} alt="" className="w-full h-auto block" />
                      {detecting && (
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2">
                          <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                          <span className="text-white text-xs font-medium">{a.aiAnalyzing}</span>
                        </div>
                      )}
                    </>
                  )}
                  <button onClick={reset} className="absolute top-2 right-2 w-7 h-7 bg-black/50 backdrop-blur text-white rounded-full flex items-center justify-center active:scale-90 transition-transform">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 识别按钮 */}
                {!done && !detecting && !isDemo && (
                  <button
                    onClick={handleDetect}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3.5 rounded-2xl active:scale-[0.97] transition-transform"
                  >
                    <ScanLine className="w-4 h-4" /><span className="font-medium">{a.startDetect}</span>
                  </button>
                )}

                {/* 检测结果列表 */}
                {done && results.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <h3 className="text-sm font-bold text-gray-800 truncate min-w-0 flex-1">{a.detected} {results.length} {a.targets}</h3>
                      <button onClick={reset} className="flex items-center gap-1 text-xs text-emerald-600 font-medium flex-shrink-0 whitespace-nowrap">
                        <RefreshCw className="w-3 h-3 flex-shrink-0" />{a.redetect}
                      </button>
                    </div>
                    {results.map((det, i) => {
                      const colors = ['bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-red-100 text-red-700', 'bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-pink-100 text-pink-700'];
                      return (
                        <div key={i} className="bg-white rounded-xl shadow px-3 py-2.5 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${colors[i % colors.length]}`}>
                            {i + 1}
                          </div>
                          <span className="font-bold text-gray-800 text-sm flex-1 truncate">{det.className}</span>
                          <span className="text-sm font-bold text-emerald-600 flex-shrink-0">{(det.score * 100).toFixed(1)}%</span>
                        </div>
                      );
                    })}
                    {isDemo && (
                      <p className="text-[10px] text-center text-amber-500 pt-1">{a.demoNote}</p>
                    )}
                  </div>
                )}

                {/* 无结果 */}
                {done && results.length === 0 && (
                  <div className="space-y-3">
                    <div className="bg-white rounded-2xl p-5 shadow text-center">
                      <p className="text-sm text-gray-600">{a.noTarget}</p>
                      <p className="text-xs text-gray-400 mt-1">{a.tryClearer}</p>
                    </div>
                    <button onClick={reset} className="w-full flex items-center justify-center gap-2 bg-white border-2 border-emerald-500 text-emerald-600 py-3 rounded-2xl active:scale-[0.97] transition-transform">
                      <Camera className="w-4 h-4" /><span className="font-medium text-sm">{a.retakePhoto}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </SecondaryView>
  );
}