'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleNotch, Sparkle, Trash } from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiPost } from '@/lib/api';

type StepInput = {
  title: string;
  step_type: string;
};

type PageProps = {
  params: Promise<{ teamId: string }>;
};

export default function NewPlaybookPage({ params }: PageProps) {
  const { teamId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [steps, setSteps] = useState<StepInput[]>([
    { title: 'Navigate to target page', step_type: 'navigate' },
    { title: 'Fill in required fields', step_type: 'input' },
    { title: 'Submit and verify', step_type: 'submit' },
  ]);
  const [saving, setSaving] = useState(false);
  const [polishing, setPolishing] = useState(false);

  function updateStep(index: number, patch: Partial<StepInput>) {
    setSteps(prev => prev.map((step, idx) => (idx === index ? { ...step, ...patch } : step)));
  }

  function addStep() {
    setSteps(prev => [...prev, { title: '', step_type: 'action' }]);
  }

  function removeStep(index: number) {
    setSteps(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function polishDescription() {
    setPolishing(true);
    try {
      const res = await fetch('/api/ai/playbook-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: name || 'Untitled playbook',
          steps: steps.map(s => s.title),
        }),
      });
      const data = (await res.json()) as { summary: string };
      setDescription(data.summary);
      toast('Description generated', 'success');
    } catch {
      toast('Could not generate description', 'error');
    } finally {
      setPolishing(false);
    }
  }

  async function savePlaybook(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId || !name) return;
    setSaving(true);

    try {
      const created = await apiPost<{ id: string }>(`/teams/${teamId}/playbooks`, {
        team_id: teamId,
        name,
        description,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        steps: steps.map(step => ({ ...step, variables: {}, guardrails: {} })),
      });
      toast('Playbook created!', 'success');
      router.push(`/team/${teamId}/playbooks/${created.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create playbook', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlatformShell teamId={teamId}>
      <div className="mb-6">
        <p className="landing-kicker">Automation</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">New playbook</h1>
      </div>

      <form onSubmit={savePlaybook} className="max-w-2xl space-y-6">
        {/* Basic info */}
        <div className="panel p-6">
          <h2 className="mb-4 text-lg font-bold">Basic info</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                className="input"
                placeholder="e.g. Onboard new customer"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Tags</label>
              <input
                className="input"
                placeholder="ops, billing, crm"
                value={tags}
                onChange={e => setTags(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-semibold">Description</label>
              <button
                type="button"
                onClick={polishDescription}
                disabled={polishing}
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--app-blue)] hover:underline disabled:opacity-60"
              >
                {polishing ? (
                  <span className="animate-spin inline-flex"><CircleNotch size={13} /></span>
                ) : (
                  <Sparkle size={13} />
                )}
                AI generate
              </button>
            </div>
            <textarea
              className="input min-h-[6rem]"
              placeholder="Describe what this playbook does…"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Steps</h2>
            <button
              type="button"
              onClick={addStep}
              className="btn-secondary rounded-full px-3 py-1.5 text-xs"
            >
              + Add step
            </button>
          </div>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={index}
                className="grid items-end gap-3 rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-2)]/40 p-4 sm:grid-cols-[1fr_160px_auto]"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--app-muted)]">
                    Step {index + 1}
                  </label>
                  <input
                    className="input text-sm"
                    placeholder="Step title"
                    value={step.title}
                    onChange={e => updateStep(index, { title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--app-muted)]">
                    Type
                  </label>
                  <select
                    className="input text-sm"
                    value={step.step_type}
                    onChange={e => updateStep(index, { step_type: e.target.value })}
                  >
                    <option value="navigate">navigate</option>
                    <option value="input">input</option>
                    <option value="click">click</option>
                    <option value="submit">submit</option>
                    <option value="validate">validate</option>
                    <option value="action">action</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  disabled={steps.length === 1}
                  className="mb-px text-[var(--app-muted)] transition-colors hover:text-red-500 disabled:opacity-30"
                  aria-label="Remove step"
                >
                  <Trash size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !name}
            className="btn-primary flex items-center gap-2 rounded-full px-6 py-2.5 font-semibold disabled:opacity-60"
          >
            {saving && <span className="animate-spin inline-flex"><CircleNotch size={16} /></span>}
            Create playbook
          </button>
          <a href={`/team/${teamId}/playbooks`} className="btn-secondary rounded-full px-5 py-2.5 text-sm">
            Cancel
          </a>
        </div>
      </form>
    </PlatformShell>
  );
}
