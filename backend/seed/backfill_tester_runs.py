#!/usr/bin/env python3
"""Give every tester on the release a test run of their own.

Execution is assignment-scoped (see ``rbac.can_execute_test_run``): a tester may
only record results on runs assigned to *them*. So a tester with no assigned run
has nothing to work on at all.

``seed_jawad_release_1`` creates one run per suite, assigned to that suite's
*primary* tester. That leaves out anyone who only appears as a suite's
``secondary``, and leaves the project owner without a run of their own. This
script fills exactly those gaps:

* a tester named as a suite's ``secondary`` gets a **second-pass** run of that
  suite (the pairing the seed already describes, made executable);
* anyone still without a run - including the project owner - gets a **release
  acceptance** run covering every critical-priority case in the release.

Safe to re-run: it skips anyone who already has a run assigned and never touches
an existing run. New runs copy the plan/milestone/environment/build of the runs
already in the project so they sit in the same release context.

    docker cp backend/seed/backfill_tester_runs.py testmona-backend-1:/app/seed/
    docker exec testmona-backend-1 python seed/backfill_tester_runs.py
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/
sys.path.append(os.path.dirname(os.path.abspath(__file__)))  # backend/seed/

from app.database import SessionLocal
from app import crud, models
from app.rbac import normalize_role

import seed_jawad_release_1 as base

PROJECT_ID = base.PROJECT_ID
BUILD = base.BUILD
ACCEPTANCE_PRIORITY = "critical"


def _display(user):
    return user.full_name or user.username


def _release_context(db):
    """Plan / milestone / environment / build shared by the project's runs.

    Taken from the newest existing run so backfilled runs land in the same
    release context instead of re-deriving (or guessing) it.
    """
    latest = (
        db.query(models.TestRun)
        .filter(models.TestRun.project_id == PROJECT_ID)
        .order_by(models.TestRun.id.desc())
        .first()
    )
    if latest is None:
        return {"build": BUILD}
    return {
        "test_plan_id": latest.test_plan_id,
        "milestone_id": latest.milestone_id,
        "environment_id": latest.environment_id,
        "build": latest.build or BUILD,
    }


def _project_testers(db):
    """Project members whose *effective role in this project* is tester."""
    testers = []
    assignments = (
        db.query(models.ProjectAssignment)
        .filter(models.ProjectAssignment.project_id == PROJECT_ID)
        .all()
    )
    for assignment in assignments:
        if normalize_role(assignment.role) is not models.Role.TESTER:
            continue
        user = db.query(models.User).filter(models.User.id == assignment.user_id).first()
        if user and user.is_active:
            testers.append(user)
    return testers


def _secondary_suite_names():
    """username -> suite name, for every suite that names a secondary reviewer."""
    return {
        suite["secondary"]: suite["name"]
        for suite in base.SUITES
        if suite.get("secondary")
    }


def _suite_cases(db, suite_name):
    suite = (
        db.query(models.TestSuite)
        .filter(
            models.TestSuite.project_id == PROJECT_ID,
            models.TestSuite.name == suite_name,
        )
        .first()
    )
    if suite is None:
        return None, []
    cases = (
        db.query(models.TestCase)
        .filter(models.TestCase.test_suite_id == suite.id)
        .all()
    )
    return suite, cases


def _acceptance_cases(db):
    """Every critical-priority case in the release, across all suites."""
    return (
        db.query(models.TestCase)
        .join(models.TestSuite, models.TestCase.test_suite_id == models.TestSuite.id)
        .filter(
            models.TestSuite.project_id == PROJECT_ID,
            models.TestCase.priority == ACCEPTANCE_PRIORITY,
        )
        .order_by(models.TestCase.test_suite_id, models.TestCase.id)
        .all()
    )


def main():
    db = SessionLocal()
    try:
        project = db.query(models.Project).filter(models.Project.id == PROJECT_ID).first()
        if not project:
            raise SystemExit(f"Project {PROJECT_ID} not found")

        context = _release_context(db)
        build = context.get("build") or BUILD
        already_assigned = {
            run.assigned_to
            for run in db.query(models.TestRun).filter(
                models.TestRun.project_id == PROJECT_ID
            ).all()
            if run.assigned_to
        }

        owner = db.query(models.User).filter(models.User.id == project.owner_id).first()
        candidates = _project_testers(db)
        # The owner runs the release acceptance pass, so they get a run of their
        # own even though their role would let them execute anyone else's.
        if owner and owner.id not in {u.id for u in candidates}:
            candidates.append(owner)

        secondary_of = _secondary_suite_names()
        acceptance_cases = None
        created = 0

        print("== Backfilling test runs ==")
        for user in candidates:
            if user.id in already_assigned:
                print(f"  skip: {_display(user)} already has a run")
                continue

            suite_name = secondary_of.get(user.username)
            if suite_name:
                suite, cases = _suite_cases(db, suite_name)
                if not cases:
                    print(f"  skip: suite '{suite_name}' for {_display(user)} has no cases")
                    continue
                name = f"{suite.name} — Second Pass — Build {build}"
                description = (
                    f"Independent second pass over the '{suite.name}' suite for build {build}, "
                    f"executed by {_display(user)}."
                )
                priority = "high"
            else:
                if acceptance_cases is None:
                    acceptance_cases = _acceptance_cases(db)
                cases = acceptance_cases
                if not cases:
                    print(f"  skip: no {ACCEPTANCE_PRIORITY} cases to build an acceptance run from")
                    continue
                name = f"Release Acceptance ({_display(user)}) — Build {build}"
                description = (
                    f"Release acceptance pass for build {build}: every {ACCEPTANCE_PRIORITY}-priority "
                    f"case across all channels, executed by {_display(user)}."
                )
                priority = "critical"

            existing = (
                db.query(models.TestRun)
                .filter(
                    models.TestRun.project_id == PROJECT_ID,
                    models.TestRun.name == name,
                )
                .first()
            )
            if existing:
                print(f"  exists: '{name}' - assigning to {_display(user)}")
                existing.assigned_to = user.id
                db.commit()
                created += 1
                continue

            run_fields = {k: v for k, v in context.items() if k != "build"}
            run = crud.create_seeded_test_run(
                db,
                project_id=PROJECT_ID,
                name=name,
                description=description,
                test_cases=cases,
                assigned_to=user.id,
                priority=priority,
                build=build,
                **run_fields,
            )
            created += 1
            print(f"  created: '{run.name}' id={run.id} -> {_display(user)} ({len(cases)} cases)")

        print(f"\nDone. {created} run(s) added.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
