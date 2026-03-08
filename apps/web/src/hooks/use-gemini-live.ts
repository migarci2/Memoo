'use client';

/**
 * useGeminiLive — Official Google GenAI SDK implementation.
 *
 * Implements the Gemini Live API using @google/genai
 * Reference: https://ai.google.dev/gemini-api/docs/live?example=mic-stream
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveSessionStatus, TranscriptEntry } from '@/lib/types';
import { GoogleGenAI } from '@google/genai';

/* ── constants ──────────────────────────────────────────────────────────────── */

// Keep this overridable because Live model availability changes frequently.
const LIVE_MODEL = (
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL
    : undefined
) || 'gemini-2.5-flash-native-audio-preview-12-2025';

const SYSTEM_PROMPT = `You are a workflow recording co-pilot inside Memoo.

The user is sharing their screen and performing a business workflow. A vision model watches the screen and detects steps. Your job:

1. When you receive "[STEP DETECTED] <description>", decide whether to ask a short clarifying question (1 sentence max) or stay silent if the step is obvious.
   Examples: "Was that a login step or creating a new account?" / "Should this be stored as a Vault credential?"

2. When the user speaks, listen and confirm briefly.

3. Be concise — always ≤ 2 sentences.

4. Never interrupt mid-action.`;

/* ── types ──────────────────────────────────────────────────────────────────── */

interface UseGeminiLiveOptions {
  onVoiceNote?: (text: string, role: 'user' | 'gemini') => void;
  onError?: (msg: string) => void;
}

export interface UseGeminiLiveReturn {
  status: LiveSessionStatus;
  transcript: TranscriptEntry[];
  isMuted: boolean;
  start: () => Promise<void>;
  stop: () => void;
  mute: () => void;
  unmute: () => void;
  sendContextUpdate: (text: string) => void;
}

/* ── PCM helpers ────────────────────────────────────────────────────────────── */

function floatTo16BitB64(samples: Float32Array): string {
  const buf = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

interface TranscriptChunk {
  text: string;
  isFinal: boolean;
}

function pickTranscriptChunk(value: unknown): TranscriptChunk {
  if (!value || typeof value !== 'object') {
    return { text: '', isFinal: false };
  }
  const obj = value as Record<string, unknown>;
  const candidates = [obj.transcript, obj.text];
  let text = '';
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      text = c.trim();
      break;
    }
  }
  const isFinal = Boolean(
    obj.isFinal === true
    || obj.final === true
    || obj.finished === true
    || obj.done === true
    || obj.completed === true,
  );
  return { text, isFinal };
}

