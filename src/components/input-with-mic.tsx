'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

function useSpeechRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // already stopped
      }
    }
  };

  const startRecording = () => {
    if (!isSupported) return;

    finalTranscriptRef.current = '';
    setInterimText('');
    setIsRecording(true);

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
      setIsRecording(false);
      setInterimText('');
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const getTranscript = () => finalTranscriptRef.current.trim();

  return {
    isSupported,
    isRecording,
    interimText,
    startRecording,
    stopRecording,
    getTranscript,
  };
}

interface InputWithMicProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function InputWithMic({ className, ...props }: InputWithMicProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    isSupported,
    isRecording,
    interimText,
    startRecording,
    stopRecording,
    getTranscript,
  } = useSpeechRecognition();

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    startRecording();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    stopRecording();
    const transcript = getTranscript();
    if (transcript && inputRef.current) {
      const start = inputRef.current.selectionStart ?? 0;
      const end = inputRef.current.selectionEnd ?? 0;
      const newValue =
        inputRef.current.value.slice(0, start) +
        transcript +
        ' ' +
        inputRef.current.value.slice(end);

      // Native setter for React controlled input
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(inputRef.current, newValue);
      }

      inputRef.current.selectionStart = inputRef.current.selectionEnd =
        start + transcript.length + 1;

      // Dispatch React input event
      inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      inputRef.current.focus();
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (isRecording) {
      stopRecording();
    }
  };

  if (!isSupported) {
    return <input className={className} ref={inputRef} {...props} />;
  }

  return (
    <div className="relative">
      <input
        className={cn(className, isRecording && 'pr-10')}
        ref={inputRef}
        {...props}
      />
      <button
        type="button"
        className={cn(
          'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all',
          isRecording
            ? 'text-destructive bg-destructive/10 animate-pulse'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        title="Hold to speak"
        aria-label="Voice input"
      >
        <Mic className="h-4 w-4" />
      </button>
      {isRecording && interimText && (
        <div className="absolute left-0 -top-6 right-10 text-xs text-muted-foreground truncate">
          {interimText}
        </div>
      )}
    </div>
  );
}

interface TextareaWithMicProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function TextareaWithMic({ className, ...props }: TextareaWithMicProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    isSupported,
    isRecording,
    interimText,
    startRecording,
    stopRecording,
    getTranscript,
  } = useSpeechRecognition();

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    startRecording();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    stopRecording();
    const transcript = getTranscript();
    if (transcript && textareaRef.current) {
      const start = textareaRef.current.selectionStart ?? 0;
      const end = textareaRef.current.selectionEnd ?? 0;
      const newValue =
        textareaRef.current.value.slice(0, start) +
        transcript +
        ' ' +
        textareaRef.current.value.slice(end);

      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(textareaRef.current, newValue);
      }

      textareaRef.current.selectionStart = textareaRef.current.selectionEnd =
        start + transcript.length + 1;

      textareaRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      textareaRef.current.focus();
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (isRecording) {
      stopRecording();
    }
  };

  if (!isSupported) {
    return <textarea className={className} ref={textareaRef} {...props} />;
  }

  return (
    <div className="relative">
      <textarea
        className={cn(className, isRecording && 'pr-10')}
        ref={textareaRef}
        {...props}
      />
      <button
        type="button"
        className={cn(
          'absolute right-2 bottom-2 p-1.5 rounded-md transition-all',
          isRecording
            ? 'text-destructive bg-destructive/10 animate-pulse'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        title="Hold to speak"
        aria-label="Voice input"
      >
        <Mic className="h-4 w-4" />
      </button>
      {isRecording && interimText && (
        <div className="absolute left-0 -top-5 right-10 text-xs text-muted-foreground truncate">
          {interimText}
        </div>
      )}
    </div>
  );
}