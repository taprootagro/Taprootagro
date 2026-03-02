import { useState, useEffect, useRef } from "react";
import { Send, Plus, X, WifiOff, Play, Check, Camera, Phone, Video, Volume2, Mic, ScanLine, MessageSquare, AlertCircle, ShieldCheck, ShieldX, LogIn } from "lucide-react";
import { useNavigate } from "react-router";
import { useLanguage } from "../hooks/useLanguage";
import { useHomeConfig } from "../hooks/useHomeConfig";
import { CameraCapture } from "./CameraCapture";
import { QRScannerCapture } from "./QRScannerCapture";
import { CallDialog } from "./CallDialog";
import { useAppBadge } from "../hooks/useAppBadge";
import { chatService, type ChatMessage } from "../services/ChatProxyService";
import { chatUserService } from "../services/ChatUserService";
import { isUserLoggedIn, getUserId } from "../utils/auth";

// Re-use ChatMessage type from service, alias for backward compatibility
type Message = ChatMessage;

// ============================================================================
// Login Gate Wrapper — separates login check from chat hooks
// ============================================================================
export function CommunityPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const loggedIn = isUserLoggedIn();
  const userId = getUserId();

  if (!loggedIn || !userId) {
    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-emerald-50 to-white items-center justify-center px-8">
        <div className="w-full max-w-xs text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-gray-800 mb-2" style={{ fontSize: 'clamp(16px, 4.5vw, 20px)' }}>
              {t.community.loginRequired || "Login Required"}
            </h2>
            <p className="text-gray-500" style={{ fontSize: 'clamp(12px, 3.2vw, 14px)' }}>
              {t.community.loginToChat || "Please log in to start chatting with your merchant"}
            </p>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl py-3 font-medium shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
          >
            <LogIn className="w-4 h-4" />
            {t.community.goToLogin || "Go to Login"}
          </button>
        </div>
      </div>
    );
  }

  return <CommunityChat />;
}

