"""A test plan is the reusable definition; each execution is a new run.

Covers the plan's suite scope (plan -> suites -> cases) and POST
/test-plans/{id}/runs, which seeds a run from that scope per build without
duplicating a single test case.
"""

from conftest import make_http_client


client = make_http_client()


def _seed_plan_with_suite(client, case_titles=("C1", "C2")):
    suite = client.post("/test-suites", json={"name": "S", "project_id": client.project_id}).json()
    for title in case_titles:
        client.post("/test-cases", json={
            "title": title, "test_suite_id": suite["id"], "test_type": "manual",
        })
    plan = client.post("/test-plans", json={
        "title": "Product Journey Regression", "project_id": client.project_id, "created_by": 1,
    }).json()
    return plan, suite


def test_plan_scope_drives_runs(client):
    plan, suite = _seed_plan_with_suite(client)

    scope = client.put(f"/test-plans/{plan['id']}/suites", json={"suite_ids": [suite["id"]]})
    assert scope.status_code == 200, scope.text
    assert scope.json() == {"suite_ids": [suite["id"]], "test_case_count": 2}

    detail = client.get(f"/test-plans/{plan['id']}").json()
    assert detail["suite_ids"] == [suite["id"]]
    assert detail["planned_case_count"] == 2

    # Two executions of the same plan against different builds.
    run1 = client.post(f"/test-plans/{plan['id']}/runs", json={"build": "2201"})
    assert run1.status_code == 200, run1.text
    run2 = client.post(f"/test-plans/{plan['id']}/runs", json={"build": "2202"})
    assert run2.status_code == 200, run2.text

    for run, build in ((run1.json(), "2201"), (run2.json(), "2202")):
        assert run["build"] == build
        assert run["test_plan_id"] == plan["id"]
        assert run["name"].endswith(build)  # defaults to "<plan title> - <build>"
        assert run["total_tests"] == 2
        assert run["not_started_tests"] == 2

    # Both runs execute the same two cases — the plan's cases were not cloned.
    assert len(client.get(f"/test-cases?project_id={client.project_id}").json()) == 2
    cases_in = lambda run_id: sorted(
        r["test_case_id"] for r in client.get(f"/test-results?test_run_id={run_id}").json()
    )
    assert cases_in(run1.json()["id"]) == cases_in(run2.json()["id"])


def test_run_from_plan_without_scope_is_rejected(client):
    plan, _ = _seed_plan_with_suite(client)
    response = client.post(f"/test-plans/{plan['id']}/runs", json={"build": "2201"})
    assert response.status_code == 400, response.text


def test_deleting_a_scoped_suite_drops_the_plan_link(client):
    plan, suite = _seed_plan_with_suite(client, case_titles=())
    client.put(f"/test-plans/{plan['id']}/suites", json={"suite_ids": [suite["id"]]})

    deleted = client.delete(f"/test-suites/{suite['id']}")
    assert deleted.status_code == 200, deleted.text
    assert client.get(f"/test-plans/{plan['id']}").json()["suite_ids"] == []


def test_plan_scope_rejects_suite_from_another_project(client):
    plan, _ = _seed_plan_with_suite(client)
    other_project = client.post("/projects", json={"name": "Other", "description": "d"}).json()
    other_suite = client.post("/test-suites", json={"name": "S2", "project_id": other_project["id"]}).json()

    response = client.put(f"/test-plans/{plan['id']}/suites", json={"suite_ids": [other_suite["id"]]})
    assert response.status_code == 400, response.text
    assert client.get(f"/test-plans/{plan['id']}").json()["suite_ids"] == []
