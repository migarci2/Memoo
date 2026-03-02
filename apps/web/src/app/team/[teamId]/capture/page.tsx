'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet, apiPost } from '@/lib/api';
import { API_BASE_URL, toWsBase } from '@/lib/config';

type Member = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

type StartSessionResponse = {
  session_id: string;
  websocket_url: string;
};

type PageProps = {
  params: Promise<{ teamId: string }>;
};

export default function CapturePage({ params }: PageProps) {
  const [teamId, setTeamId] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string>('New workflow capture');
  const [status, setStatus] = useState<string>('idle');
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [actions, setActions] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    params.then(value => setTeamId(value.teamId));
  }, [params]);

  useEffect(() => {
    if (!teamId) return;
    apiGet<Member[]>(`/teams/${teamId}/members`)
      .then(data => {
        setMembers(data);
        if (data[0]) setSelectedUserId(data[0].id);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load members.'));
  }, [teamId]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const wsOrigin = useMemo(() => {
    const apiRoot = API_BASE_URL.replace(/\/api\/?$/, '');
    return toWsBase(apiRoot);
  }, []);

  async function startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError('Screen share permission denied.');
    }
  }

  async function startSession() {
    if (!teamId || !selectedUserId) return;

    setError(null);
    setStatus('starting');
    try {
      const data = await apiPost<StartSessionResponse>('/capture-sessions/start', {
        team_id: teamId,
        user_id: selectedUserId,
        title: sessionTitle,
      });

      setSessionId(data.session_id);
      setStatus('active');

      const ws = new WebSocket(`${wsOrigin}${data.websocket_url}`);
      wsRef.current = ws;

      ws.onmessage = event => {
        const payload = JSON.parse(event.data) as Record<string, unknown>;
        if (payload.type === 'normalized-action') {
          setActions(prev => [...prev, payload]);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection failed.');
      };
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Could not start capture session.');
    }
  }

  function sendEvent(kind: string) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const payload = {
      timestamp: new Date().toISOString(),
      kind,
      target: kind === 'navigate' ? 'navigation' : '#sample-element',
      value: kind === 'input' ? 'example input value' : undefined,
      url: window.location.href,
      metadata: {
        source: 'capture-lab',
      },
    };

    wsRef.current.send(JSON.stringify(payload));
    setEvents(prev => [...prev, payload]);
  }

  async function finalizeSession() {
    if (!sessionId) return;
    setStatus('finalizing');
    try {
      await apiPost(`/capture-sessions/${sessionId}/finalize`, {
        create_playbook: true,
        playbook_name: sessionTitle,
        description: 'Playbook generated from Gemini Live capture lab.',
        created_by: selectedUserId,
      });
      wsRef.current?.close();
      setStatus('finalized');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finalize session.');
    }
  }

  return (
    <PlatformShell
      teamId={teamId}
      title="Gemini Live Capture Lab"
      subtitle="Capture browser events, stream them to the backend in real time, and normalize them into executable playbook actions."
    >
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="panel p-5">
          <h2 className="text-2xl font-bold">Session setup</h2>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-medium">
              Operator
              <select
                className="input"
                value={selectedUserId}
                onChange={event => setSelectedUserId(event.target.value)}
              >
                {members.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.full_name} · {member.role}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Session title
              <input
                className="input"
                value={sessionTitle}
                onChange={event => setSessionTitle(event.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={startScreenShare} type="button">
              Share screen
            </button>
            <button className="btn-primary" onClick={startSession} type="button" disabled={status !== 'idle'}>
              {status === 'starting' ? 'Starting...' : 'Start Gemini Live session'}
            </button>
            <button className="btn-primary" onClick={finalizeSession} type="button" disabled={!sessionId || status === 'finalized'}>
              Finalize and create playbook
            </button>
          </div>

          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

          <p className="mt-3 text-sm text-[var(--app-muted)]">
            Status: <strong>{status}</strong> {sessionId ? `· session ${sessionId.slice(0, 8)}` : ''}
          </p>

          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="mt-4 h-[260px] w-full rounded-2xl border border-[var(--app-line)] bg-black/80 object-cover"
          />
        </article>

        <article className="panel p-5">
          <h2 className="text-2xl font-bold">Event stream</h2>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-secondary" type="button" onClick={() => sendEvent('navigate')} disabled={!sessionId}>
              Simulate navigate
            </button>
            <button className="btn-secondary" type="button" onClick={() => sendEvent('click')} disabled={!sessionId}>
              Simulate click
            </button>
            <button className="btn-secondary" type="button" onClick={() => sendEvent('input')} disabled={!sessionId}>
              Simulate input
            </button>
            <button className="btn-secondary" type="button" onClick={() => sendEvent('submit')} disabled={!sessionId}>
              Simulate submit
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="panel-tight p-3">
              <h3 className="font-bold">Raw events ({events.length})</h3>
              <pre className="mt-2 max-h-64 overflow-auto text-xs text-[var(--app-muted)]">
                {JSON.stringify(events.slice(-8), null, 2)}
              </pre>
            </div>
            <div className="panel-tight p-3">
              <h3 className="font-bold">Normalized actions ({actions.length})</h3>
              <pre className="mt-2 max-h-64 overflow-auto text-xs text-[var(--app-muted)]">
                {JSON.stringify(actions.slice(-8), null, 2)}
              </pre>
            </div>
          </div>
        </article>
      </section>
    </PlatformShell>
  );
}
