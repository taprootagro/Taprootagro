import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, RotateCcw, Check, Loader } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { compressImageFile, COMPRESS_PRESETS } from '../utils/imageCompressor';
import { getCameraStream, stopCameraStream, captureVideoFrame } from '../utils/cameraUtils';

interface HTML5CameraCaptureProps {
  onCapture?: (imageData: string) => void;
  onClose?: () => void;
}

/**
 * HTML5CameraCapture - 使用 getUserMedia 直接调用摄像头
 * 
 * 这是一个高级方案，直接通过 HTML5 API 调用摄像头，绕过文件选择器。
 * 优点：
 * - 直接预览摄像头画面
 * - 可以切换前后置摄像头
 * - 实时拍照，用户体验更好
 * 
 * 缺点：
 * - 需要用户授权摄像头权限
 * - 某些PWA桌面模式可能权限受限
 * - 国产浏览器可能存在兼容性问题
 * 
 * 适用场景：
 * - 现代浏览器（Chrome, Edge, Safari）
 * - 已授权摄像头权限
 * - 非国产浏览器或国产浏览器的新版本
 */
export function HTML5CameraCapture({ onCapture, onClose }: HTML5CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { language } = useLanguage();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // 过渡动画
  const [animPhase, setAnimPhase] = useState<'entering' | 'visible' | 'leaving'>('entering');
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimPhase('visible'));
    return () => cancelAnimationFrame(raf);
  }, []);

  // 多语言
  const texts = getTexts(language);

  // 启动摄像头
  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      setLoading(true);
      setError('');

      try {
        const mediaStream = await getCameraStream(facingMode);
        
        if (cancelled) {
          stopCameraStream(mediaStream);
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setStream(mediaStream);
        setLoading(false);
      } catch (err: any) {
        console.error('[HTML5Camera] Error:', err);
        if (!cancelled) {
          setError(err.name === 'NotAllowedError' 
            ? texts.permissionDenied 
            : texts.cameraError);
          setLoading(false);
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (stream) {
        stopCameraStream(stream);
      }
    };
  }, [facingMode]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (stream) {
        stopCameraStream(stream);
      }
    };
  }, [stream]);

  // 拍照
  const handleCapture = useCallback(async () => {
    if (!videoRef.current || capturing) return;

    setCapturing(true);

    try {
      // 捕获当前帧
      const imageData = captureVideoFrame(videoRef.current, 0.92);

      // 将base64转为Blob再压缩
      const response = await fetch(imageData);
      const blob = await response.blob();
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });

      try {
        // 压缩图片
        const compressed = await compressImageFile(file, COMPRESS_PRESETS.chat);
        onCapture?.(compressed);
      } catch {
        // 压缩失败则使用原图
        onCapture?.(imageData);
      }

      // 关闭摄像头
      handleClose();
    } catch (err) {
      console.error('[HTML5Camera] Capture error:', err);
      setError(texts.captureError);
      setCapturing(false);
    }
  }, [capturing, onCapture]);

  // 切换摄像头
  const handleFlipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  // 关闭
  const handleClose = useCallback(() => {
    setAnimPhase('leaving');
    stopCameraStream(stream);
    setTimeout(() => {
      onClose?.();
    }, 200);
  }, [stream, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      style={{
        opacity: animPhase === 'visible' ? 1 : 0,
        transition: animPhase === 'leaving'
          ? 'opacity 200ms ease-in'
          : 'opacity 300ms ease-out',
      }}
    >
      {/* 视频预览 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* 加载中 */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <Loader className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-3" />
            <p className="text-white text-sm">{texts.loading}</p>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{texts.errorTitle}</h3>
            <p className="text-sm text-gray-600 mb-6">{error}</p>
            <button
              onClick={handleClose}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium active:scale-[0.97] transition-transform"
            >
              {texts.close}
            </button>
          </div>
        </div>
      )}

      {/* 顶部控制栏 */}
      {!loading && !error && (
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-lg">{texts.title}</h2>
            <button
              onClick={handleClose}
              className="w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center active:scale-90 transition-transform"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* 底部操作栏 */}
      {!loading && !error && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent z-10 safe-bottom">
          <div className="flex items-center justify-center gap-6">
            {/* 切换摄像头 */}
            <button
              onClick={handleFlipCamera}
              disabled={capturing}
              className="w-14 h-14 bg-white/20 backdrop-blur rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
            >
              <RotateCcw className="w-6 h-6 text-white" />
            </button>

            {/* 拍照按钮 */}
            <button
              onClick={handleCapture}
              disabled={capturing}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-xl disabled:opacity-50"
              style={{
                boxShadow: '0 0 0 4px rgba(255,255,255,0.3)',
              }}
            >
              {capturing ? (
                <Loader className="w-8 h-8 text-emerald-600 animate-spin" />
              ) : (
                <Camera className="w-8 h-8 text-emerald-600" />
              )}
            </button>

            {/* 占位符，保持对称 */}
            <div className="w-14 h-14" />
          </div>

          {/* 提示文字 */}
          <p className="text-white/80 text-center text-sm mt-4">
            {texts.hint}
          </p>
        </div>
      )}

      {/* 拍照闪光效果 */}
      {capturing && (
        <div className="absolute inset-0 bg-white animate-[flash_0.3s_ease-out]" />
      )}
    </div>
  );
}

