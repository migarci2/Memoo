'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { PlatformShell } from '@/components/platform-shell';
import { apiPost } from '@/lib/api';

type BootstrapResponse = {
  team: { id: string; name: string; slug: string };
  owner: { id: string; full_name: string; email: string };
  next_step: string;
};

export default function OnboardingPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    team_name: 'Northline Operations',
    team_slug: 'northline-ops',
    team_domain: 'northline.io',
    owner_name: 'Amaya Voss',
    owner_email: 'amaya@northline.io',
    owner_title: 'Head of Operations',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiPost<BootstrapResponse>('/onboarding/team', form);
      router.push(`/team/${data.team.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create workspace.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PlatformShell
      title="Team Onboarding"
      subtitle="Create a team workspace with owner account, onboarding progression, and collaboration defaults."
    >
      <section className="panel mx-auto max-w-3xl p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Team name
            <input
              className="input"
              value={form.team_name}
              onChange={e => setForm(prev => ({ ...prev, team_name: e.target.value }))}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Team slug
            <input
              className="input"
              value={form.team_slug}
              onChange={e => setForm(prev => ({ ...prev, team_slug: e.target.value.toLowerCase() }))}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Team domain
            <input
              className="input"
              value={form.team_domain}
              onChange={e => setForm(prev => ({ ...prev, team_domain: e.target.value }))}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Owner name
            <input
              className="input"
              value={form.owner_name}
              onChange={e => setForm(prev => ({ ...prev, owner_name: e.target.value }))}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Owner email
            <input
              className="input"
              type="email"
              value={form.owner_email}
              onChange={e => setForm(prev => ({ ...prev, owner_email: e.target.value }))}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Owner title
            <input
              className="input"
              value={form.owner_title}
              onChange={e => setForm(prev => ({ ...prev, owner_title: e.target.value }))}
            />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-primary" disabled={loading} onClick={submit} type="button">
            {loading ? 'Creating workspace...' : 'Create workspace'}
          </button>
        </div>
      </section>
    </PlatformShell>
  );
}
