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

const FRAME_INTERVAL_MS = 4_000;

const KIND_COLORS: Record<string, string> = {
  navigate: 'bg-slate-50 text-slate-700 border-slate-100',
  click: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  input: 'bg-amber-50 text-amber-700 border-amber-100',
  submit: 'bg-blue-50 text-blue-700 border-blue-100',
  verify: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  wait: 'bg-gray-50 text-gray-600 border-gray-100',
  action: 'bg-slate-50 text-slate-700 border-slate-100',
  voice_note: 'bg-[rgba(15,103,143,0.08)] text-[var(--app-blue)] border-[rgba(15,103,143,0.12)]',
  gemini_clarification: 'bg-[rgba(217,138,63,0.1)] text-[var(--app-brand-sand)] border-[rgba(217,138,63,0.14)]',
};

export default function CapturePage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [session, setSession] = useState<CaptureSession | null>(null);
  const [title, setTitle] = useState('');
  const [starting, setStarting] = useState(false);
  const [compiling, setCompiling] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [streamReady, setStreamReady] = useState(false);
  const [frameSummary, setFrameSummary] = useState('');
  const [lastGroundedEvent, setLastGroundedEvent] = useState<CaptureEventInput | null>(null);

  const [events, setEvents] = useState<CaptureEventInput[]>([]);
  const [captures, setCaptures] = useState<CaptureSession[]>([]);

  const [liveActive, setLiveActive] = useState(false);
  const liveActiveRef = useRef(false);
  useEffect(() => { liveActiveRef.current = liveActive; }, [liveActive]);

  const { start: liveStart, stop: liveStop, sendContextUpdate: liveSend, status: liveStatus, transcript, isMuted, mute, unmute } = useGeminiLive({
    onError: (msg) => toast(msg, 'error'),
    onVoiceNote: (text, role) => {
      const captureId = captureIdRef.current;
      if (!captureId || !text.trim()) {
        return;
      }

      const note: CaptureEventInput = {
        kind: role === 'user' ? 'voice_note' : 'gemini_clarification',
        text,
        timestamp: new Date().toISOString(),
        source: role === 'user' ? 'navigator_user_voice' : 'navigator_gemini_voice',
      };

      setEvents(prev => [...prev, note]);
      void apiPost<CaptureSession>(`/captures/${captureId}/events`, [note]).catch(err => {
        console.error('[capture] failed to persist voice note', err);
      });
    },
  });

  useEffect(() => {
    if (!liveActive) return;
    if (liveStatus === 'idle' || liveStatus === 'error') {
      setLiveActive(false);
    }
  }, [liveActive, liveStatus]);

  useEffect(() => {
    apiGet<CaptureSession[]>(`/teams/${teamId}/captures`)
      .then(setCaptures)
      .catch(() => {});
  }, [teamId]);

  const startCapture = async () => {
    if (!title.trim()) {
      toast('Give your capture a title', 'error');
      return;
    }
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 5 } },
        audio: false,
      });
      stream.getVideoTracks()[0].addEventListener('ended', () => stopScreenShare());
      streamRef.current = stream;
      const cap = await apiPost<CaptureSession>(`/teams/${teamId}/captures`, { title: title.trim() });
      captureIdRef.current = cap.id;
      setEvents([]);
      setFrameCount(0);
      setFrameSummary('');
      setLastGroundedEvent(null);
      setSession(cap);
      setStreamReady(true);
      toast('Screen recording started', 'success');
    } catch {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStreamReady(false);
      toast('Failed to start capture', 'error');
    } finally {
      setStarting(false);
    }
  };

  const captureAndAnalyze = useCallback(async () => {
    const captureId = captureIdRef.current;
    if (!captureId || busyRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

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
      if (!base64) return;

      setFrameCount(prev => prev + 1);
      const result = await apiPost<FrameAnalysisResult>(`/captures/${captureId}/analyze-frame`, { image: base64, mime_type: 'image/jpeg' });
      setFrameSummary(result.frame_summary ?? '');
      if (result.detected && result.events.length > 0) {
        const newEvents = result.events.map(e => ({
          kind: e.kind,
          url: e.url ?? undefined,
          selector: e.selector ?? undefined,
          value: e.value ?? undefined,
          text: e.text ?? undefined,
          timestamp: e.timestamp ?? new Date().toISOString(),
          confidence: e.confidence ?? undefined,
          evidence: e.evidence ?? [],
          observed_text: e.observed_text ?? undefined,
          frame_summary: result.frame_summary ?? undefined,
          source: e.source ?? undefined,
        }));
        setEvents(prev => [...prev, ...newEvents]);
        setLastGroundedEvent(newEvents[newEvents.length - 1] ?? null);
        if (liveActiveRef.current) {
          for (const ev of newEvents) {
            liveSend(ev.text ?? `${ev.kind}${ev.url ? ` on ${ev.url}` : ''}`);
          }
        }
      }
    } catch (err) {
      console.error('[capture] analysis failed', err);
    } finally {
      busyRef.current = false;
      setAnalyzing(false);
    }
  }, [liveSend]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || !streamReady) return;
    video.srcObject = stream;
    video.play().then(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(captureAndAnalyze, FRAME_INTERVAL_MS);
    }).catch(() => {});
  }, [streamReady, captureAndAnalyze]);

  const stopScreenShare = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    captureIdRef.current = null;
    setStreamReady(false);
    if (liveActiveRef.current) { liveStop(); setLiveActive(false); }
  }, [liveStop]);

  const finalizeAndCompile = async () => {
    if (!session) return;
    stopScreenShare();
    setCompiling(true);
    try {
      const result = await apiPost<CompileResult>(`/captures/${session.id}/compile`, {});
      toast(`Compiled ${result.steps_count} steps`, 'success');
      router.push(`/team/${teamId}/playbooks/${result.playbook_id}`);
    } catch {
      toast('Compile failed', 'error');
    } finally {
      setCompiling(false);
    }
  };

  useEffect(() => { return () => stopScreenShare(); }, [stopScreenShare]);

  const startLiveSession = async () => {
    try {
      await liveStart();
      setLiveActive(true);
      toast('Live session active', 'success');
    } catch {
      setLiveActive(false);
    }
  };

  const groundedEvents = events.filter(
    event => event.kind !== 'voice_note' && event.kind !== 'gemini_clarification',
  );
  const latestTimelineEvent = events[events.length - 1] ?? null;

  return (
    <PlatformShell 
      teamId={teamId}
      title="Teach Mode"
      subtitle="Memoo sees the browser, hears voice context, and compiles grounded playbooks from what actually happened on screen."
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', left: -9999, top: -9999 }} />

      {!session ? (
        <div className="space-y-6">
          <section className="panel max-w-2xl p-6">
            <h2 className="mb-4 text-lg font-bold">New Capture</h2>
            <div className="flex gap-3">
              <input
                className="input flex-1"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Employee onboarding flow"
              />
              <button
                onClick={startCapture}
                disabled={starting}
                className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm"
              >
                {starting ? (
                  <span className="flex animate-spin">
                    <CircleNotch size={14} />
                  </span>
                ) : (
                  <Record size={14} weight="fill" />
                )}
                {starting ? 'Starting…' : 'Record'}
              </button>
            </div>
          </section>

          {captures.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)] px-1">Previous Captures</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {captures.map(cap => (
                  <div key={cap.id} className="panel p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm truncate">{cap.title}</h3>
                      <span className="rounded-md bg-[rgba(27,42,74,0.05)] border border-[rgba(27,42,74,0.05)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--app-muted)]">
                        {cap.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--app-muted)]">{cap.raw_events.length} events recorded</p>
                    {cap.playbook_id && (
                      <button
                        onClick={() => router.push(`/team/${teamId}/playbooks/${cap.playbook_id}`)}
                        className="mt-3 text-xs font-bold text-[var(--app-brand-sand)] hover:underline"
                      >
                        View playbook &rarr;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                <h2 className="font-bold">{session.title}</h2>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                  Screen live
                </span>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                  analyzing
                    ? 'border-[rgba(15,103,143,0.12)] bg-[rgba(15,103,143,0.08)] text-[var(--app-blue)]'
                    : 'border-[var(--app-line-soft)] bg-white text-[var(--app-muted)]'
                }`}>
                  {analyzing ? 'Vision analyzing' : 'Vision ready'}
                </span>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                  liveActive
                    ? 'border-[rgba(217,138,63,0.16)] bg-[rgba(217,138,63,0.1)] text-[var(--app-brand-sand)]'
                    : 'border-[var(--app-line-soft)] bg-white text-[var(--app-muted)]'
                }`}>
                  {liveActive ? 'Voice live' : 'Voice optional'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!liveActive ? (
                <button
                  onClick={startLiveSession}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--app-line-soft)] px-3 py-1.5 text-xs font-bold text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.02)]"
                >
                  <WaveTriangle size={12} weight="fill" />
                  Start Navigator voice
                </button>
              ) : (
                <button
                  onClick={() => { liveStop(); setLiveActive(false); }}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                >
                  <Microphone size={12} weight="fill" />
                  Voice active
                </button>
              )}

              <button
                onClick={finalizeAndCompile}
                disabled={compiling || groundedEvents.length === 0}
                className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm"
              >
                {compiling ? (
                  <span className="flex animate-spin">
                    <CircleNotch size={14} />
                  </span>
                ) : (
                  <Lightning size={14} weight="fill" />
                )}
                {compiling ? 'Compiling…' : 'Compile Playbook'}
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              <div className="panel overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-[var(--app-line-soft)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-lg bg-[rgba(27,42,74,0.06)] p-2 text-[var(--app-muted)]">
                      <Desktop size={16} weight="fill" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                        Screen stream
                      </p>
                      <p className="text-sm font-semibold">Live browser capture</p>
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-[var(--app-muted)]">
                    Frames analyzed: {frameCount}
                  </p>
                </div>
                <div className="bg-black/5 p-2">
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    autoPlay
                    className="aspect-video w-full rounded-lg bg-black/95 object-contain shadow-2xl"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="panel p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                    Grounded detections
                  </p>
                  <p className="mt-1 text-2xl font-bold">{groundedEvents.length}</p>
                </div>
                <div className="panel p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                    Voice exchanges
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {events.filter(event => event.kind === 'voice_note' || event.kind === 'gemini_clarification').length}
                  </p>
                </div>
                <div className="panel p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                    Latest mode
                  </p>
                  <p className="mt-1 text-sm font-bold capitalize">
                    {latestTimelineEvent?.kind?.replace('_', ' ') || 'Waiting for context'}
                  </p>
                </div>
              </div>

              {liveActive || transcript.length > 0 ? (
                <GeminiLivePanel
                  status={liveStatus}
                  transcript={transcript}
                  isMuted={isMuted}
                  onMute={mute}
                  onUnmute={unmute}
                  onStop={() => {
                    liveStop();
                    setLiveActive(false);
                  }}
                />
              ) : (
                <div className="panel border-dashed p-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex rounded-lg bg-[rgba(217,138,63,0.1)] p-2 text-[var(--app-brand-sand)]">
                      <WaveTriangle size={16} weight="fill" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Navigator voice makes Teach Mode feel live.</p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--app-muted)]">
                        The screen observer sends grounded actions, and the voice copilot asks short follow-ups when the intent is ambiguous.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 lg:col-span-2">
              <div className="panel p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Eye size={16} className="text-[var(--app-blue)]" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                      Navigator grounding
                    </p>
                    <p className="text-sm font-semibold">What the model can currently justify on screen</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                    Current frame
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">
                    {frameSummary || 'Waiting for the first grounded frame summary from the screen observer.'}
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-[var(--app-line-soft)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                        Latest grounded event
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {lastGroundedEvent?.text || 'No grounded action detected yet'}
                      </p>
                    </div>
                    {lastGroundedEvent?.confidence != null && (
                      <span className="rounded-full border border-[rgba(15,103,143,0.14)] bg-[rgba(15,103,143,0.08)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-blue)]">
                        {Math.round(lastGroundedEvent.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>

                  {lastGroundedEvent?.observed_text && (
                    <p className="mt-3 rounded-lg bg-[rgba(27,42,74,0.03)] px-3 py-2 text-xs font-medium text-[var(--app-muted)]">
                      Observed text: {lastGroundedEvent.observed_text}
                    </p>
                  )}

                  {lastGroundedEvent?.evidence && lastGroundedEvent.evidence.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {lastGroundedEvent.evidence.map((item, index) => (
                        <span
                          key={`${item}-${index}`}
                          className="rounded-full border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] px-2.5 py-1 text-[10px] font-bold text-[var(--app-muted)]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Live timeline ({events.length})
                </h3>
                {events.length === 0 ? (
                  <div className="panel border-dashed bg-[rgba(27,42,74,0.01)] p-8 text-center">
                    <span className="mx-auto mb-3 block text-[var(--app-muted)] opacity-20">
                      <Eye size={32} />
                    </span>
                    <p className="text-sm text-[var(--app-muted)]">
                      Memoo is waiting for a grounded browser interaction or voice note.
                    </p>
                  </div>
                ) : (
                  <div className="scrollbar-hide max-h-[760px] space-y-2 overflow-y-auto pr-2">
                    {events.map((ev, idx) => (
                      <div key={`${ev.kind}-${idx}-${ev.timestamp ?? 't'}`} className="panel p-3">
                        <div className="flex items-start gap-3">
                          <span className="w-5 pt-0.5 text-[10px] font-mono font-bold text-[var(--app-muted)]">
                            {(idx + 1).toString().padStart(2, '0')}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className={`rounded-md border p-1 px-1.5 text-[9px] font-bold uppercase ${KIND_COLORS[ev.kind] || KIND_COLORS.action}`}>
                                {ev.kind.replace('_', ' ')}
                              </span>
                              {ev.confidence != null && (
                                <span className="rounded-full bg-[rgba(27,42,74,0.05)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                                  {Math.round(ev.confidence * 100)}%
                                </span>
                              )}
                              {ev.timestamp && (
                                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                                  {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>

                            {ev.text && <p className="text-sm font-bold leading-snug">{ev.text}</p>}
                            {ev.url && <p className="mt-1 truncate font-mono text-[10px] text-[var(--app-muted)]">{ev.url}</p>}
                            {ev.value && <p className="mt-1 truncate text-[10px] text-[var(--app-muted)]">Value: {ev.value}</p>}
                            {ev.observed_text && (
                              <p className="mt-2 text-xs leading-relaxed text-[var(--app-muted)]">
                                Observed text: {ev.observed_text}
                              </p>
                            )}
                            {ev.frame_summary && ev.kind !== 'voice_note' && ev.kind !== 'gemini_clarification' && (
                              <p className="mt-2 text-xs leading-relaxed text-[var(--app-muted)]">
                                Frame: {ev.frame_summary}
                              </p>
                            )}
                            {ev.evidence && ev.evidence.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {ev.evidence.map((item, evidenceIndex) => (
                                  <span
                                    key={`${item}-${evidenceIndex}`}
                                    className="rounded-full border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] px-2 py-1 text-[10px] font-bold text-[var(--app-muted)]"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setEvents(prev => prev.filter((_, i) => i !== idx))}
                            className="text-[var(--app-muted)] transition-colors hover:text-red-500"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PlatformShell>
  );
}
