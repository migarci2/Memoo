from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import bcrypt
from sqlalchemy import delete, select

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.entities import (
    Department,
    Invite,
    Membership,
    MembershipRole,
    OnboardingProgress,
    Playbook,
    PlaybookStatus,
    PlaybookStep,
    PlaybookVersion,
    Team,
    User,
)


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


async def reset_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


async def seed() -> None:
    await reset_schema()

    now = datetime.now(UTC)
    demo_pw = _hash('demo1234')

    async with SessionLocal() as db:
        team = Team(name='Northline Operations', slug='northline-ops', domain='northline.io', plan='scale')
        db.add(team)
        await db.flush()

        # ── Departments ──────────────────────────────────────────────────
        dept_eng = Department(team_id=team.id, name='Engineering', color='#5f7784')
        dept_finance = Department(team_id=team.id, name='Finance', color='#bf9b6a')
        dept_support = Department(team_id=team.id, name='Support', color='#7b9b86')
        db.add_all([dept_eng, dept_finance, dept_support])
        await db.flush()

        # ── Users ────────────────────────────────────────────────────────
        owner = User(
            email='amaya@northline.io',
            full_name='Amaya Voss',
            job_title='Head of Operations',
            password_hash=demo_pw,
        )
        finance_user = User(
            email='marco@northline.io',
            full_name='Marco Ilan',
            job_title='Finance Ops Lead',
            password_hash=demo_pw,
        )
        support_user = User(
            email='nina@northline.io',
            full_name='Nina Calder',
            job_title='Support Supervisor',
            password_hash=demo_pw,
        )
        db.add_all([owner, finance_user, support_user])
        await db.flush()

        # ── Memberships ─────────────────────────────────────────────────
        db.add_all(
            [
                Membership(team_id=team.id, user_id=owner.id, role=MembershipRole.OWNER, department_id=dept_eng.id),
                Membership(team_id=team.id, user_id=finance_user.id, role=MembershipRole.ADMIN, department_id=dept_finance.id),
                Membership(team_id=team.id, user_id=support_user.id, role=MembershipRole.MEMBER, department_id=dept_support.id),
            ]
        )

        # ── Onboarding ──────────────────────────────────────────────────
        db.add(
            OnboardingProgress(
                team_id=team.id,
                owner_user_id=owner.id,
                current_step='team_ready',
                completed_steps=['workspace_created', 'first_playbook_created', 'invites_sent'],
            )
        )

        # ── Invites ──────────────────────────────────────────────────────
        db.add_all(
            [
                Invite(
                    team_id=team.id,
                    email='finance-analyst@northline.io',
                    role=MembershipRole.MEMBER,
                    token='invite_finance_001',
                    status='accepted',
                    expires_at=now + timedelta(days=6),
                ),
                Invite(
                    team_id=team.id,
                    email='support-specialist@northline.io',
                    role=MembershipRole.MEMBER,
                    token='invite_support_001',
                    status='pending',
                    expires_at=now + timedelta(days=6),
                ),
            ]
        )

        # ── Playbooks ───────────────────────────────────────────────────
        playbook_hr = Playbook(
            team_id=team.id,
            created_by=owner.id,
            name='Employee onboarding checklist',
            description='Step-by-step guide for onboarding new hires: profile setup, benefits enrollment, and access provisioning.',
            status=PlaybookStatus.ACTIVE,
            tags=['hr', 'onboarding', 'hiring'],
            department_id=dept_eng.id,
        )
        playbook_finance = Playbook(
            team_id=team.id,
            created_by=finance_user.id,
            name='Invoice reconciliation process',
            description='Validate invoice fields, match ledger entries, and document reconciliation steps.',
            status=PlaybookStatus.ACTIVE,
            tags=['finance', 'billing', 'reconciliation'],
            department_id=dept_finance.id,
        )
        playbook_support = Playbook(
            team_id=team.id,
            created_by=support_user.id,
            name='Tier-1 ticket follow-up guide',
            description='Standard procedure for handling first-response tickets: templates, CRM updates, and follow-up scheduling.',
            status=PlaybookStatus.DRAFT,
            tags=['support', 'tickets'],
            department_id=dept_support.id,
        )
        db.add_all([playbook_hr, playbook_finance, playbook_support])
        await db.flush()

        # ── Playbook versions ────────────────────────────────────────────
        hr_v1 = PlaybookVersion(
            playbook_id=playbook_hr.id,
            version_number=1,
            created_by=owner.id,
            change_note='Initial version',
            graph={},
            created_at=now - timedelta(days=8),
        )
        fin_v1 = PlaybookVersion(
            playbook_id=playbook_finance.id,
            version_number=1,
            created_by=finance_user.id,
            change_note='Initial version',
            graph={},
            created_at=now - timedelta(days=5),
        )
        sup_v1 = PlaybookVersion(
            playbook_id=playbook_support.id,
            version_number=1,
            created_by=support_user.id,
            change_note='Draft version',
            graph={},
            created_at=now - timedelta(days=2),
        )
        db.add_all([hr_v1, fin_v1, sup_v1])
        await db.flush()

        # ── Playbook steps ───────────────────────────────────────────────
        db.add_all(
            [
                PlaybookStep(
                    playbook_version_id=hr_v1.id,
                    sequence=1,
                    title='Open HRIS and navigate to new employee form',
                    step_type='navigate',
                    target_url='https://hris.internal/profiles/new',
                    selector='',
                    variables={},
                    guardrails={},
                ),
                PlaybookStep(
                    playbook_version_id=hr_v1.id,
                    sequence=2,
                    title='Fill in employee personal details',
                    step_type='input',
                    selector='',
                    variables={},
                    guardrails={},
                ),
                PlaybookStep(
                    playbook_version_id=hr_v1.id,
                    sequence=3,
                    title='Submit profile and confirm success',
                    step_type='submit',
                    selector='',
                    variables={},
                    guardrails={},
                ),
                PlaybookStep(
                    playbook_version_id=fin_v1.id,
                    sequence=1,
                    title='Open invoice in vendor portal',
                    step_type='navigate',
                    target_url='https://vendors.example.com/invoices',
                    selector='',
                    variables={},
                    guardrails={},
                ),
                PlaybookStep(
                    playbook_version_id=fin_v1.id,
                    sequence=2,
                    title='Compare amount and PO number with ledger',
                    step_type='action',
                    selector='',
                    variables={},
                    guardrails={},
                ),
                PlaybookStep(
                    playbook_version_id=fin_v1.id,
                    sequence=3,
                    title='Mark as reconciled and attach documentation',
                    step_type='action',
                    selector='',
                    variables={},
                    guardrails={},
                ),
                PlaybookStep(
                    playbook_version_id=sup_v1.id,
                    sequence=1,
                    title='Open support ticket and review context',
                    step_type='navigate',
                    target_url='https://support.example.com/tickets',
                    selector='',
                    variables={},
                    guardrails={},
                ),
            ]
        )

        await db.commit()

    print('Seed complete: Northline Operations demo team created.')
    print('Login: amaya@northline.io / demo1234')


if __name__ == '__main__':
    asyncio.run(seed())
