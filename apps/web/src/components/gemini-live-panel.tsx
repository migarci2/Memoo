'use client';

import { useEffect, useRef } from 'react';
import {
  MicrophoneSlash,
  Microphone,
  X,
} from '@phosphor-icons/react';

import { GeminiLogo } from '@/components/gemini-logo';
import type { LiveSessionStatus, TranscriptEntry } from '@/lib/types';

/* ── types ─────────────────────────────────────────────────────────────────── */

interface GeminiLivePanelProps {
  status: LiveSessionStatus;
  transcript: TranscriptEntry[];
  isMuted: boolean;
  onMute: () => void;
  onUnmute: () => void;
  onStop: () => void;
}

/* ── status labels ──────────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<LiveSessionStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  listening: 'Listening',
  speaking: 'Navigator speaking',
  error: 'Connection error',
};

const STATUS_COLORS: Record<LiveSessionStatus, string> = {
  idle: 'text-[var(--app-muted)]',
  connecting: 'text-[var(--app-blue)]',
  listening: 'text-[#4a8566]',
  speaking: 'text-[var(--app-blue)]',
  error: 'text-red-500',
};

/* ── waveform bars ──────────────────────────────────────────────────────────── */

function WaveformBars({ active }: { active: boolean }) {
  const bars = [3, 5, 7, 5, 9, 6, 4, 8, 5, 3];
  return (
    <svg width="40" height="20" viewBox="0 0 40 20" className="shrink-0">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 4 + 1}
          y={(20 - h * (active ? 1.8 : 0.6)) / 2}
          width="2.5"
          height={h * (active ? 1.8 : 0.6)}
          rx="1.25"
          className={active ? 'fill-[var(--app-blue)]' : 'fill-[var(--app-line)]'}
          style={
            active
              ? {
                  animationName: 'gemini-bar',
                  animationDuration: `${0.5 + i * 0.07}s`,
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                  animationDirection: 'alternate',
                }
              : undefined
          }
        />
      ))}
    </svg>
  );
}

/* ── transcript bubble ───────────────────────────────────────────────────────── */

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const isGemini = entry.role === 'gemini';
  return (
    <div className={`flex gap-2 ${isGemini ? '' : 'flex-row-reverse'}`}>
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          isGemini
            ? 'bg-[var(--app-blue)]/15 text-[var(--app-blue)]'
            : 'bg-[var(--app-chip)] text-[var(--app-muted)]'
        }`}
      >
        {isGemini ? <GeminiLogo size={11} gradientId="gemini-live-bubble-logo" /> : 'U'}
      </span>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
          isGemini
            ? 'bg-[rgba(15,103,143,0.08)] text-[var(--app-text)]'
            : 'bg-white/70 text-[var(--app-muted)] border border-[var(--app-line)]'
        }`}
      >
        {entry.text}
      </div>
    </div>
  );
}

/* ── main panel ─────────────────────────────────────────────────────────────── */

export function GeminiLivePanel({
  status,
  transcript,
  isMuted,
  onMute,
  onUnmute,
  onStop,
}: GeminiLivePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /* auto-scroll to latest message */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const isListening = status === 'listening' && !isMuted;
  const isSpeaking  = status === 'speaking';

  return (
    <>
      {/* keyframe animation injected via style tag */}
      <style>{`
        @keyframes gemini-bar {
          0%   { transform: scaleY(0.4); }
          100% { transform: scaleY(1.0); }
        }
      `}</style>

      <div className="rounded-2xl border border-[var(--app-blue)]/20 bg-[linear-gradient(135deg,rgba(248,252,255,0.96),rgba(235,244,252,0.94))] p-4 shadow-[0_6px_24px_rgba(15,103,143,0.1)] backdrop-blur">
        {/* ── header ─────────────────────────────────────────────────────────── */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* animated status dot */}
            <span className="relative flex h-2.5 w-2.5">
              {(isListening || isSpeaking) && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--app-blue)] opacity-60" />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  isSpeaking
                    ? 'bg-[var(--app-blue)]'
                    : isListening
                      ? 'bg-[#4a8566]'
                      : status === 'error'
                        ? 'bg-red-500'
                        : 'bg-[var(--app-line)]'
                }`}
              />
            </span>

            <div className="flex items-center gap-1.5">
              <span className="inline-flex">
                <GeminiLogo size={14} gradientId="gemini-live-header-logo" />
              </span>
              <div className="leading-none">
                <p className="text-xs font-bold text-[var(--app-text)]">Navigator Live</p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Powered by Gemini
                </p>
              </div>
            </div>

            <span className={`text-[11px] font-medium ${STATUS_COLORS[status]}`}>
              · {STATUS_LABELS[status]}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Waveform */}
            <WaveformBars active={isListening} />

            {/* Mute toggle */}
            <button
              onClick={isMuted ? onUnmute : onMute}
              title={isMuted ? 'Unmute mic' : 'Mute mic'}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-all ${
                isMuted
                  ? 'border-red-300/60 bg-red-50 text-red-500 hover:bg-red-100'
                  : 'border-[var(--app-line)] bg-white/70 text-[var(--app-muted)] hover:border-[var(--app-blue)]/30 hover:text-[var(--app-blue)]'
              }`}
            >
              {isMuted ? <MicrophoneSlash size={12} weight="bold" /> : <Microphone size={12} weight="bold" />}
            </button>

            {/* End session */}
            <button
              onClick={onStop}
              title="End Live session"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--app-line)] bg-white/70 text-[var(--app-muted)] transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-500"
            >
              <X size={11} weight="bold" />
            </button>
          </div>
        </div>

        {/* ── transcript ─────────────────────────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="max-h-44 space-y-2 overflow-y-auto pr-0.5 [scrollbar-width:thin]"
        >
          {transcript.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-[var(--app-muted)]">
              Navigator will ask short clarifying questions as steps appear. You can also speak at any time to add business context.
            </p>
          ) : (
            transcript.map((entry, i) => <TranscriptBubble key={i} entry={entry} />)
          )}
        </div>

        {/* ── speaking indicator ─────────────────────────────────────────────── */}
        {isSpeaking && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--app-blue)]">
            <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--app-blue)] [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--app-blue)] [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--app-blue)] [animation-delay:300ms]" />
            <span className="ml-0.5">Navigator is speaking…</span>
          </div>
        )}
      </div>
    </>
  );
}