// ============================================================================
// Chat UI — only rendered after login (safe to use hooks)
// ============================================================================
function CommunityChat() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { config, saveConfig } = useHomeConfig();

  // 聊天页状态栏颜色与顶部绿色一致
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute('content') || '#059669';
    meta?.setAttribute('content', '#059669');
    return () => { meta?.setAttribute('content', prev); };
  }, []);
  
  const [textMessage, setTextMessage] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<{
    status: "verifying" | "verified" | "rejected";
    merchantData?: any;
    sourceDomain?: string;
    rejectReason?: string;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showTextInput, setShowTextInput] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Backend proxy mode indicator
  const [proxyMode, setProxyMode] = useState<"backend" | "mock">("mock");
  const [providerName, setProviderName] = useState("");
  
  // 网络状态监控
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // 当前用户ID — 从 ChatUserService 取已绑定登录时生成的数字ID）
  const currentUserId = chatUserService.getUserId();

  // Initialize chatService and listen for incoming messages
  useEffect(() => {
    chatService.setUserId(currentUserId);
    setProxyMode(chatService.mode);
    setProviderName(chatService.providerInfo.name);

    // Determine the target user (merchant) IM ID from config
    const targetImUserId = config?.chatContact?.imUserId || "";
    chatService.setTargetUserId(targetImUserId);

    // 聊天室ID来自商家二维码扫码绑定，固定保存在配置中
    const channelId = config?.chatContact?.channelId || "";

    // 没有 channelId 说明还没扫码绑定商家，不初始化聊天
    if (!channelId || channelId === "your-channel-id") {
      console.log("[Community] No channelId bound yet — waiting for QR scan");
      return;
    }

    console.log(`[Community] Channel: ${channelId} (me: ${currentUserId} → merchant: ${targetImUserId})`);

    // Initialize: register user → join channel → start polling (in correct order)
    const init = async () => {
      // Step 1: Register user on IM provider
      const regResult = await chatUserService.registerOnProvider();
      if (regResult.success) {
        console.log(`[Community] User ${currentUserId} registered on ${chatService.provider}`);
      } else {
        console.warn(`[Community] User registration issue: ${regResult.error}`);
      }

      // Step 2: Join channel (uses channelId from QR code, obtains IM token)
      try {
        await chatService.joinChannel(channelId);
        console.log(`[Community] Joined channel: ${channelId}`);
      } catch (err) {
        console.warn(`[Community] joinChannel failed (will poll with channel name anyway):`, err);
      }

      // Step 3: Start polling for incoming messages
      chatService.startPolling();
    };
    init();

    // Mark initial demo messages as "seen" to prevent duplicates from polling
    chatService.markSeen(["m1", "m2", "m3", "m4"]);

    // Listen for incoming messages (from polling or mock receiver)
    const unsubscribe = chatService.onMessage((incomingMsg) => {
      setChatMessages((prev) => [...prev, incomingMsg]);
    });

    // Cleanup: stop polling and unsubscribe listener on unmount
    return () => {
      chatService.stopPolling();
      unsubscribe();
    };
  }, [currentUserId, config?.chatContact?.channelId, config?.chatContact?.imUserId]);
  
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

  // 固定单个联系人 - 从配置获取
  const contact = {
    id: config?.chatContact?.imUserId || "1",
    name: config?.chatContact?.name || "建国",
    avatar: config?.chatContact?.avatar || "https://images.unsplash.com/photo-1614558097757-bf9aa8fb830e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaW1wbGUlMjBtaW5pbWFsaXN0JTIwYXZhdGFyJTIwc2tldGNoJTIwZHJhd2luZ3xlbnwxfHx8fDE3NzA4NTQxODl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    imUserId: config?.chatContact?.imUserId || "",
    imProvider: config?.chatContact?.imProvider || "aliyun-im",
    online: true,
  };

  // 聊天消息列表
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: "m1",
      channelName: "default-channel",
      type: "image",
      content: "https://images.unsplash.com/photo-1641029874359-780ba37bad59?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3JuJTIwZmllbGQlMjBhZ3JpY3VsdHVyZSUyMGZhcm18ZW58MXx8fHwxNzcwODUzMDM3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      senderId: currentUserId,
      timestamp: Date.now() - 300000,
      status: "sent",
      read: true,
    },
    {
      id: "m2",
      channelName: "default-channel",
      type: "voice",
      content: "",
      duration: 8,
      senderId: currentUserId,
      timestamp: Date.now() - 240000,
      status: "sent",
      read: true,
    },
    {
      id: "m3",
      channelName: "default-channel",
      type: "voice",
      content: "",
      duration: 6,
      senderId: contact.id,
      timestamp: Date.now() - 180000,
      status: "sent",
      read: false,
    },
    {
      id: "m4",
      channelName: "default-channel",
      type: "text",
      content: "推荐使用TaprootAgro的Atrazine+nicosulfuron混合方案，suggest TaprootAgro's mix plan",
      senderId: contact.id,
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
    isRecordingRef.current = true;
    setRecordingTime(0);
    
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 1;
      if (elapsed >= 60) {
        // 使用 ref 而不是闭包读取 isRecording 状态，避免过期值
        clearInterval(timer);
        recordingTimerRef.current = null;
        if (isRecordingRef.current) {
          isRecordingRef.current = false;
          setIsRecording(false);
          setRecordingTime(0);
          sendVoiceMessage(60);
        }
        return;
      }
      setRecordingTime(elapsed);
    }, 1000);
    
    recordingTimerRef.current = timer;
  };

  // 停止录音并发送
  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (isRecordingRef.current && recordingTime > 0) {
      sendVoiceMessage(recordingTime);
    }
    
    isRecordingRef.current = false;
    setIsRecording(false);
    setRecordingTime(0);
  };

  // 发送文字消息 — 传入 contact.imUserId 作为 targetUserId
  const sendTextMessage = async () => {
    if (textMessage.trim() && !isSending) {
      const content = textMessage.trim();
      setTextMessage("");
      setShowTextInput(false);
      setIsSending(true);

      const optimisticMsg: Message = {
        id: `m${Date.now()}_opt`,
        channelName: "default-channel",
        senderId: currentUserId,
        content,
        type: "text",
        timestamp: Date.now(),
        status: "sending",
        read: false,
      };
      setChatMessages((prev) => [...prev, optimisticMsg]);

      try {
        const sentMsg = await chatService.sendMessage(content, "text", undefined, contact.imUserId || contact.id);
        setChatMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? { ...sentMsg } : m))
        );
      } catch {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMsg.id ? { ...m, status: "failed" as const } : m
          )
        );
      } finally {
        setIsSending(false);
      }
    }
  };

  // 发送语音消息
  const sendVoiceMessage = async (duration: number) => {
    const optimisticMsg: Message = {
      id: `m${Date.now()}_opt`,
      channelName: "default-channel",
      senderId: currentUserId,
      content: "",
      type: "voice",
      duration,
      timestamp: Date.now(),
      status: "sending",
      read: false,
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      const sentMsg = await chatService.sendMessage("", "voice", duration, contact.imUserId || contact.id);
      setChatMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? { ...sentMsg } : m))
      );
    } catch {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticMsg.id ? { ...m, status: "failed" as const } : m
        )
      );
    }
  };

  // 发送图片消息
  const sendImageMessage = async (imageData: string) => {
    const optimisticMsg: Message = {
      id: `m${Date.now()}_opt`,
      channelName: "default-channel",
      senderId: currentUserId,
      content: imageData,
      type: "image",
      timestamp: Date.now(),
      status: "sending",
      read: false,
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      const sentMsg = await chatService.sendMessage(imageData, "image", undefined, contact.imUserId || contact.id);
      setChatMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? { ...sentMsg } : m))
      );
    } catch {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticMsg.id ? { ...m, status: "failed" as const } : m
        )
      );
    }
  };

  // 处理拍照
  const handleCapture = (imageData: string) => {
    sendImageMessage(imageData);
    setShowCamera(false);
  };

  // ============================================================================
  // 扫一扫 → 域名验证 → 绑定商家联系人
  // ============================================================================
  const handleQRScanResult = (qrText: string) => {
    setShowScanner(false);
    processScanResult(qrText);
  };

  const processScanResult = (qrText: string) => {
    setScanResult({ status: "verifying" });

    setTimeout(() => {
      try {
        const url = new URL(qrText);
        const sourceDomain = url.hostname.replace(/^www\./, "");

        const whitelist = (config?.chatContact?.verifiedDomains || [])
          .map((d: string) => d.toLowerCase().replace(/^www\./, "").trim())
          .filter(Boolean);

        if (whitelist.length === 0) {
          setScanResult({
            status: "rejected",
            sourceDomain,
            rejectReason: "未配置域名白名单，无法验证商家身份 / No verified domains configured",
          });
          return;
        }

        const isDomainVerified = whitelist.some((allowed: string) =>
          sourceDomain === allowed || sourceDomain.endsWith("." + allowed)
        );

        if (!isDomainVerified) {
          setScanResult({
            status: "rejected",
            sourceDomain,
            rejectReason: `域名 "${sourceDomain}" 不在白名单中 / Domain not in whitelist`,
          });
          return;
        }

        const params = url.searchParams;
        const merchantData = {
          name: params.get("name") || "",
          avatar: params.get("avatar") || "",
          subtitle: params.get("subtitle") || "",
          imUserId: params.get("imUserId") || "",
          channelId: params.get("channelId") || "",
          imProvider: params.get("imProvider") || "aliyun-im",
          phone: params.get("phone") || "",
          storeId: params.get("storeId") || "",
        };

        if (!merchantData.name || !merchantData.imUserId || !merchantData.channelId) {
          setScanResult({
            status: "rejected",
            sourceDomain,
            rejectReason: "二维码缺少必要信息（商家名称、IM用户ID或聊天室ID） / Missing required fields (name, imUserId, or channelId)",
          });
          return;
        }

        setScanResult({
          status: "verified",
          merchantData,
          sourceDomain,
        });
      } catch {
        setScanResult({
          status: "rejected",
          rejectReason: "无法解析二维码内容，格式无效 / Invalid QR code format",
        });
      }
    }, 800);
  };

  // 确认绑定商家
  const confirmBindMerchant = () => {
    if (!scanResult?.merchantData || !config) return;

    const updatedContact = {
      ...config.chatContact,
      ...scanResult.merchantData,
      verifiedDomains: config.chatContact.verifiedDomains,
      boundAt: Date.now(),
      boundFrom: scanResult.sourceDomain || "",
    };

    saveConfig({
      ...config,
      chatContact: updatedContact,
    });

    console.log("[Scan] Merchant bound:", updatedContact);
    setScanResult(null);
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
        <div className={`flex gap-2 items-start ${isSent ? "flex-row-reverse" : "flex-row"}`}>
          <div className="flex-shrink-0 pt-0.5">
            <img src={avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-100 shadow-sm" />
          </div>
          <div className="flex flex-col gap-1 max-w-[70%]">
            {msg.type === "voice" && (
              <div className={`min-w-[100px] px-3 py-2 rounded-full flex items-center gap-2 shadow-md transition-all active:scale-95 ${isSent ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white flex-row-reverse" : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 flex-row"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isSent ? "bg-white/20" : "bg-white"}`}>
                  <Play className="w-3 h-3 flex-shrink-0" fill="currentColor" />
                </div>
                <div className="flex-1 h-5 flex items-center">
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
                <span className="text-[10px] font-semibold flex-shrink-0">{msg.duration}"</span>
              </div>
            )}
            {msg.type === "text" && (
              <div className={`px-4 py-2 rounded-2xl shadow-md ${isSent ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white" : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800"}`}>
                <p className="text-sm break-words leading-relaxed">{msg.content}</p>
              </div>
            )}
            {msg.type === "image" && (
              <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-lg ring-1 ring-gray-200">
                <img src={msg.content} alt="Image" className="w-full h-full object-cover" />
              </div>
            )}
            {isSent && (
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-[10px] text-gray-400 font-medium">{formatTime(msg.timestamp)}</span>
                {msg.status === "sending" && <span className="text-[10px] text-amber-500 font-medium animate-pulse">...</span>}
                {msg.status === "failed" && <AlertCircle className="w-3 h-3 text-red-500" />}
                {msg.status === "sent" && (
                  <div className="flex items-center">
                    <Check className={`w-3 h-3 ${msg.read ? "text-emerald-500" : "text-gray-400"}`} strokeWidth={3} />
                    <Check className={`w-3 h-3 -ml-1.5 ${msg.read ? "text-emerald-500" : "text-gray-400"}`} strokeWidth={3} />
                  </div>
                )}
              </div>
            )}
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
      {showCamera && <CameraCapture onCapture={handleCapture} onClose={() => setShowCamera(false)} />}
      {showScanner && <QRScannerCapture onScan={handleQRScanResult} onClose={() => setShowScanner(false)} />}

      {/* 扫码结果弹窗 */}
      {scanResult && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            {scanResult.status === "verifying" && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center animate-pulse">
                  <ScanLine className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-gray-700 font-medium">正在验证域名...</p>
                <p className="text-xs text-gray-400 mt-1">Verifying domain...</p>
              </div>
            )}
            {scanResult.status === "verified" && scanResult.merchantData && (
              <div>
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-center">
                  <div className="w-14 h-14 mx-auto mb-2 bg-white/20 rounded-full flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-white font-semibold">域名验证通过</p>
                  <p className="text-white/70 text-xs mt-0.5">Domain Verified: {scanResult.sourceDomain}</p>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    {scanResult.merchantData.avatar && (
                      <img src={scanResult.merchantData.avatar} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-100" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{scanResult.merchantData.name}</p>
                      <p className="text-xs text-gray-500 truncate">{scanResult.merchantData.subtitle}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Channel ID</span><span className="text-gray-800 font-mono">{scanResult.merchantData.channelId}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">IM User ID</span><span className="text-gray-800 font-mono">{scanResult.merchantData.imUserId}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">IM Provider</span><span className="text-gray-800">{scanResult.merchantData.imProvider}</span></div>
                    {scanResult.merchantData.phone && <div className="flex justify-between"><span className="text-gray-500">电话 Phone</span><span className="text-gray-800">{scanResult.merchantData.phone}</span></div>}
                    {scanResult.merchantData.storeId && <div className="flex justify-between"><span className="text-gray-500">门店编号 Store ID</span><span className="text-gray-800 font-mono">{scanResult.merchantData.storeId}</span></div>}
                  </div>
                  <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg p-2">
                    确认绑定后，此商家信息将覆盖当前聊天联系人配置。<br />Confirming will overwrite the current chat contact.
                  </p>
                </div>
                <div className="flex border-t border-gray-100">
                  <button onClick={() => setScanResult(null)} className="flex-1 py-3.5 text-gray-600 font-medium text-sm active:bg-gray-50 transition-colors">取消 Cancel</button>
                  <div className="w-px bg-gray-100" />
                  <button onClick={confirmBindMerchant} className="flex-1 py-3.5 text-emerald-600 font-semibold text-sm active:bg-emerald-50 transition-colors">确认绑定 Bind</button>
                </div>
              </div>
            )}
            {scanResult.status === "rejected" && (
              <div>
                <div className="bg-gradient-to-br from-red-500 to-red-600 p-5 text-center">
                  <div className="w-14 h-14 mx-auto mb-2 bg-white/20 rounded-full flex items-center justify-center">
                    <ShieldX className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-white font-semibold">域名验证失败</p>
                  <p className="text-white/70 text-xs mt-0.5">Domain Verification Failed</p>
                </div>
                <div className="p-5 space-y-3">
                  {scanResult.sourceDomain && <div className="bg-red-50 rounded-xl p-3"><p className="text-xs text-red-600 font-mono">来源: {scanResult.sourceDomain}</p></div>}
                  <p className="text-sm text-gray-700">{scanResult.rejectReason}</p>
                  <p className="text-[10px] text-gray-400">为了您的安全，只有来自白名单域名的二维码才能绑定商家联系人。请联系您的农资服务商获取正确的二维码。</p>
                </div>
                <div className="border-t border-gray-100">
                  <button onClick={() => setScanResult(null)} className="w-full py-3.5 text-gray-600 font-medium text-sm active:bg-gray-50 transition-colors">知道了 OK</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCallDialog && (
        <CallDialog isOpen={showCallDialog} onClose={() => setShowCallDialog(false)} contactName={contact.name} contactAvatar={contact.avatar} callType={callType} callStatus={callStatus} />
      )}

      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs py-2 px-3 flex items-center justify-center gap-2 z-40 shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span className="font-medium">网络连接已断开</span>
        </div>
      )}

      {/* 顶部绿色区域 */}
      <div className="bg-[#059669] px-4 pb-4 flex-shrink-0 shadow-lg safe-top" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <div className="flex items-center gap-3">
          <button className="flex-shrink-0 active:opacity-80 transition-all active:scale-95">
            <div className="relative">
              <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow-xl bg-white">
                <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
              </div>
              {contact.online && (
                <div className="absolute -bottom-0.5 -right-0.5">
                  <div className="relative">
                    <div className="w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-md"></div>
                    <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full animate-ping opacity-50"></div>
                  </div>
                </div>
              )}
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-lg mb-0.5 drop-shadow-sm">{contact.name}</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white/80"></div>
              <p className="text-white/90 text-xs font-medium">{config?.chatContact?.subtitle || "TaprootAgro授权店"}</p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <button className="w-10 h-10 flex items-center justify-center active:scale-95 transition-all rounded-xl active:bg-white/20" onClick={() => setShowScanner(true)}>
              <ScanLine className="w-5 h-5 text-white" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* 聊天区域 */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 flex flex-col overflow-hidden min-h-0 shadow-2xl">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 min-h-0">
          <div className="flex justify-center mb-2">
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${proxyMode === "backend" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {proxyMode === "backend" ? `${providerName} Proxy` : "Mock Mode"} 
              {proxyMode === "mock" && " - Connect IM provider to enable"}
            </span>
          </div>
          <div className="flex justify-center mb-1">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-mono">
              ID: {currentUserId}
            </span>
          </div>
          {chatMessages.map((msg) => renderMessageContent(msg))}
          <div ref={messagesEndRef} />
        </div>

        {/* 底部输入栏 */}
        <div className="px-4 py-3 bg-gradient-to-t from-gray-50 to-white flex-shrink-0 border-t border-gray-100 relative">
          {showTextInput ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowTextInput(false)} className="p-2 active:scale-95 rounded-full transition-all bg-gray-100 active:bg-gray-200 flex-shrink-0">
                <X className="w-4 h-4 text-gray-600" strokeWidth={2.5} />
              </button>
              <input
                type="text"
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendTextMessage(); }}
                placeholder={t.community.typeMessage || "输入消息..."}
                className="flex-1 min-w-0 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all shadow-sm"
                autoFocus
              />
              <button
                onClick={sendTextMessage}
                disabled={!textMessage.trim()}
                className={`rounded-2xl px-4 py-2.5 transition-all flex-shrink-0 flex items-center justify-center shadow-lg active:scale-95 ${textMessage.trim() ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 active:from-emerald-600 active:to-emerald-700' : 'bg-gray-300'}`}
              >
                <Send className="w-4 h-4 text-white" strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative flex-shrink-0 plus-menu-container">
                <button 
                  onClick={() => setShowPlusMenu(!showPlusMenu)}
                  className={`w-10 h-10 flex items-center justify-center active:scale-95 rounded-2xl transition-all shadow-lg ${showPlusMenu ? 'bg-gradient-to-br from-emerald-400 to-emerald-500' : 'bg-gradient-to-br from-gray-100 to-gray-200'}`}
                >
                  <Plus className={`w-5 h-5 transition-transform ${showPlusMenu ? 'rotate-45 text-white' : 'text-gray-600'}`} strokeWidth={2.5} />
                </button>
                {showPlusMenu && (
                  <div className="absolute bottom-full left-0 mb-3 bg-white rounded-3xl shadow-2xl border border-gray-100 py-3 z-20 w-[70px] backdrop-blur-xl">
                    <button onClick={() => { setShowTextInput(true); setShowPlusMenu(false); }} className="w-full px-3 py-3 flex items-center justify-center active:bg-gray-50 transition-colors">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                        <MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                    </button>
                    <div className="h-px bg-gray-100 my-2 mx-3" />
                    <button onClick={() => { setCallType("audio"); setCallStatus("calling"); setShowCallDialog(true); setShowPlusMenu(false); }} className="w-full px-3 py-3 flex items-center justify-center active:bg-gray-50 transition-colors">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                        <Phone className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                    </button>
                    <div className="h-px bg-gray-100 my-2 mx-3" />
                    <button onClick={() => { setCallType("video"); setCallStatus("calling"); setShowCallDialog(true); setShowPlusMenu(false); }} className="w-full px-3 py-3 flex items-center justify-center active:bg-gray-50 transition-colors">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                        <Video className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                    </button>
                    <div className="absolute -bottom-2 left-5 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white"></div>
                  </div>
                )}
              </div>
              <button
                className={`flex-1 min-w-0 text-white rounded-2xl px-4 py-2.5 flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] ${isRecording ? 'bg-gradient-to-r from-red-500 to-red-600 active:from-red-600 active:to-red-700' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 active:from-emerald-600 active:to-emerald-700'}`}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
              >
                {isRecording ? (
                  <>
                    <Volume2 className="w-4 h-4 flex-shrink-0 animate-pulse" strokeWidth={2.5} />
                    <span className="text-sm font-semibold whitespace-nowrap">{recordingTime}" / 60"</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
                    <span className="text-sm font-semibold whitespace-nowrap">{t.community.holdToTalk}</span>
                  </>
                )}
              </button>
              <button className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-emerald-600 active:from-emerald-600 active:to-emerald-700 rounded-2xl transition-all shadow-lg active:scale-95 flex-shrink-0" onClick={() => setShowCamera(true)}>
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