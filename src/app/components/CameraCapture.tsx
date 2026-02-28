import { useRef, useState, useEffect } from 'react';
import { Camera, X } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

interface CameraCaptureProps {
  onCapture?: (imageData: string) => void;
  onClose?: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const { t, language } = useLanguage();
  
  // 相机翻译备份（如果useLanguage中没有camera字段）
  const cameraTranslations: Record<string, any> = {
    en: {
      title: 'Scan',
      cameraError: 'Camera Error',
      cameraErrorMessage: 'Unable to access camera. Please check your permissions.',
      close: 'Close',
    },
    zh: {
      title: '扫一扫',
      cameraError: '相机错误',
      cameraErrorMessage: '无法访问相机，请检查权限设置',
      close: '关闭',
    },
  };
  
  // 获取当前语言的相机翻译，如果没有则使用备份
  const getCameraText = (key: string) => {
    if (t.camera && (t.camera as any)[key]) {
      return (t.camera as any)[key];
    }
    const fallback = cameraTranslations[language] || cameraTranslations['en'];
    return fallback[key] || cameraTranslations['en'][key];
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // 使用后置摄像头
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
      }
    } catch (err) {
      console.error('无法访问相机:', err);
      setError(getCameraText('cameraErrorMessage'));
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        
        if (onCapture) {
          onCapture(imageData);
        }
        
        handleClose();
      }
    }
  };

  const handleClose = () => {
    stopCamera();
    if (onClose) {
      onClose();
    }
  };

  // 组件挂载时启动相机
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* 顶部控制栏 */}
      <div className="flex justify-between items-center p-4 bg-black/50">
        <h2 className="text-white font-medium text-lg">{getCameraText('title')}</h2>
        <button
          onClick={handleClose}
          className="text-white p-2 active:scale-95 transition-transform rounded-full hover:bg-white/10"
          aria-label={t.common?.close || '关闭'}
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* 相机预览 */}
      <div className="flex-1 relative flex items-center justify-center">
        {error ? (
          <div className="text-white text-center p-6 max-w-sm">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{getCameraText('cameraError')}</h3>
            <p className="mb-6 text-white/80">{error}</p>
            <button
              onClick={handleClose}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-full transition-colors font-medium shadow-lg"
            >
              {getCameraText('close')}
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* 扫描框 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-emerald-500 rounded-2xl relative">
                {/* 四个角的装饰 */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl"></div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 底部拍照按钮 */}
      {!error && (
        <div className="p-6 bg-black/50 flex justify-center">
          <button
            onClick={captureImage}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-lg"
          >
            <Camera className="w-8 h-8 text-emerald-600" />
          </button>
        </div>
      )}
    </div>
  );
}