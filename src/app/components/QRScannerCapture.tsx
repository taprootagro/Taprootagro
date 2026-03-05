/**
 * QRScannerCapture — PWA 兼容的二维码扫描组件（统一样式）
 *
 * 视觉：全屏相机预览 → 中心对准框(绿色圆角 + 扫描线) → 手电筒 → 关闭
 * 整个页面无任何文字，纯图标交互，适配低识字率用户。
 *
 * 相机可用时自动实时扫描（BarcodeDetector），
 * 相机不可用时降级为 file input（拍照 / 相册）。
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { X, Flashlight, FlashlightOff, Camera, ImageIcon } from "lucide-react";

// ── BarcodeDetector type ────────────────────────────────────────
interface BarcodeDetectorResult {
  rawValue: string;
  format: string;
  boundingBox?: DOMRectReadOnly;
  cornerPoints?: Array<{ x: number; y: number }>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): {
        detect: (source: ImageBitmapSource) => Promise<BarcodeDetectorResult[]>;
      };
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

interface QRScannerCaptureProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function QRScannerCapture({ onScan, onClose }: QRScannerCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const scannedRef = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [scanLineY, setScanLineY] = useState(0);
  const [apiSupported, setApiSupported] = useState(true);
  const [cameraFailed, setCameraFailed] = useState(false);

  // 过渡动画
  const [animPhase, setAnimPhase] = useState<"entering" | "visible" | "leaving">("entering");
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimPhase("visible"));
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── BarcodeDetector ───────────────────────────────────────────
  const detectorRef = useRef<InstanceType<NonNullable<typeof window.BarcodeDetector>> | null>(null);

  useEffect(() => {
    if (window.BarcodeDetector) {
      try {
        detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
        setApiSupported(true);
      } catch {
        setApiSupported(false);
      }
    } else {
      setApiSupported(false);
    }
  }, []);

  // ── Start camera ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        const videoTrack = mediaStream.getVideoTracks()[0];
        const caps = videoTrack.getCapabilities?.() as any;
        if (caps?.torch) setTorchSupported(true);

        if (videoRef.current) videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
      } catch {
        setCameraFailed(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  // ── Scan loop ─────────────────────────────────────────────────
  const scanFrame = useCallback(() => {
    if (scannedRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < video.HAVE_ENOUGH_DATA || !detectorRef.current) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    detectorRef.current
      .detect(video)
      .then((barcodes: BarcodeDetectorResult[]) => {
        if (scannedRef.current) return;
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          scannedRef.current = true;
          if (navigator.vibrate) navigator.vibrate(100);
          stream?.getTracks().forEach((t) => t.stop());
          onScan(barcodes[0].rawValue);
          return;
        }
        rafRef.current = requestAnimationFrame(scanFrame);
      })
      .catch(() => {
        rafRef.current = requestAnimationFrame(scanFrame);
      });
  }, [stream, onScan]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || !apiSupported) return;
    const handlePlaying = () => { rafRef.current = requestAnimationFrame(scanFrame); };
    video.addEventListener("playing", handlePlaying);
    if (!video.paused) rafRef.current = requestAnimationFrame(scanFrame);
    return () => {
      video.removeEventListener("playing", handlePlaying);
      cancelAnimationFrame(rafRef.current);
    };
  }, [stream, scanFrame, apiSupported]);

  // ── Scan line animation ───────────────────────────────────────
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

  // ── Torch ─────────────────────────────────────────────────────
  const toggleTorch = async () => {
    if (!stream) return;
    try {
      await (stream.getVideoTracks()[0] as any).applyConstraints({
        advanced: [{ torch: !torchOn } as any],
      });
      setTorchOn(!torchOn);
    } catch {}
  };

  // ── Close ─────────────────────────────────────────────────────
  const handleClose = () => {
    setAnimPhase("leaving");
    cancelAnimationFrame(rafRef.current);
    stream?.getTracks().forEach((t) => t.stop());
    setTimeout(() => onClose(), 150);
  };

  // ── Scan image file ───────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!detectorRef.current) return;

    try {
      const bitmap = await createImageBitmap(file);
      const barcodes = await detectorRef.current.detect(bitmap);

      if (barcodes.length > 0 && barcodes[0].rawValue) {
        scannedRef.current = true;
        if (navigator.vibrate) navigator.vibrate(100);
        stream?.getTracks().forEach((t) => t.stop());
        onScan(barcodes[0].rawValue);
      }
    } catch {}
  }, [stream, onScan]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col"
      style={{
        transform: animPhase === "visible" ? "none" : "scale(0.96)",
        opacity: animPhase === "visible" ? 1 : 0,
        transition:
          animPhase === "leaving"
            ? "transform 150ms ease-in, opacity 150ms ease-in"
            : "transform 200ms ease-out, opacity 200ms ease-out",
        willChange: animPhase === "visible" ? "auto" : "transform, opacity",
      }}
    >
      <canvas ref={canvasRef} className="hidden" />

      {/* 隐藏的 file inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
      <input ref={albumInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {/* ═══════ 主内容区 ═══════ */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {cameraFailed ? (
          /* 相机不可用降级 — 纯图标，无文字 */
          <div className="flex flex-col items-center gap-6">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center active:scale-90 transition-transform"
            >
              <Camera className="w-10 h-10 text-emerald-400" />
            </button>
            <button
              onClick={() => albumInputRef.current?.click()}
              className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition-transform border border-white/20"
            >
              <ImageIcon className="w-6 h-6 text-white" />
            </button>
          </div>
        ) : (
          <>
            {/* 相机预览 */}
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

            {/* 暗角遮罩 + 透明框 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/50" />
              <div
                className="absolute bg-transparent"
                style={{
                  top: "50%", left: "50%", transform: "translate(-50%, -55%)",
                  width: "260px", height: "260px",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)", borderRadius: "20px",
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
          </>
        )}
      </div>

      {/* ═══════ 底部控制区 ═══════ */}
      <div className="flex-shrink-0 bg-black/80 backdrop-blur-sm flex flex-col items-center gap-5 pt-5 pb-4">
        {/* 手电筒 */}
        {!cameraFailed && (
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
        )}

        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform border border-white/20 mb-2"
        >
          <X className="w-6 h-6 text-white/90" />
        </button>
      </div>
    </div>
  );
}