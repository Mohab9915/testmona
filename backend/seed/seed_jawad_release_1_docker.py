#!/usr/bin/env python3
"""Variant of seed_jawad_release_1.py for the live docker-deployed instance.

Differences from the local variant:
- Reuses the 10 real user accounts that already exist in this deployment
  instead of creating new ones (idempotent lookup already handled the same
  way in the base script).
- Reuses the existing execution environments (by environment_type) and the
  existing milestone instead of creating duplicates with different names.
- Wipes the old "Bug Bash" plan/suites/cases/run before loading the new
  structure (explicitly approved by the project owner).
"""
import html
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/
sys.path.append(os.path.dirname(os.path.abspath(__file__)))  # backend/seed/

from datetime import datetime, timedelta, timezone
from sqlalchemy import text

from app.database import SessionLocal
from app import models, crud, schemas

import seed_jawad_release_1 as base

PROJECT_ID = base.PROJECT_ID
BUILD = base.BUILD


def wipe_old_bug_bash(db):
    print("== Wiping old Bug Bash data ==")
    old_suite_ids = [r[0] for r in db.execute(
        text("SELECT id FROM test_suites WHERE project_id = :pid"), {"pid": PROJECT_ID}
    ).fetchall()]
    old_plan_ids = [r[0] for r in db.execute(
        text("SELECT id FROM test_plans WHERE project_id = :pid"), {"pid": PROJECT_ID}
    ).fetchall()]
    old_case_ids = [r[0] for r in db.execute(
        text("SELECT id FROM test_cases WHERE test_suite_id IN (" + ",".join(str(i) for i in old_suite_ids) + ")")
    ).fetchall()] if old_suite_ids else []

    old_run_ids = [r[0] for r in db.execute(
        text("SELECT id FROM test_runs WHERE project_id = :pid"), {"pid": PROJECT_ID}
    ).fetchall()]

    def run_delete(sql, **params):
        result = db.execute(text(sql), params)
        return result.rowcount

    if old_run_ids:
        ids_sql = "(" + ",".join(str(i) for i in old_run_ids) + ")"
        for table in [
            "test_results",
            "test_executions",
            "test_run_environments",
            "coverage_reports",
            "execution_logs",
            "custom_field_values",
        ]:
            n = run_delete(f"DELETE FROM {table} WHERE test_run_id IN {ids_sql}")
            if n:
                print(f"  deleted {n} rows from {table}")
        n = run_delete(f"DELETE FROM test_runs WHERE id IN {ids_sql}")
        print(f"  deleted {n} test_runs")

    if old_case_ids:
        ids_sql = "(" + ",".join(str(i) for i in old_case_ids) + ")"
        for table, col in [
            ("test_case_steps", "test_case_id"),
            ("test_case_tags", "test_case_id"),
            ("shared_step_usage", "test_case_id"),
            ("custom_field_values", "test_case_id"),
            ("test_case_revisions", "test_case_id"),
            ("test_case_versions", "test_case_id"),
            ("requirement_test_case_links", "test_case_id"),
            ("traceability_matrix", "test_case_id"),
        ]:
            n = run_delete(f"DELETE FROM {table} WHERE {col} IN {ids_sql}")
            if n:
                print(f"  deleted {n} rows from {table}")
        n = run_delete(f"DELETE FROM test_cases WHERE id IN {ids_sql}")
        print(f"  deleted {n} test_cases")

    if old_suite_ids:
        ids_sql = "(" + ",".join(str(i) for i in old_suite_ids) + ")"
        n = run_delete(f"DELETE FROM test_case_sections WHERE test_suite_id IN {ids_sql}")
        print(f"  deleted {n} test_case_sections")
        n = run_delete(f"DELETE FROM test_plan_suites WHERE test_suite_id IN {ids_sql}")
        if n:
            print(f"  deleted {n} test_plan_suites links")
        n = run_delete(f"DELETE FROM test_suites WHERE id IN {ids_sql}")
        print(f"  deleted {n} test_suites")

    # Requirements previously created by *this* seed script (matched by title,
    # in both raw and HTML-escaped form, since the API escapes on write) are
    # deleted so repeated runs don't accumulate duplicates. Requirements that
    # predate this script are left alone and re-linked to the new plan below.
    seeded_titles = set()
    for r in base.REQUIREMENTS:
        seeded_titles.add(r["title"])
        seeded_titles.add(html.escape(r["title"], quote=True))
    old_req_ids = [
        rid for rid, title in db.execute(text("SELECT id, title FROM requirements WHERE project_id = :pid"),
                                         {"pid": PROJECT_ID}).fetchall()
        if title in seeded_titles
    ]
    if old_req_ids:
        ids_sql = "(" + ",".join(str(i) for i in old_req_ids) + ")"
        for table in [
            "requirement_test_case_links",
            "requirement_test_plan_links",
            "requirement_versions",
            "requirement_comments",
            "traceability_matrix",
            "doc_requirement_links",
            "custom_field_values",
        ]:
            n = run_delete(f"DELETE FROM {table} WHERE requirement_id IN {ids_sql}")
            if n:
                print(f"  deleted {n} rows from {table}")
        n = run_delete(f"DELETE FROM requirements WHERE id IN {ids_sql}")
        print(f"  deleted {n} previously-seeded requirements")

    if old_plan_ids:
        ids_sql = "(" + ",".join(str(i) for i in old_plan_ids) + ")"
        n = run_delete(f"DELETE FROM requirement_test_plan_links WHERE test_plan_id IN {ids_sql}")
        print(f"  deleted {n} requirement_test_plan_links")
        n = run_delete(f"DELETE FROM test_plan_suites WHERE test_plan_id IN {ids_sql}")
        if n:
            print(f"  deleted {n} test_plan_suites links (plan side)")
        n = run_delete(f"DELETE FROM test_plans WHERE id IN {ids_sql}")
        print(f"  deleted {n} test_plans")

    db.commit()


