import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, ImageIcon, X } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { compressImageFile, compressImageBase64, COMPRESS_PRESETS } from '../utils/imageCompressor';
import { CameraOverlay } from './CameraOverlay';

interface CameraCaptureProps {
  onCapture?: (imageData: string) => void;
  onClose?: () => void;
}

/**
 * CameraCapture — PWA 兼容的图片采集组件
 *
 * 方案 C 升级：优先使用 getUserMedia（CameraOverlay 组件）直接打开相机预览，
 * 绕过国产浏览器 PWA standalone 下 capture="environment" 被拦截的问题。
 * 底部 Action Sheet 仍保留"从相册选择"入口。
 *
 * 流程：
 * 1. 点击"拍照" → 打开 CameraOverlay（getUserMedia 实时预览 + 拍照）
 * 2. 点击"从相册选择" → 触发 <input type="file"> 选择图片
 */
export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const albumInputRef = useRef<HTMLInputElement>(null);
  const { language } = useLanguage();

  const [showCameraOverlay, setShowCameraOverlay] = useState(false);

  // 过渡动画
  const [animPhase, setAnimPhase] = useState<'entering' | 'visible' | 'leaving'>('entering');
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimPhase('visible'));
    return () => cancelAnimationFrame(raf);
  }, []);

  // 多语言
  const texts = getTexts(language);

  const handleClose = useCallback(() => {
    setAnimPhase('leaving');
    setTimeout(() => {
      onClose?.();
    }, 200);
  }, [onClose]);

  // 处理 CameraOverlay 拍照结果
  const handleCameraCapture = useCallback(async (base64: string) => {
    setShowCameraOverlay(false);
    try {
      const compressed = await compressImageBase64(base64, COMPRESS_PRESETS.chat);
      onCapture?.(compressed);
      handleClose();
    } catch {
      onCapture?.(base64);
      handleClose();
    }
  }, [onCapture, handleClose]);

  // 处理相册文件选择
  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 限制文件大小 20MB
    if (file.size > 20 * 1024 * 1024) {
      alert(texts.fileTooLarge);
      return;
    }

    try {
      const compressed = await compressImageFile(file, COMPRESS_PRESETS.chat);
      onCapture?.(compressed);
      handleClose();
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) {
          onCapture?.(result);
          handleClose();
        }
      };
      reader.onerror = () => {
        alert(texts.readError);
      };
      reader.readAsDataURL(file);
    }

    e.target.value = '';
  }, [onCapture, handleClose, texts]);

  // 点击遮罩关闭
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  // 如果正在使用 CameraOverlay，则渲染它
  if (showCameraOverlay) {
    return (
      <CameraOverlay
        onCapture={handleCameraCapture}
        onClose={() => setShowCameraOverlay(false)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={handleBackdropClick}
      style={{
        backgroundColor: animPhase === 'visible' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
        transition: 'background-color 200ms ease-out',
      }}
    >
      {/* Action Sheet */}
      <div
        className="w-full max-w-lg mx-2 mb-2 safe-bottom"
        style={{
          transform: animPhase === 'visible' ? 'translateY(0)' : 'translateY(100%)',
          opacity: animPhase === 'leaving' ? 0 : 1,
          transition: animPhase === 'leaving'
            ? 'transform 200ms ease-in, opacity 150ms ease-in'
            : 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out',
        }}
      >
        {/* 选项组 */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
          {/* 标题 */}
          <div className="px-4 pt-4 pb-2 text-center">
            <p className="text-gray-400" style={{ fontSize: '13px' }}>{texts.title}</p>
          </div>

          {/* 拍照 — 使用 getUserMedia CameraOverlay */}
          <button
            className="w-full flex items-center justify-center gap-3 py-4 active:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 -1px 0 rgba(0,0,0,0.04)' }}
          >
            <Camera className="w-5 h-5 text-emerald-600" />
            <span className="text-emerald-600" style={{ fontSize: '17px' }}>{texts.takePhoto}</span>
          </button>

          {/* 从相册选择 */}
          <button
            className="w-full flex items-center justify-center gap-3 py-4 active:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 -1px 0 rgba(0,0,0,0.04)' }}
            onClick={() => albumInputRef.current?.click()}
          >
            <ImageIcon className="w-5 h-5 text-emerald-600" />
            <span className="text-emerald-600" style={{ fontSize: '17px' }}>{texts.chooseFromAlbum}</span>
          </button>
        </div>

        {/* 取消按钮 */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-xl mt-2">
          <button
            className="w-full py-4 active:bg-gray-50 transition-colors"
            onClick={handleClose}
          >
            <span className="text-gray-600 font-medium" style={{ fontSize: '17px' }}>{texts.cancel}</span>
          </button>
        </div>
      </div>

      {/* 隐藏的 file input — 相册选择 */}
      <input
        ref={albumInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

/** 多语言文本 */
function getTexts(lang: string) {
  const map: Record<string, {
    title: string;
    takePhoto: string;
    chooseFromAlbum: string;
    cancel: string;
    fileTooLarge: string;
    readError: string;
  }> = {
    zh: {
      title: '选择图片来源',
      takePhoto: '拍照',
      chooseFromAlbum: '从相册选择',
      cancel: '取消',
      fileTooLarge: '图片不能超过 20MB',
      readError: '读取图片失败，请重试',
    },
    en: {
      title: 'Choose image source',
      takePhoto: 'Take Photo',
      chooseFromAlbum: 'Choose from Album',
      cancel: 'Cancel',
      fileTooLarge: 'Image must be under 20MB',
      readError: 'Failed to read image. Please try again.',
    },
    fr: {
      title: 'Choisir la source',
      takePhoto: 'Prendre une photo',
      chooseFromAlbum: 'Choisir dans la galerie',
      cancel: 'Annuler',
      fileTooLarge: "L'image ne doit pas depasser 20 Mo",
      readError: "Echec de lecture de l'image. Veuillez reessayer.",
    },
    pt: {
      title: 'Escolher origem',
      takePhoto: 'Tirar foto',
      chooseFromAlbum: 'Escolher do album',
      cancel: 'Cancelar',
      fileTooLarge: 'A imagem deve ter menos de 20MB',
      readError: 'Falha ao ler a imagem. Tente novamente.',
    },
    es: {
      title: 'Elegir origen',
      takePhoto: 'Tomar foto',
      chooseFromAlbum: 'Elegir del album',
      cancel: 'Cancelar',
      fileTooLarge: 'La imagen no debe superar los 20MB',
      readError: 'Error al leer la imagen. Intentelo de nuevo.',
    },
    ar: {
      title: '\u0627\u062e\u062a\u0631 \u0645\u0635\u062f\u0631 \u0627\u0644\u0635\u0648\u0631\u0629',
      takePhoto: '\u0627\u0644\u062a\u0642\u0627\u0637 \u0635\u0648\u0631\u0629',
      chooseFromAlbum: '\u0627\u062e\u062a\u064a\u0627\u0631 \u0645\u0646 \u0627\u0644\u0623\u0644\u0628\u0648\u0645',
      cancel: '\u0625\u0644\u063a\u0627\u0621',
      fileTooLarge: '\u064a\u062c\u0628 \u0623\u0644\u0627 \u062a\u062a\u062c\u0627\u0648\u0632 \u0627\u0644\u0635\u0648\u0631\u0629 20 \u0645\u064a\u063a\u0627\u0628\u0627\u064a\u062a',
      readError: '\u0641\u0634\u0644 \u0641\u064a \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0635\u0648\u0631\u0629. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.',
    },
    sw: {
      title: 'Chagua chanzo cha picha',
      takePhoto: 'Piga picha',
      chooseFromAlbum: 'Chagua kutoka albamu',
      cancel: 'Ghairi',
      fileTooLarge: 'Picha lazima iwe chini ya 20MB',
      readError: 'Imeshindwa kusoma picha. Tafadhali jaribu tena.',
    },
    ha: {
      title: 'Zabi tushen hoto',
      takePhoto: 'Dauki hoto',
      chooseFromAlbum: 'Zaba daga album',
      cancel: 'Soke',
      fileTooLarge: 'Hoton bai kamata ya wuce 20MB ba',
      readError: 'An kasa karanta hoton. Da fatan za a sake gwadawa.',
    },
    am: {
      title: '\u12e8\u121d\u1235\u120d \u121d\u1295\u132d \u12ed\u121d\u1228\u1321',
      takePhoto: '\u134e\u1276 \u12a3\u1295\u1233',
      chooseFromAlbum: '\u12a8\u12a0\u120d\u1260\u121d \u12ed\u121d\u1228\u1321',
      cancel: '\u1230\u122d\u12dd',
      fileTooLarge: '\u121d\u1235\u120d 20MB \u1260\u120b\u12ed \u1218\u1206\u1295 \u12e8\u1208\u1260\u1275\u121d',
      readError: '\u121d\u1235\u120d \u121b\u1295\u1260\u1265 \u12a0\u120d\u1270\u1233\u12ab\u121d\u1362 \u12a5\u1263\u12ad\u12ce \u12ed\u121e\u12ad\u1229\u1362',
    },
    yo: {
      title: 'Yan orisun aworan',
      takePhoto: 'Ya aworan',
      chooseFromAlbum: 'Yan lati awo-orin',
      cancel: 'Fagilee',
      fileTooLarge: 'Aworan gbodo wa ni isale 20MB',
      readError: 'Ko le ka aworan. Jowo tun gbiyanju.',
    },
  };
  return map[lang] || map.en;
}