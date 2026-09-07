"""User-supplied text is stored exactly as typed, not HTML-escaped.

The API used to run every string field through ``html.escape`` on write, so
``Noise & Turn`` came back as ``Noise &amp; Turn`` and ``customer's`` as
``customer&#x27;s``. Escaping belongs on render (React escapes text nodes;
``dangerouslySetInnerHTML`` paths go through DOMPurify), so these round-trips
must return the input untouched -- including across an update, which is where
the old escaping compounded.
"""

from conftest import make_http_client


client = make_http_client()

TEXT = "Noise Cancellation & Turn Analysis — the customer's \"quoted\" <name>"


def test_suite_and_case_text_round_trips_verbatim(client):
    suite = client.post("/test-suites", json={
        "name": TEXT, "description": TEXT, "project_id": client.project_id,
    })
    assert suite.status_code == 200, suite.text
    assert suite.json()["name"] == TEXT
    assert suite.json()["description"] == TEXT

    case = client.post("/test-cases", json={
        "title": TEXT, "description": TEXT, "test_suite_id": suite.json()["id"],
        "test_type": "manual",
    })
    assert case.status_code == 200, case.text
    assert case.json()["title"] == TEXT

    fetched = client.get(f"/test-suites/{suite.json()['id']}").json()
    assert fetched["name"] == TEXT


def test_repeated_updates_do_not_compound_escaping(client):
    suite = client.post("/test-suites", json={
        "name": "S", "project_id": client.project_id,
    }).json()

    for _ in range(3):
        updated = client.put(f"/test-suites/{suite['id']}", json={"name": TEXT})
        assert updated.status_code == 200, updated.text
        assert updated.json()["name"] == TEXT


def test_requirement_rich_text_survives_the_edit_round_trip(client):
    body = "<p>Reject a webhook whose body doesn't match &lt;sig&gt;</p>"
    requirement = client.post("/requirements", json={
        "title": TEXT, "description": body, "acceptance_criteria": body,
        "project_id": client.project_id, "created_by": 1,
    })
    assert requirement.status_code == 200, requirement.text
    assert requirement.json()["title"] == TEXT
    # The literal entity the author typed stays literal; the markup stays markup.
    assert requirement.json()["description"] == body

    # Re-saving what the edit form loaded must be a no-op, not another escape pass.
    resaved = client.put(f"/requirements/{requirement.json()['id']}", json={"description": body})
    assert resaved.status_code == 200, resaved.text
    assert resaved.json()["description"] == body
