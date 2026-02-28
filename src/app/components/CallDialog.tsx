import { X, Phone, Video, Mic, MicOff, VideoOff, Volume2 } from "lucide-react";
import { useState } from "react";

interface CallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contactName: string;
  contactAvatar: string;
  callType: "audio" | "video";
  callStatus: "calling" | "connected" | "ended";
}

export function CallDialog({
  isOpen,
  onClose,
  contactName,
  contactAvatar,
  callType,
  callStatus,
}: CallDialogProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-center">
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white"
      >
        <X className="w-5 h-5" />
      </button>

      {/* 通话主体 */}
      <div className="flex flex-col items-center gap-8 px-6">
        {/* 对方头像 */}
        <div className="relative">
          <img
            src={contactAvatar}
            alt={contactName}
            className="w-32 h-32 rounded-full object-cover border-4 border-emerald-500"
          />
          {/* 通话状态指示器 */}
          {callStatus === "calling" && (
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 animate-ping"></div>
          )}
        </div>

        {/* 联系人名称 */}
        <div className="text-center">
          <h2 className="text-white text-2xl font-medium">{contactName}</h2>
          <p className="text-gray-400 text-sm mt-2">
            {callStatus === "calling" && "正在呼叫..."}
            {callStatus === "connected" && `通话中 ${Math.floor(callDuration / 60)}:${(callDuration % 60).toString().padStart(2, '0')}`}
            {callStatus === "ended" && "通话已结束"}
          </p>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center gap-6">
          {/* 麦克风开关 */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isMuted ? "bg-red-500" : "bg-gray-700"
            }`}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          {/* 挂断按钮 */}
          <button
            onClick={onClose}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
          >
            <Phone className="w-7 h-7 text-white rotate-[135deg]" />
          </button>

          {/* 视频开关（仅视频通话显示） */}
          {callType === "video" && (
            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                isVideoOff ? "bg-red-500" : "bg-gray-700"
              }`}
            >
              {isVideoOff ? (
                <VideoOff className="w-6 h-6 text-white" />
              ) : (
                <Video className="w-6 h-6 text-white" />
              )}
            </button>
          )}

          {/* 扬声器 */}
          {callType === "audio" && (
            <button className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-white" />
            </button>
          )}
        </div>

        {/* 提示信息 */}
        <div className="text-center text-gray-500 text-xs mt-4">
          <p>提示：此功能需要集成声网SDK后才能使用</p>
          <p className="mt-1">当前为UI预览模式</p>
        </div>
      </div>
    </div>
  );
}
