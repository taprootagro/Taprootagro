import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router";
import { type ChatMessage } from "../../../services/ChatProxyService";

export function useVoiceSystem(chatMessages: ChatMessage[], currentUserId: string) {
  const location = useLocation();

  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true); // 默认开启朗读（全局控制）
  const playingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用 ref 跟踪 ttsEnabled 的最新值，避免 speakText 回调频繁重建
  const ttsEnabledRef = useRef(ttsEnabled);
  ttsEnabledRef.current = ttsEnabled;

  // 清理播放定时器
  useEffect(() => {
    return () => {
      if (playingTimerRef.current) {
        clearTimeout(playingTimerRef.current);
      }
    };
  }, []);

  // 离开页面时停止TTS播放
  useEffect(() => {
    if (location.pathname !== '/home/community') {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      // 如果正在播放语音消息，也暂停
      if (playingTimerRef.current) {
        clearTimeout(playingTimerRef.current);
        playingTimerRef.current = null;
        setPlayingVoiceId(null);
      }
    }
  }, [location.pathname]);

  // TTS朗读文字消息（统一管理）— 稳定回调
  const speakText = useCallback((text: string, force = false) => {
    if (!('speechSynthesis' in window)) return;
    // force=true 时强制朗读（用户点击消息时），否则检查全局开关
    if (!force && !ttsEnabledRef.current) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  // 点击文字消息时主动朗读 — useCallback 配合 MessageBubble React.memo
  const handleTextMsgClick = useCallback((text: string) => {
    // 如果当前是关闭状态，自动开启
    if (!ttsEnabledRef.current) {
      setTtsEnabled(true);
    }
    // 强制朗读选中的文字
    speakText(text, true);
  }, [speakText]);

  // 语音播放切换 — useCallback 配合 MessageBubble React.memo
  const toggleVoicePlay = useCallback((msgId: string, duration: number) => {
    setPlayingVoiceId((prev) => {
      if (prev === msgId) {
        // 暂停
        if (playingTimerRef.current) { clearTimeout(playingTimerRef.current); playingTimerRef.current = null; }
        return null;
      }
      // 播放
      if (playingTimerRef.current) { clearTimeout(playingTimerRef.current); playingTimerRef.current = null; }
      playingTimerRef.current = setTimeout(() => {
        setPlayingVoiceId(null);
        playingTimerRef.current = null;
      }, (duration || 5) * 1000);
      return msgId;
    });
  }, []);

  // 新收到的文字消息自动朗读
  const prevMsgCountRef = useRef(chatMessages.length);
  useEffect(() => {
    if (chatMessages.length > prevMsgCountRef.current) {
      const newMsgs = chatMessages.slice(prevMsgCountRef.current);
      for (const msg of newMsgs) {
        if (msg.type === 'text' && msg.senderId !== currentUserId && ttsEnabledRef.current) {
          speakText(msg.content);
        }
      }
    }
    prevMsgCountRef.current = chatMessages.length;
  }, [chatMessages, currentUserId, speakText]);

  const toggleTts = useCallback(() => {
    setTtsEnabled(prev => {
      const newVal = !prev;
      if (!newVal && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return newVal;
    });
  }, []);

  return {
    playingVoiceId,
    ttsEnabled,
    toggleTts,
    toggleVoicePlay,
    handleTextMsgClick,
  };
}
