import { useState, useRef, useEffect, useCallback } from "react";

export function useVoiceRecorder(sendVoiceMessage: (duration: number) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isCancelPending, setIsCancelPending] = useState(false);
  const recordingTimeRef = useRef(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const isCancelPendingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const startRecording = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isRecordingRef.current = true;
    isCancelPendingRef.current = false;
    recordingTimeRef.current = 0;
    setIsRecording(true);
    setIsCancelPending(false);
    setRecordingTime(0);
    
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
          recordingTimeRef.current = 0;
          setRecordingTime(0);
          sendVoiceMessage(60);
        }
      }
    }, 1000);
    
    recordingTimerRef.current = timer;
  }, [sendVoiceMessage]);

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

    if (!wasCancelled && duration > 0) {
      sendVoiceMessage(duration);
    }
  }, [sendVoiceMessage]);

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
  }, []);

  const setCancelPending = useCallback((pending: boolean) => {
    isCancelPendingRef.current = pending;
    setIsCancelPending(pending);
  }, []);

  return {
    isRecording,
    recordingTime,
    isRecordingRef,
    isCancelPending,
    isCancelPendingRef,
    startRecording,
    stopRecording,
    cancelRecording,
    setCancelPending,
  };
}