def main():
    db = SessionLocal()
    try:
        project = db.query(models.Project).filter(models.Project.id == PROJECT_ID).first()
        if not project:
            raise SystemExit(f"Project {PROJECT_ID} not found")
        owner_id = project.owner_id

        wipe_old_bug_bash(db)

        # --- Users (reuse existing accounts) ---------------------------------
        username_to_user = {}
        print("== Users ==")
        for t in base.TESTERS:
            existing = db.query(models.User).filter(models.User.username == t["username"]).first()
            if existing:
                username_to_user[t["username"]] = existing
                print(f"  reused: {t['username']} ({existing.full_name}) id={existing.id}")
                continue
            user = crud.create_user(db, schemas.UserCreate(
                username=t["username"], email=t["email"], full_name=t["full_name"],
                password=base.TEMP_PASSWORD, role="tester", force_password_change=True,
            ))
            username_to_user[t["username"]] = user
            print(f"  created: {t['username']} ({t['full_name']}) id={user.id}")

        def ensure_assignment(user_id, role):
            existing = db.query(models.ProjectAssignment).filter(
                models.ProjectAssignment.user_id == user_id,
                models.ProjectAssignment.project_id == PROJECT_ID,
            ).first()
            if existing:
                return existing
            pa = models.ProjectAssignment(user_id=user_id, project_id=PROJECT_ID, role=role, assigned_by=owner_id)
            db.add(pa)
            db.commit()
            db.refresh(pa)
            return pa

        ensure_assignment(owner_id, models.Role.ADMIN)
        for t in base.TESTERS:
            ensure_assignment(username_to_user[t["username"]].id, models.Role.TESTER)

        # --- Execution environments (reuse existing by type) ------------------
        print("== Environments (reused) ==")
        env_by_type = {}
        for existing in db.query(models.ExecutionEnvironment).filter(
            models.ExecutionEnvironment.project_id == PROJECT_ID
        ).all():
            env_by_type.setdefault(existing.environment_type, existing)
            print(f"  reused: {existing.name} ({existing.environment_type}) id={existing.id}")
        if "staging" not in env_by_type:
            e = base.ENVIRONMENTS[1]
            env = crud.create_execution_environment(db, {**e, "project_id": PROJECT_ID})
            env_by_type["staging"] = env
            print(f"  created: {env.name} id={env.id}")
        staging_env = env_by_type["staging"]

        # --- Shared steps -------------------------------------------------------
        print("== Shared steps ==")
        shared_by_key = {}
        for key, s in base.SHARED_STEPS.items():
            existing = db.query(models.SharedStep).filter(
                models.SharedStep.project_id == PROJECT_ID,
                models.SharedStep.name == s["name"],
            ).first()
            if existing:
                shared_by_key[key] = existing
                continue
            ss = crud.create_shared_step(db, {**s, "project_id": PROJECT_ID, "created_by": owner_id})
            shared_by_key[key] = ss
            print(f"  created: {s['name']} id={ss.id}")

        # --- Milestone (reuse existing, else create) --------------------------
        print("== Milestone ==")
        milestone = db.query(models.Milestone).filter(models.Milestone.project_id == PROJECT_ID).first()
        if milestone:
            print(f"  reused: '{milestone.title}' id={milestone.id}")
        else:
            milestone = crud.create_milestone(db, schemas.MilestoneCreate(
                title="Release 1.0 — Messenger, Web Chat Widget & Voice Pipeline Upgrade",
                description="First release tracked in TestMona.",
                project_id=PROJECT_ID,
                created_by=owner_id,
                target_date=datetime.now(timezone.utc) + timedelta(days=21),
            ))
            print(f"  created: id={milestone.id}")

        # --- Test Plan ------------------------------------------------------
        print("== Test Plan ==")
        plan = crud.create_test_plan(db, schemas.TestPlanCreate(
            title="Jawad Release 1.0 Test Plan",
            description=(
                "Reusable test plan for Release 1.0. Covers the two new chat channels (Messenger, Web Chat Widget), "
                "the voice pipeline upgrade (RNNoise + SmartTurn), a full regression pass on the existing production "
                "WhatsApp channel, and a cross-channel consistency/regression pass. Re-run this plan (as a new Test "
                "Run) against each build candidate rather than cloning its test cases."
            ),
            project_id=PROJECT_ID,
            created_by=owner_id,
            assigned_to=owner_id,
            milestone_id=milestone.id,
            test_objectives=(
                "Verify the 5 shipped feature areas function correctly end-to-end; confirm zero regression on the "
                "production WhatsApp channel, especially after the shared text_channel.py base merge; confirm "
                "WhatsApp/Messenger native voice calling remains genuinely out of scope this release."
            ),
            scope_inclusions=(
                "Messenger Chat; Web Chat Widget + landing Channels section; Noise Cancellation and Turn Analysis; "
                "WhatsApp Chat regression; Calling the Website (landing voice call); Cross-Channel Consistency."
            ),
            scope_exclusions=(
                "WhatsApp/Messenger native voice calling — not implemented in this release (confirmed absent from "
                "every branch searched). Automated regression scripts — this release is manual QA only."
            ),
            test_environment=(
                "Primary target is Staging; a subset of security/negative webhook cases may run against Local Dev "
                "via ngrok. TURN relay (Twilio NTS) is mandatory in both, since ACA has no direct UDP ingress."
            ),
            entry_criteria=(
                "All 5 feature branches merged to a shared staging deployment; QA WhatsApp test number, Facebook test "
                "Page + test user, and Azure/Twilio ICE credentials provisioned; all 7 testers have TestMona accounts."
            ),
            exit_criteria=(
                "All Critical-priority test cases pass; no open Critical/High defects on any suite; the WhatsApp "
                "regression suite has been explicitly re-run and signed off after whichever refactor branch merges last."
            ),
            risks_assumptions=(
                "Messenger and the web-widget branch each independently rebuilt WhatsApp's channel logic onto a "
                "shared TextSessionManager base — see the Cross-Channel Consistency suite. RNNoise/SmartTurn "
                "fail_open defaults mean a silent degrade could be mistaken for 'working'; testers must check logs, "
                "not just subjective audio/behavior."
            ),
        ))
        print(f"  test plan id={plan.id}")

        # --- Suites, sections, cases, requirements --------------------------
        print("== Suites ==")
        all_suite_objs = []
        req_case_map = {}

        for suite_def in base.SUITES:
            suite = crud.create_test_suite(db, schemas.TestSuiteCreate(
                name=suite_def["name"], description=suite_def["description"], project_id=PROJECT_ID,
            ))
            all_suite_objs.append(suite)
            print(f"  suite '{suite.name}' id={suite.id}")

            section_by_name = {}
            for idx, sec_name in enumerate(suite_def["sections"]):
                sec = crud.create_test_case_section(db, schemas.TestCaseSectionCreate(
                    name=sec_name, test_suite_id=suite.id, order_index=idx,
                ))
                section_by_name[sec_name] = sec

            for c in suite_def["cases"]:
                section = section_by_name[c["section"]]
                test_steps = [
                    schemas.TestCaseStepCreate(step_number=i + 1, action=s["action"],
                                                expected_result=s["expected_result"], step_type=s["step_type"])
                    for i, s in enumerate(c["steps"])
                ]
                tc = crud.create_test_case(db, schemas.TestCaseCreate(
                    title=c["title"],
                    description=c["description"],
                    test_type=c["test_type"],
                    preconditions=c["preconditions"],
                    priority=c["priority"],
                    tags=c["tags"],
                    section_id=section.id,
                    test_suite_id=suite.id,
                    test_steps=test_steps,
                ), created_by=owner_id)
                for shared_key in c["shared"]:
                    tc.shared_steps.append(shared_by_key[shared_key])
                if c["shared"]:
                    db.commit()
                req_case_map[c["title"]] = tc

            print(f"    {len(suite_def['cases'])} test cases across {len(suite_def['sections'])} sections")

        # --- Requirements + traceability -------------------------------------
        print("== Requirements ==")
        plan.suites = all_suite_objs
        db.commit()

        req_objs = []
        for r in base.REQUIREMENTS:
            req = crud.create_requirement(db, schemas.RequirementCreate(
                title=r["title"], description=r["acceptance_criteria"], acceptance_criteria=r["acceptance_criteria"],
                priority=r["priority"], tags=r["tags"], project_id=PROJECT_ID, created_by=owner_id,
                status="approved",
            ))
            linked_cases = [req_case_map[t] for t in r["case_titles"] if t in req_case_map]
            req.test_cases = linked_cases
            req_objs.append(req)
        db.commit()

        # Keep any pre-existing requirements (e.g. the old bug-bash ones) linked
        # to the new plan too, rather than deleting them outright.
        pre_existing_reqs = db.query(models.Requirement).filter(
            models.Requirement.project_id == PROJECT_ID,
            ~models.Requirement.id.in_([r.id for r in req_objs]),
        ).all()
        plan.requirements = req_objs + pre_existing_reqs
        db.commit()
        print(f"  {len(req_objs)} new requirements created and linked ({len(pre_existing_reqs)} pre-existing ones kept and re-linked)")

        # --- Test runs ------------------------------------------------------
        # Execution is assignment-scoped (rbac.can_execute_test_run): a tester can
        # only work the runs assigned to them, so every tester needs one. That is
        # a run per suite for the primary, a second-pass run for each secondary,
        # and a release-acceptance run for the project owner.
        print("== Test Runs ==")
        suite_by_key = {s_def["key"]: s_obj for s_def, s_obj in zip(base.SUITES, all_suite_objs)}
        for suite_def in base.SUITES:
            suite = suite_by_key[suite_def["key"]]
            test_cases = db.query(models.TestCase).filter(models.TestCase.test_suite_id == suite.id).all()
            primary_user = username_to_user[suite_def["primary"]]
            secondary_note = ""
            if suite_def["secondary"]:
                secondary_user = username_to_user[suite_def["secondary"]]
                secondary_note = f" Paired with {secondary_user.full_name} as secondary reviewer given this suite's regression risk."
            run = crud.create_seeded_test_run(
                db,
                project_id=PROJECT_ID,
                name=f"{suite.name} — Build {BUILD}",
                description=f"Execution of the '{suite.name}' suite for Release 1.0, build {BUILD}.{secondary_note}",
                test_cases=test_cases,
                test_plan_id=plan.id,
                milestone_id=milestone.id,
                build=BUILD,
                environment_id=staging_env.id,
                assigned_to=primary_user.id,
                priority=suite_def["run_priority"],
            )
            print(f"  run '{run.name}' id={run.id} assigned_to={primary_user.full_name} ({len(test_cases)} cases)")

            # The secondary reviewer executes the same suite independently, so
            # they get their own run rather than sharing the primary's.
            if suite_def["secondary"]:
                secondary_user = username_to_user[suite_def["secondary"]]
                second_pass = crud.create_seeded_test_run(
                    db,
                    project_id=PROJECT_ID,
                    name=f"{suite.name} — Second Pass — Build {BUILD}",
                    description=(
                        f"Independent second pass over the '{suite.name}' suite for build {BUILD}, "
                        f"executed by {secondary_user.full_name} as the suite's secondary reviewer."
                    ),
                    test_cases=test_cases,
                    test_plan_id=plan.id,
                    milestone_id=milestone.id,
                    build=BUILD,
                    environment_id=staging_env.id,
                    assigned_to=secondary_user.id,
                    priority="high",
                )
                print(f"  run '{second_pass.name}' id={second_pass.id} assigned_to={secondary_user.full_name} ({len(test_cases)} cases)")

        # The project owner signs the release off on the critical cases.
        owner = db.query(models.User).filter(models.User.id == owner_id).first()
        critical_cases = db.query(models.TestCase).join(
            models.TestSuite, models.TestCase.test_suite_id == models.TestSuite.id
        ).filter(
            models.TestSuite.project_id == PROJECT_ID,
            models.TestCase.priority == "critical",
        ).order_by(models.TestCase.test_suite_id, models.TestCase.id).all()
        if critical_cases:
            owner_name = owner.full_name or owner.username
            acceptance = crud.create_seeded_test_run(
                db,
                project_id=PROJECT_ID,
                name=f"Release Acceptance ({owner_name}) — Build {BUILD}",
                description=(
                    f"Release acceptance pass for build {BUILD}: every critical-priority case "
                    f"across all channels, executed by {owner_name}."
                ),
                test_cases=critical_cases,
                test_plan_id=plan.id,
                milestone_id=milestone.id,
                build=BUILD,
                environment_id=staging_env.id,
                assigned_to=owner_id,
                priority="critical",
            )
            print(f"  run '{acceptance.name}' id={acceptance.id} assigned_to={owner_name} ({len(critical_cases)} cases)")

        print("\nDone.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
