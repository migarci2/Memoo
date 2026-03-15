'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CircleNotch,
  Desktop,
  Lightning,
  Eye,
  Microphone,
  Record,
  Trash,
  WaveTriangle,
} from '@phosphor-icons/react';

import { GeminiLivePanel } from '@/components/gemini-live-panel';
import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { useGeminiLive } from '@/hooks/use-gemini-live';
import { apiGet, apiPost } from '@/lib/api';
import type {
  CaptureEventInput,
  CaptureSession,
  CompileResult,
  FrameAnalysisResult,
} from '@/lib/types';

/* ── constants ────────────────────────────────────────────────────────────── */

const FRAME_INTERVAL_MS = 4_000; // capture a frame every 4 seconds

const KIND_COLORS: Record<string, string> = {
  navigate: 'bg-[var(--app-chip)] text-[var(--app-blue)]',
  click: 'bg-[rgba(123,155,134,0.18)] text-[#335443]',
  input: 'bg-[rgba(191,155,106,0.16)] text-[#7d5d31]',
  submit: 'bg-[rgba(95,119,132,0.18)] text-[#3f5e6f]',
  verify: 'bg-[rgba(123,155,134,0.25)] text-[#335443]',
  wait: 'bg-[var(--app-chip)] text-[var(--app-muted)]',
  action: 'bg-[rgba(95,119,132,0.12)] text-[#3f5e6f]',
};

/* ── component ────────────────────────────────────────────────────────────── */

