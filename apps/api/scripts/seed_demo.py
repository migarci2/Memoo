from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.entities import (
    CaptureSession,
    CaptureStatus,
    Evidence,
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
)


async def reset_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


async def seed() -> None:
    await reset_schema()

    now = datetime.now(UTC)

    async with SessionLocal() as db:
        team = Team(name='Northline Operations', slug='northline-ops', domain='northline.io', plan='scale')
        db.add(team)
        await db.flush()

        owner = User(email='amaya@northline.io', full_name='Amaya Voss', job_title='Head of Operations')
        finance = User(email='marco@northline.io', full_name='Marco Ilan', job_title='Finance Ops Lead')
        support = User(email='nina@northline.io', full_name='Nina Calder', job_title='Support Supervisor')
        db.add_all([owner, finance, support])
        await db.flush()

        db.add_all(
            [
                Membership(team_id=team.id, user_id=owner.id, role=MembershipRole.OWNER),
                Membership(team_id=team.id, user_id=finance.id, role=MembershipRole.ADMIN),
                Membership(team_id=team.id, user_id=support.id, role=MembershipRole.MEMBER),
            ]
        )

        db.add(
            OnboardingProgress(
                team_id=team.id,
                owner_user_id=owner.id,
                current_step='team_ready',
                completed_steps=['workspace_created', 'first_playbook_created', 'invites_sent'],
            )
        )

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

        playbook_hr = Playbook(
            team_id=team.id,
            created_by=owner.id,
            name='Employee onboarding in HRIS',
            description='Create new employee profile, assign benefits package, and verify account provisioning.',
            status=PlaybookStatus.ACTIVE,
            tags=['hr', 'onboarding', 'hiring'],
        )
        playbook_finance = Playbook(
            team_id=team.id,
            created_by=finance.id,
            name='Invoice reconciliation workflow',
            description='Validate invoice fields, match ledger entries, submit reconciliation evidence.',
            status=PlaybookStatus.ACTIVE,
            tags=['finance', 'billing', 'reconciliation'],
        )
        playbook_support = Playbook(
            team_id=team.id,
            created_by=support.id,
            name='Tier-1 ticket follow-up',
            description='Apply reply template, update CRM timeline, and schedule follow-up callback.',
            status=PlaybookStatus.DRAFT,
            tags=['support', 'tickets'],
        )
        db.add_all([playbook_hr, playbook_finance, playbook_support])
        await db.flush()

        hr_v1 = PlaybookVersion(
            playbook_id=playbook_hr.id,
            version_number=1,
            created_by=owner.id,
            change_note='Initial production version',
            graph={'source': 'gemini-live-capture', 'confidence': 0.92},
            created_at=now - timedelta(days=8),
        )
        fin_v1 = PlaybookVersion(
            playbook_id=playbook_finance.id,
            version_number=1,
            created_by=finance.id,
            change_note='Initial production version',
            graph={'source': 'gemini-live-capture', 'confidence': 0.9},
            created_at=now - timedelta(days=5),
        )
        sup_v1 = PlaybookVersion(
            playbook_id=playbook_support.id,
            version_number=1,
            created_by=support.id,
            change_note='Draft from capture',
            graph={'source': 'gemini-live-capture', 'confidence': 0.78},
            created_at=now - timedelta(days=2),
        )
        db.add_all([hr_v1, fin_v1, sup_v1])
        await db.flush()

        db.add_all(
            [
                PlaybookStep(
                    playbook_version_id=hr_v1.id,
                    sequence=1,
                    title='Open HRIS employee profile form',
                    step_type='navigate',
                    target_url='https://hris.internal/profiles/new',
                    selector='a[href="/profiles/new"]',
                    variables={},
                    guardrails={'verify': 'new_profile_page_loaded'},
                ),
                PlaybookStep(
                    playbook_version_id=hr_v1.id,
                    sequence=2,
                    title='Fill employee identity fields',
                    step_type='input',
                    selector='form#employee-profile',
                    variables={'first_name': '{{first_name}}', 'last_name': '{{last_name}}', 'email': '{{email}}'},
                    guardrails={'required': ['first_name', 'last_name', 'email']},
                ),
                PlaybookStep(
                    playbook_version_id=hr_v1.id,
                    sequence=3,
                    title='Submit profile and verify success banner',
                    step_type='submit',
                    selector='button[type="submit"]',
                    variables={},
                    guardrails={'expect_text': 'Employee profile created'},
                ),
                PlaybookStep(
                    playbook_version_id=fin_v1.id,
                    sequence=1,
                    title='Open invoice in vendor portal',
                    step_type='navigate',
                    target_url='https://vendors.example.com/invoices/{{invoice_id}}',
                    selector='table#invoices a.invoice-link',
                    variables={'invoice_id': '{{invoice_id}}'},
                    guardrails={'verify': 'invoice_detail_opened'},
                ),
                PlaybookStep(
                    playbook_version_id=fin_v1.id,
                    sequence=2,
                    title='Compare amount and PO number',
                    step_type='validate',
                    selector='.invoice-summary',
                    variables={'amount': '{{amount}}', 'po_number': '{{po_number}}'},
                    guardrails={'match': ['amount', 'po_number']},
                ),
                PlaybookStep(
                    playbook_version_id=fin_v1.id,
                    sequence=3,
                    title='Mark reconciled and attach evidence',
                    step_type='action',
                    selector='button#mark-reconciled',
                    variables={},
                    guardrails={'expect_text': 'Reconciled'},
                ),
                PlaybookStep(
                    playbook_version_id=sup_v1.id,
                    sequence=1,
                    title='Open ticket and review context',
                    step_type='navigate',
                    target_url='https://support.example.com/tickets/{{ticket_id}}',
                    selector='a.ticket-link',
                    variables={'ticket_id': '{{ticket_id}}'},
                    guardrails={'verify': 'ticket_opened'},
                ),
            ]
        )

        capture = CaptureSession(
            team_id=team.id,
            user_id=owner.id,
            title='HRIS onboarding capture',
            provider='gemini-live',
            status=CaptureStatus.FINALIZED,
            raw_events=[
                {'kind': 'navigate', 'target': 'new profile', 'url': 'https://hris.internal/profiles/new'},
                {'kind': 'input', 'target': 'first_name', 'value': 'Sofia'},
                {'kind': 'input', 'target': 'email', 'value': 'sofia@northline.io'},
                {'kind': 'submit', 'target': 'employee_profile_form'},
            ],
            derived_actions=[
                {'title': 'Navigate to new profile form', 'step_type': 'navigate'},
                {'title': 'Fill identity data', 'step_type': 'input'},
                {'title': 'Submit and verify banner', 'step_type': 'submit'},
            ],
            started_at=now - timedelta(days=9),
            ended_at=now - timedelta(days=9, minutes=-12),
        )
        db.add(capture)

        run = Run(
            team_id=team.id,
            playbook_version_id=hr_v1.id,
            status=RunStatus.COMPLETED,
            trigger_type='csv_batch',
            input_source='new_hires_week_08.csv',
            total_items=6,
            success_count=6,
            failed_count=0,
            started_at=now - timedelta(days=1, hours=2),
            ended_at=now - timedelta(days=1, hours=1, minutes=40),
        )
        db.add(run)
        await db.flush()

        for idx in range(6):
            item = RunItem(
                run_id=run.id,
                row_index=idx,
                input_payload={
                    'first_name': f'Employee{idx + 1}',
                    'last_name': 'Northline',
                    'email': f'employee{idx + 1}@northline.io',
                },
                status='completed',
            )
            db.add(item)
            await db.flush()

            db.add(
                RunEvent(
                    run_item_id=item.id,
                    step_title='Submit profile and verify success banner',
                    status='success',
                    message='Employee profile created and verified.',
                    screenshot_url=f'https://picsum.photos/seed/hris-run-{idx}/1200/700',
                )
            )
            db.add(
                Evidence(
                    run_item_id=item.id,
                    evidence_type='screenshot',
                    url=f'https://picsum.photos/seed/hris-evidence-{idx}/1200/700',
                    metadata_json={'category': 'profile_created', 'row_index': idx},
                )
            )

        await db.commit()

    print('Seed complete: Northline Operations demo team created.')


if __name__ == '__main__':
    asyncio.run(seed())
