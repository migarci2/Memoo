from __future__ import annotations

import asyncio
import json
import random
from datetime import UTC, datetime, timedelta

import bcrypt

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.entities import (
    CaptureSession,
    CaptureStatus,
    Invite,
    Membership,
    MembershipRole,
    OnboardingProgress,
    Playbook,
    PlaybookStatus,
    PlaybookStep,
    PlaybookVersion,
    Run,
    RunEvent,
    RunItem,
    RunStatus,
    Team,
    User,
    VaultCredential,
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

        # ── Users ────────────────────────────────────────────────────────
        owner = User(
            email='amaya@northline.io',
            full_name='Amaya Voss',
            job_title='Head of Operations',
            password_hash=demo_pw,
        )
        ops_user = User(
            email='marco@northline.io',
            full_name='Marco Ilan',
            job_title='Ops Lead',
            password_hash=demo_pw,
        )
        analyst = User(
            email='nina@northline.io',
            full_name='Nina Calder',
            job_title='Automation Analyst',
            password_hash=demo_pw,
        )
        db.add_all([owner, ops_user, analyst])
        await db.flush()

        # ── Memberships ─────────────────────────────────────────────────
        db.add_all(
            [
                Membership(team_id=team.id, user_id=owner.id, role=MembershipRole.OWNER),
                Membership(team_id=team.id, user_id=ops_user.id, role=MembershipRole.ADMIN),
                Membership(team_id=team.id, user_id=analyst.id, role=MembershipRole.MEMBER),
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
        db.add(
            Invite(
                team_id=team.id,
                email='support@northline.io',
                role=MembershipRole.MEMBER,
                token='invite_support_001',
                status='pending',
                expires_at=now + timedelta(days=6),
            )
        )

        # ── Vault credentials ───────────────────────────────────────────
        cred_google = VaultCredential(
            team_id=team.id,
            name='Google Admin SA',
            service='Google Workspace',
            credential_type='api_key',
            masked_value='AIza••••••••••Xq',
            encrypted_value='demo-google-admin-token',
            created_by=owner.id,
        )
        cred_jira = VaultCredential(
            team_id=team.id,
            name='Jira API Token',
            service='Jira',
            credential_type='api_key',
            masked_value='ATATT••••••••••5K',
            encrypted_value='demo-jira-token',
            created_by=ops_user.id,
        )
        cred_slack = VaultCredential(
            team_id=team.id,
            name='Slack Bot Token',
            service='Slack',
            credential_type='oauth_token',
            masked_value='xoxb-••••••••••Rw',
            encrypted_value='demo-slack-token',
            created_by=analyst.id,
        )
        db.add_all([cred_google, cred_jira, cred_slack])
        await db.flush()

        # ── Capture session (completed + compiled) ───────────────────────
        capture_events = [
            {'kind': 'navigate', 'url': 'https://admin.google.com/ac/users', 'timestamp': 0},
            {'kind': 'click', 'selector': 'button.add-user', 'text': 'Add a user', 'timestamp': 2},
            {'kind': 'input', 'selector': '#firstName', 'value': '{{first_name}}', 'timestamp': 4},
            {'kind': 'input', 'selector': '#lastName', 'value': '{{last_name}}', 'timestamp': 5},
            {'kind': 'input', 'selector': '#primaryEmail', 'value': '{{email}}', 'timestamp': 6},
            {'kind': 'submit', 'selector': 'form.new-user', 'text': 'Create user', 'timestamp': 8},
            {'kind': 'verify', 'selector': '.success-banner', 'text': 'User created successfully', 'timestamp': 10},
        ]

        capture = CaptureSession(
            team_id=team.id,
            user_id=owner.id,
            title='Google Workspace user provisioning',
            status=CaptureStatus.COMPILED,
            raw_events=capture_events,
            started_at=now - timedelta(hours=6),
            ended_at=now - timedelta(hours=5, minutes=50),
        )
        db.add(capture)
        await db.flush()

        # ── Playbooks (compiled from capture + manual) ───────────────────
        playbook_provision = Playbook(
            team_id=team.id,
            created_by=owner.id,
            name='Google Workspace user provisioning',
            description='Automated workflow to provision new employees in Google Admin. Compiled from recorded capture session with Gemini.',
            status=PlaybookStatus.PUBLISHED,
            tags=['google', 'provisioning', 'onboarding'],
        )
        playbook_jira = Playbook(
            team_id=team.id,
            created_by=ops_user.id,
            name='Jira ticket triage & assignment',
            description='Automate ticket triage: classify priority, assign to team, post Slack notification.',
            status=PlaybookStatus.PUBLISHED,
            tags=['jira', 'triage', 'tickets'],
        )
        playbook_offboard = Playbook(
            team_id=team.id,
            created_by=analyst.id,
            name='Employee offboarding checklist',
            description='Revoke access across Google, Jira, and Slack for departing employees.',
            status=PlaybookStatus.DRAFT,
            tags=['offboarding', 'security'],
        )
        db.add_all([playbook_provision, playbook_jira, playbook_offboard])
        await db.flush()

        # Link capture to playbook
        capture.playbook_id = playbook_provision.id

        # ── Versions + Steps ─────────────────────────────────────────────
        prov_v1 = PlaybookVersion(
            playbook_id=playbook_provision.id,
            version_number=1,
            created_by=owner.id,
            change_note='Compiled by Gemini from capture session',
            graph={},
            created_at=now - timedelta(hours=5, minutes=45),
        )
        jira_v1 = PlaybookVersion(
            playbook_id=playbook_jira.id,
            version_number=1,
            created_by=ops_user.id,
            change_note='Initial version',
            graph={},
            created_at=now - timedelta(days=2),
        )
        off_v1 = PlaybookVersion(
            playbook_id=playbook_offboard.id,
            version_number=1,
            created_by=analyst.id,
            change_note='Draft',
            graph={},
            created_at=now - timedelta(days=1),
        )
        db.add_all([prov_v1, jira_v1, off_v1])
        await db.flush()

        db.add_all(
            [
                # Provision steps
                PlaybookStep(playbook_version_id=prov_v1.id, sequence=1, title='Open Google Admin Console', step_type='navigate', target_url='https://admin.google.com/ac/users', selector='', variables={}, guardrails={}),
                PlaybookStep(playbook_version_id=prov_v1.id, sequence=2, title='Click Add a user', step_type='click', selector='button.add-user', variables={}, guardrails={}),
                PlaybookStep(playbook_version_id=prov_v1.id, sequence=3, title='Enter first name', step_type='input', selector='#firstName', variables={'first_name': 'string'}, guardrails={'required': True}),
                PlaybookStep(playbook_version_id=prov_v1.id, sequence=4, title='Enter last name', step_type='input', selector='#lastName', variables={'last_name': 'string'}, guardrails={'required': True}),
                PlaybookStep(playbook_version_id=prov_v1.id, sequence=5, title='Enter email address', step_type='input', selector='#primaryEmail', variables={'email': 'email'}, guardrails={'format': 'email'}),
                PlaybookStep(playbook_version_id=prov_v1.id, sequence=6, title='Submit new user form', step_type='submit', selector='form.new-user', variables={}, guardrails={}),
                PlaybookStep(playbook_version_id=prov_v1.id, sequence=7, title='Verify user created successfully', step_type='verify', selector='.success-banner', variables={}, guardrails={'expected_text': 'User created successfully'}),
                # Jira steps
                PlaybookStep(playbook_version_id=jira_v1.id, sequence=1, title='Open Jira inbox', step_type='navigate', target_url='https://northline.atlassian.net/jira/servicedesk/queue', selector='', variables={}, guardrails={}),
                PlaybookStep(playbook_version_id=jira_v1.id, sequence=2, title='Read ticket summary and classify priority', step_type='action', selector='', variables={'ticket_id': 'string'}, guardrails={}),
                PlaybookStep(playbook_version_id=jira_v1.id, sequence=3, title='Assign to team lead', step_type='action', selector='', variables={'assignee': 'string'}, guardrails={}),
                PlaybookStep(playbook_version_id=jira_v1.id, sequence=4, title='Post assignment to Slack #ops-tickets', step_type='action', selector='', variables={}, guardrails={}),
                # Offboard steps
                PlaybookStep(playbook_version_id=off_v1.id, sequence=1, title='Revoke Google Workspace access', step_type='action', selector='', variables={'employee_email': 'email'}, guardrails={}),
                PlaybookStep(playbook_version_id=off_v1.id, sequence=2, title='Deactivate Jira account', step_type='action', selector='', variables={}, guardrails={}),
                PlaybookStep(playbook_version_id=off_v1.id, sequence=3, title='Remove from Slack workspace', step_type='action', selector='', variables={}, guardrails={}),
            ]
        )

        # ── Run (completed, provisioning 3 employees) ───────────────────
        run = Run(
            team_id=team.id,
            playbook_id=playbook_provision.id,
            playbook_version_id=prov_v1.id,
            status=RunStatus.COMPLETED,
            trigger_type='manual',
            input_source='csv_paste',
            total_items=3,
            success_count=3,
            failed_count=0,
            started_at=now - timedelta(hours=3),
            ended_at=now - timedelta(hours=2, minutes=55),
        )
        db.add(run)
        await db.flush()

        employees = [
            {'first_name': 'Alice', 'last_name': 'Strand', 'email': 'alice@northline.io'},
            {'first_name': 'Bjorn', 'last_name': 'Moen', 'email': 'bjorn@northline.io'},
            {'first_name': 'Clara', 'last_name': 'Dahlin', 'email': 'clara@northline.io'},
        ]

        step_titles = [
            'Open Google Admin Console',
            'Click Add a user',
            'Enter first name',
            'Enter last name',
            'Enter email address',
            'Submit new user form',
            'Verify user created successfully',
        ]

        for row_idx, emp in enumerate(employees):
            item = RunItem(
                run_id=run.id,
                row_index=row_idx,
                input_payload=emp,
                status=RunStatus.COMPLETED,
            )
            db.add(item)
            await db.flush()

            for step_seq, step_title in enumerate(step_titles, start=1):
                vault_used = None
                if step_seq in (1, 6):  # navigate & submit use Google cred
                    vault_used = 'Google Admin SA'

                db.add(
                    RunEvent(
                        run_item_id=item.id,
                        step_sequence=step_seq,
                        step_title=step_title,
                        status='success',
                        expected_state=f'Step {step_seq} complete' if step_seq < 7 else 'User created successfully',
                        actual_state=f'Step {step_seq} complete' if step_seq < 7 else 'User created successfully',
                        vault_credential_used=vault_used,
                    )
                )

        # ── Second run (partially failed — Jira triage) ─────────────────
        run2 = Run(
            team_id=team.id,
            playbook_id=playbook_jira.id,
            playbook_version_id=jira_v1.id,
            status=RunStatus.COMPLETED,
            trigger_type='manual',
            input_source='manual',
            total_items=2,
            success_count=1,
            failed_count=1,
            started_at=now - timedelta(hours=1),
            ended_at=now - timedelta(minutes=55),
        )
        db.add(run2)
        await db.flush()

        tickets = [
            {'ticket_id': 'OPS-142', 'assignee': 'Marco Ilan'},
            {'ticket_id': 'OPS-143', 'assignee': 'Nina Calder'},
        ]

        jira_step_titles = [
            'Open Jira inbox',
            'Read ticket summary and classify priority',
            'Assign to team lead',
            'Post assignment to Slack #ops-tickets',
        ]

        for row_idx, ticket in enumerate(tickets):
            item_status = RunStatus.COMPLETED if row_idx == 0 else RunStatus.FAILED
            item = RunItem(
                run_id=run2.id,
                row_index=row_idx,
                input_payload=ticket,
                status=item_status,
            )
            db.add(item)
            await db.flush()

            for step_seq, step_title in enumerate(jira_step_titles, start=1):
                # Second item fails at step 3
                if row_idx == 1 and step_seq >= 3:
                    ev_status = 'failed' if step_seq == 3 else 'pending'
                else:
                    ev_status = 'success'

                vault_used = 'Jira API Token' if step_seq in (1, 3) else None
                if step_seq == 4 and ev_status == 'success':
                    vault_used = 'Slack Bot Token'

                db.add(
                    RunEvent(
                        run_item_id=item.id,
                        step_sequence=step_seq,
                        step_title=step_title,
                        status=ev_status,
                        expected_state=f'{step_title} — done',
                        actual_state=f'{step_title} — done' if ev_status == 'success' else 'Assignee not found in project',
                        vault_credential_used=vault_used,
                    )
                )

        await db.commit()

    print('Seed complete: Northline Operations demo team created.')
    print('Login: amaya@northline.io / demo1234')
    print('Demo includes: 3 playbooks, 3 vault credentials, 2 runs with verification logs')


if __name__ == '__main__':
    asyncio.run(seed())