export default function CapturePage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  /* capture session */
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [title, setTitle] = useState('');
  const [starting, setStarting] = useState(false);
  const [compiling, setCompiling] = useState(false);

  /* screen capture — refs persist across renders */
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [streamReady, setStreamReady] = useState(false);

  /* detected events */
  const [events, setEvents] = useState<CaptureEventInput[]>([]);

  /* past captures */
  const [captures, setCaptures] = useState<CaptureSession[]>([]);

  /* live voice session */
  const [liveActive, setLiveActive] = useState(false);
  const live = useGeminiLive({
    onError: (msg) => {
      toast(msg, 'error');
    },
  });
  // Stable refs so callbacks don't change on every render
  const liveActiveRef = useRef(false);
  const liveStopRef   = useRef<() => void>(live.stop);
  const liveSendRef   = useRef<(t: string) => void>(live.sendContextUpdate);
  useEffect(() => { liveActiveRef.current = liveActive; }, [liveActive]);
  useEffect(() => { liveStopRef.current   = live.stop; }, [live.stop]);
  useEffect(() => { liveSendRef.current   = live.sendContextUpdate; }, [live.sendContextUpdate]);
  useEffect(() => {
    if (!liveActive) return;
    if (live.status === 'idle' || live.status === 'error') {
      setLiveActive(false);
      liveActiveRef.current = false;
    }
  }, [liveActive, live.status]);

  useEffect(() => {
    apiGet<CaptureSession[]>(`/teams/${teamId}/captures`)
      .then(setCaptures)
      .catch(() => {});
  }, [teamId]);

  /* ── start recording ───────────────────────────────────────────────────── */

  const startCapture = async () => {
    if (!title.trim()) {
      toast('Give your capture a title', 'error');
      return;
    }

    setStarting(true);
    try {
      // 1. Request screen sharing
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 5 } },
        audio: false,
      });

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });

      streamRef.current = stream;

      // 2. Create capture session on backend
      const cap = await apiPost<CaptureSession>(`/teams/${teamId}/captures`, {
        title: title.trim(),
      });
      captureIdRef.current = cap.id;
      setSession(cap);

      // 3. Signal that the stream is ready — a useEffect will
      //    wire it to the video element after React renders it.
      setStreamReady(true);

      toast('Screen recording started — Gemini is watching', 'success');

      // 4. Auto-start Gemini Live so spoken context is captured while recording.
      try {
        await live.start();
        setLiveActive(true);
        liveActiveRef.current = true;
        toast('Gemini Live session active — speak to add context', 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[capture] auto-start live failed:', msg);
        setLiveActive(false);
        liveActiveRef.current = false;
        toast('Recording started, but Gemini Live voice did not connect', 'error');
      }
    } catch (err) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStreamReady(false);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        toast('Screen share permission denied', 'error');
      } else {
        toast('Failed to start capture', 'error');
        console.error('[capture] startCapture error:', err);
      }
    } finally {
      setStarting(false);
    }
  };

  /* ── capture a frame & send to Gemini ──────────────────────────────────── */

  const captureAndAnalyze = useCallback(async () => {
    const captureId = captureIdRef.current;
    if (!captureId || busyRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      console.warn('[capture] video or canvas ref missing');
      return;
    }
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('[capture] video has no dimensions yet');
      return;
    }

    busyRef.current = true;
    setAnalyzing(true);

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        console.warn('[capture] canvas produced empty base64');
        return;
      }

      setFrameCount(prev => prev + 1);
      console.log(`[capture] sending frame to Gemini (capture=${captureId})`);

      const result = await apiPost<FrameAnalysisResult>(
        `/captures/${captureId}/analyze-frame`,
        { image: base64, mime_type: 'image/jpeg' },
      );

      console.log('[capture] Gemini result:', result);

      if (result.detected && result.events.length > 0) {
        const newEvents = result.events.map(e => ({
          kind: e.kind,
          url: e.url ?? undefined,
          selector: e.selector ?? undefined,
          value: e.value ?? undefined,
          text: e.text ?? undefined,
        }));
        setEvents(prev => [...prev, ...newEvents]);

        // Notify Gemini Live session of the newly detected steps
        if (liveActiveRef.current) {
          for (const ev of newEvents) {
            const label = ev.text ?? `${ev.kind}${ev.url ? ` on ${ev.url}` : ''}`;
            liveSendRef.current(label);
          }
        }
      }
    } catch (err) {
      console.error('[capture] frame analysis failed:', err);
    } finally {
      busyRef.current = false;
      setAnalyzing(false);
    }
  }, []);

  /* ── wire stream → video once both are in the DOM ──────────────────────── */

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || !streamReady) return;

    video.srcObject = stream;
    video.play().then(() => {
      console.log('[capture] video playing — starting frame timer');
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(captureAndAnalyze, FRAME_INTERVAL_MS);
    }).catch(err => console.error('[capture] video.play() failed:', err));
  }, [streamReady, captureAndAnalyze]);

  /* ── stop recording ────────────────────────────────────────────────────── */

  const stopScreenShare = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    captureIdRef.current = null;
    setStreamReady(false);
    // Stop the live voice session if active (via stable ref — no render deps)
    if (liveActiveRef.current) {
      liveStopRef.current();
      setLiveActive(false);
      liveActiveRef.current = false;
    }
  }, []); // empty deps — uses only refs, never stale

  /* ── finalize & compile ────────────────────────────────────────────────── */

  const isTransientFetchError = (err: unknown): boolean => {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return (
      err.name === 'TypeError'
      || msg.includes('networkerror')
      || msg.includes('failed to fetch')
      || msg.includes('network request failed')
    );
  };

  const shouldFallbackToDirectCompile = (err: unknown): boolean => {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return (
      msg.includes('internal server error')
      || msg.includes('missing capture id')
      || msg.includes('upstream compile request failed')
      || msg.includes('unexpected token')
    );
  };

  const compileViaServerRoute = async (captureId: string): Promise<CompileResult> => {
    const res = await fetch(`/api/captures/${captureId}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    if (!res.ok) {
      const raw = await res.text();
      let message = raw;
      try {
        const parsed = JSON.parse(raw) as { detail?: string };
        if (parsed.detail) message = parsed.detail;
      } catch {
        // keep raw text
      }
      throw new Error(message || `Compile failed (${res.status})`);
    }

    return res.json() as Promise<CompileResult>;
  };

  const compileOnce = async (captureId: string): Promise<CompileResult> => {
    try {
      return await compileViaServerRoute(captureId);
    } catch (err) {
      if (!shouldFallbackToDirectCompile(err)) throw err;
      return apiPost<CompileResult>(`/captures/${captureId}/compile`, {});
    }
  };

  const compileWithRetry = async (captureId: string): Promise<CompileResult> => {
    let lastErr: unknown;
    const delaysMs = [0, 450, 1200];

    for (let attempt = 0; attempt < delaysMs.length; attempt++) {
      if (delaysMs[attempt] > 0) {
        await new Promise((r) => setTimeout(r, delaysMs[attempt]));
      }
      try {
        return await compileOnce(captureId);
      } catch (err) {
        lastErr = err;
        if (!isTransientFetchError(err) || attempt === delaysMs.length - 1) {
          throw err;
        }
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error('Compile failed');
  };

  const finalizeAndCompile = async () => {
    if (!session) return;
    const captureId = session.id;

    stopScreenShare();
    setCompiling(true);

    try {
      // Compile endpoint marks the capture as compiled; no separate finalize request needed.
      const result = await compileWithRetry(captureId);

      toast(`Compiled ${result.steps_count} steps with Gemini`, 'success');
      router.push(`/team/${teamId}/playbooks/${result.playbook_id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Compile failed';
      toast(`Stop & compile failed: ${msg}`, 'error');
    } finally {
      setCompiling(false);
    }
  };

  /* ── cleanup on unmount ────────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      stopScreenShare();
    };
  }, [stopScreenShare]);

  /* ── manual event removal ──────────────────────────────────────────────── */

  const removeEvent = (idx: number) => {
    setEvents(prev => prev.filter((_, i) => i !== idx));
  };

  const isRecording = session !== null;

  /* ── start / stop Gemini Live session ─────────────────────────────────── */

  const startLiveSession = useCallback(async () => {
    try {
      await live.start();  // throws if connection fails — shows toast via onError
      setLiveActive(true); // only runs if truly connected (setupComplete received)
      toast('Gemini Live session active — speak to add context', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // onError already showed a toast with the technical reason;
      // show a user-friendly fallback only if nothing else showed
      console.error('[startLiveSession]', msg);
      setLiveActive(false);
    }
  }, [live, toast]);

  const stopLiveSession = useCallback(() => {
    live.stop();
    setLiveActive(false);
  }, [live]);

  /* ── render ────────────────────────────────────────────────────────────── */

  return (
    <PlatformShell teamId={teamId}>
      {/* Off-screen canvas for frame capture (not display:none — needs to render pixels) */}
      <canvas ref={canvasRef} style={{ position: 'absolute', left: -9999, top: -9999, pointerEvents: 'none' }} />

      <div className="mb-6">
        <p className="landing-kicker">Teach mode</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Capture a workflow</h1>
        <p className="mt-2 max-w-[70ch] text-[var(--app-muted)]">
          Share your screen and perform the workflow. Gemini will watch in real-time
          and detect every interaction — then compile it into a reusable playbook.
        </p>
      </div>

      {!isRecording ? (
        <>
          {/* ── Start new capture ──────────────────────────────────── */}
          <div className="panel max-w-2xl p-6">
            <h2 className="mb-4 text-lg font-bold">Start a new capture</h2>
            <p className="mb-4 text-sm text-[var(--app-muted)]">
              You&apos;ll be prompted to share your screen. Gemini Vision will analyze
              screenshots every {FRAME_INTERVAL_MS / 1000}s and detect your actions automatically.
            </p>
            <div className="flex gap-3">
              <input
                className="input flex-1"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Employee onboarding in Google Admin"
              />
              <button
                onClick={startCapture}
                disabled={starting}
                className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {starting ? (
                  <span className="animate-spin inline-flex">
                    <CircleNotch size={15} />
                  </span>
                ) : (
                  <Desktop size={15} weight="bold" />
                )}
                {starting ? 'Starting…' : 'Share screen & record'}
              </button>
            </div>
          </div>

          {/* ── Past captures ──────────────────────────────────────── */}
          {captures.length > 0 && (
            <section className="mt-6">
              <p className="landing-kicker mb-3">Previous captures</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {captures.map(cap => (
                  <div key={cap.id} className="panel-tight p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm">{cap.title}</h3>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${
                          cap.status === 'compiled'
                            ? 'bg-[rgba(123,155,134,0.18)] text-[#335443]'
                            : cap.status === 'completed'
                              ? 'bg-[rgba(191,155,106,0.18)] text-[#7d5d31]'
                              : 'bg-[rgba(95,119,132,0.18)] text-[#3f5e6f]'
                        }`}
                      >
                        {cap.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--app-muted)]">
                      {cap.raw_events.length} events recorded
                    </p>
                    {cap.playbook_id && (
                      <a
                        href={`/team/${teamId}/playbooks/${cap.playbook_id}`}
                        className="mt-2 inline-block text-xs font-semibold text-[var(--app-blue)] hover:underline"
                      >
                        View playbook &rarr;
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          {/* ── Recording session ──────────────────────────────────── */}
          <div className="panel p-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
                <h2 className="text-lg font-bold">Recording: {session.title}</h2>
              </div>
              <div className="flex items-center gap-3">
                {analyzing && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--app-muted)]">
                    <span className="inline-flex animate-pulse text-[var(--app-blue)]">
                      <Eye size={14} />
                    </span>
                    Gemini analyzing…
                  </span>
                )}
                <span className="text-xs text-[var(--app-muted)]">
                  {frameCount} frames · {events.length} events
                </span>

                {/* ── Gemini Live toggle ─── */}
                {!liveActive ? (
                  <button
                    onClick={startLiveSession}
                    title="Start a live voice session with Gemini"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-blue)]/30 bg-[var(--app-blue)]/8 px-3 py-1.5 text-xs font-semibold text-[var(--app-blue)] transition-all hover:bg-[var(--app-blue)]/14 hover:border-[var(--app-blue)]/50"
                  >
                    <WaveTriangle size={12} weight="fill" />
                    Start Live Session
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4a8566]/30 bg-[rgba(80,139,130,0.1)] px-3 py-1.5 text-xs font-semibold text-[#4a8566]">
                    <Microphone size={12} weight="fill" />
                    Live session active
                  </span>
                )}

                <button
                  onClick={finalizeAndCompile}
                  disabled={compiling || events.length === 0}
                  className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {compiling ? (
                    <span className="animate-spin inline-flex">
                      <CircleNotch size={15} />
                    </span>
                  ) : (
                    <Lightning size={15} weight="fill" />
                  )}
                  {compiling ? 'Compiling…' : 'Stop & compile'}
                </button>
              </div>
            </div>

            {/* Screen preview + timeline side by side */}
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Video preview */}
              <div className="lg:col-span-3">
                <div className="rounded-xl border border-[var(--app-line)] bg-black/5 overflow-hidden">
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    autoPlay
                    className="w-full aspect-video object-contain bg-black/90"
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--app-muted)] text-center">
                  Screen preview — Gemini analyses a frame every {FRAME_INTERVAL_MS / 1000}s
                </p>
              </div>

              {/* Live event timeline */}
              <div className="lg:col-span-2">
                <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
                  <span className="inline-flex text-red-500">
                    <Record size={14} weight="fill" />
                  </span>
                  Detected actions ({events.length})
                </h3>

                {events.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--app-line)] p-8 text-center">
                    <span className="mx-auto mb-3 inline-flex text-[var(--app-muted)] opacity-40">
                      <Eye size={32} />
                    </span>
                    <p className="text-sm text-[var(--app-muted)]">
                      Perform actions on the shared screen.
                      <br />
                      Gemini will detect them here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {events.map((ev, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-xl border border-[var(--app-line)] px-4 py-3 animate-in slide-in-from-top-1 fade-in duration-300"
                      >
                        <span className="font-mono text-xs text-[var(--app-muted)] w-6 shrink-0 pt-0.5">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                                KIND_COLORS[ev.kind] ?? KIND_COLORS.action
                              }`}
                            >
                              {ev.kind}
                            </span>
                            {ev.url && (
                              <span className="truncate text-[10px] font-mono text-[var(--app-muted)]">
                                {ev.url}
                              </span>
                            )}
                          </div>
                          {ev.text && (
                            <p className="text-sm text-[var(--app-fg)]">{ev.text}</p>
                          )}
                          {ev.selector && (
                            <code className="text-[10px] text-[var(--app-muted)] bg-[var(--app-surface-2)] px-1 rounded">
                              {ev.selector}
                            </code>
                          )}
                          {ev.value && (
                            <span className="block text-xs text-[var(--app-muted)] mt-0.5">
                              → {ev.value}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeEvent(idx)}
                          className="shrink-0 text-[var(--app-muted)] hover:text-red-500 transition-colors pt-0.5"
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Gemini Live panel (shown when active) ─────────────── */}
            {liveActive && (
              <div className="mt-5">
                <GeminiLivePanel
                  status={live.status}
                  transcript={live.transcript}
                  isMuted={live.isMuted}
                  onMute={live.mute}
                  onUnmute={live.unmute}
                  onStop={stopLiveSession}
                />
              </div>
            )}
          </div>
        </>
      )}
    </PlatformShell>
  );
}
