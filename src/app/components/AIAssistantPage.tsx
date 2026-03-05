import { compressImageFile, compressImageBase64, COMPRESS_PRESETS } from '../utils/imageCompressor';
import { CameraOverlay } from './CameraOverlay';
import { SecondaryView } from "./SecondaryView";
import { useLanguage } from "../hooks/useLanguage";
import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Upload, Loader, X, ScanLine, RefreshCw, AlertTriangle, FolderOpen, Play, Sparkles, Copy, Check, ChevronDown, ChevronUp, Cloud, Shield, Clock, Send } from "lucide-react";
import { TaprootAgroDetector, Detection } from "../utils/taprootAgroDetector";
import { useHomeConfig } from "../hooks/useHomeConfig";
import { cloudAIService, type DeepAnalysisResult } from "../services/CloudAIService";
import { cloudAIGuard } from "../utils/cloudAIGuard";

interface AIAssistantPageProps {
  onClose: () => void;
}

type Status = 'idle' | 'loading' | 'ready' | 'no-model' | 'error' | 'cloud-only';

export function AIAssistantPage({ onClose }: AIAssistantPageProps) {
  const { t } = useLanguage();
  const { config } = useHomeConfig();
  const a = t.ai;

  // Cloud-only mode: when cloud AI is enabled AND device is online, skip local model
  // Default / offline → local inference; cloud AI enabled + online → cloud-only
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const cloudOnlyMode = config.cloudAIConfig?.enabled === true && isOnline;

  // CameraOverlay state
  const [showCameraOverlay, setShowCameraOverlay] = useState(false);

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

  // Deep Analysis state
  const [deepAnalysisResult, setDeepAnalysisResult] = useState<DeepAnalysisResult | null>(null);
  const [deepAnalyzing, setDeepAnalyzing] = useState(false);
  const [deepError, setDeepError] = useState('');
  const [deepExpanded, setDeepExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  // Anti-abuse guard state
  const [cooldownSec, setCooldownSec] = useState(0);
  const [dailyUsage, setDailyUsage] = useState({ used: 0, limit: 20 });
  const [cachedHit, setCachedHit] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Follow-up chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatReplying, setChatReplying] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Refresh guard state
  const refreshGuardState = useCallback(() => {
    setDailyUsage(cloudAIGuard.getDailyUsage());
    const cd = cloudAIGuard.getCooldownRemaining();
    setCooldownSec(cd);
    if (cd > 0 && !cooldownRef.current) {
      cooldownRef.current = setInterval(() => {
        const remaining = cloudAIGuard.getCooldownRemaining();
        setCooldownSec(remaining);
        setDailyUsage(cloudAIGuard.getDailyUsage());
        if (remaining <= 0 && cooldownRef.current) {
          clearInterval(cooldownRef.current);
          cooldownRef.current = null;
        }
      }, 1000);
    }
  }, []);

  // Init guard state + cleanup
  useEffect(() => {
    refreshGuardState();
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // Listen for online/offline changes
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Helper: format guard translation strings
  const guardText = useCallback((template: string, vars: Record<string, string | number>) => {
    let result = template;
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(`{${k}}`, String(v));
    }
    return result;
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const detectorRef = useRef<TaprootAgroDetector | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingDrawRef = useRef<{ img: HTMLImageElement; dets: Detection[] } | null>(null);

  // 加载模型
  const loadModel = useCallback(async () => {
    setStatus('loading');
    setProgress(0);
    setErrorMsg('');

    try {
      const aiCfg = config.aiModelConfig;
      const detector = new TaprootAgroDetector({
        modelUrl: aiCfg?.modelUrl || '',
        labelsUrl: aiCfg?.labelsUrl || '',
      });
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
  }, [config.aiModelConfig]);

  useEffect(() => {
    if (cloudOnlyMode) {
      setStatus('cloud-only');
    } else {
      loadModel();
    }
  }, []);

  // CameraOverlay 拍照回调 — 接收 base64，压缩后设置为图片
  const onCameraCapture = async (base64: string) => {
    setShowCameraOverlay(false);
    try {
      const compressed = await compressImageBase64(base64, COMPRESS_PRESETS.ai);
      setImage(compressed);
      setResults([]);
      setDone(false);
    } catch {
      setImage(base64);
      setResults([]);
      setDone(false);
    }
  };

  // 选图 — 压缩后再 setState，AI 预设保留足够清晰度识别病虫害
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const compressed = await compressImageFile(f, COMPRESS_PRESETS.ai);
      setImage(compressed);
      setResults([]);
      setDone(false);
    } catch {
      // 压缩失败降级读原图
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImage(ev.target?.result as string);
        setResults([]);
        setDone(false);
      };
      reader.readAsDataURL(f);
    }
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
    setDeepAnalysisResult(null);
    setDeepAnalyzing(false);
    setDeepError('');
    setCopied(false);
    setChatMessages([]);
    setChatInput('');
    setChatReplying(false);
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

  // Deep Analysis handler (unified for both local+cloud and cloud-only modes)
  const handleDeepAnalysis = async (forceCloudOnly = false) => {
    if (!image) return;
    // In cloud-only mode or forced cloud-only, we don't require local detection results
    const isCloudOnly = cloudOnlyMode || forceCloudOnly;
    if (!isCloudOnly && results.length === 0) return;
    setDeepAnalyzing(true);
    setDeepError('');
    setDeepAnalysisResult(null);
    setDeepExpanded(true);
    setCachedHit(false);

    try {
      const detections = isCloudOnly ? [] : results.map((d) => ({ className: d.className, score: d.score }));
      const result = await cloudAIService.analyze(image, detections);
      setDeepAnalysisResult(result);
      if (isCloudOnly) setDone(true);
      refreshGuardState();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg === 'DAILY_LIMIT_REACHED') {
        setDeepError(a.dailyLimitReached);
      } else if (msg.startsWith('COOLDOWN:')) {
        setDeepError(guardText(a.cooldownWait, { seconds: msg.split(':')[1] }));
      } else {
        setDeepError(msg || a.deepAnalysisError);
      }
      refreshGuardState();
    } finally {
      setDeepAnalyzing(false);
    }
  };

  // Cloud-only shorthand
  const handleCloudAnalysis = () => handleDeepAnalysis(true);

  // Copy report to clipboard
  const handleCopyReport = async () => {
    if (!deepAnalysisResult) return;
    try {
      await navigator.clipboard.writeText(deepAnalysisResult.analysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = deepAnalysisResult.analysis;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Follow-up chat handler
  const handleChatSend = async () => {
    const msg = chatInput.trim();
    if (!msg || !deepAnalysisResult || chatReplying) return;

    const userMsg = { role: 'user' as const, text: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatReplying(true);

    try {
      // Build full conversation context for AI
      const fullContext = deepAnalysisResult.analysis +
        chatMessages.map(m => `\n\n[${m.role === 'user' ? 'User' : 'AI'}]: ${m.text}`).join('') +
        `\n\n[User]: ${msg}`;
      const reply = await cloudAIService.followUp(msg, fullContext);
      setChatMessages(prev => [...prev, { role: 'ai', text: reply }]);
      refreshGuardState();
    } catch (err: any) {
      const errMsg = err?.message || a.deepAnalysisError;
      setChatMessages(prev => [...prev, { role: 'ai', text: `⚠️ ${errMsg}` }]);
      refreshGuardState();
    } finally {
      setChatReplying(false);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatReplying]);

  // Simple markdown renderer for analysis text
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Headers
      if (line.startsWith('## ')) return <h2 key={i} className="text-base text-gray-900 mt-4 mb-2">{line.slice(3)}</h2>;
      if (line.startsWith('### ')) return <h3 key={i} className="text-sm text-gray-800 mt-3 mb-1">{line.slice(4)}</h3>;
      if (line.startsWith('#### ')) return <h4 key={i} className="text-xs text-gray-700 mt-2 mb-1">{line.slice(5)}</h4>;
      // Horizontal rule
      if (line.startsWith('---')) return <hr key={i} className="my-3 border-gray-200" />;
      // List items
      if (line.startsWith('- **')) {
        const match = line.match(/^- \*\*(.+?)\*\*[：:](.*)$/);
        if (match) return <p key={i} className="text-xs text-gray-600 ml-3 my-0.5"><span className="text-gray-800">{match[1]}</span>：{match[2]}</p>;
      }
      if (line.startsWith('- ')) return <p key={i} className="text-xs text-gray-600 ml-3 my-0.5">{line.slice(2)}</p>;
      // Numbered items
      if (/^\d+\.\s\*\*/.test(line)) {
        const match = line.match(/^(\d+)\.\s\*\*(.+?)\*\*[：:](.*)$/);
        if (match) return <p key={i} className="text-xs text-gray-600 ml-3 my-0.5"><span className="text-emerald-700">{match[1]}.</span> <span className="text-gray-800">{match[2]}</span>：{match[3]}</p>;
      }
      // Bold text
      if (line.includes('**')) {
        const parts = line.split(/\*\*(.+?)\*\*/g);
        return <p key={i} className="text-xs text-gray-600 my-0.5">{parts.map((part, j) => j % 2 === 1 ? <span key={j} className="text-gray-800">{part}</span> : part)}</p>;
      }
      // Italic/small text
      if (line.startsWith('*') && line.endsWith('*')) return <p key={i} className="text-[10px] text-gray-400 my-0.5 italic">{line.slice(1, -1)}</p>;
      // Empty line
      if (line.trim() === '') return <div key={i} className="h-1" />;
      // Normal text
      return <p key={i} className="text-xs text-gray-600 my-0.5">{line}</p>;
    });
  };

  // ===== 渲 =====
  return (
    <SecondaryView onClose={onClose} title={a.title} showTitle={true}>
      <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--app-bg)' }}>

        {/* 顶部状态 */}
        <div className="px-4 pt-2 pb-1 flex-shrink-0">
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
          {status === 'cloud-only' && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 min-w-0">
              <Cloud className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span className="text-xs text-amber-700 font-medium truncate min-w-0">{a.cloudOnlyMode}</span>
            </div>
          )}

          {/* Anti-abuse guard status bar — only during cloud AI usage */}
          {dailyUsage.used > 0 && (deepAnalyzing || deepAnalysisResult || deepError || chatReplying) && (
            <div className="flex items-center gap-2 mt-1 min-w-0">
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 min-w-0 flex-1">
                <Shield className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-500 truncate">
                  {guardText(a.dailyUsageInfo, { used: dailyUsage.used, limit: dailyUsage.limit })}
                </span>
                {dailyUsage.used >= dailyUsage.limit && (
                  <span className="text-[9px] text-red-500 ml-auto flex-shrink-0">!</span>
                )}
              </div>
              {cooldownSec > 0 && (
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex-shrink-0">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] text-amber-600">
                    {guardText(a.cooldownWait, { seconds: cooldownSec })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 免责声明 — 页面顶部唯一显示 */}
          <div className="flex items-center gap-1.5 mt-1 px-1">
            <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
            <p className="text-[10px] text-amber-600 leading-relaxed">{a.disclaimer}</p>
          </div>
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
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5 break-all">python export_model.py --format onnx --imgsz 640</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full text-center leading-5 text-[11px] font-bold flex-shrink-0">2</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-700 break-words">{a.step2}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5 break-all">public/models/taprootagro.onnx</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full text-center leading-5 text-[11px] font-bold flex-shrink-0">3</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-700 break-words">{a.step3}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5 break-all">public/models/labels.json</p>
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
          <>
          <div className="flex-1 px-4 pb-4">
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
                      onClick={() => setShowCameraOverlay(true)}
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
                {/* 图片预览 — 仅在未开始分析时显示 */}
                {!detecting && !deepAnalyzing && !done && !deepAnalysisResult && !deepError && (
                <div className="flex justify-center">
                  <div className="relative w-44 h-44 rounded-2xl overflow-hidden shadow bg-gray-100 flex-shrink-0">
                    {done && results.length > 0 ? (
                      <canvas ref={canvasRef} className="w-full h-full object-cover block" />
                    ) : (
                      <>
                        <img src={image} alt="" className="w-full h-full object-cover block" />
                        {detecting && (
                          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2">
                            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          </div>
                        )}
                      </>
                    )}
                    <button onClick={reset} className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 backdrop-blur text-white rounded-full flex items-center justify-center active:scale-90 transition-transform">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                )}

                {/* 识别按钮已移至底部固定栏 */}

                {/* Cloud-only 分析按钮已移至底部固定栏 */}

                {/* Cloud-only mode: deep analysis loading/error/result */}
                {cloudOnlyMode && (deepAnalyzing || deepError || deepAnalysisResult) && (
                  <div className="space-y-2 pt-1">
                    {/* Loading state */}
                    {deepAnalyzing && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-5">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-white animate-pulse" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-emerald-700 font-medium">{a.deepAnalyzing}</p>
                          </div>
                          <div className="w-full bg-emerald-200 rounded-full h-1 overflow-hidden">
                            <div className="bg-emerald-600 h-1 rounded-full" style={{ width: '60%', animation: 'loading 2s ease-in-out infinite' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error state */}
                    {deepError && (
                      <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <span className="text-xs text-red-600 font-medium">{a.deepAnalysisError}</span>
                        </div>
                        <p className="text-[10px] text-red-400 mb-2">{deepError}</p>
                        <button
                          onClick={handleCloudAnalysis}
                          className="w-full flex items-center justify-center gap-2 bg-red-100 text-red-700 py-2.5 rounded-xl active:scale-[0.97] transition-transform text-xs font-medium"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />{a.deepAnalysisRetry}
                        </button>
                      </div>
                    )}

                    {/* Analysis Result */}
                    {deepAnalysisResult && (
                      <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Sparkles className="w-4 h-4 text-white flex-shrink-0" />
                            <span className="text-sm text-white font-medium truncate">{a.deepAnalysisResult}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Copy button */}
                            <button
                              onClick={handleCopyReport}
                              className="flex items-center gap-1 text-[10px] text-white/80 hover:text-white bg-white/15 px-2 py-1 rounded-lg active:scale-95 transition-all"
                            >
                              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copied ? a.copied : a.copyReport}
                            </button>
                            {/* Collapse/Expand */}
                            <button
                              onClick={() => setDeepExpanded(!deepExpanded)}
                              className="text-white/80 hover:text-white p-1 rounded-lg active:scale-95 transition-all"
                            >
                              {deepExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Body */}
                        {deepExpanded && (
                          <div className="px-4 py-3 max-h-[400px] overflow-y-auto">
                            {renderMarkdown(deepAnalysisResult.analysis)}
                          </div>
                        )}

                        {/* Follow-up chat messages */}
                        {chatMessages.length > 0 && (
                          <div className="px-4 py-2 border-t border-gray-100 space-y-2 max-h-[300px] overflow-y-auto">
                            {chatMessages.map((msg, idx) => (
                              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                                  msg.role === 'user'
                                    ? 'bg-emerald-500 text-white rounded-br-md'
                                    : 'bg-gray-100 text-gray-700 rounded-bl-md'
                                }`}>
                                  {msg.role === 'ai' ? (
                                    <div className="text-xs leading-relaxed">{renderMarkdown(msg.text)}</div>
                                  ) : (
                                    <p className="text-xs leading-relaxed">{msg.text}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {chatReplying && (
                              <div className="flex justify-start">
                                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-1.5">
                                  <Loader className="w-3 h-3 text-emerald-500 animate-spin" />
                                  <span className="text-[10px] text-gray-400">{a.aiReplying}</span>
                                </div>
                              </div>
                            )}
                            <div ref={chatEndRef} />
                          </div>
                        )}
                      </div>
                    )}

                  </div>
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
                {done && results.length === 0 && !cloudOnlyMode && (
                  <div className="bg-white rounded-2xl p-5 shadow text-center">
                    <p className="text-sm text-gray-600">{a.noTarget}</p>
                    <p className="text-xs text-gray-400 mt-1">{a.tryClearer}</p>
                  </div>
                )}

                {/* Deep Analysis — 按钮已移至底部，此处仅展示 loading/error/result */}
                {done && results.length > 0 && (deepAnalyzing || deepError || deepAnalysisResult) && (
                  <div className="space-y-2 pt-1">
                    {/* Loading state */}
                    {deepAnalyzing && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-5">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-white animate-pulse" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-emerald-700 font-medium">{a.deepAnalyzing}</p>
                          </div>
                          <div className="w-full bg-emerald-200 rounded-full h-1 overflow-hidden">
                            <div className="bg-emerald-600 h-1 rounded-full animate-[loading_2s_ease-in-out_infinite]" style={{ width: '60%', animation: 'loading 2s ease-in-out infinite' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error state */}
                    {deepError && (
                      <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <span className="text-xs text-red-600 font-medium">{a.deepAnalysisError}</span>
                        </div>
                        <p className="text-[10px] text-red-400 mb-2">{deepError}</p>
                        <button
                          onClick={handleDeepAnalysis}
                          className="w-full flex items-center justify-center gap-2 bg-red-100 text-red-700 py-2.5 rounded-xl active:scale-[0.97] transition-transform text-xs font-medium"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />{a.deepAnalysisRetry}
                        </button>
                      </div>
                    )}

                    {/* Analysis Result */}
                    {deepAnalysisResult && (
                      <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Sparkles className="w-4 h-4 text-white flex-shrink-0" />
                            <span className="text-sm text-white font-medium truncate">{a.deepAnalysisResult}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Copy button */}
                            <button
                              onClick={handleCopyReport}
                              className="flex items-center gap-1 text-[10px] text-white/80 hover:text-white bg-white/15 px-2 py-1 rounded-lg active:scale-95 transition-all"
                            >
                              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copied ? a.copied : a.copyReport}
                            </button>
                            {/* Collapse/Expand */}
                            <button
                              onClick={() => setDeepExpanded(!deepExpanded)}
                              className="text-white/80 hover:text-white p-1 rounded-lg active:scale-95 transition-all"
                            >
                              {deepExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Body */}
                        {deepExpanded && (
                          <div className="px-4 py-3 max-h-[400px] overflow-y-auto">
                            {renderMarkdown(deepAnalysisResult.analysis)}
                          </div>
                        )}

                        {/* Follow-up chat messages */}
                        {chatMessages.length > 0 && (
                          <div className="px-4 py-2 border-t border-gray-100 space-y-2 max-h-[300px] overflow-y-auto">
                            {chatMessages.map((msg, idx) => (
                              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                                  msg.role === 'user'
                                    ? 'bg-emerald-500 text-white rounded-br-md'
                                    : 'bg-gray-100 text-gray-700 rounded-bl-md'
                                }`}>
                                  {msg.role === 'ai' ? (
                                    <div className="text-xs leading-relaxed">{renderMarkdown(msg.text)}</div>
                                  ) : (
                                    <p className="text-xs leading-relaxed">{msg.text}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {chatReplying && (
                              <div className="flex justify-start">
                                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-1.5">
                                  <Loader className="w-3 h-3 text-emerald-500 animate-spin" />
                                  <span className="text-[10px] text-gray-400">{a.aiReplying}</span>
                                </div>
                              </div>
                            )}
                            <div ref={chatEndRef} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══════ 固定底部操作栏 ═══════ */}
          {image && (
            <div className="sticky bottom-0 z-10 bg-white px-4 pt-3 pb-2 space-y-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
              {/* 识别按钮 — 本地模式，未开始 */}
              {!done && !detecting && !isDemo && !cloudOnlyMode && (
                <button
                  onClick={handleDetect}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3.5 rounded-2xl active:scale-[0.97] transition-transform"
                >
                  <ScanLine className="w-4 h-4" /><span className="font-medium">{a.startDetect}</span>
                </button>
              )}

              {/* Cloud-only mode: 云端分析按钮 */}
              {cloudOnlyMode && !done && !deepAnalyzing && !deepAnalysisResult && !deepError && (
                <button
                    onClick={handleCloudAnalysis}
                    disabled={cooldownSec > 0 || dailyUsage.used >= dailyUsage.limit}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3.5 rounded-2xl active:scale-[0.97] transition-transform shadow-lg disabled:opacity-50 disabled:active:scale-100"
                  >
                    {cooldownSec > 0 ? (
                      <><Clock className="w-4 h-4" /><span className="font-medium">{guardText(a.cooldownWait, { seconds: cooldownSec })}</span></>
                    ) : dailyUsage.used >= dailyUsage.limit ? (
                      <><Shield className="w-4 h-4" /><span className="font-medium">{a.dailyLimitReached}</span></>
                    ) : (
                      <><Cloud className="w-4 h-4" /><span className="font-medium">{a.cloudAnalyzeBtn}</span></>
                    )}
                  </button>
              )}

              {/* 深度分析按钮 — 本地检测完成后 */}
              {done && results.length > 0 && !deepAnalysisResult && !deepAnalyzing && !deepError && (
                <button
                    onClick={handleDeepAnalysis}
                    disabled={cooldownSec > 0 || dailyUsage.used >= dailyUsage.limit}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3.5 rounded-2xl active:scale-[0.97] transition-transform shadow-lg disabled:opacity-50 disabled:active:scale-100"
                  >
                    {cooldownSec > 0 ? (
                      <><Clock className="w-4 h-4" /><span className="font-medium">{guardText(a.cooldownWait, { seconds: cooldownSec })}</span></>
                    ) : dailyUsage.used >= dailyUsage.limit ? (
                      <><Shield className="w-4 h-4" /><span className="font-medium">{a.dailyLimitReached}</span></>
                    ) : (
                      <><Sparkles className="w-4 h-4" /><span className="font-medium">{a.deepAnalysis}</span></>
                    )}
                  </button>
              )}

              {/* 分析中 — 进度提示 */}
              {(detecting || deepAnalyzing) && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader className="w-4 h-4 text-emerald-500 animate-spin" />
                  <span className="text-xs text-gray-500">{detecting ? a.aiAnalyzing : a.deepAnalyzing}</span>
                </div>
              )}

              {/* 追问聊天输入框 — 深度分析完成后 */}
              {deepAnalysisResult && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleChatSend(); }}
                    placeholder={a.chatPlaceholder}
                    disabled={chatReplying || cooldownSec > 0 || dailyUsage.used >= dailyUsage.limit}
                    className="flex-1 min-w-0 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-50 transition-all"
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || chatReplying || cooldownSec > 0 || dailyUsage.used >= dailyUsage.limit}
                    className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-full active:scale-90 transition-all disabled:opacity-40 disabled:active:scale-100 flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* 重新拍照按钮 — 分析完成后 */}
              {(done || deepAnalysisResult || deepError) && (
                <button
                  onClick={reset}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl active:scale-[0.97] transition-transform shadow-sm"
                >
                  <Camera className="w-4 h-4" /><span className="font-medium text-sm">{a.retakePhoto}</span>
                </button>
              )}
            </div>
          )}
          </>
        )}
      </div>
      {showCameraOverlay && <CameraOverlay onClose={() => setShowCameraOverlay(false)} onCapture={onCameraCapture} />}
    </SecondaryView>
  );
}