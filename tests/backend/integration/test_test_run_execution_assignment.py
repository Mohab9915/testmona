"""Execution is assignment-scoped for testers.

A tester works the test runs assigned to *them*: they may not log results into a
colleague's run, pick up an unassigned one, or spin up a run of their own from a
test case. Managers/admins (anything holding ``write`` in the project) still
execute anything. See ``rbac.can_execute_test_run``.
"""

from conftest import make_http_client


def _seed(db, _engine):
    """Manager-owned project with one run assigned to Tester A, one unassigned."""
    from app import models

    manager = models.User(
        username="mgr", email="mgr@b.c", hashed_password="x",
        role="manager", is_active=True, full_name="Mgr",
    )
    db.add(manager)
    db.commit()
    db.refresh(manager)

    project = models.Project(name="Proj", description="d", owner_id=manager.id)
    db.add(project)
    db.commit()
    db.refresh(project)

    tester_a = models.User(
        username="thamdan", email="a@b.c", hashed_password="x",
        role="tester", is_active=True, full_name="Thamdan",
    )
    tester_b = models.User(
        username="ghassan", email="g@b.c", hashed_password="x",
        role="tester", is_active=True, full_name="Ghassan",
    )
    db.add_all([tester_a, tester_b])
    db.commit()
    db.refresh(tester_a)
    db.refresh(tester_b)
    db.add_all([
        models.ProjectAssignment(project_id=project.id, user_id=tester_a.id, role=models.Role.TESTER),
        models.ProjectAssignment(project_id=project.id, user_id=tester_b.id, role=models.Role.TESTER),
    ])

    suite = models.TestSuite(name="S1", project_id=project.id)
    db.add(suite)
    db.commit()
    db.refresh(suite)

    case = models.TestCase(
        title="TC", test_suite_id=suite.id, status="active",
        priority="high", test_type="manual", created_by=manager.id,
    )
    spare_case = models.TestCase(
        title="TC2", test_suite_id=suite.id, status="active",
        priority="low", test_type="manual", created_by=manager.id,
    )
    db.add_all([case, spare_case])
    db.commit()
    db.refresh(case)
    db.refresh(spare_case)

    assigned_run = models.TestRun(
        name="Run for A", project_id=project.id, assigned_to=tester_a.id, status="pending",
    )
    unassigned_run = models.TestRun(name="Nobody's run", project_id=project.id, status="pending")
    db.add_all([assigned_run, unassigned_run])
    db.commit()
    db.refresh(assigned_run)
    db.refresh(unassigned_run)

    assigned_result = models.TestResult(
        test_case_id=case.id, test_run_id=assigned_run.id, status="not_started",
    )
    unassigned_result = models.TestResult(
        test_case_id=case.id, test_run_id=unassigned_run.id, status="not_started",
    )
    db.add_all([assigned_result, unassigned_result])
    db.commit()
    db.refresh(assigned_result)
    db.refresh(unassigned_result)

    # Acts as Tester A (the assignee) by default.
    return tester_a.id, project.id, {
        "manager_id": manager.id,
        "tester_a_id": tester_a.id,
        "tester_b_id": tester_b.id,
        "test_case_id": case.id,
        "spare_case_id": spare_case.id,
        "assigned_run_id": assigned_run.id,
        "unassigned_run_id": unassigned_run.id,
        "assigned_result_id": assigned_result.id,
        "unassigned_result_id": unassigned_result.id,
    }


client = make_http_client(seed_fn=_seed)

PASS = {"status": "passed", "actual_result": "worked"}


def test_assignee_can_record_results_on_their_run(client):
    resp = client.put(f"/test-results/{client.assigned_result_id}", json=PASS)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "pass"  # canonicalized on write


def test_other_tester_cannot_record_results_on_someone_elses_run(client):
    client.set_current_user(client.tester_b_id)
    resp = client.put(f"/test-results/{client.assigned_result_id}", json=PASS)
    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"] == "This test run is not assigned to you"


def test_tester_cannot_pick_up_an_unassigned_run(client):
    resp = client.put(f"/test-results/{client.unassigned_result_id}", json=PASS)
    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"] == "This test run is not assigned to you"


def test_other_tester_can_still_read_the_run(client):
    """The gate is on recording work, not on visibility."""
    client.set_current_user(client.tester_b_id)
    assert client.get(f"/test-runs/{client.assigned_run_id}").status_code == 200
    assert client.get(f"/test-results?test_run_id={client.assigned_run_id}").status_code == 200


def test_every_execution_side_door_is_gated_for_a_non_assignee(client):
    client.set_current_user(client.tester_b_id)
    result_id = client.assigned_result_id
    assert client.put(f"/test-results/{result_id}/pause").status_code == 403
    assert client.put(f"/test-results/{result_id}/resume").status_code == 403
    assert client.put(f"/test-results/{result_id}/add-time", json={"hours": 1}).status_code == 403
    assert client.put(f"/test-results/{result_id}/reset-time").status_code == 403
    step_results = client.put(
        f"/test-results/{result_id}/step-results",
        json=[{"step_number": 1, "step_name": "s", "step_status": "passed", "step_duration": 0}],
    )
    assert step_results.status_code == 403
    imported = client.post(
        f"/test-runs/{client.assigned_run_id}/import-results",
        files={"file": ("r.xml", b"<testsuite/>", "application/xml")},
    )
    assert imported.status_code == 403


def test_tester_cannot_spin_up_their_own_run(client):
    """The ad-hoc "execute this test case" flow: create a run, then attach the case."""
    created = client.post("/test-runs", json={
        "name": "Quick execution", "project_id": client.project_id, "status": "in_progress",
    })
    assert created.status_code == 403, created.text

    # Nor attach a case to a run — even the one assigned to them. Defining what a
    # run covers is authoring, and stays with whoever owns the run.
    attached = client.post("/test-results", json={
        "test_run_id": client.assigned_run_id,
        "test_case_id": client.spare_case_id,
        "status": "not_started",
    })
    assert attached.status_code == 403, attached.text


def test_tester_cannot_drop_a_case_from_their_run(client):
    resp = client.delete(f"/test-results/{client.assigned_result_id}")
    assert resp.status_code == 403, resp.text


def test_manager_executes_any_run_regardless_of_assignee(client):
    client.set_current_user(client.manager_id)
    assert client.put(f"/test-results/{client.assigned_result_id}", json=PASS).status_code == 200
    assert client.put(f"/test-results/{client.unassigned_result_id}", json=PASS).status_code == 200


def test_browse_list_only_shows_runs_assigned_to_the_tester(client):
    """The gate on visibility is the browse list, not opening a run by ID
    (see test_other_tester_can_still_read_the_run above)."""
    resp = client.get(f"/test-runs?project_id={client.project_id}")
    assert resp.status_code == 200, resp.text
    ids = {run["id"] for run in resp.json()}
    assert ids == {client.assigned_run_id}  # not the unassigned one

    client.set_current_user(client.tester_b_id)
    resp = client.get(f"/test-runs?project_id={client.project_id}")
    assert resp.status_code == 200, resp.text
    assert resp.json() == []  # nothing is assigned to tester B


def test_manager_sees_every_run_in_the_browse_list(client):
    client.set_current_user(client.manager_id)
    resp = client.get(f"/test-runs?project_id={client.project_id}")
    assert resp.status_code == 200, resp.text
    ids = {run["id"] for run in resp.json()}
    assert ids == {client.assigned_run_id, client.unassigned_run_id}
