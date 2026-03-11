import { useState, useRef, useEffect, useCallback } from "react";

/**
 * useVoiceRecorder — 真实麦克风录音 Hook
 *
 * 关键原则（用户隐私）：
 * 1. 仅在 startRecording 时申请麦克风权限 (getUserMedia)
 * 2. 录音结束/取消后 **立即** 停止所有 MediaStream tracks，释放麦克风
 * 3. 绝不在后台保持麦克风打开
 */
export function useVoiceRecorder(sendVoiceMessage: (duration: number) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isCancelPending, setIsCancelPending] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  const recordingTimeRef = useRef(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const isCancelPendingRef = useRef(false);

  // MediaRecorder 相关
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceCancelledRef = useRef(false);

  // 彻底释放麦克风 — 所有退出路径都必须调用
  const releaseMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
      }
      mediaRecorderRef.current = null;
    }
  }, []);

  // 组件卸载时确保释放
  useEffect(() => {
    return () => {
      releaseMediaStream();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [releaseMediaStream]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;

    // 先取消任何正在播放的TTS
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // 重置权限拒绝提示
    setMicPermissionDenied(false);

    try {
      // 真正申请麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      voiceCancelledRef.current = false;

      // 创建 MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      // 录音数据收集（虽然当前 IM 后端是 mock，但录制是真实的）
      const audioChunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      recorder.onstop = () => {
        // ★ 立即释放麦克风 — 不在后台保持
        stream.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;

        // 如果是取消，不发送
        if (voiceCancelledRef.current) {
          return;
        }

        // 这里有真实的 audioBlob，当 IM 后端接入后可以发送
        // const blob = new Blob(audioChunks, { type: recorder.mimeType || 'audio/webm' });
        // TODO: 当 IM 真正接入时，改为发送 blob 数据
      };

      recorder.start(250); // 每250ms收集数据

      // 录音状态更新
      isRecordingRef.current = true;
      isCancelPendingRef.current = false;
      recordingTimeRef.current = 0;
      setIsRecording(true);
      setIsCancelPending(false);
      setRecordingTime(0);

      // 计时器
      const timer = setInterval(() => {
        recordingTimeRef.current += 1;
        const t = recordingTimeRef.current;
        setRecordingTime(t);
        if (t >= 60) {
          clearInterval(timer);
          recordingTimerRef.current = null;
          if (isRecordingRef.current) {
            isRecordingRef.current = false;
            isCancelPendingRef.current = false;
            setIsRecording(false);
            setIsCancelPending(false);
            const duration = recordingTimeRef.current;
            recordingTimeRef.current = 0;
            setRecordingTime(0);
            // 停止 MediaRecorder（触发 onstop 释放麦克风）
            voiceCancelledRef.current = false;
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
            sendVoiceMessage(duration);
          }
        }
      }, 1000);

      recordingTimerRef.current = timer;

    } catch (err) {
      // 麦克风权限被拒绝或不可用
      console.error('[Voice] Microphone access denied:', err);
      setMicPermissionDenied(true);
      // 确保彻底清理
      releaseMediaStream();
      isRecordingRef.current = false;
      setIsRecording(false);
      // 3秒后自动清除权限拒绝提示
      setTimeout(() => setMicPermissionDenied(false), 3000);
    }
  }, [sendVoiceMessage, releaseMediaStream]);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const duration = recordingTimeRef.current;
    const wasCancelled = isCancelPendingRef.current;

    isRecordingRef.current = false;
    isCancelPendingRef.current = false;
    recordingTimeRef.current = 0;
    setIsRecording(false);
    setIsCancelPending(false);
    setRecordingTime(0);

    // 停止 MediaRecorder（触发 onstop → 释放麦克风）
    if (wasCancelled || duration < 1) {
      voiceCancelledRef.current = true;
    } else {
      voiceCancelledRef.current = false;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
    } else {
      // MediaRecorder 已经停了，手动释放 stream
      releaseMediaStream();
    }

    if (!wasCancelled && duration > 0) {
      sendVoiceMessage(duration);
    }
  }, [sendVoiceMessage, releaseMediaStream]);

  const cancelRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    isRecordingRef.current = false;
    isCancelPendingRef.current = false;
    recordingTimeRef.current = 0;
    setIsRecording(false);
    setIsCancelPending(false);
    setRecordingTime(0);

    // 取消 — 停止 MediaRecorder 并释放麦克风
    voiceCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
    } else {
      releaseMediaStream();
    }
  }, [releaseMediaStream]);

  const setCancelPending = useCallback((pending: boolean) => {
    isCancelPendingRef.current = pending;
    setIsCancelPending(pending);
  }, []);

  // 清除权限拒绝提示
  const clearMicDenied = useCallback(() => {
    setMicPermissionDenied(false);
  }, []);

  return {
    isRecording,
    recordingTime,
    isRecordingRef,
    isCancelPending,
    isCancelPendingRef,
    micPermissionDenied,
    startRecording,
    stopRecording,
    cancelRecording,
    setCancelPending,
    clearMicDenied,
  };
}
