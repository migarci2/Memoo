from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import bcrypt

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.entities import (
    AutomationTriggerType,
    CaptureSession,
    CaptureStatus,
    Invite,
    Membership,
    MembershipRole,
    OnboardingProgress,
    Playbook,
    PlaybookAutomation,
    PlaybookFolder,
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


def _run_items(
    db,
    run,
    rows: list[dict],
    steps: list[tuple[str, str | None]],  # (title, vault_name | None)
    *,
    fail_row: int | None = None,
    fail_step: int | None = None,
    fail_msg: str = "Unexpected error",
):
    """Helper — returns list of (item, events) without flushing."""
    items = []
    for row_idx, payload in enumerate(rows):
        is_fail = fail_row is not None and row_idx == fail_row
        item = RunItem(
            run_id=run.id,
            row_index=row_idx,
            input_payload=payload,
            status=RunStatus.FAILED if is_fail else RunStatus.COMPLETED,
        )
        db.add(item)
        items.append((item, payload, is_fail))
    return items


async def _flush_events(db, items_meta, steps, fail_step, fail_msg):
    for item, payload, is_fail in items_meta:
        await db.flush()
        for seq, (title, vault) in enumerate(steps, start=1):
            if is_fail and seq > fail_step:
                status, actual = "pending", "Skipped — previous step failed"
                vault = None
            elif is_fail and seq == fail_step:
                status, actual = "failed", fail_msg
                vault = None
            else:
                status, actual = "success", f"{title} — done"
            db.add(RunEvent(
                run_item_id=item.id,
                step_sequence=seq,
                step_title=title,
                status=status,
                expected_state=f"{title} — done",
                actual_state=actual,
                vault_credential_used=vault if status == "success" else None,
            ))


async def seed() -> None:
    await reset_schema()

    now = datetime.now(UTC)
    demo_pw = _hash("demo1234")

    async with SessionLocal() as db:
        # ── Team ─────────────────────────────────────────────────────────────
        team = Team(
            name="Kova Technologies",
            slug="kova-tech",
            domain="kova.io",
            plan="scale",
        )
        db.add(team)
        await db.flush()

        # ── Users ─────────────────────────────────────────────────────────────
        owner = User(email="anna@kova.io", full_name="Anna S.", job_title="VP of Operations", password_hash=demo_pw)
        ops   = User(email="luca@kova.io", full_name="Luca Ferreira", job_title="Ops Manager", password_hash=demo_pw)
        rev   = User(email="priya@kova.io", full_name="Priya Nair", job_title="Revenue Ops Analyst", password_hash=demo_pw)
        it    = User(email="tom@kova.io", full_name="Tom Elger", job_title="IT Administrator", password_hash=demo_pw)
        hr    = User(email="camille@kova.io", full_name="Camille Roy", job_title="People Ops Lead", password_hash=demo_pw)
        db.add_all([owner, ops, rev, it, hr])
        await db.flush()

        db.add_all([
            Membership(team_id=team.id, user_id=owner.id, role=MembershipRole.OWNER),
            Membership(team_id=team.id, user_id=ops.id,   role=MembershipRole.ADMIN),
            Membership(team_id=team.id, user_id=rev.id,   role=MembershipRole.MEMBER),
            Membership(team_id=team.id, user_id=it.id,    role=MembershipRole.MEMBER),
            Membership(team_id=team.id, user_id=hr.id,    role=MembershipRole.MEMBER),
        ])
        db.add(OnboardingProgress(
            team_id=team.id,
            owner_user_id=owner.id,
            current_step="team_ready",
            completed_steps=["workspace_created", "first_playbook_created", "invites_sent", "first_run_completed"],
        ))
        db.add_all([
            Invite(team_id=team.id, email="alex@kova.io",    role=MembershipRole.MEMBER, token="invite_alex_001",    status="pending",  expires_at=now + timedelta(days=5)),
            Invite(team_id=team.id, email="finance@kova.io", role=MembershipRole.MEMBER, token="invite_finance_002", status="accepted", expires_at=now + timedelta(days=30)),
            Invite(team_id=team.id, email="design@kova.io",  role=MembershipRole.MEMBER, token="invite_design_003",  status="pending",  expires_at=now + timedelta(days=3)),
        ])

        # ── Vault ─────────────────────────────────────────────────────────────
        V = {}
        for spec in [
            ("Google Workspace Admin",   "Google Workspace", "service_account", "sa-ops-kova••••••@kova-prod.iam", owner),
            ("Salesforce OAuth",         "Salesforce",       "oauth2",           "3MVG9••••••••••Yz",               rev),
            ("HubSpot Private App",      "HubSpot",          "api_key",          "pat-eu-••••••••3d",               ops),
            ("Slack Bot — Ops",          "Slack",            "oauth_token",      "xoxb-••••••••••9f",               ops),
            ("Stripe Restricted Key",    "Stripe",           "api_key",          "rk_live_••••••••Kp",              owner),
            ("Okta API Token",           "Okta",             "api_key",          "00VZ••••••••••Lq",                it),
            ("Notion Integration Token", "Notion",           "api_key",          "secret_••••••••Mn",               hr),
            ("Greenhouse API Key",       "Greenhouse",       "api_key",          "gh_live_••••••••Xw",              hr),
        ]:
            name, service, ctype, masked, creator = spec
            cred = VaultCredential(
                team_id=team.id, name=name, service=service,
                credential_type=ctype, masked_value=masked,
                encrypted_value=f"demo-{service.lower().replace(' ', '-')}-token",
                created_by=creator.id,
                last_used_at=now - timedelta(hours=abs(hash(name)) % 72 + 1),
            )
            db.add(cred)
            V[name] = cred
        await db.flush()

        # ── Folders ───────────────────────────────────────────────────────────
        f_people  = PlaybookFolder(team_id=team.id, name="People Ops",    color="#6366f1", created_by=hr.id)
        f_revenue = PlaybookFolder(team_id=team.id, name="Revenue",       color="#10b981", created_by=rev.id)
        f_it      = PlaybookFolder(team_id=team.id, name="IT & Security", color="#f59e0b", created_by=it.id)
        f_finance = PlaybookFolder(team_id=team.id, name="Finance",       color="#ec4899", created_by=owner.id)
        db.add_all([f_people, f_revenue, f_it, f_finance])
        await db.flush()

        # ══════════════════════════════════════════════════════════════════════
        # PLAYBOOK A — New employee onboarding  (People Ops, Published)
        # ══════════════════════════════════════════════════════════════════════
        pb_onboard = Playbook(
            team_id=team.id, folder_id=f_people.id, created_by=hr.id,
            name="New employee onboarding",
            description="End-to-end onboarding: Google Workspace account, Okta SSO, Slack invite, Notion workspace access, and Jira tracker ticket. Compiled from a recorded teach session.",
            status=PlaybookStatus.PUBLISHED,
            tags=["onboarding", "hr", "google", "okta", "slack", "notion"],
        )
        db.add(pb_onboard)
        await db.flush()

        # Capture session linked to pb_onboard
        db.add(CaptureSession(
            team_id=team.id, user_id=hr.id,
            title="Onboarding — Camille's recording (v1)",
            status=CaptureStatus.COMPILED,
            playbook_id=pb_onboard.id,
            raw_events=[
                {"kind": "navigate", "url": "https://admin.google.com/ac/users", "timestamp": 0},
                {"kind": "click", "selector": "a[data-action='add-user']", "timestamp": 3},
                {"kind": "input", "selector": "#firstName", "value": "{{first_name}}", "timestamp": 5},
                {"kind": "input", "selector": "#lastName",  "value": "{{last_name}}",  "timestamp": 6},
                {"kind": "submit", "selector": "button[type=submit]", "timestamp": 9},
                {"kind": "verify", "selector": ".notification-success", "timestamp": 11},
            ],
            started_at=now - timedelta(days=28, hours=3),
            ended_at=now - timedelta(days=28, hours=2, minutes=45),
        ))

        pv_ob1 = PlaybookVersion(playbook_id=pb_onboard.id, version_number=1, created_by=hr.id,
            change_note="Compiled from Camille's teach session", graph={},
            created_at=now - timedelta(days=28, hours=2))
        pv_ob2 = PlaybookVersion(playbook_id=pb_onboard.id, version_number=2, created_by=ops.id,
            change_note="Added Okta provisioning step", graph={},
            created_at=now - timedelta(days=20))
        pv_ob3 = PlaybookVersion(playbook_id=pb_onboard.id, version_number=3, created_by=hr.id,
            change_note="Added Notion workspace invite + Jira ticket creation", graph={},
            created_at=now - timedelta(days=10))
        db.add_all([pv_ob1, pv_ob2, pv_ob3])
        await db.flush()

        onboard_steps = [
            ("Navigate to Google Admin",          V["Google Workspace Admin"].name),
            ("Click Add new user",                None),
            ("Fill first name",                   None),
            ("Fill last name",                    None),
            ("Select org unit / department",      None),
            ("Submit — create Google account",    V["Google Workspace Admin"].name),
            ("Verify account created",            V["Google Workspace Admin"].name),
            ("Navigate to Okta — add person",     V["Okta API Token"].name),
            ("Enter work email in Okta",          None),
            ("Submit Okta invite",                V["Okta API Token"].name),
            ("Navigate to Slack admin",           V["Slack Bot — Ops"].name),
            ("Send Slack workspace invite",       None),
            ("Confirm Slack invite sent",         V["Slack Bot — Ops"].name),
            ("Share Notion workspace",            V["Notion Integration Token"].name),
            ("Open Jira — create onboard ticket", None),
            ("Fill ticket summary",               None),
            ("Submit Jira ticket",                None),
        ]

        for i, (title, _) in enumerate(onboard_steps):
            db.add(PlaybookStep(
                playbook_version_id=pv_ob3.id, sequence=i+1,
                title=title, step_type="action",
                selector="", target_url=None, variables={}, guardrails={},
            ))

        # ══════════════════════════════════════════════════════════════════════
        # PLAYBOOK B — Lead enrichment & CRM sync  (Revenue, Published)
        # ══════════════════════════════════════════════════════════════════════
        pb_lead = Playbook(
            team_id=team.id, folder_id=f_revenue.id, created_by=rev.id,
            name="Inbound lead enrichment & CRM sync",
            description="For each inbound lead: enrich company data from LinkedIn, score in HubSpot, create linked Salesforce opportunity, post to #sales-pipeline.",
            status=PlaybookStatus.PUBLISHED,
            tags=["hubspot", "salesforce", "leads", "crm", "enrichment"],
        )
        db.add(pb_lead)
        await db.flush()

        pv_lead1 = PlaybookVersion(playbook_id=pb_lead.id, version_number=1, created_by=rev.id,
            change_note="Initial version", graph={}, created_at=now - timedelta(days=22))
        pv_lead2 = PlaybookVersion(playbook_id=pb_lead.id, version_number=2, created_by=rev.id,
            change_note="Added Slack notification step", graph={}, created_at=now - timedelta(days=14))
        db.add_all([pv_lead1, pv_lead2])
        await db.flush()

        lead_steps = [
            ("Open HubSpot contact record",          V["HubSpot Private App"].name),
            ("Read company name and domain",         V["HubSpot Private App"].name),
            ("Search LinkedIn for company profile",  None),
            ("Extract headcount and industry",       None),
            ("Update lead score in HubSpot",         V["HubSpot Private App"].name),
            ("Save HubSpot contact",                 V["HubSpot Private App"].name),
            ("Open Salesforce — new opportunity",    V["Salesforce OAuth"].name),
            ("Fill opportunity name & stage",        None),
            ("Save Salesforce opportunity",          V["Salesforce OAuth"].name),
            ("Post summary to #sales-pipeline",      V["Slack Bot — Ops"].name),
            ("Verify Slack message delivered",       V["Slack Bot — Ops"].name),
        ]

        for i, (title, _) in enumerate(lead_steps):
            db.add(PlaybookStep(
                playbook_version_id=pv_lead2.id, sequence=i+1,
                title=title, step_type="action",
                selector="", variables={}, guardrails={},
            ))

        # ══════════════════════════════════════════════════════════════════════
        # PLAYBOOK C — Employee offboarding  (IT & Security, Published)
        # ══════════════════════════════════════════════════════════════════════
        pb_offboard = Playbook(
            team_id=team.id, folder_id=f_it.id, created_by=it.id,
            name="Employee offboarding & access revocation",
            description="Suspend Google + Okta accounts, remove from Slack, reassign Salesforce opportunities, log to compliance sheet.",
            status=PlaybookStatus.PUBLISHED,
            tags=["offboarding", "security", "google", "okta", "salesforce"],
        )
        db.add(pb_offboard)
        await db.flush()

        pv_off1 = PlaybookVersion(playbook_id=pb_offboard.id, version_number=1, created_by=it.id,
            change_note="Initial version — 4 systems", graph={}, created_at=now - timedelta(days=25))
        pv_off2 = PlaybookVersion(playbook_id=pb_offboard.id, version_number=2, created_by=it.id,
            change_note="Added compliance sheet logging", graph={}, created_at=now - timedelta(days=12))
        db.add_all([pv_off1, pv_off2])
        await db.flush()

        offboard_steps = [
            ("Find user in Google Admin",              V["Google Workspace Admin"].name),
            ("Suspend Google account",                 V["Google Workspace Admin"].name),
            ("Confirm suspension",                     V["Google Workspace Admin"].name),
            ("Verify Google account suspended",        V["Google Workspace Admin"].name),
            ("Deactivate Okta account",                V["Okta API Token"].name),
            ("Remove from Slack workspace",            V["Slack Bot — Ops"].name),
            ("Find open Salesforce opportunities",     V["Salesforce OAuth"].name),
            ("Reassign opportunities to team lead",    V["Salesforce OAuth"].name),
            ("Log in IT compliance sheet",             None),
        ]
        for i, (title, _) in enumerate(offboard_steps):
            db.add(PlaybookStep(
                playbook_version_id=pv_off2.id, sequence=i+1,
                title=title, step_type="action", selector="", variables={}, guardrails={},
            ))

        # ══════════════════════════════════════════════════════════════════════
        # PLAYBOOK D — Invoice reconciliation  (Finance, Published)
        # ══════════════════════════════════════════════════════════════════════
        pb_invoice = Playbook(
            team_id=team.id, folder_id=f_finance.id, created_by=owner.id,
            name="Monthly invoice reconciliation",
            description="Export Stripe payments, cross-reference Salesforce closed-won, flag gaps > $500, and paste formatted summary into the #finance Slack channel and monthly Google Sheet.",
            status=PlaybookStatus.PUBLISHED,
            tags=["stripe", "finance", "reconciliation", "salesforce"],
        )
        db.add(pb_invoice)
        await db.flush()

        pv_inv1 = PlaybookVersion(playbook_id=pb_invoice.id, version_number=1, created_by=owner.id,
            change_note="Initial version", graph={}, created_at=now - timedelta(days=35))
        pv_inv2 = PlaybookVersion(playbook_id=pb_invoice.id, version_number=2, created_by=rev.id,
            change_note="Automated gap detection logic", graph={}, created_at=now - timedelta(days=18))
        db.add_all([pv_inv1, pv_inv2])
        await db.flush()

        invoice_steps = [
            ("Open Stripe — export MRR report",        V["Stripe Restricted Key"].name),
            ("Set date range to current month",         None),
            ("Download CSV",                            V["Stripe Restricted Key"].name),
            ("Open Salesforce closed-won report",       V["Salesforce OAuth"].name),
            ("Cross-reference payments vs. deals",      None),
            ("Flag gaps > $500",                        None),
            ("Paste into monthly Google Sheet",         V["Google Workspace Admin"].name),
            ("Post #finance Slack summary",             V["Slack Bot — Ops"].name),
        ]
        for i, (title, _) in enumerate(invoice_steps):
            db.add(PlaybookStep(
                playbook_version_id=pv_inv2.id, sequence=i+1,
                title=title, step_type="action", selector="", variables={}, guardrails={},
            ))

        # ══════════════════════════════════════════════════════════════════════
        # PLAYBOOK E — Candidate pipeline refresh  (People Ops, Published)
        # ══════════════════════════════════════════════════════════════════════
        pb_recruit = Playbook(
            team_id=team.id, folder_id=f_people.id, created_by=hr.id,
            name="Candidate pipeline refresh",
            description="Pull list of candidates in Interview stage from Greenhouse, update status in Notion tracker, and post daily hiring digest to #talent Slack channel.",
            status=PlaybookStatus.PUBLISHED,
            tags=["greenhouse", "notion", "recruiting", "talent"],
        )
        db.add(pb_recruit)
        await db.flush()

        pv_rec1 = PlaybookVersion(playbook_id=pb_recruit.id, version_number=1, created_by=hr.id,
            change_note="Initial version", graph={}, created_at=now - timedelta(days=16))
        db.add(pv_rec1)
        await db.flush()

        recruit_steps = [
            ("Open Greenhouse — filter Interview stage", V["Greenhouse API Key"].name),
            ("Read candidate list",                      V["Greenhouse API Key"].name),
            ("Update Notion tracker statuses",           V["Notion Integration Token"].name),
            ("Identify stuck candidates (> 5 days)",     None),
            ("Post daily digest to #talent Slack",       V["Slack Bot — Ops"].name),
            ("Verify Slack post delivered",              V["Slack Bot — Ops"].name),
        ]
        for i, (title, _) in enumerate(recruit_steps):
            db.add(PlaybookStep(
                playbook_version_id=pv_rec1.id, sequence=i+1,
                title=title, step_type="action", selector="", variables={}, guardrails={},
            ))

        # ══════════════════════════════════════════════════════════════════════
        # PLAYBOOK F — Churned customer re-engagement  (Revenue, Active)
        # ══════════════════════════════════════════════════════════════════════
        pb_churn = Playbook(
            team_id=team.id, folder_id=f_revenue.id, created_by=rev.id,
            name="Churned customer re-engagement",
            description="Identify customers with cancelled Stripe subscriptions in last 30 days, find contact in Salesforce, queue personalised re-engagement email sequence.",
            status=PlaybookStatus.ACTIVE,
            tags=["churn", "stripe", "salesforce", "retention"],
        )
        db.add(pb_churn)
        await db.flush()

        pv_churn1 = PlaybookVersion(playbook_id=pb_churn.id, version_number=1, created_by=rev.id,
            change_note="Draft promoted to active", graph={}, created_at=now - timedelta(days=8))
        db.add(pv_churn1)
        await db.flush()

        churn_steps = [
            ("Export Stripe cancelled subs last 30d",    V["Stripe Restricted Key"].name),
            ("Match to Salesforce accounts",             V["Salesforce OAuth"].name),
            ("Score re-engagement potential",            None),
            ("Queue HubSpot email sequence",             V["HubSpot Private App"].name),
            ("Log in Salesforce re-engagement report",  V["Salesforce OAuth"].name),
            ("Post summary to #revenue Slack",           V["Slack Bot — Ops"].name),
        ]
        for i, (title, _) in enumerate(churn_steps):
            db.add(PlaybookStep(
                playbook_version_id=pv_churn1.id, sequence=i+1,
                title=title, step_type="action", selector="", variables={}, guardrails={},
            ))

        # ══════════════════════════════════════════════════════════════════════
        # PLAYBOOK G — IT access audit  (IT & Security, Draft)
        # ══════════════════════════════════════════════════════════════════════
        pb_audit = Playbook(
            team_id=team.id, folder_id=f_it.id, created_by=it.id,
            name="Quarterly IT access audit",
            description="Cross-check active Okta users against Google Workspace and Salesforce user lists, flag orphaned accounts, produce Notion audit report.",
            status=PlaybookStatus.DRAFT,
            tags=["audit", "okta", "google", "security", "compliance"],
        )
        db.add(pb_audit)
        await db.flush()

        pv_audit1 = PlaybookVersion(playbook_id=pb_audit.id, version_number=1, created_by=it.id,
            change_note="WIP draft", graph={}, created_at=now - timedelta(days=4))
        db.add(pv_audit1)
        await db.flush()

        audit_steps = [
            ("Export Okta active user list",            V["Okta API Token"].name),
            ("Export Google Workspace user list",       V["Google Workspace Admin"].name),
            ("Export Salesforce active users",          V["Salesforce OAuth"].name),
            ("Diff and flag orphaned accounts",         None),
            ("Generate Notion audit report",            V["Notion Integration Token"].name),
            ("Post findings to #it-security Slack",     V["Slack Bot — Ops"].name),
        ]
        for i, (title, _) in enumerate(audit_steps):
            db.add(PlaybookStep(
                playbook_version_id=pv_audit1.id, sequence=i+1,
                title=title, step_type="action", selector="", variables={}, guardrails={},
            ))

        # ══════════════════════════════════════════════════════════════════════
        # RUNS — dense history across ~30 days
        # ══════════════════════════════════════════════════════════════════════

        async def make_run(
            pb, pv, rows, steps,
            *,
            ago_h: float,
            duration_m: int = 8,
            fail_row: int | None = None,
            fail_step: int | None = None,
            fail_msg: str = "Unexpected error",
            trigger: str = "manual",
            vault_ids: list | None = None,
            use_sandbox: bool = False,
        ) -> Run:
            success = len(rows) - (1 if fail_row is not None else 0)
            failed  = 1 if fail_row is not None else 0
            r = Run(
                team_id=team.id,
                playbook_id=pb.id,
                playbook_version_id=pv.id,
                status=RunStatus.COMPLETED,
                trigger_type=trigger,
                input_source="csv_paste" if trigger == "manual" else "automation",
                total_items=len(rows),
                success_count=success,
                failed_count=failed,
                selected_vault_credential_ids=[c.id for c in (vault_ids or [])],
                use_sandbox=use_sandbox,
                started_at=now - timedelta(hours=ago_h),
                ended_at=now - timedelta(hours=ago_h) + timedelta(minutes=duration_m),
            )
            db.add(r)
            await db.flush()

            for row_idx, payload in enumerate(rows):
                is_fail = fail_row is not None and row_idx == fail_row
                item = RunItem(
                    run_id=r.id, row_index=row_idx, input_payload=payload,
                    status=RunStatus.FAILED if is_fail else RunStatus.COMPLETED,
                    started_at=r.started_at + timedelta(minutes=row_idx * 2),
                    ended_at=r.started_at + timedelta(minutes=row_idx * 2 + 1, seconds=50),
                )
                db.add(item)
                await db.flush()
                for seq, (title, vault) in enumerate(steps, start=1):
                    if is_fail and seq > (fail_step or 99):
                        ev_status, actual, vault = "pending", "Skipped — previous step failed", None
                    elif is_fail and seq == fail_step:
                        ev_status, actual, vault = "failed", fail_msg, None
                    else:
                        ev_status, actual = "success", f"{title} — done"
                    db.add(RunEvent(
                        run_item_id=item.id, step_sequence=seq, step_title=title,
                        status=ev_status, expected_state=f"{title} — done", actual_state=actual,
                        vault_credential_used=vault if ev_status == "success" else None,
                    ))
            return r

        # ── Onboarding runs (over 4 weeks) ───────────────────────────────────
        hires_batches = [
            # (list of hires, days_ago)
            ([{"first_name": "James",   "last_name": "Okafor",    "email": "james@kova.io",   "dept": "/Engineering"},
              {"first_name": "Mia",     "last_name": "Bergstrom", "email": "mia@kova.io",     "dept": "/Design"},
              {"first_name": "Carlos",  "last_name": "Rivas",     "email": "carlos@kova.io",  "dept": "/Sales"},
              {"first_name": "Yuki",    "last_name": "Tanaka",    "email": "yuki@kova.io",    "dept": "/Engineering"},
              {"first_name": "Fatima",  "last_name": "Al-Hassan", "email": "fatima@kova.io",  "dept": "/Operations"}], 26 * 24),
            ([{"first_name": "Diego",   "last_name": "Vargas",    "email": "diego@kova.io",   "dept": "/Sales"},
              {"first_name": "Leah",    "last_name": "Morin",     "email": "leah@kova.io",    "dept": "/Finance"},
              {"first_name": "Kwame",   "last_name": "Asante",    "email": "kwame@kova.io",   "dept": "/Engineering"}], 19 * 24),
            ([{"first_name": "Sophie",  "last_name": "Linden",    "email": "sophie@kova.io",  "dept": "/Marketing"},
              {"first_name": "Rafael",  "last_name": "Nunez",     "email": "rafael@kova.io",  "dept": "/Engineering"},
              {"first_name": "Anya",    "last_name": "Petrov",    "email": "anya@kova.io",    "dept": "/Design"}], 12 * 24),
            ([{"first_name": "Jin",     "last_name": "Park",      "email": "jin@kova.io",     "dept": "/Engineering"},
              {"first_name": "Elisa",   "last_name": "Feretti",   "email": "elisa@kova.io",   "dept": "/Operations"}], 4),
        ]

        ob_vaults = [V["Google Workspace Admin"], V["Okta API Token"], V["Slack Bot — Ops"], V["Notion Integration Token"]]
        for hires, ago_h in hires_batches:
            await make_run(pb_onboard, pv_ob3, hires, onboard_steps,
                ago_h=ago_h, duration_m=len(hires)*7,
                vault_ids=ob_vaults)

        # ── Lead enrichment runs (daily-ish) ─────────────────────────────────
        lead_batches = [
            ([{"contact_id": "001A", "company": "Arctis Labs",     "portal": "8823411"},
              {"contact_id": "001B", "company": "Veltro Systems",  "portal": "8823411"},
              {"contact_id": "001C", "company": "Deepwave AI",     "portal": "8823411"},
              {"contact_id": "001D", "company": "Orion Fintech",   "portal": "8823411"},
              {"contact_id": "001E", "company": "Pulsar Labs",     "portal": "8823411"},
              {"contact_id": "001F", "company": "Nexora Health",   "portal": "8823411"},
              {"contact_id": "001G", "company": "Gravix Data",     "portal": "8823411"},
              {"contact_id": "001H", "company": "Luminos Energy",  "portal": "8823411"}], 20 * 24, None, None, ""),
            ([{"contact_id": "002A", "company": "Tidal Finance",  "portal": "8823411"},
              {"contact_id": "002B", "company": "Korova Media",   "portal": "8823411"},
              {"contact_id": "002C", "company": "Sylph Network",  "portal": "8823411"},
              {"contact_id": "002D", "company": "Apex Robotics",  "portal": "8823411"},
              {"contact_id": "002E", "company": "Ironclad Bio",   "portal": "8823411"}], 13 * 24, 2, 9, "Salesforce API returned 503 — timed out after 30 s"),
            ([{"contact_id": "003A", "company": "Stellar Grid",   "portal": "8823411"},
              {"contact_id": "003B", "company": "Halo Systems",   "portal": "8823411"},
              {"contact_id": "003C", "company": "Qubit Analytics","portal": "8823411"},
              {"contact_id": "003D", "company": "Prism Security", "portal": "8823411"},
              {"contact_id": "003E", "company": "Epoch Labs",     "portal": "8823411"},
              {"contact_id": "003F", "company": "Crest Ventures", "portal": "8823411"}], 6 * 24, None, None, ""),
            ([{"contact_id": "004A", "company": "Nova Commerce",  "portal": "8823411"},
              {"contact_id": "004B", "company": "Drift Capital",  "portal": "8823411"},
              {"contact_id": "004C", "company": "Bastion Health", "portal": "8823411"}], 2, None, None, ""),
        ]

        lead_vaults = [V["HubSpot Private App"], V["Salesforce OAuth"], V["Slack Bot — Ops"]]
        last_lead_run = None
        for batch in lead_batches:
            rows, ago_h, fail_row, fail_step, fail_msg = batch
            r = await make_run(pb_lead, pv_lead2, rows, lead_steps,
                ago_h=ago_h, duration_m=len(rows)*5,
                fail_row=fail_row, fail_step=fail_step, fail_msg=fail_msg or "",
                vault_ids=lead_vaults)
            last_lead_run = r

        # ── Offboarding runs ──────────────────────────────────────────────────
        off_batches = [
            ([{"email": "dan@kova.io",   "name": "Dan Royce",   "to": "Luca Ferreira"},
              {"email": "becky@kova.io", "name": "Becky Firth", "to": "Anna S."}],      21 * 24),
            ([{"email": "ross@kova.io",  "name": "Ross Imber",  "to": "Tom Elger"}],    9 * 24),
            ([{"email": "nadia@kova.io", "name": "Nadia Voss",  "to": "Luca Ferreira"},
              {"email": "omar@kova.io",  "name": "Omar Selin",  "to": "Priya Nair"}],   1 * 24),
        ]
        off_vaults = [V["Google Workspace Admin"], V["Okta API Token"], V["Slack Bot — Ops"], V["Salesforce OAuth"]]
        for rows, ago_h in off_batches:
            await make_run(pb_offboard, pv_off2, rows, offboard_steps,
                ago_h=ago_h, vault_ids=off_vaults)

        # ── Invoice reconciliation (monthly) ─────────────────────────────────
        inv_vaults = [V["Stripe Restricted Key"], V["Salesforce OAuth"], V["Google Workspace Admin"], V["Slack Bot — Ops"]]
        for ago_h, fail_row, fail_step, fail_msg in [
            (30 * 24, None, None, ""),
            (29 * 24 + 1, 0, 5,  "Gap detection script returned exit code 1 — missing CSV column 'net_volume'"),
            (23 * 24, None, None, ""),
        ]:
            await make_run(pb_invoice, pv_inv2,
                [{"month": "February 2026"}, {"month": "Q4 2025 catch-up"}],
                invoice_steps, ago_h=ago_h, duration_m=12,
                fail_row=fail_row, fail_step=fail_step, fail_msg=fail_msg or "",
                vault_ids=inv_vaults)

        # ── Candidate pipeline refresh (daily automation) ─────────────────────
        rec_vaults = [V["Greenhouse API Key"], V["Notion Integration Token"], V["Slack Bot — Ops"]]
        for ago_h in [7 * 24, 6 * 24, 5 * 24, 4 * 24, 3 * 24, 2 * 24, 1 * 24, 3]:
            await make_run(pb_recruit, pv_rec1,
                [{"stage": "Interview", "date": "today"}],
                recruit_steps, ago_h=ago_h, duration_m=4,
                trigger="automation", vault_ids=rec_vaults)

        # ── Churn re-engagement (2 manual runs) ───────────────────────────────
        churn_vaults = [V["Stripe Restricted Key"], V["Salesforce OAuth"], V["HubSpot Private App"], V["Slack Bot — Ops"]]
        await make_run(pb_churn, pv_churn1,
            [{"period": "Feb 2026 cancellations"}],
            churn_steps, ago_h=7 * 24, vault_ids=churn_vaults)
        await make_run(pb_churn, pv_churn1,
            [{"period": "Mar 1–10 2026 cancellations"}],
            churn_steps, ago_h=5, vault_ids=churn_vaults, fail_row=0, fail_step=4,
            fail_msg="HubSpot rate limit exceeded — 429 Too Many Requests")

        # ══════════════════════════════════════════════════════════════════════
        # AUTOMATIONS
        # ══════════════════════════════════════════════════════════════════════
        db.add(PlaybookAutomation(
            team_id=team.id, playbook_id=pb_lead.id,
            name="Daily inbound lead sync",
            trigger_type=AutomationTriggerType.INTERVAL, enabled=True,
            interval_minutes=1440,
            input_rows=[], input_source="hubspot_webhook",
            selected_vault_credential_ids=[V["HubSpot Private App"].id, V["Salesforce OAuth"].id, V["Slack Bot — Ops"].id],
            use_sandbox=False,
            next_run_at=now + timedelta(hours=20),
            last_run_at=now - timedelta(hours=2),
            last_run_id=last_lead_run.id if last_lead_run else None,
            created_by=rev.id,
        ))
        db.add(PlaybookAutomation(
            team_id=team.id, playbook_id=pb_recruit.id,
            name="Daily candidate digest",
            trigger_type=AutomationTriggerType.INTERVAL, enabled=True,
            interval_minutes=1440,
            input_rows=[{"stage": "Interview"}], input_source="manual",
            selected_vault_credential_ids=[V["Greenhouse API Key"].id, V["Notion Integration Token"].id, V["Slack Bot — Ops"].id],
            use_sandbox=False,
            next_run_at=now + timedelta(hours=21),
            last_run_at=now - timedelta(hours=3),
            created_by=hr.id,
        ))
        db.add(PlaybookAutomation(
            team_id=team.id, playbook_id=pb_invoice.id,
            name="Monthly invoice reconciliation",
            trigger_type=AutomationTriggerType.INTERVAL, enabled=True,
            interval_minutes=43200,  # 30 days
            input_rows=[], input_source="manual",
            selected_vault_credential_ids=[V["Stripe Restricted Key"].id, V["Salesforce OAuth"].id, V["Google Workspace Admin"].id, V["Slack Bot — Ops"].id],
            use_sandbox=False,
            next_run_at=now + timedelta(days=14),
            last_run_at=now - timedelta(days=16),
            created_by=owner.id,
        ))

        await db.commit()

    print("✅ Seed complete — Kova Technologies demo team.")
    print("🔑 Login: anna@kova.io / demo1234   |   invite code: invite_alex_001")
    print("📋 7 playbooks · 4 folders · 8 vault credentials · 5 users")
    print("🏃 ~20 runs spanning 30 days · 3 automations")


if __name__ == "__main__":
    asyncio.run(seed())
