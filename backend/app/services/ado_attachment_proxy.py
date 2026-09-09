"""Inline-image support for Azure DevOps bugs imported into ``defects``.

An ADO work item's Description / Repro Steps is HTML, and pasted screenshots
land in it as ``<img src="https://dev.azure.com/{org}/.../_apis/wit/attachments/
{guid}">``. That URL is auth-gated: a browser ``<img>`` load carries no PAT and
no ADO session cookie (SameSite), so it 302s to a Microsoft sign-in page and
the image renders broken - even for a viewer logged into ADO in the same tab.

Rather than download and re-host the bytes (storage we don't want to spend),
the defect API rewrites each such ``src`` to a short-lived signed URL back to
``app.api.defect_management.get_defect_ado_attachment``, which streams the bytes
from ADO on demand using the integration PAT and never writes them to disk.

The signature (Fernet, with a TTL) does two jobs:

* it authorises the fetch for a browser that cannot send our bearer token - the
  URL only ever appears inside an already access-controlled defect payload, and
  the TTL caps how long a copied link keeps working;
* it pins the fetch to one ``(defect, attachment)`` pair, so the URL cannot be
  edited to pull a different attachment.
"""
from __future__ import annotations

import json
import mimetypes
import re
from typing import Optional, Tuple
from urllib.parse import quote, unquote

from cryptography.fernet import Fernet, InvalidToken

from ..crypto import get_encryption_key

# Signed refs are minted only inside an already access-controlled defect
# payload; the TTL caps how long a copied URL keeps working.
_TOKEN_TTL_SECONDS = 6 * 60 * 60

_GUID = (
    r"[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}"
)

# An ``src="..."`` / ``src='...'`` whose value points at ADO's work-item
# attachment endpoint. The host is deliberately not pinned: the proxy rebuilds
# the real URL from the integration config and only ever talks to that one
# organization, so a crafted value cannot redirect it elsewhere.
_ADO_IMG_SRC_RE = re.compile(
    r"""(?P<attr>\bsrc\s*=\s*)(?P<q>["'])"""
    r"""(?P<url>[^"']*?/_apis/wit/attachments/(?P<guid>""" + _GUID + r""")[^"']*)"""
    r"""(?P=q)""",
    re.IGNORECASE | re.VERBOSE,
)

_FILENAME_RE = re.compile(r"[?&]fileName=(?P<name>[^&]+)", re.IGNORECASE)


def sign_attachment_ref(defect_id: int, attachment_guid: str) -> str:
    """A signed, self-expiring token binding one attachment to one defect."""
    payload = json.dumps({"d": int(defect_id), "g": str(attachment_guid)}).encode()
    return Fernet(get_encryption_key()).encrypt(payload).decode()


def verify_attachment_ref(token: str) -> Optional[Tuple[int, str]]:
    """``(defect_id, attachment_guid)`` if ``token`` is valid and unexpired, else None."""
    if not token:
        return None
    try:
        raw = Fernet(get_encryption_key()).decrypt(token.encode(), ttl=_TOKEN_TTL_SECONDS)
    except (InvalidToken, ValueError, TypeError):
        return None
    try:
        data = json.loads(raw)
        return int(data["d"]), str(data["g"])
    except (ValueError, KeyError, TypeError):
        return None


def has_ado_attachments(description: Optional[str]) -> bool:
    return bool(description) and "/_apis/wit/attachments/" in description


def rewrite_ado_image_srcs(
    description: Optional[str],
    *,
    api_base_url: str,
    project_id: int,
    defect_id: int,
) -> Optional[str]:
    """Point every ADO-attachment ``<img>`` in ``description`` at the streaming
    proxy. A no-op (returns the input unchanged) when there is nothing to do."""
    if not has_ado_attachments(description):
        return description

    base = (api_base_url or "").rstrip("/")

    def _replace(match: "re.Match[str]") -> str:
        guid = match.group("guid")
        token = sign_attachment_ref(defect_id, guid)
        query = f"token={quote(token, safe='')}"
        name_match = _FILENAME_RE.search(match.group("url"))
        if name_match:
            query += f"&name={quote(unquote(name_match.group('name')), safe='')}"
        proxied = (
            f"{base}/projects/{project_id}/defects-management/{defect_id}"
            f"/ado-attachment?{query}"
        )
        return f"{match.group('attr')}{match.group('q')}{proxied}{match.group('q')}"

    return _ADO_IMG_SRC_RE.sub(_replace, description)


_IMAGE_MAGIC = (
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"BM", "image/bmp"),
    (b"\x00\x00\x01\x00", "image/x-icon"),
)


def resolve_media_type(
    upstream_content_type: Optional[str],
    head: bytes,
    name: Optional[str],
) -> str:
    """Best available image content type. ``X-Content-Type-Options: nosniff`` is
    set globally, so the browser will not rescue a wrong type - prefer ADO's own
    header when it is an image, then the file's magic bytes, then the name."""
    ado = (upstream_content_type or "").split(";")[0].strip().lower()
    if ado.startswith("image/"):
        return ado

    for magic, media_type in _IMAGE_MAGIC:
        if head.startswith(magic):
            return media_type
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    stripped = head.lstrip()[:64].lower()
    if stripped.startswith(b"<svg") or (stripped.startswith(b"<?xml") and b"<svg" in head[:512].lower()):
        return "image/svg+xml"

    if name:
        guessed, _ = mimetypes.guess_type(name)
        if guessed:
            return guessed

    return "application/octet-stream"
