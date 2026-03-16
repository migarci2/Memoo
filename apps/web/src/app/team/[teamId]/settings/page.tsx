'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CircleNotch, EnvelopeSimple, UserCircle, UserPlus, CheckCircle } from '@phosphor-icons/react';

import { useAuth } from '@/components/auth-provider';
import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import type { Team, TeamMember, TeamMemberCreateInput, TeamMemberProfileUpdate, TeamUpdateInput } from '@/lib/types';
 
export default function SettingsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { session, updateSession } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [profileName, setProfileName] = useState('');
  const [profileTitle, setProfileTitle] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);

  // Invite-by-email state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);

  const loadMembers = () => {
    setLoadingMembers(true);
    apiGet<TeamMember[]>(`/teams/${teamId}/members`)
      .then(setMembers)
      .catch(() => toast('Failed to load members', 'error'))
      .finally(() => setLoadingMembers(false));
  };

  useEffect(() => {
    loadMembers();
  }, [teamId]);

  const currentUser = session ? members.find(m => m.id === session.user_id) : null;

  useEffect(() => {
    if (!currentUser) return;
    setProfileName(currentUser.full_name ?? '');
    setProfileTitle(currentUser.job_title ?? '');
  }, [currentUser]);

  useEffect(() => {
    setTeamName(session?.team_name ?? '');
  }, [session?.team_name]);

  const canEditTeam = session?.role === 'owner' || session?.role === 'admin';

  const saveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditTeam) return;
    setSavingTeam(true);
    try {
      const updated = await apiPatch<Team>(`/teams/${teamId}`, { name: teamName.trim() });
      updateSession({ team_name: updated.name });
      toast('Team name updated', 'success');
    } catch {
      toast('Failed to update team', 'error');
    } finally {
      setSavingTeam(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !profileName.trim()) return;
    setSavingProfile(true);
    try {
      const payload: TeamMemberProfileUpdate = {
        full_name: profileName.trim(),
        job_title: profileTitle.trim() || null,
      };
      const updated = await apiPatch<TeamMember>(`/teams/${teamId}/members/${session.user_id}`, payload);
      setMembers(prev => prev.map(m => (m.id === updated.id ? updated : m)));
      updateSession({ full_name: updated.full_name });
      toast('Profile updated', 'success');
    } catch {
      toast('Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

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
    owner: 'bg-amber-50 text-amber-700 border-amber-100',
    admin: 'bg-slate-50 text-slate-700 border-slate-100',
    member: 'bg-gray-50 text-gray-600 border-gray-100',
  };

  return (
    <PlatformShell 
      teamId={teamId}
      title="Settings"
      subtitle="Manage your team profile, your own account, and the people in your workspace."
    >
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="panel p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--app-muted)]">Team Profile</h2>
            <form onSubmit={saveTeam} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">Workspace name</label>
                <input
                  className="input"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  disabled={!canEditTeam}
                />
              </div>
              <button
                type="submit"
                disabled={savingTeam || !canEditTeam}
                className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm"
              >
                {savingTeam ? (
                  <span className="flex animate-spin">
                    <CircleNotch size={14} />
                  </span>
                ) : (
                  <CheckCircle size={14} weight="bold" />
                )}
                Update team
              </button>
            </form>
          </section>

          <section className="panel p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--app-muted)]">Your Profile</h2>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">Full name</label>
                  <input
                    className="input"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">Job title</label>
                  <input
                    className="input"
                    value={profileTitle}
                    onChange={e => setProfileTitle(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm"
              >
                {savingProfile ? (
                  <span className="flex animate-spin">
                    <CircleNotch size={14} />
                  </span>
                ) : (
                  <CheckCircle size={14} weight="bold" />
                )}
                Save profile
              </button>
            </form>
          </section>
        </div>

        <section className="panel p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--app-muted)]">Invite Team Member</h2>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">Email address</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">Role</label>
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
              className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm"
            >
              {inviting ? (
                <span className="flex animate-spin">
                  <CircleNotch size={14} />
                </span>
              ) : (
                <UserPlus size={14} weight="bold" />
              )}
              Send invite
            </button>
          </form>
        </section>

        <section className="panel overflow-hidden p-0">
          <div className="border-b border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.01)] px-5 py-3">
            <h2 className="text-sm font-bold text-[var(--app-text)]">Workspace Members ({members.length})</h2>
          </div>
          {loadingMembers ? (
            <div className="flex justify-center py-10">
              <span className="flex animate-spin text-[var(--app-muted)]">
                <CircleNotch size={24} />
              </span>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--app-line-soft)]">
              {members.map(m => (
                <li key={m.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(27,42,74,0.05)] text-sm font-bold text-[var(--app-muted)] uppercase">
                    {m.full_name ? m.full_name.slice(0, 2) : <UserCircle size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{m.full_name}</p>
                    <p className="text-xs text-[var(--app-muted)] truncate">{m.email} · {m.job_title || 'No title'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {session?.user_id === m.id && (
                      <span className="rounded-md bg-[rgba(27,42,74,0.05)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--app-muted)]">
                        You
                      </span>
                    )}
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_BADGE[m.role] || ROLE_BADGE.member}`}>
                      {m.role}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PlatformShell>
  );
}
