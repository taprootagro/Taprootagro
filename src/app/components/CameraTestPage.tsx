import { useState } from 'react';
import { Camera, TestTube, CheckCircle, XCircle, Info } from 'lucide-react';
import { SecondaryView } from './SecondaryView';
import { CameraCapture } from './CameraCapture';
import { HTML5CameraCapture } from './HTML5CameraCapture';
import {
  supportsGetUserMedia,
  supportsCaptureAttribute,
  isChineseBrowser,
  getPWADisplayMode,
  getRecommendedCameraStrategy,
} from '../utils/cameraUtils';

interface CameraTestPageProps {
  onClose: () => void;
}

/**
 * CameraTestPage - 相机功能测试页面
 * 
 * 用于测试不同相机方案在当前设备上的兼容性
 */
export function CameraTestPage({ onClose }: CameraTestPageProps) {
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [showHTML5Camera, setShowHTML5Camera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<string[]>([]);

  // 设备能力检测
  const deviceInfo = {
    supportsGetUserMedia: supportsGetUserMedia(),
    supportsCaptureAttr: supportsCaptureAttribute(),
    isChineseBrowser: isChineseBrowser(),
    displayMode: getPWADisplayMode(),
    recommendedStrategy: getRecommendedCameraStrategy(),
    userAgent: navigator.userAgent,
  };

  const handleCapture = (imageData: string, method: string) => {
    setCapturedImage(imageData);
    setTestResults((prev) => [
      ...prev,
      `✅ ${method} - ${new Date().toLocaleTimeString()}`,
    ]);
  };

  const addTestResult = (result: string) => {
    setTestResults((prev) => [...prev, result]);
  };

  return (
    <SecondaryView onClose={onClose} title="相机测试工具" showTitle={true}>
      <div className="flex flex-col h-full overflow-y-auto px-4 py-4 space-y-4">
        {/* 设备信息 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            设备信息
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {deviceInfo.supportsGetUserMedia ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-gray-600">getUserMedia:</span>
              <span className="font-medium text-gray-900">
                {deviceInfo.supportsGetUserMedia ? '支持' : '不支持'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {deviceInfo.supportsCaptureAttr ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-gray-600">capture 属性:</span>
              <span className="font-medium text-gray-900">
                {deviceInfo.supportsCaptureAttr ? '支持' : '不支持'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {deviceInfo.isChineseBrowser ? (
                <XCircle className="w-4 h-4 text-amber-500" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              <span className="text-gray-600">浏览器类型:</span>
              <span className="font-medium text-gray-900">
                {deviceInfo.isChineseBrowser ? '国产浏览器' : '国际浏览器'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600">显示模式:</span>
              <span className="font-medium text-gray-900">
                {deviceInfo.displayMode === 'standalone' ? 'PWA 桌面' : '浏览器'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <TestTube className="w-4 h-4 text-purple-500" />
              <span className="text-gray-600">推荐方案:</span>
              <span className="font-medium text-emerald-600">
                {deviceInfo.recommendedStrategy === 'getUserMedia' && 'HTML5 Camera'}
                {deviceInfo.recommendedStrategy === 'input-capture' && 'Input + Capture'}
                {deviceInfo.recommendedStrategy === 'input-simple' && 'Input Simple ★'}
              </span>
            </div>

            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 break-all">
                User Agent: {deviceInfo.userAgent}
              </p>
            </div>
          </div>
        </div>

        {/* 测试方案 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <TestTube className="w-5 h-5 text-purple-500" />
            测试方案
          </h2>

          <div className="space-y-3">
            {/* 方案1: CameraCapture (Input Simple) */}
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-emerald-900">方案1: Input Simple</h3>
                  <p className="text-xs text-emerald-600 mt-0.5">无 capture 属性，兼容性最好</p>
                </div>
                {deviceInfo.recommendedStrategy === 'input-simple' && (
                  <span className="text-xs bg-emerald-600 text-white px-2 py-1 rounded-full">推荐</span>
                )}
              </div>
              <button
                onClick={() => {
                  setShowCameraCapture(true);
                  addTestResult(`🧪 测试方案1 - ${new Date().toLocaleTimeString()}`);
                }}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-lg active:scale-[0.97] transition-transform text-sm font-medium"
              >
                测试 CameraCapture
              </button>
            </div>

            {/* 方案2: HTML5CameraCapture */}
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-blue-900">方案2: HTML5 Camera</h3>
                  <p className="text-xs text-blue-600 mt-0.5">getUserMedia 直接调用摄像头</p>
                </div>
                {deviceInfo.recommendedStrategy === 'getUserMedia' && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">推荐</span>
                )}
              </div>
              <button
                onClick={() => {
                  setShowHTML5Camera(true);
                  addTestResult(`🧪 测试方案2 - ${new Date().toLocaleTimeString()}`);
                }}
                disabled={!deviceInfo.supportsGetUserMedia}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg active:scale-[0.97] transition-transform text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deviceInfo.supportsGetUserMedia ? '测试 HTML5Camera' : '不支持 getUserMedia'}
              </button>
            </div>

            {/* 方案3: Input + Capture (Legacy) */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">方案3: Input + Capture</h3>
                  <p className="text-xs text-gray-600 mt-0.5">带 capture 属性（传统方案）</p>
                </div>
                {deviceInfo.recommendedStrategy === 'input-capture' && (
                  <span className="text-xs bg-gray-600 text-white px-2 py-1 rounded-full">推荐</span>
                )}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                <p className="text-[11px] text-amber-700">
                  ⚠️ 国产浏览器可能不支持，仅用于测试
                </p>
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const result = ev.target?.result as string;
                      handleCapture(result, '方案3 (Input+Capture)');
                    };
                    reader.readAsDataURL(file);
                  }
                  e.target.value = '';
                  addTestResult(`🧪 测试方案3 - ${new Date().toLocaleTimeString()}`);
                }}
                className="w-full py-2.5 bg-gray-600 text-white rounded-lg text-sm font-medium"
              />
            </div>
          </div>
        </div>

        {/* 测试结果 */}
        {capturedImage && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              拍照成功
            </h2>
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full rounded-lg border border-gray-200"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setCapturedImage(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium active:scale-[0.97] transition-transform"
              >
                清除
              </button>
              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = capturedImage;
                  a.download = `test-${Date.now()}.jpg`;
                  a.click();
                }}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium active:scale-[0.97] transition-transform"
              >
                下载
              </button>
            </div>
          </div>
        )}

        {/* 测试日志 */}
        {testResults.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <TestTube className="w-5 h-5 text-purple-500" />
              测试日志
            </h2>
            <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
              {testResults.map((result, i) => (
                <p key={i} className="text-xs text-gray-600 font-mono mb-1">
                  {result}
                </p>
              ))}
            </div>
            <button
              onClick={() => setTestResults([])}
              className="w-full mt-2 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium active:scale-[0.97] transition-transform"
            >
              清除日志
            </button>
          </div>
        )}

        {/* 建议 */}
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl shadow-sm border border-emerald-200 p-4">
          <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-600" />
            推荐方案
          </h2>
          <div className="space-y-2 text-sm">
            {deviceInfo.isChineseBrowser && (
              <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
                <p className="text-amber-900 font-medium mb-1">⚠️ 检测到国产浏览器</p>
                <p className="text-amber-700 text-xs">
                  强烈推荐使用<strong>方案1 (Input Simple)</strong>，移除 capture 属性可确保最佳兼容性。
                </p>
              </div>
            )}

            {deviceInfo.supportsGetUserMedia && !deviceInfo.isChineseBrowser && (
              <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                <p className="text-blue-900 font-medium mb-1">✨ 支持高级功能</p>
                <p className="text-blue-700 text-xs">
                  您的设备支持 getUserMedia，可以使用<strong>方案2 (HTML5 Camera)</strong>获得更好的拍照体验。
                </p>
              </div>
            )}

            {deviceInfo.displayMode === 'standalone' && (
              <div className="bg-purple-100 border border-purple-300 rounded-lg p-3">
                <p className="text-purple-900 font-medium mb-1">📱 PWA 桌面模式</p>
                <p className="text-purple-700 text-xs">
                  当前在PWA桌面模式运行，某些权限可能受限。如遇问题请尝试在浏览器中打开。
                </p>
              </div>
            )}

            <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-3">
              <p className="text-emerald-900 font-medium mb-1">✅ 最佳实践</p>
              <p className="text-emerald-700 text-xs">
                为确保最佳兼容性，TaprootAgro 默认使用<strong>方案1</strong>。如需更好体验，可在支持的设备上切换到方案2。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 相机组件 */}
      {showCameraCapture && (
        <CameraCapture
          onCapture={(img) => {
            handleCapture(img, '方案1 (CameraCapture)');
            setShowCameraCapture(false);
          }}
          onClose={() => setShowCameraCapture(false)}
        />
      )}

      {showHTML5Camera && (
        <HTML5CameraCapture
          onCapture={(img) => {
            handleCapture(img, '方案2 (HTML5Camera)');
            setShowHTML5Camera(false);
          }}
          onClose={() => setShowHTML5Camera(false)}
        />
      )}
    </SecondaryView>
  );
}
