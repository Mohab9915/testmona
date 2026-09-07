"""A run's status follows its results, not who is looking at it.

Regression: the status was derived (and written back) by the run detail page, so
a run stayed "pending" in the list until somebody opened it — and opening a
freshly seeded run flipped it to "running" before anything had been executed.
"""

from conftest import make_http_client


client = make_http_client()


def _seed_run(client, case_count=2):
    suite = client.post("/test-suites", json={"name": "S", "project_id": client.project_id}).json()
    cases = [
        client.post("/test-cases", json={
            "title": f"T{i}", "test_suite_id": suite["id"], "test_type": "manual",
        }).json()
        for i in range(case_count)
    ]
    run = client.post("/test-runs", json={"name": "R", "project_id": client.project_id}).json()
    results = []
    for case in cases:
        response = client.post("/test-results", json={
            "test_run_id": run["id"], "test_case_id": case["id"], "status": "not_started",
        })
        assert response.status_code == 200, response.text
        results.append(response.json())
    return run, results


def _run_status(client, run_id):
    response = client.get(f"/test-runs/{run_id}")
    assert response.status_code == 200, response.text
    return response.json()


def test_seeded_run_stays_pending_until_something_is_executed(client):
    run, _ = _seed_run(client)
    fetched = _run_status(client, run["id"])
    assert fetched["status"] == "pending"
    assert fetched["started_at"] is None


def test_first_recorded_result_moves_the_run_to_running(client):
    run, results = _seed_run(client)

    updated = client.put(f"/test-results/{results[0]['id']}", json={"status": "pass"})
    assert updated.status_code == 200, updated.text

    # No visit to the run's page in between — the status is already current.
    fetched = _run_status(client, run["id"])
    assert fetched["status"] == "running"
    assert fetched["started_at"] is not None
    assert fetched["completed_at"] is None


def test_run_completes_when_every_result_is_executed(client):
    run, results = _seed_run(client)
    for result in results:
        client.put(f"/test-results/{result['id']}", json={"status": "pass"})

    fetched = _run_status(client, run["id"])
    assert fetched["status"] == "completed"
    assert fetched["completed_at"] is not None


def test_a_failure_makes_the_finished_run_failed(client):
    run, results = _seed_run(client)
    client.put(f"/test-results/{results[0]['id']}", json={"status": "pass"})
    client.put(f"/test-results/{results[1]['id']}", json={"status": "fail"})

    fetched = _run_status(client, run["id"])
    assert fetched["status"] == "failed"
    assert fetched["completed_at"] is not None


def test_reopening_a_result_takes_the_run_out_of_a_terminal_state(client):
    run, results = _seed_run(client)
    for result in results:
        client.put(f"/test-results/{result['id']}", json={"status": "pass"})
    assert _run_status(client, run["id"])["status"] == "completed"

    client.put(f"/test-results/{results[0]['id']}", json={"status": "not_started"})

    fetched = _run_status(client, run["id"])
    assert fetched["status"] == "running"
    assert fetched["completed_at"] is None


def test_removing_the_last_executed_result_returns_the_run_to_pending(client):
    run, results = _seed_run(client, case_count=1)
    client.put(f"/test-results/{results[0]['id']}", json={"status": "pass"})
    assert _run_status(client, run["id"])["status"] == "completed"

    deleted = client.delete(f"/test-results/{results[0]['id']}")
    assert deleted.status_code == 200, deleted.text

    fetched = _run_status(client, run["id"])
    assert fetched["status"] == "pending"
    assert fetched["started_at"] is None
    assert fetched["completed_at"] is None
