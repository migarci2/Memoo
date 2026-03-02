'use client';

import { useEffect, useState } from 'react';

import { PlatformShell } from '@/components/platform-shell';
import { apiPost } from '@/lib/api';

type StepInput = {
  title: string;
  step_type: string;
};

type PageProps = {
  params: Promise<{ teamId: string }>;
};

export default function NewPlaybookPage({ params }: PageProps) {
  const [teamId, setTeamId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('ops, automation');
  const [steps, setSteps] = useState<StepInput[]>([
    { title: 'Navigate to target page', step_type: 'navigate' },
    { title: 'Fill input fields', step_type: 'input' },
    { title: 'Submit and verify success', step_type: 'submit' },
  ]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    params.then(value => setTeamId(value.teamId));
  }, [params]);

  function updateStep(index: number, patch: Partial<StepInput>) {
    setSteps(prev => prev.map((step, idx) => (idx === index ? { ...step, ...patch } : step)));
  }

  function addStep() {
    setSteps(prev => [...prev, { title: 'New step', step_type: 'action' }]);
  }

  async function polishDescription() {
    setMessage('Generating description...');
    try {
      const res = await fetch('/api/ai/playbook-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: name || 'Untitled playbook',
          steps: steps.map(step => step.title),
        }),
      });
      const data = (await res.json()) as { summary: string };
      setDescription(data.summary);
      setMessage('Description generated with Vercel AI SDK.');
    } catch {
      setMessage('Could not generate description.');
    }
  }

  async function savePlaybook() {
    if (!teamId || !name) return;
    setSaving(true);
    setMessage(null);

    try {
      await apiPost(`/teams/${teamId}/playbooks`, {
        team_id: teamId,
        name,
        description,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        steps: steps.map(step => ({
          ...step,
          variables: {},
          guardrails: {},
        })),
      });
      setMessage('Playbook created successfully.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not create playbook.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlatformShell
      teamId={teamId}
      title="Create Playbook"
      subtitle="Define steps, generate concise copy with AI SDK, and publish versioned playbooks to your team workspace."
    >
      <section className="panel p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Playbook name
            <input className="input" value={name} onChange={event => setName(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Tags (comma separated)
            <input className="input" value={tags} onChange={event => setTags(event.target.value)} />
          </label>
        </div>

        <label className="mt-4 grid gap-2 text-sm font-medium">
          Description
          <textarea
            className="input min-h-28"
            value={description}
            onChange={event => setDescription(event.target.value)}
          />
        </label>

        <button className="btn-secondary mt-3" onClick={polishDescription} type="button">
          AI polish description
        </button>

        <div className="mt-5 grid gap-3">
          {steps.map((step, index) => (
            <div key={`step-${index}`} className="panel-tight grid gap-3 p-4 md:grid-cols-[1fr_160px]">
              <label className="grid gap-2 text-sm font-medium">
                Step title
                <input
                  className="input"
                  value={step.title}
                  onChange={event => updateStep(index, { title: event.target.value })}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Type
                <select
                  className="input"
                  value={step.step_type}
                  onChange={event => updateStep(index, { step_type: event.target.value })}
                >
                  <option value="navigate">navigate</option>
                  <option value="input">input</option>
                  <option value="click">click</option>
                  <option value="submit">submit</option>
                  <option value="validate">validate</option>
                  <option value="action">action</option>
                </select>
              </label>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={addStep} type="button">
            Add step
          </button>
          <button className="btn-primary" disabled={saving} onClick={savePlaybook} type="button">
            {saving ? 'Saving...' : 'Create playbook'}
          </button>
        </div>

        {message ? <p className="mt-3 text-sm text-[var(--app-muted)]">{message}</p> : null}
      </section>
    </PlatformShell>
  );
}
