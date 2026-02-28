import { useState, useEffect, useRef } from "react";
import { Send, Plus, X, WifiOff, Play, Check, Camera, Phone, Video, Volume2, Mic, ScanLine, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router";
import { useLanguage } from "../hooks/useLanguage";
import { useHomeConfig } from "../hooks/useHomeConfig";
import { CameraCapture } from "./CameraCapture";
import { CallDialog } from "./CallDialog";
import { useAppBadge } from "../hooks/useAppBadge";

interface Message {
  id: string;
  type: "text" | "image" | "voice";
  content: string;
  senderId: string;
  timestamp: number;
  status: "sending" | "sent" | "failed";
  read: boolean;
  duration?: number; // 语音消息时长（秒）
}

export function CommunityPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { config } = useHomeConfig();
  
  const [textMessage, setTextMessage] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showTextInput, setShowTextInput] = useState(false);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 网络状态监控
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // 通话状态
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video">("audio");
  const [callStatus, setCallStatus] = useState<"calling" | "connected" | "ended">("calling");
  
  // 加号菜单状态
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  
  // 点击菜单外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (showPlusMenu) {
        const target = e.target as HTMLElement;
        if (!target.closest('.plus-menu-container')) {
          setShowPlusMenu(false);
        }
      }
    };
    
    if (showPlusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPlusMenu]);
  
  // 当前用户ID
  const currentUserId = "me";

  // 固定单个联系人 - 从配置获取
  const contact = {
    id: "1",
    name: config?.chatContact?.name || "建国",
    avatar: config?.chatContact?.avatar || "https://images.unsplash.com/photo-1614558097757-bf9aa8fb830e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaW1wbGUlMjBtaW5pbWFsaXN0JTIwYXZhdGFyJTIwc2tldGNoJTIwZHJhd2luZ3xlbnwxfHx8fDE3NzA4NTQxODl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    online: true,
  };

  // 聊天消息列表（不使用localStorage，避免缓存问题）
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: "m1",
      type: "image",
      content: "https://images.unsplash.com/photo-1641029874359-780ba37bad59?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3JuJTIwZmllbGQlMjBhZ3JpY3VsdHVyZSUyMGZhcm18ZW58MXx8fHwxNzcwODUzMDM3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      senderId: "me",
      timestamp: Date.now() - 300000,
      status: "sent",
      read: true,
    },
    {
      id: "m2",
      type: "voice",
      content: "",
      duration: 8,
      senderId: "me",
      timestamp: Date.now() - 240000,
      status: "sent",
      read: true,
    },
    {
      id: "m3",
      type: "voice",
      content: "",
      duration: 6,
      senderId: "1",
      timestamp: Date.now() - 180000,
      status: "sent",
      read: false,
    },
    {
      id: "m4",
      type: "text",
      content: "推荐使用TaprootAgro的Atrazine+nicosulfuron混合方案，suggest TaprootAgro's mix plan",
      senderId: "1",
      timestamp: Date.now() - 120000,
      status: "sent",
      read: false,
    },
  ]);

  // 使用App Badge Hook管理应用图标徽章
  useAppBadge(0);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // 开始录音
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    
    const timer = setInterval(() => {
      setRecordingTime((prev) => {
        if (prev >= 59) {
          stopRecording();
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
    
    recordingTimerRef.current = timer;
  };

  // 停止录音并发送
  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (isRecording && recordingTime > 0) {
      // 发送语音消息
      sendVoiceMessage(recordingTime);
    }
    
    setIsRecording(false);
    setRecordingTime(0);
  };

  // 发送文字消息
  const sendTextMessage = () => {
    if (textMessage.trim()) {
      const newMessage: Message = {
        id: `m${Date.now()}`,
        type: "text",
        content: textMessage.trim(),
        senderId: currentUserId,
        timestamp: Date.now(),
        status: "sent",
        read: false,
      };
      
      setChatMessages([...chatMessages, newMessage]);
      setTextMessage("");
      setShowTextInput(false);
    }
  };

  // 发送语音消息
  const sendVoiceMessage = (duration: number) => {
    const newMessage: Message = {
      id: `m${Date.now()}`,
      type: "voice",
      content: "",
      duration,
      senderId: currentUserId,
      timestamp: Date.now(),
      status: "sent",
      read: false,
    };
    
    setChatMessages([...chatMessages, newMessage]);
  };

  // 发送图片消息
  const sendImageMessage = (imageData: string) => {
    const newMessage: Message = {
      id: `m${Date.now()}`,
      type: "image",
      content: imageData,
      senderId: currentUserId,
      timestamp: Date.now(),
      status: "sent",
      read: false,
    };
    
    setChatMessages([...chatMessages, newMessage]);
  };

  // 处理拍照
  const handleCapture = (imageData: string) => {
    sendImageMessage(imageData);
    setShowCamera(false);
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // 渲染消息内容
  const renderMessageContent = (msg: Message) => {
    const isSent = msg.senderId === currentUserId;
    const avatar = isSent ? "https://images.unsplash.com/photo-1642919854816-98575cbaefa8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaW1wbGUlMjBsZWFmJTIwc2tldGNoJTIwbWluaW1hbCUyMGRyYXdpbmd8ZW58MXx8fHwxNzcwODU0NDU2fDA&ixlib=rb-4.1.0&q=80&w=1080" : contact.avatar;

    return (
      <div key={msg.id} className="flex flex-col gap-1">
        {/* 消息行：头像 + 内容 */}
        <div className={`flex gap-2 items-start ${isSent ? "flex-row-reverse" : "flex-row"}`}>
          {/* 头像 - 增强版 */}
          <div className="flex-shrink-0 pt-0.5">
            <img
              src={avatar}
              alt="Avatar"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-100 shadow-sm"
            />
          </div>

          {/* 消息内容容器 */}
          <div className="flex flex-col gap-1 max-w-[70%]">
            {msg.type === "voice" && (
              <div
                className={`min-w-[100px] px-3 py-2 rounded-full flex items-center gap-2 shadow-md transition-all active:scale-95 ${
                  isSent
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white flex-row-reverse"
                    : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 flex-row"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isSent ? "bg-white/20" : "bg-white"
                }`}>
                  <Play className="w-3 h-3 flex-shrink-0" fill="currentColor" />
                </div>
                <div className="flex-1 h-5 flex items-center">
                  {/* 语音波形线 - 美化版 */}
                  <div className="flex items-center gap-0.5 h-full">
                    <div className={`w-0.5 h-1.5 rounded-full ${isSent ? "bg-white/80" : "bg-gray-500"}`}></div>
                    <div className={`w-0.5 h-3 rounded-full ${isSent ? "bg-white" : "bg-gray-600"}`}></div>
                    <div className={`w-0.5 h-2 rounded-full ${isSent ? "bg-white/80" : "bg-gray-500"}`}></div>
                    <div className={`w-0.5 h-3.5 rounded-full ${isSent ? "bg-white" : "bg-gray-600"}`}></div>
                    <div className={`w-0.5 h-1.5 rounded-full ${isSent ? "bg-white/80" : "bg-gray-500"}`}></div>
                    <div className={`w-0.5 h-3 rounded-full ${isSent ? "bg-white" : "bg-gray-600"}`}></div>
                    <div className={`w-0.5 h-2 rounded-full ${isSent ? "bg-white/80" : "bg-gray-500"}`}></div>
                  </div>
                </div>
                <span className="text-[10px] font-semibold flex-shrink-0">{msg.duration}\"</span>
              </div>
            )}

            {msg.type === "text" && (
              <div
                className={`px-4 py-2 rounded-2xl shadow-md ${
                  isSent
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                    : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800"
                }`}
              >
                <p className="text-sm break-words leading-relaxed">{msg.content}</p>
              </div>
            )}

            {msg.type === "image" && (
              <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-lg ring-1 ring-gray-200">
                <img
                  src={msg.content}
                  alt="Image"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            {/* 消息状态和时间 */}
            {isSent && (
              <div className={`flex items-center gap-1.5 ${isSent ? "justify-end" : "justify-start"}`}>
                <span className="text-[10px] text-gray-400 font-medium">{formatTime(msg.timestamp)}</span>
                {/* 已读/未读状态双勾 */}
                <div className="flex items-center">
                  <Check className={`w-3 h-3 ${msg.read ? "text-emerald-500" : "text-gray-400"}`} strokeWidth={3} />
                  <Check className={`w-3 h-3 -ml-1.5 ${msg.read ? "text-emerald-500" : "text-gray-400"}`} strokeWidth={3} />
                </div>
              </div>
            )}
            
            {/* 对方消息显示时间 */}
            {!isSent && (
              <div className="flex items-center gap-1 justify-start">
                <span className="text-[10px] text-gray-400 font-medium">{formatTime(msg.timestamp)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-emerald-50 to-white">
      {/* 相机捕获界面 */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* 通话对话框 */}
      {showCallDialog && (
        <CallDialog
          isOpen={showCallDialog}
          onClose={() => setShowCallDialog(false)}
          contactName={contact.name}
          contactAvatar={contact.avatar}
          callType={callType}
          callStatus={callStatus}
        />
      )}

      {/* 网络状态提示 */}
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs py-2 px-3 flex items-center justify-center gap-2 z-40 shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span className="font-medium">网络连接已断开</span>
        </div>
      )}

      {/* 顶部绿色区域 - 美化版 */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 pt-3 pb-4 flex-shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          {/* 左侧：联系人头像 - 增强版 */}
          <button className="flex-shrink-0 active:opacity-80 transition-all active:scale-95">
            <div className="relative">
              <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow-xl bg-white">
                <img
                  src={contact.avatar}
                  alt={contact.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* 在线状态 - 带动画 */}
              {contact.online && (
                <div className="absolute -bottom-0.5 -right-0.5">
                  <div className="relative">
                    <div className="w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-md"></div>
                    {/* 呼吸动画 */}
                    <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full animate-ping opacity-50"></div>
                  </div>
                </div>
              )}
            </div>
          </button>

          {/* 中间：联系人名字和门店信息（上下排列） */}
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-lg mb-0.5 drop-shadow-sm">{contact.name}</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white/80"></div>
              <p className="text-white/90 text-xs font-medium">{config?.chatContact?.subtitle || "TaprootAgro授权店"}</p>
            </div>
          </div>

          {/* 右侧：扫一扫图标 - 美化版 */}
          <div className="flex-shrink-0">
            <button className="w-10 h-10 flex items-center justify-center active:scale-95 transition-all rounded-xl active:bg-white/20">
              <ScanLine className="w-5 h-5 text-white" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* 主天区域 - 美化版白色圆角背景 */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 flex flex-col overflow-hidden min-h-0 shadow-2xl">
        {/* 聊天消息区域 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 min-h-0">
          {chatMessages.map((msg) => renderMessageContent(msg))}
          <div ref={messagesEndRef} />
        </div>

        {/* 底部输入栏 - 美化版 */}
        <div className="px-4 py-3 bg-gradient-to-t from-gray-50 to-white flex-shrink-0 border-t border-gray-100 relative">
          {showTextInput ? (
            // 文字输入模式
            <div className="flex items-center gap-2">
              {/* 返回按钮 */}
              <button 
                onClick={() => setShowTextInput(false)}
                className="p-2 active:scale-95 rounded-full transition-all bg-gray-100 active:bg-gray-200 flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-600" strokeWidth={2.5} />
              </button>

              {/* 文字输入框 - 美化版 */}
              <input
                type="text"
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    sendTextMessage();
                  }
                }}
                placeholder={t.community.typeMessage || "输入消息..."}
                className="flex-1 min-w-0 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all shadow-sm"
                autoFocus
              />

              {/* 发送按钮 - 美化版 */}
              <button
                onClick={sendTextMessage}
                disabled={!textMessage.trim()}
                className={`rounded-2xl px-4 py-2.5 transition-all flex-shrink-0 flex items-center justify-center shadow-lg active:scale-95 ${
                  textMessage.trim()
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 active:from-emerald-600 active:to-emerald-700'
                    : 'bg-gray-300'
                }`}
              >
                <Send className="w-4 h-4 text-white" strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            // 语音输入模式
            <div className="flex items-center gap-2">
              {/* 加号菜单按钮（左下角）- 美化版 */}
              <div className="relative flex-shrink-0 plus-menu-container">
                <button 
                  onClick={() => setShowPlusMenu(!showPlusMenu)}
                  className={`w-10 h-10 flex items-center justify-center active:scale-95 rounded-2xl transition-all shadow-lg ${
                    showPlusMenu ? 'bg-gradient-to-br from-emerald-400 to-emerald-500' : 'bg-gradient-to-br from-gray-100 to-gray-200'
                  }`}
                >
                  <Plus className={`w-5 h-5 transition-transform ${
                    showPlusMenu ? 'rotate-45 text-white' : 'text-gray-600'
                  }`} strokeWidth={2.5} />
                </button>

                {/* 加号弹出菜单 - 美化版 */}
                {showPlusMenu && (
                  <div className="absolute bottom-full left-0 mb-3 bg-white rounded-3xl shadow-2xl border border-gray-100 py-3 z-20 w-[70px] backdrop-blur-xl">
                    {/* 打字选项 */}
                    <button
                      onClick={() => {
                        setShowTextInput(true);
                        setShowPlusMenu(false);
                      }}
                      className="w-full px-3 py-3 flex items-center justify-center active:bg-gray-50 transition-colors"
                    >
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                        <MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                    </button>

                    {/* 隔线 */}
                    <div className="h-px bg-gray-100 my-2 mx-3" />

                    {/* 电话选项 */}
                    <button
                      onClick={() => {
                        setCallType("audio");
                        setCallStatus("calling");
                        setShowCallDialog(true);
                        setShowPlusMenu(false);
                      }}
                      className="w-full px-3 py-3 flex items-center justify-center active:bg-gray-50 transition-colors"
                    >
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                        <Phone className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                    </button>

                    {/* 分隔线 */}
                    <div className="h-px bg-gray-100 my-2 mx-3" />

                    {/* 视频选项 */}
                    <button
                      onClick={() => {
                        setCallType("video");
                        setCallStatus("calling");
                        setShowCallDialog(true);
                        setShowPlusMenu(false);
                      }}
                      className="w-full px-3 py-3 flex items-center justify-center active:bg-gray-50 transition-colors"
                    >
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                        <Video className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                    </button>
                    
                    {/* 底部小三角 */}
                    <div className="absolute -bottom-2 left-5 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white"></div>
                  </div>
                )}
              </div>

              {/* 语音输入按钮（长条）- 美化版 */}
              <button
                className={`flex-1 min-w-0 text-white rounded-2xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] ${
                  isRecording 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 active:from-red-600 active:to-red-700' 
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 active:from-emerald-600 active:to-emerald-700'
                }`}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
              >
                {isRecording ? (
                  <>
                    <Volume2 className="w-4 h-4 flex-shrink-0 animate-pulse" strokeWidth={2.5} />
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {recordingTime}\" / 60\"
                    </span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {t.community.holdToTalk}
                    </span>
                  </>
                )}
              </button>

              {/* 拍照按钮 - 美化版 */}
              <button
                className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-emerald-600 active:from-emerald-600 active:to-emerald-700 rounded-2xl transition-all shadow-lg active:scale-95 flex-shrink-0"
                onClick={() => setShowCamera(true)}
              >
                <Camera className="w-5 h-5 text-white" strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 默认导出用于懒加载
export default CommunityPage;