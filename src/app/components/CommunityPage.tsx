import { CameraCapture } from "./CameraCapture";
import { useState, useEffect, useRef } from "react";
import { Plus, WifiOff, Play, Pause, Camera, Phone, Video, Mic, ScanLine, MessageSquare, AlertCircle, ShieldCheck, ShieldX, LogIn, ImageIcon, Loader, PenLine, Volume2, VolumeX, Send } from "lucide-react";
import { useNavigate } from "react-router";
import { useLanguage } from "../hooks/useLanguage";
import { useHomeConfig } from "../hooks/useHomeConfig";
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
  const { t, isRTL } = useLanguage();
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
  const [showScanActionSheet, setShowScanActionSheet] = useState(false); // 扫码选择面板
  const [scanResult, setScanResult] = useState<{
    status: "verifying" | "verified" | "rejected";
    merchantData?: any;
    sourceDomain?: string;
    rejectReason?: string;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true); // 默认开启朗读（全局控制）
  const playingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scanAlbumInputRef = useRef<HTMLInputElement>(null);
  
  // ---- 防止键盘弹出时页面跳动（PWA核心问题）----
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  
  // 输入框聚焦处理 — 阻止原生 scrollIntoView
  const handleInputFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  };
  
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
  
  // 点击菜单外部关闭菜
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
      if (playingTimerRef.current) {
        clearTimeout(playingTimerRef.current);
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

  // 发送文���消息 — 传入 contact.imUserId 作为 targetUserId
  const sendTextMessage = async () => {
    if (textMessage.trim() && !isSending) {
      const content = textMessage.trim();
      setTextMessage("");
      // 重置输入框高度
      if (textInputRef.current) {
        textInputRef.current.style.height = '36px';
      }
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

  // 发送图片消息 — 先压缩再发送，节省流量和存储
  const sendImageMessage = async (imageData: string) => {
    // 压缩图片（chat 设：最长边1024，质量0.7，上限200KB）
    let compressed = imageData;
    try {
      const { compressImageBase64, COMPRESS_PRESETS } = await import('../utils/imageCompressor');
      compressed = await compressImageBase64(imageData, COMPRESS_PRESETS.chat);
    } catch (err) {
      console.warn('[Chat] Image compression failed, using original', err);
    }

    const optimisticMsg: Message = {
      id: `m${Date.now()}_opt`,
      channelName: "default-channel",
      senderId: currentUserId,
      content: compressed,
      type: "image",
      timestamp: Date.now(),
      status: "sending",
      read: false,
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      const sentMsg = await chatService.sendMessage(compressed, "image", undefined, contact.imUserId || contact.id);
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

  // 扫码 Action Sheet — 从相册选择后用 BarcodeDetector 识别二维码
  const [scanAlbumScanning, setScanAlbumScanning] = useState(false);
  const [scanAlbumError, setScanAlbumError] = useState("");
  
  // Action Sheet 动画控制
  const [scanSheetAnim, setScanSheetAnim] = useState<'entering' | 'visible' | 'leaving'>('entering');
  useEffect(() => {
    if (showScanActionSheet) {
      setScanSheetAnim('entering');
      requestAnimationFrame(() => setScanSheetAnim('visible'));
    }
  }, [showScanActionSheet]);

  const closeScanActionSheet = () => {
    setScanSheetAnim('leaving');
    setTimeout(() => {
      setShowScanActionSheet(false);
      setScanAlbumError("");
    }, 200);
  };

  // 从相册选择图片 → BarcodeDetector 识别二维码
  const handleScanAlbumFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!window.BarcodeDetector) {
      setScanAlbumError(t.community.qrNotSupported || "QR detection not supported in this browser");
      return;
    }

    setScanAlbumScanning(true);
    setScanAlbumError("");

    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const bitmap = await createImageBitmap(file);
      const barcodes = await detector.detect(bitmap);

      if (barcodes.length > 0 && barcodes[0].rawValue) {
        if (navigator.vibrate) navigator.vibrate(100);
        closeScanActionSheet();
        processScanResult(barcodes[0].rawValue);
      } else {
        setScanAlbumError(t.community.noQrDetected || "No QR code detected. Please try again.");
      }
    } catch (err) {
      console.error("[Scan] Album scan error:", err);
      setScanAlbumError(t.community.scanFailed || "Detection failed. Please try again.");
    } finally {
      setScanAlbumScanning(false);
    }
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

  // 语音播放切换
  const toggleVoicePlay = (msgId: string, duration: number) => {
    if (playingVoiceId === msgId) {
      // 暂停
      setPlayingVoiceId(null);
      if (playingTimerRef.current) { clearTimeout(playingTimerRef.current); playingTimerRef.current = null; }
    } else {
      // 播放
      setPlayingVoiceId(msgId);
      if (playingTimerRef.current) { clearTimeout(playingTimerRef.current); playingTimerRef.current = null; }
      playingTimerRef.current = setTimeout(() => {
        setPlayingVoiceId(null);
        playingTimerRef.current = null;
      }, (duration || 5) * 1000);
    }
  };

  // TTS朗读文字消息（统一管理）
  const speakText = (text: string, force = false) => {
    if (!('speechSynthesis' in window)) return;
    // force=true 时强制朗读（用户点击消息时），否则检查全局开关
    if (!force && !ttsEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // 点击文字消息时主动朗读
  const handleTextMsgClick = (text: string) => {
    // 如果当前是关闭状态，自动开启
    if (!ttsEnabled) {
      setTtsEnabled(true);
    }
    // 强制朗读选中的文字
    speakText(text, true);
  };

  // 新收到的文字消息自动朗读
  const prevMsgCountRef = useRef(chatMessages.length);
  useEffect(() => {
    if (chatMessages.length > prevMsgCountRef.current) {
      const newMsgs = chatMessages.slice(prevMsgCountRef.current);
      for (const msg of newMsgs) {
        if (msg.type === 'text' && msg.senderId !== currentUserId && ttsEnabled) {
          speakText(msg.content);
        }
      }
    }
    prevMsgCountRef.current = chatMessages.length;
  }, [chatMessages, ttsEnabled, currentUserId]);

  // 渲染消息内容
  const renderMessageContent = (msg: Message) => {
    const isSent = msg.senderId === currentUserId;
    const isFailed = msg.status === 'failed';
    const isPlaying = playingVoiceId === msg.id;

    const bubble = (
      <div className="relative max-w-[85%]">
        <div className={`rounded-2xl px-3 py-2 ${
          isSent
            ? `bg-emerald-500 text-white ${isRTL ? 'rounded-bl-md' : 'rounded-br-md'}`
            : `bg-gray-100 text-gray-700 ${isRTL ? 'rounded-br-md' : 'rounded-bl-md'}`
        }`}>
          {msg.type === "voice" && (
            <button
              className="flex items-center gap-2 min-w-[80px] w-full"
              onClick={() => toggleVoicePlay(msg.id, msg.duration || 5)}
            >
              {isPlaying
                ? <Pause className="w-3.5 h-3.5 flex-shrink-0" />
                : <Play className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" />
              }
              <div className="flex items-end gap-[2px] h-4">
                {[1.5, 3, 2, 3.5, 1.5, 3, 2].map((h, i) => (
                  <div
                    key={i}
                    className={`w-[3px] rounded-full ${isSent ? 'bg-white/80' : 'bg-gray-500'}`}
                    style={isPlaying ? {
                      height: `${h * 4}px`,
                      animation: `voiceWave 0.4s ease-in-out ${i * 0.07}s infinite alternate`,
                    } : {
                      height: `${h * 4}px`,
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] font-semibold flex-shrink-0">{msg.duration}"</span>
            </button>
          )}
          {msg.type === "text" && (
            <p 
              className={`break-words leading-relaxed ${!isSent ? 'cursor-pointer active:opacity-70' : ''}`}
              style={{ fontSize: 'clamp(13px, 3.5vw, 15px)' }}
              onClick={() => !isSent && handleTextMsgClick(msg.content)}
            >
              {msg.content}
            </p>
          )}
          {msg.type === "image" && (
            <img src={msg.content} alt="" className="w-36 h-36 object-cover rounded-xl" />
          )}
        </div>
      </div>
    );

    return (
      <div key={msg.id} className={`flex items-end gap-1.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
        {isSent && isFailed && (
          <div className="flex-shrink-0 mb-0.5">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
        )}
        {bubble}
        {!isSent && isFailed && (
          <div className="flex-shrink-0 mb-0.5">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
        )}
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
                <div className="flex" style={{ boxShadow: '0 -1px 4px rgba(0,0,0,0.04)' }}>
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
                <div style={{ boxShadow: '0 -1px 4px rgba(0,0,0,0.04)' }}>
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
                <div className={`absolute -bottom-0.5 ${isRTL ? '-left-0.5' : '-right-0.5'}`}>
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
          <div className="flex-shrink-0 flex items-center -gap-0.5">
            {/* 统一语音播放控制 */}
            <button 
              className={`w-10 h-10 flex items-center justify-center active:scale-95 transition-all rounded-xl ${ttsEnabled ? 'active:bg-white/20' : 'bg-white/20 active:bg-white/30'}`}
              onClick={() => {
                setTtsEnabled(!ttsEnabled);
                if (ttsEnabled) {
                  // 关闭时立即停止当前播放
                  window.speechSynthesis.cancel();
                }
              }}
            >
              {ttsEnabled 
                ? <Volume2 className="w-5 h-5 text-white" strokeWidth={2.5} />
                : <VolumeX className="w-5 h-5 text-white" strokeWidth={2.5} />
              }
            </button>
            {/* 扫码按钮 */}
            <button className="w-10 h-10 flex items-center justify-center active:scale-95 transition-all rounded-xl active:bg-white/20" onClick={() => setShowScanActionSheet(true)}>
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
        <div className="px-2 py-2 bg-gradient-to-t from-gray-50 to-white flex-shrink-0 relative" style={{ boxShadow: '0 -1px 8px rgba(0,0,0,0.06)' }}>
            <div className="flex items-end gap-2">
              {/* 加号菜单 — 电话/视频通话 */}
              <div className="relative flex-shrink-0 plus-menu-container">
                <button 
                  onClick={() => setShowPlusMenu(!showPlusMenu)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all flex-shrink-0 ${showPlusMenu ? 'bg-emerald-50' : 'bg-gray-100'}`}
                >
                  <Plus className={`w-5 h-5 transition-transform ${showPlusMenu ? 'rotate-45 text-emerald-600' : 'text-gray-500'}`} strokeWidth={2.5} />
                </button>
                {showPlusMenu && (
                  <div className={`absolute bottom-full mb-2.5 bg-white rounded-2xl py-2 z-20 w-[60px] ${isRTL ? 'right-0' : 'left-0'}`} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <button onClick={() => { setCallType("audio"); setCallStatus("calling"); setShowCallDialog(true); setShowPlusMenu(false); }} className="w-full px-2 py-2 flex items-center justify-center active:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center active:scale-95 transition-transform">
                        <Phone className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
                      </div>
                    </button>
                    <div className="h-px bg-gray-100 my-1.5 mx-2.5" />
                    <button onClick={() => { setCallType("video"); setCallStatus("calling"); setShowCallDialog(true); setShowPlusMenu(false); }} className="w-full px-2 py-2 flex items-center justify-center active:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center active:scale-95 transition-transform">
                        <Video className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
                      </div>
                    </button>
                    <div className={`absolute -bottom-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white ${isRTL ? 'right-4' : 'left-4'}`}></div>
                  </div>
                )}
              </div>

              {/* 左侧切换按钮：语音模式显示笔(切文字)，文字模式显示麦克风(切语音) */}
              <button
                onClick={() => setInputMode(inputMode === 'voice' ? 'text' : 'voice')}
                className="w-9 h-9 flex items-center justify-center text-gray-500 active:scale-90 transition-all flex-shrink-0"
              >
                {inputMode === 'voice' ? <PenLine className="w-[18px] h-[18px]" /> : <Mic className="w-[18px] h-[18px]" />}
              </button>

              {/* ── 语音模式：按住说话按钮 ── */}
              {inputMode === 'voice' && (
                <div
                  className="flex-1 min-w-0 select-none"
                  style={{ height: '36px' }}
                  onTouchStart={(e) => {
                    if (isRecording) return;
                    const touch = e.touches[0];
                    const startY = touch?.clientY || 0;
                    (e.currentTarget as any).__startY = startY;
                    setIsRecording(true);
                    isRecordingRef.current = true;
                    setRecordingTime(0);
                    startRecording();
                  }}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    const startY = (e.currentTarget as any).__startY || 0;
                    if (isRecording && (touch?.clientY || 0) < startY - 80) {
                      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
                      isRecordingRef.current = false;
                      setIsRecording(false);
                      setRecordingTime(0);
                    }
                  }}
                  onTouchEnd={() => {
                    if (isRecording) {
                      if (recordingTime >= 1) {
                        stopRecording();
                      } else {
                        // too short, cancel
                        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
                        isRecordingRef.current = false;
                        setIsRecording(false);
                        setRecordingTime(0);
                      }
                    }
                  }}
                  onTouchCancel={() => {
                    if (isRecording) {
                      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
                      isRecordingRef.current = false;
                      setIsRecording(false);
                      setRecordingTime(0);
                    }
                  }}
                >
                  {!isRecording ? (
                    <div className="bg-gray-100 rounded-2xl text-center text-sm text-gray-500 active:bg-emerald-500 active:text-white transition-colors select-none flex items-center justify-center" style={{ height: '36px' }}>
                      <Mic className="w-4 h-4 inline-block mr-1.5" />
                      {t.ai.holdToSpeak}
                    </div>
                  ) : (
                    <div className="bg-emerald-500 rounded-2xl px-3.5 flex items-center gap-2.5" style={{ height: '36px' }}>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <div className="flex items-end gap-[2px] h-4">
                          {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="w-[3px] bg-white/70 rounded-full" style={{
                              height: `${6 + Math.random() * 10}px`,
                              animation: `voiceWave 0.4s ease-in-out ${i * 0.07}s infinite alternate`
                            }} />
                          ))}
                        </div>
                        <span className="text-sm text-white font-medium tabular-nums">{recordingTime}"</span>
                        <span className="text-[10px] text-white/60 tabular-nums">/ 60s</span>
                      </div>
                      <span className="text-[10px] text-white/80 flex-shrink-0">{t.ai.releaseToSend}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── 文字模式：输入框 + 内嵌发送按钮 ── */}
              {inputMode === 'text' && (
                <div className="flex-1 min-w-0 relative" style={{ minHeight: '36px' }}>
                  <textarea
                    value={textMessage}
                    onChange={(e) => {
                      setTextMessage(e.target.value);
                      // 自动调整高度（仅多行时才撑高）
                      const el = e.target;
                      el.style.height = '36px';
                      // If content needs more space, expand (but only if not empty)
                      if (e.target.value && el.scrollHeight > 36) {
                        el.style.height = Math.min(el.scrollHeight, 96) + 'px';
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        sendTextMessage();
                      }
                    }}
                    placeholder={t.community.typeMessage || '输入消息...'}
                    className={`w-full bg-gray-100 rounded-2xl text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-300 transition-[box-shadow] resize-none overflow-y-auto ${isRTL ? 'pr-10 pl-3' : 'pl-3 pr-10'}`}
                    ref={textInputRef}
                    onFocus={handleInputFocus}
                    style={{ height: '36px', minHeight: '36px', maxHeight: '96px', lineHeight: '18px', paddingTop: '9px', paddingBottom: '9px', boxSizing: 'border-box', fieldSizing: 'fixed' } as React.CSSProperties}
                  />
                  {/* 发送按钮 — 仅有内容时显示，在输入框内部 */}
                  {textMessage.trim() && (
                    <button
                      onClick={sendTextMessage}
                      disabled={isSending}
                      className={`absolute bottom-1.5 w-7 h-7 flex items-center justify-center active:scale-90 transition-all disabled:opacity-40 disabled:active:scale-100 ${isRTL ? 'left-1.5' : 'right-1.5'}`}
                    >
                      <Send className="w-[17px] h-[17px] text-emerald-600" strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              )}

              {/* 相机按钮 */}
              <button
                className="w-9 h-9 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-full active:scale-90 transition-all flex-shrink-0"
                onClick={() => setShowCamera(true)}
              >
                <Camera className="w-[18px] h-[18px]" />
              </button>
            </div>
        </div>
      </div>

      {/* ============ 扫码 Action Sheet — 与 CameraCapture 保持一致 ============ */}
      {showScanActionSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) closeScanActionSheet(); }}
          style={{
            backgroundColor: scanSheetAnim === 'visible' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
            transition: 'background-color 200ms ease-out',
          }}
        >
          <div
            className="w-full max-w-lg mx-2 mb-2 safe-bottom"
            style={{
              transform: scanSheetAnim === 'visible' ? 'translateY(0)' : 'translateY(100%)',
              opacity: scanSheetAnim === 'leaving' ? 0 : 1,
              transition: scanSheetAnim === 'leaving'
                ? 'transform 200ms ease-in, opacity 150ms ease-in'
                : 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out',
            }}
          >
            {/* 选项组 */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
              {/* 标题 */}
              <div className="px-4 pt-4 pb-2 text-center">
                <p className="text-gray-400" style={{ fontSize: '13px' }}>
                  {t.camera?.chooseSource || "Choose image source"}
                </p>
              </div>

              {/* 扫码（相机） — 打开 QRScannerCapture */}
              <button
                className="w-full flex items-center justify-center gap-3 py-4 active:bg-gray-50 transition-colors"
                style={{ boxShadow: '0 -1px 0 rgba(0,0,0,0.04)' }}
                onClick={() => {
                  closeScanActionSheet();
                  // 延迟打开扫码器，等 action sheet 关闭动画完成
                  setTimeout(() => setShowScanner(true), 220);
                }}
              >
                <ScanLine className="w-5 h-5 text-emerald-600" />
                <span className="text-emerald-600" style={{ fontSize: '17px' }}>
                  {t.camera?.takePhoto || "Take Photo"}
                </span>
              </button>

              {/* 从相册选择 — 用 BarcodeDetector 识别 */}
              <button
                className="w-full flex items-center justify-center gap-3 py-4 active:bg-gray-50 transition-colors"
                style={{ boxShadow: '0 -1px 0 rgba(0,0,0,0.04)' }}
                onClick={() => scanAlbumInputRef.current?.click()}
                disabled={scanAlbumScanning}
              >
                {scanAlbumScanning ? (
                  <>
                    <Loader className="w-5 h-5 text-emerald-600 animate-spin" />
                    <span className="text-emerald-600" style={{ fontSize: '17px' }}>
                      {t.community.scanning || "Scanning..."}
                    </span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 text-emerald-600" />
                    <span className="text-emerald-600" style={{ fontSize: '17px' }}>
                      {t.camera?.chooseFromAlbum || "Choose from Album"}
                    </span>
                  </>
                )}
              </button>

              {/* 相册识别错误提示 */}
              {scanAlbumError && (
                <div className="px-4 pb-3">
                  <div className="bg-red-50 rounded-xl px-3 py-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-500 text-xs">{scanAlbumError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 取消按钮 */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-xl mt-2">
              <button
                className="w-full py-4 active:bg-gray-50 transition-colors"
                onClick={closeScanActionSheet}
              >
                <span className="text-gray-600 font-medium" style={{ fontSize: '17px' }}>
                  {t.common?.cancel || "Cancel"}
                </span>
              </button>
            </div>
          </div>

          {/* 隐藏的 file input — 从相册选择二维码图片 */}
          <input
            ref={scanAlbumInputRef}
            type="file"
            accept="image/*"
            onChange={handleScanAlbumFile}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

// 默认导出用于懒加载
export default CommunityPage;