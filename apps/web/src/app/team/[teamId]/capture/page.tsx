'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CircleNotch, Lightning, Plus, Record, Stop, Trash } from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiGet, apiPost } from '@/lib/api';
import type { CaptureEventInput, CaptureSession, CompileResult } from '@/lib/types';

const EVENT_KINDS = ['navigate', 'click', 'input', 'submit', 'verify', 'wait'];

const KIND_COLORS: Record<string, string> = {
  navigate: 'bg-[var(--app-chip)] text-[var(--app-blue)]',
  click: 'bg-[rgba(123,155,134,0.18)] text-[#335443]',
  input: 'bg-[rgba(191,155,106,0.16)] text-[#7d5d31]',
  submit: 'bg-[rgba(95,119,132,0.18)] text-[#3f5e6f]',
  verify: 'bg-[rgba(123,155,134,0.25)] text-[#335443]',
  wait: 'bg-[var(--app-chip)] text-[var(--app-muted)]',
};

export default function CapturePage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  // Capture state
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [title, setTitle] = useState('');
  const [starting, setStarting] = useState(false);
  const [compiling, setCompiling] = useState(false);

  // Event builder
  const [events, setEvents] = useState<CaptureEventInput[]>([]);
  const [newEvent, setNewEvent] = useState<CaptureEventInput>({ kind: 'navigate' });

  // Past captures
  const [captures, setCaptures] = useState<CaptureSession[]>([]);

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
      const cap = await apiPost<CaptureSession>(`/teams/${teamId}/captures`, {
        title: title.trim(),
      });
      setSession(cap);
      toast('Recording started', 'success');
    } catch {
      toast('Failed to start capture', 'error');
    } finally {
      setStarting(false);
    }
  };

  const addEvent = useCallback(async () => {
    if (!session) return;
    const ev = { ...newEvent };
    if (!ev.kind) return;

    setEvents(prev => [...prev, ev]);

    try {
      await apiPost<CaptureSession>(`/captures/${session.id}/events`, [ev]);
    } catch {
      toast('Failed to save event', 'error');
    }

    setNewEvent({ kind: 'navigate' });
  }, [session, newEvent, toast]);

  const removeEvent = (idx: number) => {
    setEvents(prev => prev.filter((_, i) => i !== idx));
  };

  const finalizeAndCompile = async () => {
    if (!session) return;
    setCompiling(true);
    try {
      // Finalize
      await apiPost<CaptureSession>(`/captures/${session.id}/finalize`, {});

      // Compile with Gemini
      const result = await apiPost<CompileResult>(`/captures/${session.id}/compile`, {});

      toast(`Compiled ${result.steps_count} steps with Gemini`, 'success');
      router.push(`/team/${teamId}/playbooks/${result.playbook_id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Compile failed', 'error');
    } finally {
      setCompiling(false);
    }
  };

  const isRecording = session !== null;

  return (
    <PlatformShell teamId={teamId}>
      <div className="mb-6">
        <p className="landing-kicker">Teach mode</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Capture a workflow</h1>
        <p className="mt-2 max-w-[70ch] text-[var(--app-muted)]">
          Record the steps of a business process. Once captured, Gemini will compile
          them into a structured, reusable playbook with automatic variable detection.
        </p>
      </div>

      {!isRecording ? (
        <>
          {/* Start new capture */}
          <div className="panel max-w-2xl p-6">
            <h2 className="mb-4 text-lg font-bold">Start a new capture</h2>
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
                  <span className="animate-spin inline-flex"><CircleNotch size={15} /></span>
                ) : (
                  <Record size={15} weight="fill" />
                )}
                {starting ? 'Starting…' : 'Start recording'}
              </button>
            </div>
          </div>

          {/* Past captures */}
          {captures.length > 0 && (
            <section className="mt-6">
              <p className="landing-kicker mb-3">Previous captures</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {captures.map(cap => (
                  <div key={cap.id} className="panel-tight p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm">{cap.title}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${
                        cap.status === 'compiled'
                          ? 'bg-[rgba(123,155,134,0.18)] text-[#335443]'
                          : cap.status === 'completed'
                          ? 'bg-[rgba(191,155,106,0.18)] text-[#7d5d31]'
                          : 'bg-[rgba(95,119,132,0.18)] text-[#3f5e6f]'
                      }`}>
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
          {/* Recording session */}
          <div className="panel p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
                <h2 className="text-lg font-bold">Recording: {session.title}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={finalizeAndCompile}
                  disabled={compiling || events.length === 0}
                  className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {compiling ? (
                    <span className="animate-spin inline-flex"><CircleNotch size={15} /></span>
                  ) : (
                    <Lightning size={15} weight="fill" />
                  )}
                  {compiling ? 'Compiling with Gemini…' : 'Compile with Gemini'}
                </button>
              </div>
            </div>

            {/* Add event form */}
            <div className="rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-2)] p-4">
              <h3 className="mb-3 text-sm font-semibold">Add interaction step</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">Type</label>
                  <select
                    className="input"
                    value={newEvent.kind}
                    onChange={e => setNewEvent(prev => ({ ...prev, kind: e.target.value }))}
                  >
                    {EVENT_KINDS.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">URL</label>
                  <input
                    className="input"
                    value={newEvent.url ?? ''}
                    onChange={e => setNewEvent(prev => ({ ...prev, url: e.target.value || undefined }))}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">Selector</label>
                  <input
                    className="input"
                    value={newEvent.selector ?? ''}
                    onChange={e => setNewEvent(prev => ({ ...prev, selector: e.target.value || undefined }))}
                    placeholder="#email-field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">Value / Text</label>
                  <input
                    className="input"
                    value={newEvent.value ?? newEvent.text ?? ''}
                    onChange={e => {
                      const v = e.target.value || undefined;
                      setNewEvent(prev =>
                        prev.kind === 'input'
                          ? { ...prev, value: v }
                          : { ...prev, text: v }
                      );
                    }}
                    placeholder="john@company.com"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={addEvent}
                  className="btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
                >
                  <Plus size={14} weight="bold" />
                  Add step
                </button>
              </div>
            </div>

            {/* Timeline */}
            {events.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold text-[var(--app-muted)]">
                  Captured steps ({events.length})
                </h3>
                <div className="space-y-2">
                  {events.map((ev, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 rounded-xl border border-[var(--app-line)] px-4 py-3"
                    >
                      <span className="font-mono text-xs text-[var(--app-muted)] w-6 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                        KIND_COLORS[ev.kind] ?? KIND_COLORS.wait
                      }`}>
                        {ev.kind}
                      </span>
                      <span className="flex-1 truncate text-sm">
                        {ev.url && <span className="text-[var(--app-muted)] font-mono text-xs">{ev.url} </span>}
                        {ev.selector && <code className="text-xs bg-[var(--app-surface-2)] px-1 rounded">{ev.selector}</code>}
                        {(ev.value || ev.text) && (
                          <span className="ml-1 text-[var(--app-muted)]">&rarr; {ev.value || ev.text}</span>
                        )}
                      </span>
                      <button
                        onClick={() => removeEvent(idx)}
                        className="shrink-0 text-[var(--app-muted)] hover:text-red-500 transition-colors"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </PlatformShell>
  );
}
