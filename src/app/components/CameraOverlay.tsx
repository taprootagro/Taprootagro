import { useRef, useState, useEffect } from "react";
import { X, Camera, RotateCcw, Loader, AlertTriangle } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

interface CameraOverlayProps {
  onCapture: (imageDataUrl: string) => void;
  onClose: () => void;
  facingMode?: 'user' | 'environment';
  title?: string;
}

/**
 * CameraOverlay - 通用HTML5相机组件
 * 
 * 使用 getUserMedia API 直接调用系统相机
 * - 实时预览画面
 * - 支持前置/后置切换
 * - 绕过所有文件选择器兼容性问题
 * - 适用于所有国产手机PWA模式
 */
export function CameraOverlay({ 
  onCapture, 
  onClose, 
  facingMode = 'environment',
  title 
}: CameraOverlayProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>(facingMode);

  // 启动相机
  const startCamera = async (facing: 'user' | 'environment') => {
    setLoading(true);
    setError("");

    try {
      // 停止旧的流
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // 请求相机权限
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(newStream);

      // 绑定到video元素
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      setLoading(false);
    } catch (err) {
      console.error('[CameraOverlay] Failed to start camera:', err);
      
      // 友好的错误提示
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError(t.camera?.permissionDenied || '相机权限被拒绝');
        } else if (err.name === 'NotFoundError') {
          setError(t.camera?.notFound || '未找到相机设备');
        } else {
          setError(t.camera?.error || '无法启动相机');
        }
      } else {
        setError(t.camera?.error || '无法启动相机');
      }
      
      setLoading(false);
    }
  };

  // 组件挂载时启动相机
  useEffect(() => {
    startCamera(currentFacingMode);

    // 组件卸载时停止相机
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentFacingMode]);

  // 拍照
  const handleCapture = () => {
    if (!videoRef.current) return;

    try {
      // 创建canvas捕获当前帧
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // 绘制视频帧
      ctx.drawImage(videoRef.current, 0, 0);

      // 转换为base64
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.92);

      // 停止相机
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // 回调
      onCapture(imageDataUrl);
    } catch (err) {
      console.error('[CameraOverlay] Failed to capture:', err);
      setError(t.camera?.captureFailed || '拍照失败');
    }
  };

  // 切换前后摄像头
  const handleFlipCamera = () => {
    setCurrentFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // 关闭相机
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* 顶部栏 */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4 flex items-center justify-between">
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h1 className="text-white font-medium text-lg">
          {title || t.camera?.title || '拍照'}
        </h1>

        <button
          onClick={handleFlipCamera}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          disabled={loading}
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* 相机预览 */}
      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center">
              <Loader className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-3" />
              <p className="text-white/60">{t.camera?.starting || '正在启动相机...'}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center px-6">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-white mb-2">{error}</p>
              <button
                onClick={() => startCamera(currentFacingMode)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                {t.camera?.retry || '重试'}
              </button>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      </div>

      {/* 底部拍照按钮 */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/60 to-transparent p-8 flex items-center justify-center">
        <button
          onClick={handleCapture}
          disabled={loading || !!error}
          className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-16 h-16 rounded-full border-4 border-black flex items-center justify-center">
            <Camera className="w-8 h-8 text-black" />
          </div>
        </button>
      </div>
    </div>
  );
}
