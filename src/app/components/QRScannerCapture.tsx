import { useRef, useState, useEffect, useCallback } from "react";
import { X, ScanLine, Flashlight, FlashlightOff, AlertTriangle } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

// ── BarcodeDetector polyfill type ──────────────────────────────
// Chrome 83+, Edge 83+, Android WebView, Samsung Internet — all support it.
// Safari 17.2+ has partial support. Firefox does not support it yet.
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
  /** Called when a QR code is successfully decoded */
  onScan: (decodedText: string) => void;
  /** Called when the scanner is closed without a result */
  onClose: () => void;
}

/**
 * Real-time QR code scanner.
 *
 * Strategy (ordered by preference):
 *  1. Native BarcodeDetector API (Chrome/Edge/Android — zero bundle cost, HW accelerated)
 *  2. Canvas frame-grab fallback for unsupported browsers (shows a "not supported" message)
 *
 * Continuously grabs frames from the rear camera, decodes them, and fires `onScan` on first hit.
 */
export function QRScannerCapture({ onScan, onClose }: QRScannerCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const scannedRef = useRef(false); // prevent double-fire

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [scanLineY, setScanLineY] = useState(0);
  const [apiSupported, setApiSupported] = useState(true);

  // 过渡动画
  const [animPhase, setAnimPhase] = useState<'entering' | 'visible' | 'leaving'>('entering');
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimPhase('visible'));
    return () => cancelAnimationFrame(raf);
  }, []);

  const { language } = useLanguage();
  const isChinese = language === "zh";
  const ct = (zh: string, en: string) => (isChinese ? zh : en);

  // ── Check BarcodeDetector support ─────────────────────────────
  const detectorRef = useRef<InstanceType<NonNullable<typeof window.BarcodeDetector>> | null>(null);

  useEffect(() => {
    if (window.BarcodeDetector) {
      try {
        detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
        setApiSupported(true);
        console.log("[QRScanner] Using native BarcodeDetector API");
      } catch {
        setApiSupported(false);
        console.warn("[QRScanner] BarcodeDetector constructor failed");
      }
    } else {
      setApiSupported(false);
      console.warn("[QRScanner] BarcodeDetector API not available in this browser");
    }
  }, []);

  // ── Start camera ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Check torch support
        const videoTrack = mediaStream.getVideoTracks()[0];
        const caps = videoTrack.getCapabilities?.() as any;
        if (caps?.torch) {
          setTorchSupported(true);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setStream(mediaStream);
      } catch (err) {
        console.error("[QRScanner] Camera error:", err);
        setError(
          ct(
            "无法访问相机，请检查权限设置",
            "Unable to access camera. Please check your permissions."
          )
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  // ── Scan loop (BarcodeDetector) ───────────────────────────────
  const scanFrame = useCallback(() => {
    if (scannedRef.current) return;

    const video = videoRef.current;
    if (!video || video.readyState < video.HAVE_ENOUGH_DATA || !detectorRef.current) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    // Use BarcodeDetector.detect() directly on video element
    detectorRef.current
      .detect(video)
      .then((barcodes: BarcodeDetectorResult[]) => {
        if (scannedRef.current) return;

        if (barcodes.length > 0 && barcodes[0].rawValue) {
          scannedRef.current = true;
          console.log("[QRScanner] Decoded:", barcodes[0].rawValue);

          // Haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          // Stop camera before callback
          stream?.getTracks().forEach((t) => t.stop());
          onScan(barcodes[0].rawValue);
          return;
        }

        // Continue scanning
        rafRef.current = requestAnimationFrame(scanFrame);
      })
      .catch(() => {
        // Detection error — continue scanning
        rafRef.current = requestAnimationFrame(scanFrame);
      });
  }, [stream, onScan]);

  // Start scanning when video is playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || !apiSupported) return;

    const handlePlaying = () => {
      rafRef.current = requestAnimationFrame(scanFrame);
    };

    video.addEventListener("playing", handlePlaying);
    // In case already playing
    if (!video.paused) {
      rafRef.current = requestAnimationFrame(scanFrame);
    }

    return () => {
      video.removeEventListener("playing", handlePlaying);
      cancelAnimationFrame(rafRef.current);
    };
  }, [stream, scanFrame, apiSupported]);

  // ── Animated scan line ────────────────────────────────────────
  useEffect(() => {
    let frame = 0;
    let animId = 0;
    const animate = () => {
      frame++;
      // Oscillate between 0 and 100 over ~120 frames (~2s at 60fps)
      const progress = (Math.sin(frame * 0.03) + 1) / 2;
      setScanLineY(progress * 100);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  // ── Toggle torch ──────────────────────────────────────────────
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !torchOn } as any],
      });
      setTorchOn(!torchOn);
    } catch (e) {
      console.warn("[QRScanner] Torch toggle failed:", e);
    }
  };

  // ── Close handler ─────────────────────────────────────────────
  const handleClose = () => {
    setAnimPhase('leaving');
    cancelAnimationFrame(rafRef.current);
    stream?.getTracks().forEach((t) => t.stop());
    setTimeout(() => onClose(), 150);
  };

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col"
      style={{
        transform: animPhase === 'visible' ? 'none' : 'scale(0.96)',
        opacity: animPhase === 'visible' ? 1 : 0,
        transition: animPhase === 'leaving' ? 'transform 150ms ease-in, opacity 150ms ease-in' : 'transform 200ms ease-out, opacity 200ms ease-out',
        willChange: animPhase === 'visible' ? 'auto' : 'transform, opacity',
      }}
    >
      {/* Hidden canvas (kept for potential future fallback use) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top bar */}
      <div className="flex justify-between items-center p-4 bg-black/60 backdrop-blur-sm z-10">
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-emerald-400" />
          {ct("扫一扫", "Scan QR")}
        </h2>
        <div className="flex items-center gap-2">
          {/* Torch toggle */}
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className="text-white p-2 active:scale-95 transition-transform rounded-full hover:bg-white/10"
            >
              {torchOn ? (
                <Flashlight className="w-5 h-5 text-yellow-400" />
              ) : (
                <FlashlightOff className="w-5 h-5" />
              )}
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

      {/* Camera preview */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-white text-center p-6 max-w-sm">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ScanLine className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-xl mb-2">{ct("相机错误", "Camera Error")}</h3>
            <p className="mb-6 text-white/80 text-sm">{error}</p>
            <button
              onClick={handleClose}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-full transition-colors shadow-lg"
            >
              {ct("关闭", "Close")}
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Dark overlay with transparent window */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Semi-transparent masks around the scan area */}
              <div className="absolute inset-0 bg-black/50" />
              {/* Cut-out window */}
              <div
                className="absolute bg-transparent"
                style={{
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "260px",
                  height: "260px",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                  borderRadius: "20px",
                }}
              />
            </div>

            {/* Scan frame corners */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[260px] h-[260px] relative">
                {/* Corners */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-[20px]" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-[20px]" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-[20px]" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-[20px]" />

                {/* Animated scan line */}
                <div
                  className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent transition-none"
                  style={{ top: `${scanLineY}%` }}
                />
              </div>
            </div>

            {/* API not supported warning */}
            {!apiSupported && (
              <div className="absolute top-20 left-4 right-4 z-20">
                <div className="bg-amber-500/90 backdrop-blur-sm rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-medium">
                      {ct(
                        "此浏览器不支持二维码扫描",
                        "QR scanning not supported in this browser"
                      )}
                    </p>
                    <p className="text-white/80 text-xs mt-1">
                      {ct(
                        "请使用 Chrome、Edge 或 Samsung Internet 浏览器，或将此 PWA 安装到手机桌面后使用",
                        "Please use Chrome, Edge, or Samsung Internet. Or install this PWA to your home screen."
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Hint text */}
            <div className="absolute bottom-0 left-0 right-0 pb-8 pt-4 bg-gradient-to-t from-black/70 to-transparent">
              <p className="text-white/90 text-center text-sm">
                {ct(
                  "将二维码放入框内，自动识别",
                  "Place QR code inside the frame to scan"
                )}
              </p>
              <p className="text-white/50 text-center text-xs mt-1">
                {ct("支持商家绑定码、链接码", "Supports merchant binding & URL codes")}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}