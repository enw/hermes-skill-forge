'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function useSpeechRecognition({ onFinal }: { onFinal?: (transcript: string) => void } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  const lastInterimRef = useRef('');
  const firedRef = useRef(false);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const fireCallback = () => {
    if (firedRef.current) return;
    const text = finalTranscriptRef.current.trim() || lastInterimRef.current.trim();
    if (text) {
      firedRef.current = true;
      onFinalRef.current?.(text);
    }
  };

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
    lastInterimRef.current = '';
    firedRef.current = false;
    setInterimText('');
    setIsRecording(true);

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition!;
    const recognition = new SR();
    recognition.continuous = false;
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
      if (interim) {
        lastInterimRef.current = interim;
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
      fireCallback();
      finalTranscriptRef.current = '';
      lastInterimRef.current = '';
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  return {
    isSupported,
    isRecording,
    interimText,
    startRecording,
    stopRecording,
  };
}

interface InputWithMicProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

export function InputWithMic({
  className,
  containerClassName,
  onChange,
  value,
  ...props
}: InputWithMicProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const {
    isSupported,
    isRecording,
    interimText,
    startRecording,
    stopRecording,
  } = useSpeechRecognition({
    onFinal: (transcript) => {
      if (!onChange) return;
      const currentValue = String(value ?? inputRef.current?.value ?? '');
      const { start, end } = selectionRef.current;
      const newValue = currentValue.slice(0, start) + transcript + ' ' + currentValue.slice(end);
      // Build a minimal event that satisfies e.target.value
      onChange({ target: { value: newValue } } as React.ChangeEvent<HTMLInputElement>);
      const newCursor = start + transcript.length + 1;
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.selectionStart = newCursor;
          inputRef.current.selectionEnd = newCursor;
          inputRef.current.focus();
        }
      });
    },
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    // Snapshot cursor position before recording blurs the input
    selectionRef.current = {
      start: inputRef.current?.selectionStart ?? (inputRef.current?.value.length ?? 0),
      end: inputRef.current?.selectionEnd ?? (inputRef.current?.value.length ?? 0),
    };
    startRecording();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    stopRecording();
  };

  const handlePointerLeave = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  if (!mounted) {
    return (
      <Input className={className} onChange={onChange} value={value} ref={inputRef} {...props} />
    );
  }

  if (!isSupported) {
    return (
      <Input className={className} onChange={onChange} value={value} ref={inputRef} {...props} />
    );
  }

  return (
    <div className={cn('relative w-full', containerClassName)}>
      <Input
        className={cn(className, isRecording && 'pr-10')}
        ref={inputRef}
        onChange={onChange}
        value={value}
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

interface TextareaWithMicProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
}

export function TextareaWithMic({
  className,
  containerClassName,
  onChange,
  value,
  ...props
}: TextareaWithMicProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const {
    isSupported,
    isRecording,
    interimText,
    startRecording,
    stopRecording,
  } = useSpeechRecognition({
    onFinal: (transcript) => {
      if (!onChange) return;
      const currentValue = String(value ?? textareaRef.current?.value ?? '');
      const { start, end } = selectionRef.current;
      const newValue = currentValue.slice(0, start) + transcript + ' ' + currentValue.slice(end);
      onChange({ target: { value: newValue } } as React.ChangeEvent<HTMLTextAreaElement>);
      const newCursor = start + transcript.length + 1;
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newCursor;
          textareaRef.current.selectionEnd = newCursor;
          textareaRef.current.focus();
        }
      });
    },
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    selectionRef.current = {
      start: textareaRef.current?.selectionStart ?? (textareaRef.current?.value.length ?? 0),
      end: textareaRef.current?.selectionEnd ?? (textareaRef.current?.value.length ?? 0),
    };
    startRecording();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    stopRecording();
  };

  const handlePointerLeave = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  if (!mounted) {
    return (
      <Textarea
        className={className}
        onChange={onChange}
        value={value}
        ref={textareaRef}
        {...props}
      />
    );
  }

  if (!isSupported) {
    return (
      <Textarea
        className={className}
        onChange={onChange}
        value={value}
        ref={textareaRef}
        {...props}
      />
    );
  }

  return (
    <div className={cn('relative w-full', containerClassName)}>
      <Textarea
        className={cn(className, isRecording && 'pr-10')}
        ref={textareaRef}
        onChange={onChange}
        value={value}
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