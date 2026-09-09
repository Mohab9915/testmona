"""Unit coverage for keeping Azure DevOps bug descriptions as HTML on import
and for the inline-image proxy helper.

Before this, ``map_azure_devops_work_item_to_defect`` flattened the ADO
Description / Repro Steps HTML to a single whitespace-collapsed line, which
destroyed every line break, list and paragraph and dropped ``<img>`` tags
entirely. Now the markup is kept and the defect API rewrites attachment
``<img>`` srcs to a signed, self-expiring proxy URL.
"""

import re
from urllib.parse import unquote

import pytest

from app.azure_devops_client import AzureDevOpsClient
from app.services.ado_attachment_proxy import (
    rewrite_ado_image_srcs,
    resolve_media_type,
    sign_attachment_ref,
    verify_attachment_ref,
)
from app.sync_service import SyncService


ADO_IMG = (
    '<img src="https://dev.azure.com/acme/web/_apis/wit/attachments/'
    '12ab34cd-5678-90ef-1234-567890abcdef?fileName=screenshot.png">'
)


class TestCleanAdoHtml:
    def test_preserves_structure(self):
        raw = "<div>Line one</div><div>Line two</div><ul><li>a</li><li>b</li></ul>"
        assert SyncService._clean_ado_html(raw) == raw

    def test_strips_script_and_style_blocks(self):
        raw = "<div>ok</div><script>alert(1)</script><style>.x{}</style>"
        assert SyncService._clean_ado_html(raw) == "<div>ok</div>"

    def test_trims_outer_whitespace(self):
        assert SyncService._clean_ado_html("\n  <div>x</div>  \n") == "<div>x</div>"

    def test_none_and_empty(self):
        assert SyncService._clean_ado_html(None) == ""
        assert SyncService._clean_ado_html("") == ""


class TestMappingKeepsHtml:
    def test_description_is_kept_as_html_with_image(self):
        work_item = {
            "id": 1892,
            "title": "Financing upper limit not surfaced",
            "description": f"<div>Steps:</div>{ADO_IMG}",
            "state": "Resolved",
            "severity": "3 - Medium",
            "url": "https://dev.azure.com/acme/web/_workitems/edit/1892",
        }
        mapped = SyncService.map_azure_devops_work_item_to_defect(work_item)
        assert mapped["description"] == f"<div>Steps:</div>{ADO_IMG}"
        assert mapped["status"] == "fixed"
        assert mapped["severity"] == "medium"


class _FakeResponse:
    def __init__(self, payload):
        self.status_code = 200
        self._payload = payload

    def json(self):
        return self._payload


class TestListActiveBugsDescriptionFallback:
    """``list_active_bugs`` maps a bug's content from whichever field the
    project actually fills: Description, then Repro Steps, then System Info.
    Real Azure DevOps projects vary - the ASAL-AI/AgentHub Bug form only ever
    writes Repro Steps, and a handful of bugs put the whole write-up in the
    System Info field and leave the other two blank."""

    def _client_returning(self, bug_fields):
        client = AzureDevOpsClient("https://dev.azure.com", "pat", "org", "proj")

        def fake_request(method, url, **kwargs):
            if url.endswith("/_apis/wit/wiql"):
                return _FakeResponse({"workItems": [{"id": 42}]})
            return _FakeResponse({"value": [{"id": 42, "fields": bug_fields}]})

        client._make_request = fake_request
        return client

    def test_prefers_description_then_repro_then_system_info(self):
        cases = [
            ({"System.Description": "D", "Microsoft.VSTS.TCM.ReproSteps": "R",
              "Microsoft.VSTS.TCM.SystemInfo": "S"}, "D"),
            ({"Microsoft.VSTS.TCM.ReproSteps": "R",
              "Microsoft.VSTS.TCM.SystemInfo": "S"}, "R"),
            ({"Microsoft.VSTS.TCM.SystemInfo": "S"}, "S"),
            ({}, None),
        ]
        for fields, expected in cases:
            client = self._client_returning({"System.Title": "t", **fields})
            result = client.list_active_bugs()
            assert result["success"] is True
            assert result["work_items"][0]["description"] == expected

    def test_system_info_only_bug_maps_to_a_defect_description(self):
        client = self._client_returning({
            "System.Title": "Agent crashes on invalid tenure",
            "Microsoft.VSTS.TCM.SystemInfo": "<div>0 tenure -> float division by zero</div>",
            "System.State": "Resolved",
        })
        work_item = client.list_active_bugs()["work_items"][0]
        mapped = SyncService.map_azure_devops_work_item_to_defect(work_item)
        assert mapped["description"] == "<div>0 tenure -> float division by zero</div>"


