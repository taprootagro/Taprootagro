/**
 * CameraOverlay — 通用 getUserMedia 相机预览组件（统一样式）
 *
 * 视觉：全屏相机预览 → 中心对准框(绿色圆角 + 扫描线) → 手电筒 → 快门 → 关闭
 * 整个页面无任何文字，纯图标交互，适配低识字率用户。
 *
 * 使用全局 CameraManager：
 * - 分级约束降级（1920→1280→640→bare），兼容 iPhone 8 Plus 等低端设备
 * - 用完即释放，不在后台占用摄像头硬件
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, Flashlight, FlashlightOff } from 'lucide-react';
import { canvasToBase64 } from '../utils/imageUtils';
import { cameraManager, type FacingMode } from '../utils/cameraManager';

interface CameraOverlayProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  showFlip?: boolean;
  quality?: number;
}

export function CameraOverlay({
  onCapture,
  onClose,
  showFlip = true,
  quality = 0.85,
}: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [scanLineY, setScanLineY] = useState(0);

  // 过渡动画
  const [animPhase, setAnimPhase] = useState<'entering' | 'visible' | 'leaving'>('entering');
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimPhase('visible'));
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── 扫描线动画 ─────────────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    let animId = 0;
    const animate = () => {
      frame++;
      setScanLineY(((Math.sin(frame * 0.025) + 1) / 2) * 100);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  // ── 启动相机（通过全局 CameraManager）──────────────────────
  const startCamera = useCallback(async (facing: FacingMode) => {
    setCameraReady(false);
    setCameraFailed(false);
    setTorchOn(false);
    setTorchSupported(false);

    try {
      const managed = await cameraManager.acquire(facing);
      setTorchSupported(managed.torchSupported);

      if (videoRef.current) {
        videoRef.current.srcObject = managed.stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
            .then(() => setCameraReady(true))
            .catch(() => setCameraReady(true));
        };
      }
    } catch (err) {
      console.error('[CameraOverlay] startCamera failed:', err);
      setCameraFailed(true);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      // 用完即释放 — 立即停止摄像头，不保活
      cameraManager.release();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 切换前后摄像头 ────────────────────────────────────────
  const handleFlip = useCallback(() => {
    const next: FacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    // acquire() 内部会先 release 旧 stream，再创建新的
    startCamera(next);
  }, [facingMode, startCamera]);

  // ── 手电筒 ────────────────────────────────────────────────
  const toggleTorch = useCallback(async () => {
    const success = await cameraManager.toggleTorch(!torchOn);
    if (success) setTorchOn(!torchOn);
  }, [torchOn]);

  // ── 拍照 ──────────────────────────────────────────────────
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return;

    setCapturing(true);
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d')!;
    if (facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    const base64 = canvasToBase64(canvas, quality);

    // 拍照完成，立即释放摄像头
    cameraManager.release();

    setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      onCapture(base64);
    }, 150);
  }, [cameraReady, facingMode, quality, onCapture]);

  // ── 关闭 ──────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setAnimPhase('leaving');
    cameraManager.release();
    setTimeout(() => onClose(), 150);
  }, [onClose]);

  // ── 渲染 ──────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col"
      style={{
        transform: animPhase === 'visible' ? 'none' : 'scale(0.96)',
        opacity: animPhase === 'visible' ? 1 : 0,
        transition: animPhase === 'leaving'
          ? 'transform 150ms ease-in, opacity 150ms ease-in'
          : 'transform 200ms ease-out, opacity 200ms ease-out',
        willChange: animPhase === 'visible' ? 'auto' : 'transform, opacity',
      }}
    >
      <canvas ref={canvasRef} className="hidden" />

      {/* 白闪拍照效果 */}
      {capturing && (
        <div className="absolute inset-0 bg-white z-50 animate-pulse" style={{ animationDuration: '150ms' }} />
      )}

      {/* ═══════ 主内容区 ═══════ */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {cameraFailed ? (
          /* 相机不可用降级 — 重试图标，无文字 */
          <div className="flex flex-col items-center gap-6">
            <button
              onClick={() => startCamera(facingMode)}
              className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center active:scale-90 transition-transform"
            >
              <RefreshCw className="w-10 h-10 text-emerald-400" />
            </button>
          </div>
        ) : (
          <>
            {/* 相机预览 */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />

            {/* 暗角遮罩 + 透明框 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/50" />
              <div
                className="absolute bg-transparent"
                style={{
                  top: '50%', left: '50%', transform: 'translate(-50%, -55%)',
                  width: '260px', height: '260px',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)', borderRadius: '20px',
                }}
              />
            </div>

            {/* 四角标记 + 扫描线 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginTop: '-5%' }}>
              <div className="w-[260px] h-[260px] relative">
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-[20px]" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-[20px]" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-[20px]" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-[20px]" />
                {/* 绿色扫描线 */}
                <div
                  className="absolute left-2 right-2 h-[2px]"
                  style={{
                    top: `${scanLineY}%`,
                    background: 'linear-gradient(90deg, transparent 0%, #34d399 20%, #10b981 50%, #34d399 80%, transparent 100%)',
                    boxShadow: '0 0 8px 2px rgba(16,185,129,0.4)',
                  }}
                />
              </div>
            </div>

            {/* 加载中 spinner */}
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══════ 底部控制区 ═══════ */}
      {!cameraFailed && (
        <div className="flex-shrink-0 bg-black/80 backdrop-blur-sm flex flex-col items-center gap-5 pt-5 pb-4">
          {/* 手电筒 */}
          <button
            onClick={toggleTorch}
            disabled={!torchSupported}
            className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-all ${
              torchOn
                ? 'bg-yellow-400/20 ring-2 ring-yellow-400/50'
                : torchSupported
                  ? 'bg-white/10 active:bg-white/20'
                  : 'bg-white/5 opacity-30'
            }`}
          >
            {torchOn
              ? <Flashlight className="w-5 h-5 text-yellow-400" />
              : <FlashlightOff className="w-5 h-5 text-white/70" />
            }
          </button>

          {/* 快门行 */}
          <div className="flex items-center justify-center">
            {/* 快门 */}
            <button
              onClick={handleCapture}
              disabled={!cameraReady}
              className="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
            >
              <div className="w-[60px] h-[60px] rounded-full bg-white" />
            </button>
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform border border-white/20 mb-2"
          >
            <X className="w-6 h-6 text-white/90" />
          </button>
        </div>
      )}

      {/* 相机失败时的底部关闭 */}
      {cameraFailed && (
        <div className="flex-shrink-0 bg-black/80 py-6 flex justify-center">
          <button
            onClick={handleClose}
            className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform border border-white/20"
          >
            <X className="w-6 h-6 text-white/90" />
          </button>
        </div>
      )}
    </div>
  );
}
