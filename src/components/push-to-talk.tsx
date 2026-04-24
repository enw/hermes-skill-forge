'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, AlertCircle } from 'lucide-react';

function insertTextAtCursor(text: string): boolean {
  const el = document.activeElement as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;

  if (!el) return false;
  const tag = el.tagName;

  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = el.value;
    el.value = value.slice(0, start) + text + value.slice(end);
    el.selectionStart = el.selectionEnd = start + text.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus();
    return true;
  }

  if ('isContentEditable' in el && el.isContentEditable) {
    document.execCommand('insertText', false, text);
    return true;
  }

  return false;
}

export function PushToTalk() {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [showNoFocus, setShowNoFocus] = useState(false);
  const [mounted, setMounted] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

  // Wait until after hydration to render anything that depends on browser APIs
  useEffect(() => {
    setMounted(true);
  }, []);

  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // already stopped
      }
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!isSupported) return;

    // Ensure an input is focused before we even start
    const focused = document.activeElement as HTMLElement | null;
    const isInput =
      focused &&
      (focused.tagName === 'INPUT' ||
        focused.tagName === 'TEXTAREA' ||
        focused.isContentEditable);

    if (!isInput) {
      setShowNoFocus(true);
      setTimeout(() => setShowNoFocus(false), 2500);
      return;
    }

    finalTranscriptRef.current = '';
    setInterimText('');
    setIsRecording(true);
    setShowNoFocus(false);

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition!;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        finalTranscriptRef.current += final;
      }
      setInterimText(interim);
    };

    recognition.onerror = () => {
      setIsRecording(false);
      setInterimText('');
    };

    recognition.onend = () => {
      const fullText = finalTranscriptRef.current.trim();
      if (fullText) {
        const inserted = insertTextAtCursor(fullText + ' ');
        if (!inserted) {
          setShowNoFocus(true);
          setTimeout(() => setShowNoFocus(false), 2500);
        }
      }
      setIsRecording(false);
      setInterimText('');
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [isSupported]);

  // Keyboard shortcut: Alt+M toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, startRecording, stopRecording]);

  // Stop if the user blurs the window while holding
  useEffect(() => {
    const handleBlur = () => {
      if (isRecording) stopRecording();
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [isRecording, stopRecording]);

  if (!mounted || !isSupported) return null;

  return (
    <>
      {/* Interim / warning bubble */}
      {(isRecording || showNoFocus) && (
        <div
          className={`fixed bottom-20 right-6 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg transition-opacity ${
            showNoFocus
              ? 'bg-amber-500 text-white'
              : 'bg-destructive text-destructive-foreground animate-pulse'
          }`}
        >
          {showNoFocus ? (
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Focus an input field first
            </span>
          ) : (
            interimText || 'Listening...'
          )}
        </div>
      )}

      {/* Push-to-talk button */}
      <button
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all select-none ${
          isRecording
            ? 'bg-destructive text-destructive-foreground scale-110 ring-4 ring-destructive/30'
            : 'bg-primary text-primary-foreground hover:scale-105'
        }`}
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerLeave={stopRecording}
        title="Hold to speak (Alt+M)"
        aria-label="Push to talk"
      >
        <Mic className="h-6 w-6" />
      </button>
    </>
  );
}