class TestRewriteAdoImageSrcs:
    def test_rewrites_attachment_img_to_signed_relative_proxy_url(self):
        out = rewrite_ado_image_srcs(
            f"<p>before</p>{ADO_IMG}<p>after</p>",
            project_id=7,
            defect_id=42,
        )
        assert "dev.azure.com" not in out
        # API-root-relative: no scheme/host (the frontend prepends its API base).
        assert 'src="/projects/7/defects-management/42/ado-attachment?token=' in out
        assert "://" not in re.search(r'src="([^"]*ado-attachment[^"]*)"', out).group(1)
        assert "name=screenshot.png" in out
        assert "<p>before</p>" in out and "<p>after</p>" in out

        token = unquote(re.search(r"token=([^&\"]+)", out).group(1))
        assert verify_attachment_ref(token) == (42, "12ab34cd-5678-90ef-1234-567890abcdef")

    def test_non_ado_images_are_left_untouched(self):
        html = '<img src="https://example.com/pic.png"><img src="/local/a.png">'
        assert rewrite_ado_image_srcs(html, project_id=1, defect_id=1) == html

    def test_no_images_is_a_noop(self):
        html = "<div>just text</div>"
        assert rewrite_ado_image_srcs(html, project_id=1, defect_id=1) == html

    def test_handles_single_quoted_src_and_extra_query(self):
        html = (
            "<img alt='x' src='https://acme.visualstudio.com/web/_apis/wit/attachments/"
            "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee?fileName=a.png&api-version=5.0'/>"
        )
        out = rewrite_ado_image_srcs(html, project_id=2, defect_id=3)
        assert "/projects/2/defects-management/3/ado-attachment?token=" in out
        token = unquote(re.search(r"token=([^&']+)", out).group(1))
        assert verify_attachment_ref(token) == (3, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")


class TestSignedRef:
    def test_round_trip(self):
        tok = sign_attachment_ref(5, "guid-1")
        assert verify_attachment_ref(tok) == (5, "guid-1")

    def test_tampered_or_garbage_token_is_rejected(self):
        assert verify_attachment_ref("not-a-token") is None
        assert verify_attachment_ref("") is None
        tok = sign_attachment_ref(5, "guid-1")
        assert verify_attachment_ref(tok[:-4] + "AAAA") is None

    def test_expired_token_is_rejected(self, monkeypatch):
        import app.services.ado_attachment_proxy as mod

        tok = sign_attachment_ref(5, "guid-1")
        monkeypatch.setattr(mod, "_TOKEN_TTL_SECONDS", -1)
        assert verify_attachment_ref(tok) is None


class TestResolveMediaType:
    def test_prefers_ado_image_content_type(self):
        assert resolve_media_type("image/png; charset=binary", b"", None) == "image/png"

    def test_falls_back_to_magic_bytes(self):
        assert resolve_media_type("application/octet-stream", b"\x89PNG\r\n\x1a\n\x00", None) == "image/png"
        assert resolve_media_type(None, b"\xff\xd8\xff\xe0", None) == "image/jpeg"
        assert resolve_media_type(None, b"GIF89a...", None) == "image/gif"

    def test_falls_back_to_name(self):
        assert resolve_media_type("application/octet-stream", b"????", "diagram.webp") == "image/webp"

    def test_unknown_stays_octet_stream(self):
        assert resolve_media_type(None, b"\x00\x01\x02", None) == "application/octet-stream"
