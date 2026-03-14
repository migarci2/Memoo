'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CircleNotch, EnvelopeSimple, UserCircle, UserPlus } from '@phosphor-icons/react';

import { useAuth } from '@/components/auth-provider';
import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import type { Team, TeamMember, TeamMemberCreateInput, TeamMemberProfileUpdate, TeamUpdateInput } from '@/lib/types';
 
export default function SettingsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { session, updateSession } = useAuth();
  const { toast } = useToast();

  // Members state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Profile editor state
  const [profileName, setProfileName] = useState('');
  const [profileTitle, setProfileTitle] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);

  // Direct add state
  const [addForm, setAddForm] = useState({
    full_name: '',
    email: '',
    job_title: '',
    role: 'member' as 'member' | 'admin',
    password: '',
  });
  const [addingMember, setAddingMember] = useState(false);

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
  }, [teamId, toast]);

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
    if (!canEditTeam) {
      toast('Only admins and owners can change the team name', 'error');
      return;
    }

    const cleanName = teamName.trim();
    if (cleanName.length < 2) {
      toast('Team name must be at least 2 characters', 'error');
      return;
    }

    setSavingTeam(true);
    try {
      const payload: TeamUpdateInput = { name: cleanName };
      const updated = await apiPatch<Team>(`/teams/${teamId}`, payload);
      updateSession({ team_name: updated.name });
      setTeamName(updated.name);
      toast('Team name updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update team name', 'error');
    } finally {
      setSavingTeam(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      toast('No active session.', 'error');
      return;
    }
    if (!profileName.trim()) {
      toast('Name is required', 'error');
      return;
    }

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
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const addMemberNow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.full_name.trim() || !addForm.email.trim()) {
      toast('Name and email are required', 'error');
      return;
    }

    setAddingMember(true);
    try {
      const payload: TeamMemberCreateInput = {
        full_name: addForm.full_name.trim(),
        email: addForm.email.trim().toLowerCase(),
        job_title: addForm.job_title.trim() || null,
        role: addForm.role,
        password: addForm.password.trim() || null,
      };
      const created = await apiPost<TeamMember>(`/teams/${teamId}/members`, payload);
      setMembers(prev =>
        [...prev, created].sort((a, b) => a.full_name.localeCompare(b.full_name))
      );
      setAddForm({
        full_name: '',
        email: '',
        job_title: '',
        role: 'member',
        password: '',
      });
      toast(`Added ${created.full_name} to the team`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add team member', 'error');
    } finally {
      setAddingMember(false);
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
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="panel p-6">
            <h2 className="mb-4 text-lg font-bold">Team profile</h2>
            <form onSubmit={saveTeam} className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-semibold">
                Team name
                <input
                  className="input"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  placeholder="Northline Operations"
                  disabled={!canEditTeam}
                />
              </label>
              <p className="text-xs text-[var(--app-muted)]">
                {canEditTeam
                  ? 'This updates the workspace name shown across the app.'
                  : 'Only admins and owners can change the workspace name.'}
              </p>
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={savingTeam || !canEditTeam}
                  className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {savingTeam && <span className="animate-spin inline-flex"><CircleNotch size={15} /></span>}
                  Save team
                </button>
              </div>
            </form>
          </div>

          <div className="panel p-6">
            <h2 className="mb-4 text-lg font-bold">Your profile</h2>
            <form onSubmit={saveProfile} className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-semibold">
                Full name
                <input
                  className="input"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="Your full name"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Job title
                <input
                  className="input"
                  value={profileTitle}
                  onChange={e => setProfileTitle(e.target.value)}
                  placeholder="Operations manager"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Email
                <input
                  className="input"
                  value={currentUser?.email ?? ''}
                  disabled
                />
              </label>
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={savingProfile || !session}
                  className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {savingProfile && <span className="animate-spin inline-flex"><CircleNotch size={15} /></span>}
                  Save profile
                </button>
              </div>
            </form>
          </div>

          <div className="panel p-6">
            <h2 className="mb-4 text-lg font-bold">Add team member now</h2>
            <form onSubmit={addMemberNow} className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-semibold">
                Full name
                <input
                  className="input"
                  value={addForm.full_name}
                  onChange={e => setAddForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Alex Rivera"
                  required
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Email
                <input
                  type="email"
                  className="input"
                  value={addForm.email}
                  onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="alex@company.com"
                  required
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Job title
                <input
                  className="input"
                  value={addForm.job_title}
                  onChange={e => setAddForm(prev => ({ ...prev, job_title: e.target.value }))}
                  placeholder="Support lead"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold">
                  Role
                  <select
                    className="input"
                    value={addForm.role}
                    onChange={e => setAddForm(prev => ({ ...prev, role: e.target.value as 'member' | 'admin' }))}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Password (optional)
                  <input
                    type="password"
                    className="input"
                    value={addForm.password}
                    onChange={e => setAddForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Set temporary password"
                  />
                </label>
              </div>
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={addingMember}
                  className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {addingMember ? (
                    <span className="animate-spin inline-flex"><CircleNotch size={15} /></span>
                  ) : (
                    <UserPlus size={15} weight="bold" />
                  )}
                  Add member
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="mb-4 text-lg font-bold">Invite by email</h2>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="mb-1.5 block text-sm font-semibold">Email address</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-blue)]/70 inline-flex">
                  <EnvelopeSimple size={16} />
                </span>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="input pl-9 text-[var(--app-text)] placeholder:text-[#7f90a0]"
                  style={{ paddingLeft: '2.5rem' }}
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
              className="btn-secondary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
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
                  <div className="flex items-center gap-2">
                    {session?.user_id === m.id && (
                      <span className="rounded-full bg-[var(--app-chip)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--app-muted)]">
                        You
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                        ROLE_BADGE[m.role] ?? ROLE_BADGE.member
                      }`}
                    >
                      {m.role}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PlatformShell>
  );
}