/** 多语言文本 */
function getTexts(lang: string) {
  const map: Record<string, {
    title: string;
    loading: string;
    errorTitle: string;
    permissionDenied: string;
    cameraError: string;
    captureError: string;
    close: string;
    hint: string;
  }> = {
    zh: {
      title: '拍照',
      loading: '正在启动摄像头...',
      errorTitle: '无法访问摄像头',
      permissionDenied: '您拒绝了摄像头权限，请在浏览器设置中允许访问摄像头',
      cameraError: '无法启动摄像头，请检查设备是否正常或尝试刷新页面',
      captureError: '拍照失败，请重试',
      close: '关闭',
      hint: '点击中间按钮拍照',
    },
    en: {
      title: 'Take Photo',
      loading: 'Starting camera...',
      errorTitle: 'Camera Access Denied',
      permissionDenied: 'Camera permission denied. Please allow camera access in browser settings.',
      cameraError: 'Failed to start camera. Please check your device or try refreshing the page.',
      captureError: 'Capture failed. Please try again.',
      close: 'Close',
      hint: 'Tap the center button to capture',
    },
    fr: {
      title: 'Prendre une photo',
      loading: 'Démarrage de la caméra...',
      errorTitle: 'Accès caméra refusé',
      permissionDenied: 'Permission de caméra refusée. Veuillez autoriser l\'accès à la caméra dans les paramètres.',
      cameraError: 'Impossible de démarrer la caméra. Vérifiez votre appareil ou actualisez la page.',
      captureError: 'Échec de capture. Réessayez.',
      close: 'Fermer',
      hint: 'Appuyez sur le bouton central pour capturer',
    },
    pt: {
      title: 'Tirar foto',
      loading: 'Iniciando câmera...',
      errorTitle: 'Acesso à câmera negado',
      permissionDenied: 'Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações.',
      cameraError: 'Falha ao iniciar a câmera. Verifique seu dispositivo ou tente atualizar a página.',
      captureError: 'Falha ao capturar. Tente novamente.',
      close: 'Fechar',
      hint: 'Toque no botão central para capturar',
    },
    es: {
      title: 'Tomar foto',
      loading: 'Iniciando cámara...',
      errorTitle: 'Acceso a cámara denegado',
      permissionDenied: 'Permiso de cámara denegado. Por favor, permite el acceso a la cámara en la configuración.',
      cameraError: 'No se pudo iniciar la cámara. Verifica tu dispositivo o intenta actualizar la página.',
      captureError: 'Captura fallida. Inténtalo de nuevo.',
      close: 'Cerrar',
      hint: 'Toca el botón central para capturar',
    },
    ar: {
      title: '\u0627\u0644\u062a\u0642\u0627\u0637 \u0635\u0648\u0631\u0629',
      loading: '\u062c\u0627\u0631\u064a \u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0643\u0627\u0645\u064a\u0631\u0627...',
      errorTitle: '\u062a\u0645 \u0631\u0641\u0636 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0643\u0627\u0645\u064a\u0631\u0627',
      permissionDenied: '\u062a\u0645 \u0631\u0641\u0636 \u0625\u0630\u0646 \u0627\u0644\u0643\u0627\u0645\u064a\u0631\u0627. \u064a\u0631\u062c\u0649 \u0627\u0644\u0633\u0645\u0627\u062d \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0641\u064a \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0645\u062a\u0635\u0641\u062d.',
      cameraError: '\u0641\u0634\u0644 \u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0643\u0627\u0645\u064a\u0631\u0627. \u064a\u0631\u062c\u0649 \u0641\u062d\u0635 \u062c\u0647\u0627\u0632\u0643 \u0623\u0648 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0635\u0641\u062d\u0629.',
      captureError: '\u0641\u0634\u0644 \u0627\u0644\u0627\u0644\u062a\u0642\u0627\u0637. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.',
      close: '\u0625\u063a\u0644\u0627\u0642',
      hint: '\u0627\u0646\u0642\u0631 \u0639\u0644\u0649 \u0627\u0644\u0632\u0631 \u0627\u0644\u0623\u0648\u0633\u0637 \u0644\u0644\u0627\u0644\u062a\u0642\u0627\u0637',
    },
    sw: {
      title: 'Piga picha',
      loading: 'Inaanzisha kamera...',
      errorTitle: 'Ufikiaji wa kamera umekataliwa',
      permissionDenied: 'Ruhusa ya kamera imekataliwa. Tafadhali ruhusu ufikiaji wa kamera katika mipangilio.',
      cameraError: 'Imeshindwa kuanzisha kamera. Tafadhali kagua kifaa chako au jaribu kurefresh ukurasa.',
      captureError: 'Kunasa kumeshindikana. Tafadhali jaribu tena.',
      close: 'Funga',
      hint: 'Gusa kitufe cha katikati kunasa',
    },
    ha: {
      title: 'Dauki hoto',
      loading: 'Ana kunna kyamara...',
      errorTitle: 'An hana izinin kyamara',
      permissionDenied: 'An ki izini kyamara. Da fatan za a ba da izini a saitunan burauzar.',
      cameraError: 'An kasa kunna kyamara. Da fatan a duba na\'urarka ko a sake gwadawa.',
      captureError: 'Daukar hoto ya kasa. Da fatan za a sake gwadawa.',
      close: 'Rufe',
      hint: 'Danna maballin tsakiya don daukar hoto',
    },
    am: {
      title: '\u134e\u1276 \u12a3\u1295\u1233',
      loading: '\u12ab\u121c\u122b \u12a5\u12eb\u1270\u1320\u1240\u1218 \u1290\u12cd...',
      errorTitle: '\u12eb\u121c\u122b \u12cd\u1235\u12f5 \u1270\u12cb\u1208\u120d',
      permissionDenied: '\u12e8\u12ab\u121c\u122b \u134d\u1245\u12f5 \u1270\u12cb\u1208\u120d\u1362 \u12a5\u1263\u12ad\u12ce \u1260\u1265\u122b\u12cd\u12d8\u122d \u1245\u1295\u1265\u122e\u127d \u12cd\u1235\u1325 \u12eb\u1235\u121d\u1271\u1362',
      cameraError: '\u12ab\u121c\u122b \u121b\u1230\u122b\u1275 \u12a0\u120d\u1270\u1233\u12ab\u121d\u1362 \u12a5\u1263\u12ad\u12ce \u121b\u1230\u122a\u12eb\u12cd\u1295 \u12ed\u1218\u122d\u1218\u1229 \u12c8\u12ed\u121d \u1308\u133d\u1295 \u12eb\u1301\u1361',
      captureError: '\u121b\u1235\u1308\u1263\u1275 \u12a0\u120d\u1270\u1233\u12ab\u121d\u1362 \u12a5\u1263\u12ad\u12ce \u12a5\u1295\u12f0\u1308\u1293 \u12ed\u121e\u12ad\u1229\u1362',
      close: '\u12ed\u12d8\u130b',
      hint: '\u1208\u121b\u1235\u1308\u1263\u1275 \u12e8\u121b\u12ab\u12a8\u120d\u129b\u12cd\u1295 \u1261\u1275\u1295 \u12ed\u130b\u1271',
    },
    yo: {
      title: 'Ya aworan',
      loading: 'N bẹrẹ kamẹra...',
      errorTitle: 'Ko le wọle si kamẹra',
      permissionDenied: 'A ko gba laaye kamẹra. Jọwọ gba laaye ni eto aṣàyàn aṣàwákiri.',
      cameraError: 'Ko le bẹrẹ kamẹra. Jọwọ ṣayẹwo ẹrọ rẹ tabi gbiyanju lati tun ojú-iwe ṣe.',
      captureError: 'Gbigba aworan kuna. Jọwọ gbiyanju lẹẹkansi.',
      close: 'Ti',
      hint: 'Tẹ bọtini aringbungbun lati gba aworan',
    },
  };
  return map[lang] || map.en;
}
