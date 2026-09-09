"""Integration coverage for Azure DevOps inline images on imported defects.

A bug imported from ADO keeps its description as HTML, and pasted screenshots
live in it as ``<img src=".../_apis/wit/attachments/{guid}">`` - a URL a browser
cannot load (it needs the integration PAT). The defect API rewrites those srcs
to a signed proxy URL; ``GET .../ado-attachment`` then streams the bytes from
ADO without persisting them.
"""

import pytest

from conftest import make_http_client, seed_admin_project_member


client = make_http_client(seed_fn=seed_admin_project_member)

GUID = "12ab34cd-5678-90ef-1234-567890abcdef"
ADO_IMG = (
    f'<img src="https://dev.azure.com/acme/web/_apis/wit/attachments/{GUID}'
    '?fileName=shot.png">'
)
DESC = f"<div>Repro steps:</div><div>1. open page</div>{ADO_IMG}"


def _seed_integration_and_defect(client, *, active=True, description=DESC):
    from app import models

    db = client.SessionLocal()
    try:
        integ = models.IssueTrackerIntegration(
            name="ADO",
            tracker_type="azure-devops",
            project_id=client.project_id,
            api_url="https://dev.azure.com",
            project_key="acme/web",
            sync_direction="import",
            is_active=active,
            created_by=1,
        )
        integ.api_token = "pat-secret"
        db.add(integ)
        defect = models.Defect(
            title="Financing upper limit not surfaced",
            defect_id="P1-DEF-003",
            project_id=client.project_id,
            reported_by=1,
            description=description,
            external_issue_id="1892",
            external_issue_url="https://dev.azure.com/acme/web/_workitems/edit/1892",
            external_sync_status="synced",
        )
        db.add(defect)
        db.commit()
        db.refresh(defect)
        return defect.id
    finally:
        db.close()


def _proxied_src(html: str) -> str:
    import re

    m = re.search(r'src="([^"]*ado-attachment[^"]*)"', html)
    assert m, f"no proxied img src in: {html}"
    return m.group(1)


def test_detail_rewrites_ado_image_src_to_proxy(client):
    defect_id = _seed_integration_and_defect(client)

    resp = client.get(f"/projects/{client.project_id}/defects-management/{defect_id}")
    assert resp.status_code == 200, resp.text
    desc = resp.json()["description"]

    assert "dev.azure.com" not in desc
    assert f"/projects/{client.project_id}/defects-management/{defect_id}/ado-attachment?token=" in desc
    # structure survived the import
    assert "<div>Repro steps:</div>" in desc
    assert "name=shot.png" in desc


def test_list_rewrites_ado_image_src_to_proxy(client):
    defect_id = _seed_integration_and_defect(client)

    resp = client.get(f"/projects/{client.project_id}/defects-management")
    assert resp.status_code == 200, resp.text
    row = next(d for d in resp.json() if d["id"] == defect_id)
    assert "ado-attachment?token=" in row["description"]
    assert "dev.azure.com" not in row["description"]


def test_proxy_streams_attachment_bytes(client, monkeypatch):
    defect_id = _seed_integration_and_defect(client)

    class _FakeUpstream:
        headers = {"Content-Type": "application/octet-stream"}
        closed = False

        def iter_content(self, chunk_size=65536):
            yield b"\x89PNG\r\n\x1a\n"
            yield b"rest-of-image-bytes"

        def close(self):
            _FakeUpstream.closed = True

    def _fake_stream_attachment(self, attachment_id):
        assert attachment_id == GUID
        return {"success": True, "response": _FakeUpstream()}

    monkeypatch.setattr(
        "app.azure_devops_client.AzureDevOpsClient.stream_attachment",
        _fake_stream_attachment,
    )

    detail = client.get(
        f"/projects/{client.project_id}/defects-management/{defect_id}"
    ).json()
    src = _proxied_src(detail["description"])

    resp = client.get(src)
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "image/png"
    assert resp.headers["cache-control"] == "private, max-age=3600"
    assert resp.content == b"\x89PNG\r\n\x1a\nrest-of-image-bytes"
    assert _FakeUpstream.closed is True


def test_proxy_rejects_bad_token(client):
    defect_id = _seed_integration_and_defect(client)
    resp = client.get(
        f"/projects/{client.project_id}/defects-management/{defect_id}/ado-attachment",
        params={"token": "forged"},
    )
    assert resp.status_code == 404


def test_proxy_rejects_token_minted_for_another_defect(client):
    defect_id = _seed_integration_and_defect(client)
    from app.services.ado_attachment_proxy import sign_attachment_ref

    other = sign_attachment_ref(defect_id + 999, GUID)
    resp = client.get(
        f"/projects/{client.project_id}/defects-management/{defect_id}/ado-attachment",
        params={"token": other},
    )
    assert resp.status_code == 404


def test_proxy_502_when_ado_fetch_fails(client, monkeypatch):
    defect_id = _seed_integration_and_defect(client)

    monkeypatch.setattr(
        "app.azure_devops_client.AzureDevOpsClient.stream_attachment",
        lambda self, attachment_id: {"success": False, "status_code": 404, "message": "gone"},
    )
    detail = client.get(
        f"/projects/{client.project_id}/defects-management/{defect_id}"
    ).json()
    resp = client.get(_proxied_src(detail["description"]))
    assert resp.status_code == 502


def test_proxy_404_when_no_active_ado_integration(client):
    defect_id = _seed_integration_and_defect(client, active=False)
    from app.services.ado_attachment_proxy import sign_attachment_ref

    token = sign_attachment_ref(defect_id, GUID)
    resp = client.get(
        f"/projects/{client.project_id}/defects-management/{defect_id}/ado-attachment",
        params={"token": token},
    )
    assert resp.status_code == 404


def test_plain_text_description_is_untouched(client):
    defect_id = _seed_integration_and_defect(client, description="just a plain sentence")
    resp = client.get(f"/projects/{client.project_id}/defects-management/{defect_id}")
    assert resp.json()["description"] == "just a plain sentence"
