/**
 * CameraOverlay — 通用 getUserMedia 相机预览组件
 *
 * 方案 C：直接使用 HTML5 Camera API（navigator.mediaDevices.getUserMedia）
 * 绕过 <input type="file" capture="environment"> 在国产 PWA 浏览器中被拦截的问题。
 *
 * 功能：
 * - 实时相机预览（后置优先）
 * - 前后摄像头切换
 * - 拍照捕获（canvas 截帧）
 * - 闪光灯/手电筒开关（设备支持时）
 * - 相机不可用时降级为 file input
 *
 * 使用场景：扫一扫、AI 助手、聊天拍照
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { X, Camera, RefreshCw, Flashlight, FlashlightOff, ImageIcon } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { canvasToBase64 } from '../utils/imageUtils';

interface CameraOverlayProps {
  /** 拍照成功回调，返回 base64 图片 */
  onCapture: (base64: string) => void;
  /** 关闭回调 */
  onClose: () => void;
  /** 是否显示前后摄像头切换按钮，默认 true */
  showFlip?: boolean;
  /** 拍照质量 0-1，默认 0.85 */
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
  const streamRef = useRef<MediaStream | null>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 过渡动画
  const [animPhase, setAnimPhase] = useState<'entering' | 'visible' | 'leaving'>('entering');
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimPhase('visible'));
    return () => cancelAnimationFrame(raf);
  }, []);

  const { t } = useLanguage();

  // ── 启动相机 ──────────────────────────────────────────────
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    // 先停掉旧流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setCameraFailed(false);
    setTorchOn(false);
    setTorchSupported(false);
    setErrorMsg('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // 检查手电筒支持
      const videoTrack = stream.getVideoTracks()[0];
      const caps = videoTrack?.getCapabilities?.() as any;
      if (caps?.torch) {
        setTorchSupported(true);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // 等待 video 真正开始播放
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setCameraReady(true);
          }).catch(() => {
            setCameraReady(true); // 即使 play 失败也标记 ready
          });
        };
      }
    } catch (err: any) {
      console.error('[CameraOverlay] getUserMedia error:', err);
      setCameraFailed(true);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg(t.camera?.permissionDeniedMessage ?? 'Camera permission denied. Please allow in settings.');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg(t.camera?.noCamera ?? 'No camera found on this device.');
      } else {
        setErrorMsg(t.camera?.startFailed ?? 'Failed to start camera.');
      }
    }
  }, [t]);

  // 初始化
  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 切换前后摄像头 ────────────────────────────────────────
  const handleFlip = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  // ── 手电筒 ────────────────────────────────────────────────
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      await (track as any).applyConstraints({
        advanced: [{ torch: !torchOn } as any],
      });
      setTorchOn(!torchOn);
    } catch {
      // 静默失败
    }
  }, [torchOn]);

  // ── 拍照 ──────────────────────────────────────────────────
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return;

    setCapturing(true);

    // 使用 video 的实际渲染尺寸
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d')!;
    // 前置摄像头需要镜像翻转
    if (facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    const base64 = canvasToBase64(canvas, quality);

    // 停止流
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    // 白闪效果后回调
    setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      onCapture(base64);
    }, 150);
  }, [cameraReady, facingMode, quality, onCapture]);

  // ── 关闭 ──────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setAnimPhase('leaving');
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setTimeout(() => onClose(), 150);
  }, [onClose]);

  // ── 从相册选择（降级方案）────────────────────────────────
  const handleAlbumFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        onCapture(result);
      }
    };
    reader.readAsDataURL(file);
  }, [onCapture]);

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
      <input ref={albumInputRef} type="file" accept="image/*" onChange={handleAlbumFile} className="hidden" />

      {/* 白闪拍照效果 */}
      {capturing && (
        <div className="absolute inset-0 bg-white z-50 animate-pulse" style={{ animationDuration: '150ms' }} />
      )}

      {/* 顶部工具栏 */}
      <div className="flex justify-between items-center p-4 bg-black/60 backdrop-blur-sm z-10">
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-400" />
          {t.camera?.takePicture ?? 'Camera'}
        </h2>
        <div className="flex items-center gap-2">
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className="text-white p-2 active:scale-95 transition-transform rounded-full hover:bg-white/10"
            >
              {torchOn
                ? <Flashlight className="w-5 h-5 text-yellow-400" />
                : <FlashlightOff className="w-5 h-5" />
              }
            </button>
          )}
          <button
            onClick={handleClose}
            className="text-white p-2 active:scale-95 transition-transform rounded-full hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 主内容 */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {cameraFailed ? (
          /* 相机不可用降级 UI */
          <div className="text-white text-center p-6 max-w-sm w-full">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Camera className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-xl mb-2">{t.camera?.cameraUnavailable ?? 'Camera Unavailable'}</h3>
            <p className="text-white/60 text-sm mb-4">{errorMsg}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => startCamera(facingMode)}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3.5 rounded-2xl active:scale-[0.97] transition-transform"
              >
                <RefreshCw className="w-5 h-5" />
                <span>{t.camera?.retry ?? 'Retry'}</span>
              </button>
              <button
                onClick={() => albumInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-white/10 text-white py-3.5 rounded-2xl active:scale-[0.97] transition-transform border border-white/20"
              >
                <ImageIcon className="w-5 h-5" />
                <span>{t.camera?.chooseFromAlbum ?? 'Choose from Album'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* 相机预览 */
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              }}
            />

            {/* 加载中 */}
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-white/80 text-sm">{t.camera?.startingCamera ?? 'Starting camera...'}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部控制栏 */}
      {!cameraFailed && (
        <div className="bg-black/80 backdrop-blur-sm pb-8 pt-5 px-6 z-10">
          <div className="flex items-center justify-around max-w-sm mx-auto">
            {/* 相册按钮 */}
            <button
              onClick={() => albumInputRef.current?.click()}
              className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition-transform border border-white/20"
            >
              <ImageIcon className="w-5 h-5 text-white" />
            </button>

            {/* 快门按钮 */}
            <button
              onClick={handleCapture}
              disabled={!cameraReady}
              className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
              style={{ width: '72px', height: '72px' }}
            >
              <div
                className="rounded-full bg-white"
                style={{ width: '60px', height: '60px' }}
              />
            </button>

            {/* 翻转按钮 */}
            {showFlip ? (
              <button
                onClick={handleFlip}
                className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition-transform border border-white/20"
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
            ) : (
              <div className="w-12 h-12" /> // placeholder for centering
            )}
          </div>
        </div>
      )}
    </div>
  );
}