function appendTranscriptText(base: string, chunk: string): string {
  const next = chunk.trim();
  if (!next) return base;
  if (!base) return next;
  if (/^[,.;:!?)]/.test(next)) return `${base}${next}`;
  if (/^[’']/.test(next)) return `${base}${next}`;
  if (base.endsWith('(')) return `${base}${next}`;
  if (base.endsWith(' ')) return `${base}${next}`;
  return `${base} ${next}`;
}

function mergeTranscriptProgress(current: string, chunk: string): string {
  const next = chunk.trim();
  if (!next) return current;
  if (!current) return next;

  // Many streaming transcription backends send the full phrase-so-far.
  if (next === current) return current;
  if (next.startsWith(current)) return next;
  if (current.startsWith(next)) return current;

  // Guard against duplicate repeated fragments.
  if (current.endsWith(next)) return current;
  if (next.endsWith(current)) return next;

  // Otherwise treat as delta.
  return appendTranscriptText(current, next);
}

function upsertDraftTranscript(
  prev: TranscriptEntry[],
  role: 'user' | 'gemini',
  text: string,
  allowReplaceLast: boolean,
): TranscriptEntry[] {
  if (!text.trim()) return prev;
  const now = new Date().toISOString();
  const last = prev[prev.length - 1];
  if (allowReplaceLast && last && last.role === role) {
    const copy = prev.slice();
    copy[copy.length - 1] = { ...last, text, timestamp: now };
    return copy;
  }
  return [...prev, { role, text, timestamp: now }];
}

/* ── hook ───────────────────────────────────────────────────────────────────── */

export function useGeminiLive({
  onVoiceNote,
  onError,
}: UseGeminiLiveOptions = {}): UseGeminiLiveReturn {
  const apiKey = (
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_GEMINI_API_KEY
      : undefined
  ) ?? '';

  const [status, setStatus]     = useState<LiveSessionStatus>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isMuted, setIsMuted]   = useState(false);

  // Use any to bypass strict typing for the SDK since type definitions may vary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef     = useRef<any>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const micStreamRef   = useRef<MediaStream | null>(null);
  const processorRef   = useRef<ScriptProcessorNode | null>(null);
  const isMutedRef     = useRef(false);
  
  const pendingTextRef = useRef('');
  const pendingSpokenTextRef = useRef('');
  const pendingUserTextRef = useRef('');
  const userDraftActiveRef = useRef(false);
  const geminiDraftActiveRef = useRef(false);
  const userFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioQueue     = useRef<Uint8Array[]>([]);
  const playingRef     = useRef(false);
  const closingRef     = useRef(false);
  
  const onVoiceNoteRef = useRef(onVoiceNote);
  const onErrorRef     = useRef(onError);
  
  useEffect(() => { onVoiceNoteRef.current = onVoiceNote; }, [onVoiceNote]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const clearUserFlushTimer = useCallback(() => {
    if (userFlushTimerRef.current) {
      clearTimeout(userFlushTimerRef.current);
      userFlushTimerRef.current = null;
    }
  }, []);

  const flushUserTranscript = useCallback(() => {
    clearUserFlushTimer();
    const text = pendingUserTextRef.current.trim();
    if (text) {
      onVoiceNoteRef.current?.(text, 'user');
    }
    pendingUserTextRef.current = '';
    userDraftActiveRef.current = false;
  }, [clearUserFlushTimer]);

  /* ── audio playback ───────────────────────────────────────────────────────── */

  const playNext = useCallback(() => {
    if (playingRef.current || audioQueue.current.length === 0) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    playingRef.current = true;
    const pcmData = audioQueue.current.shift()!;
    
    // The SDK returns 24000Hz PCM audio.
    const f32 = new Float32Array(pcmData.length / 2);
    const view = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    for (let i = 0; i < f32.length; i++) {
      f32[i] = view.getInt16(i * 2, true) / 32768; // true for little-endian
    }

    const buf = ctx.createBuffer(1, f32.length, 24000);
    buf.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => { playingRef.current = false; playNext(); };
    src.start();
  }, []);

  /* ── mic ──────────────────────────────────────────────────────────────────── */

  const startMic = useCallback(async () => {
    console.log('[GeminiLive] requesting mic permission…');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    micStreamRef.current = stream;
    console.log('[GeminiLive] mic permission granted');

    const ctx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = ctx;

    const src = ctx.createMediaStreamSource(stream);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = proc;

    proc.onaudioprocess = (e: AudioProcessingEvent) => {
      if (isMutedRef.current) return;
      const session = sessionRef.current;
      if (!session) return;
      
      const b64 = floatTo16BitB64(e.inputBuffer.getChannelData(0));
      // Using the SDK's realtime input method via sendRealtimeInput
      try {
        session.sendRealtimeInput({
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: b64,
          },
        });
      } catch (err) {
        console.error('[GeminiLive] error sending audio:', err);
      }
    };

    src.connect(proc);
    proc.connect(ctx.destination);
  }, []);

  /* ── WebSocket Connection via SDK ─────────────────────────────────────────── */

  const openSession = useCallback(async () => {
    const ai = new GoogleGenAI({ apiKey });
    
    console.log('[GeminiLive] Connecting SDK...');
    const session = await ai.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: ['AUDIO'],
        inputAudioTranscription: {},
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
      },
      callbacks: {
        onopen: () => {
          closingRef.current = false;
          console.log('[GeminiLive] SDK Connected');
          setStatus('listening');
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onmessage: (msg: any) => {
          const sc = msg.serverContent;
          if (sc) {
            const userChunk = pickTranscriptChunk(sc.inputTranscription);
            if (userChunk.text) {
              pendingUserTextRef.current = mergeTranscriptProgress(pendingUserTextRef.current, userChunk.text);
              setTranscript((prev: TranscriptEntry[]) =>
                upsertDraftTranscript(
                  prev,
                  'user',
                  pendingUserTextRef.current,
                  userDraftActiveRef.current,
                ),
              );
              userDraftActiveRef.current = true;
              if (userChunk.isFinal) {
                flushUserTranscript();
              } else {
                clearUserFlushTimer();
                userFlushTimerRef.current = setTimeout(() => {
                  flushUserTranscript();
                }, 900);
              }
            }

            const spokenChunk = pickTranscriptChunk(sc.outputTranscription);
            if (spokenChunk.text) {
              pendingSpokenTextRef.current = mergeTranscriptProgress(
                pendingSpokenTextRef.current,
                spokenChunk.text,
              );
              setTranscript((prev: TranscriptEntry[]) =>
                upsertDraftTranscript(
                  prev,
                  'gemini',
                  pendingSpokenTextRef.current,
                  geminiDraftActiveRef.current,
                ),
              );
              geminiDraftActiveRef.current = true;
            }

            const mt = sc.modelTurn;
            if (mt) {
              const parts = mt.parts;
              for (const part of parts ?? []) {
                if (part.inlineData) {
                  const audioBytes = b64ToUint8Array(part.inlineData.data);
                  audioQueue.current.push(audioBytes);
                  setStatus('speaking');
                  playNext();
                }
                if (part.text) {
                  pendingTextRef.current += part.text;
                }
              }
            }

            if (sc.turnComplete) {
              flushUserTranscript();
              const text = (pendingSpokenTextRef.current || pendingTextRef.current).trim();
              pendingTextRef.current = '';
              pendingSpokenTextRef.current = '';
              if (text) {
                setTranscript((prev: TranscriptEntry[]) =>
                  upsertDraftTranscript(prev, 'gemini', text, geminiDraftActiveRef.current),
                );
                onVoiceNoteRef.current?.(text, 'gemini');
              }
              geminiDraftActiveRef.current = false;
              setStatus('listening');
            }
          }
          
          if (msg.error) {
            const errMsg = String(msg.error.message ?? JSON.stringify(msg.error));
            console.error('[GeminiLive] server error:', errMsg);
            onErrorRef.current?.(`Gemini error: ${errMsg}`);
            setStatus('error');
          }
        },
        onclose: (e: CloseEvent) => {
          const reason = e.reason || `code ${e.code}`;
          console.log('[GeminiLive] Session closed:', reason);
          flushUserTranscript();
          if (closingRef.current) {
            closingRef.current = false;
            setStatus('idle');
            return;
          }
          onErrorRef.current?.(`Gemini Live disconnected (${reason})`);
          setStatus('error');
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onerror: (e: any) => {
          if (closingRef.current) {
            return;
          }
          console.error('[GeminiLive] Session error:', e);
          flushUserTranscript();
          onErrorRef.current?.('Gemini Live session error');
          setStatus('error');
        }
      }
    });

    sessionRef.current = session;
    // Some SDK/runtime combinations do not surface `onopen` reliably.
    setStatus('listening');
  }, [apiKey, playNext, flushUserTranscript]);

  /* ── public API ──────────────────────────────────────────────────────────── */

  const start = useCallback(async (): Promise<void> => {
    if (!apiKey) {
      const msg = 'NEXT_PUBLIC_GEMINI_API_KEY is not set — add it to apps/web/.env.local';
      console.error('[GeminiLive]', msg);
      onErrorRef.current?.(msg);
      setStatus('error');
      throw new Error(msg);
    }

    setStatus('connecting');
    setTranscript([]);
    closingRef.current = false;
    console.log('[GeminiLive] starting SDK with model:', LIVE_MODEL);

    try {
      await openSession();
      await startMic();
    } catch (err) {
      console.error('[GeminiLive] start failed:', err);
      setStatus('error');
      flushUserTranscript();
      throw err;
    }
  }, [apiKey, openSession, startMic, flushUserTranscript]);

  const stop = useCallback(() => {
    flushUserTranscript();
    clearUserFlushTimer();
    processorRef.current?.disconnect();
    processorRef.current = null;
    micStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    micStreamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    
    // Close the SDK session
    if (sessionRef.current && typeof sessionRef.current.close === 'function') {
      closingRef.current = true;
      sessionRef.current.close();
    }
    sessionRef.current = null;
    
    audioQueue.current = [];
    playingRef.current = false;
    pendingTextRef.current = '';
    pendingSpokenTextRef.current = '';
    pendingUserTextRef.current = '';
    userDraftActiveRef.current = false;
    geminiDraftActiveRef.current = false;
    setStatus('idle');
  }, [clearUserFlushTimer, flushUserTranscript]);

  const mute   = useCallback(() => { isMutedRef.current = true;  setIsMuted(true);  }, []);
  const unmute = useCallback(() => { isMutedRef.current = false; setIsMuted(false); }, []);

  const sendContextUpdate = useCallback((text: string) => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      session.sendClientContent({
        turns: [{
          role: 'user',
          parts: [{ text: `[STEP DETECTED] ${text}` }],
        }],
        turnComplete: true,
      });
    } catch (e) {
      console.error('[GeminiLive] Error sending context update:', e);
    }
  }, []);

  useEffect(() => () => { stop(); }, [stop]);

  return { status, transcript, isMuted, start, stop, mute, unmute, sendContextUpdate };
}
