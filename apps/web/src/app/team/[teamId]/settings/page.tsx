'use client';

import { useEffect, useState } from 'react';
import { CircleNotch, EnvelopeSimple, UserCircle } from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiGet, apiPost } from '@/lib/api';
import type { TeamMember } from '@/lib/types';

type Props = {
  params: Promise<{ teamId: string }>;
};

// ─── Client component (uses hooks) ──────────────────────────────────────────

function SettingsContent({ teamId }: { teamId: string }) {
  const { toast } = useToast();

  // Members state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    setLoadingMembers(true);
    apiGet<TeamMember[]>(`/teams/${teamId}/members`)
      .then(setMembers)
      .catch(() => toast('Failed to load members', 'error'))
      .finally(() => setLoadingMembers(false));
  }, [teamId, toast]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await apiPost(`/teams/${teamId}/invites`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      toast(`Invite sent to ${inviteEmail}`, 'success');
      setInviteEmail('');
    } catch {
      toast('Failed to send invite', 'error');
    } finally {
      setInviting(false);
    }
  };

  const ROLE_BADGE: Record<string, string> = {
    owner: 'bg-[rgba(191,155,106,0.2)] text-[#7d5d31]',
    admin: 'bg-[rgba(95,119,132,0.2)] text-[#3f5e6f]',
    member: 'bg-[var(--app-chip)] text-[var(--app-muted)]',
  };

  return (
    <PlatformShell teamId={teamId}>
      <div className="mb-6">
        <p className="landing-kicker">Configuration</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Team settings</h1>
      </div>

      <div className="space-y-6">
        {/* Invite form */}
        <div className="panel p-6">
          <h2 className="mb-4 text-lg font-bold">Invite a team member</h2>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="mb-1.5 block text-sm font-semibold">Email address</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)] inline-flex">
                  <EnvelopeSimple size={16} />
                </span>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="input pl-9"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Role</label>
              <select
                className="input"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'member' | 'admin')}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="btn-primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {inviting && <span className="animate-spin inline-flex"><CircleNotch size={15} /></span>}
              Send invite
            </button>
          </form>
        </div>

        {/* Members list */}
        <div className="panel overflow-hidden p-0">
          <div className="border-b border-[var(--app-line)] px-5 py-4">
            <h2 className="font-bold">Members ({members.length})</h2>
          </div>
          {loadingMembers ? (
            <div className="flex items-center justify-center py-10">
              <span className="animate-spin text-[var(--app-muted)] inline-flex"><CircleNotch size={24} /></span>
            </div>
          ) : members.length === 0 ? (
            <div className="px-5 py-8 text-center text-[var(--app-muted)]">No members yet.</div>
          ) : (
            <ul className="divide-y divide-[var(--app-line)]">
              {members.map(m => (
                <li key={m.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--app-chip)] text-sm font-bold uppercase">
                    {m.full_name ? m.full_name.slice(0, 2) : <span className="inline-flex"><UserCircle size={20} /></span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-semibold">{m.full_name}</p>
                    <p className="truncate text-xs text-[var(--app-muted)]">{m.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                      ROLE_BADGE[m.role] ?? ROLE_BADGE.member
                    }`}
                  >
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PlatformShell>
  );
}

// ─── Page shell (async, awaits params) ──────────────────────────────────────

export default async function SettingsPage({ params }: Props) {
  const { teamId } = await params;
  return <SettingsContent teamId={teamId} />;
}
