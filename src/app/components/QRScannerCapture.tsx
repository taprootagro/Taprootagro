import { useRef, useState, useEffect, useCallback } from "react";
import { X, ScanLine, Flashlight, FlashlightOff, AlertTriangle, Camera, ImageIcon, Loader } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { SafeFilePicker } from "./SafeFilePicker";

// ── BarcodeDetector polyfill type ──────────────────────────────
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

/**
 * QRScannerCapture — PWA 兼容的二维码扫描组件
 *
 * 双模式策略：
 * 1. 相机模式：getUserMedia + BarcodeDetector 实时扫描（优先）
 * 2. 图片模式：当相机不可用时（PWA standalone 常见），
 *    通过 <input type="file"> 拍照或从相册选择图片，再用 BarcodeDetector 解析
 *
 * 相机可用时底部也显示「从相册识别」按钮，作为补充入口。
 */
export function QRScannerCapture({ onScan, onClose }: QRScannerCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const scannedRef = useRef(false);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [scanLineY, setScanLineY] = useState(0);
  const [apiSupported, setApiSupported] = useState(true);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [scanningImage, setScanningImage] = useState(false);
  const [imageError, setImageError] = useState("");

  // 过渡动画
  const [animPhase, setAnimPhase] = useState<"entering" | "visible" | "leaving">("entering");
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimPhase("visible"));
    return () => cancelAnimationFrame(raf);
  }, []);

  const { language } = useLanguage();
  const isChinese = language === "zh";
  const ct = (zh: string, en: string) => (isChinese ? zh : en);

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
      } catch (err) {
        console.error("[QRScanner] Camera error:", err);
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
      setScanLineY(((Math.sin(frame * 0.03) + 1) / 2) * 100);
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

    if (!detectorRef.current) {
      setImageError(ct("此浏览器不支持二维码识别", "QR detection not supported in this browser"));
      return;
    }

    setScanningImage(true);
    setImageError("");

    try {
      const bitmap = await createImageBitmap(file);
      const barcodes = await detectorRef.current.detect(bitmap);

      if (barcodes.length > 0 && barcodes[0].rawValue) {
        scannedRef.current = true;
        if (navigator.vibrate) navigator.vibrate(100);
        stream?.getTracks().forEach((t) => t.stop());
        onScan(barcodes[0].rawValue);
      } else {
        setImageError(ct("未检测到二维码，请重试", "No QR code detected. Please try again."));
      }
    } catch (err) {
      console.error("[QRScanner] Image scan error:", err);
      setImageError(ct("识别失败，请重试", "Detection failed. Please try again."));
    } finally {
      setScanningImage(false);
    }
  }, [stream, onScan, ct]);

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

      {/* Top bar */}
      <div className="flex justify-between items-center p-4 bg-black/60 backdrop-blur-sm z-10">
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-emerald-400" />
          {ct("扫一扫", "Scan QR")}
        </h2>
        <div className="flex items-center gap-2">
          {torchSupported && (
            <button onClick={toggleTorch} className="text-white p-2 active:scale-95 transition-transform rounded-full hover:bg-white/10">
              {torchOn ? <Flashlight className="w-5 h-5 text-yellow-400" /> : <FlashlightOff className="w-5 h-5" />}
            </button>
          )}
          <button onClick={handleClose} className="text-white p-2 active:scale-95 transition-transform rounded-full hover:bg-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {cameraFailed ? (
          /* ── 相机不可用：fallback UI ── */
          <div className="text-white text-center p-6 max-w-sm w-full">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ScanLine className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-xl mb-2">{ct("扫描二维码", "Scan QR Code")}</h3>
            <p className="text-white/60 text-sm mb-8">
              {ct("相机暂不可用，请拍照或从相册选择二维码图片", "Camera unavailable. Take a photo or choose a QR code image from album.")}
            </p>

            {scanningImage ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader className="w-5 h-5 text-emerald-400 animate-spin" />
                <span className="text-white/80">{ct("识别中...", "Scanning...")}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <SafeFilePicker accept="image/*" capture="environment" onChange={handleFileChange}>
                  <div
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3.5 rounded-2xl active:scale-[0.97] transition-transform"
                  >
                    <Camera className="w-5 h-5" />
                    <span>{ct("拍照识别", "Take Photo")}</span>
                  </div>
                </SafeFilePicker>
                <SafeFilePicker accept="image/*" onChange={handleFileChange}>
                  <div
                    className="w-full flex items-center justify-center gap-2 bg-white/10 text-white py-3.5 rounded-2xl active:scale-[0.97] transition-transform border border-white/20"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span>{ct("从相册选择", "Choose from Album")}</span>
                  </div>
                </SafeFilePicker>
              </div>
            )}

            {imageError && (
              <div className="mt-4 bg-red-500/20 rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm text-left">{imageError}</p>
              </div>
            )}
          </div>
        ) : (
          /* ── 相机正常：实时扫描 UI ── */
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

            {/* Dark overlay with transparent window */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/50" />
              <div
                className="absolute bg-transparent"
                style={{
                  top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                  width: "260px", height: "260px",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)", borderRadius: "20px",
                }}
              />
            </div>

            {/* Scan frame corners */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[260px] h-[260px] relative">
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-[20px]" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-[20px]" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-[20px]" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-[20px]" />
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
                      {ct("此浏览器不支持二维码扫描", "QR scanning not supported in this browser")}
                    </p>
                    <p className="text-white/80 text-xs mt-1">
                      {ct(
                        "请使用 Chrome、Edge 或 Samsung Internet 浏览器",
                        "Please use Chrome, Edge, or Samsung Internet."
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom: hint + album button */}
            <div className="absolute bottom-0 left-0 right-0 pb-6 pt-4 bg-gradient-to-t from-black/80 to-transparent z-10">
              <p className="text-white/90 text-center text-sm">
                {ct("将二维码放入框内，自动识别", "Place QR code inside the frame to scan")}
              </p>
              <p className="text-white/50 text-center text-xs mt-1 mb-4">
                {ct("支持商家绑定码、链接码", "Supports merchant binding & URL codes")}
              </p>
              {/* 相册入口 — 即使相机正常也提供 */}
              <div className="flex justify-center">
                <SafeFilePicker accept="image/*" onChange={handleFileChange}>
                  <div
                    className="flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white/90 px-5 py-2.5 rounded-full active:scale-95 transition-transform border border-white/20"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-sm">{ct("从相册识别", "Scan from Album")}</span>
                  </div>
                </SafeFilePicker>
              </div>
              {/* 图片扫描状态 */}
              {scanningImage && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Loader className="w-4 h-4 text-emerald-400 animate-spin" />
                  <span className="text-white/70 text-sm">{ct("识别中...", "Scanning...")}</span>
                </div>
              )}
              {imageError && (
                <p className="text-red-300 text-center text-xs mt-2">{imageError}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}