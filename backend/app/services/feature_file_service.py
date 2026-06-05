"""Gherkin ``.feature`` file import/export for requirements.

A requirement's ``acceptance_criteria`` holds Gherkin (Background + Scenarios).
This module renders a requirement into a canonical ``.feature`` document and
parses uploaded ``.feature`` files back into requirement drafts, so a project's
BDD specs can round-trip through the standard Cucumber/Gherkin file format.

Everything here is pure (no DB/HTTP) and string-only, so it is trivially
testable and reusable by the route layer.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, field
from typing import List, Optional

# Block-level keywords that open a scenario-ish section.
_BLOCK_RE = re.compile(r"^(Background|Scenario Outline|Scenario|Example|Rule):", re.IGNORECASE)
_FEATURE_RE = re.compile(r"^\s*Feature:\s*(.*)$", re.IGNORECASE)
# Detects a Feature line anywhere in a multi-line block (not just at the start).
_HAS_FEATURE_RE = re.compile(r"^\s*Feature:", re.IGNORECASE | re.MULTILINE)
_STEP_RE = re.compile(r"^(Given|When|Then|And|But|\*)\b", re.IGNORECASE)
_FENCE_RE = re.compile(r'^("""|```)')
_REQ_KEY_RE = re.compile(r"\bREQ-\d+\b", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Extracting raw Gherkin from stored acceptance criteria
# ---------------------------------------------------------------------------

# Tags emitted by ``markdown_to_html`` plus the Gherkin code-block wrapper. Only
# these are stripped, so Scenario Outline placeholders like ``<value>`` (which
# look like tags after entity-decoding) are preserved verbatim.
_HTML_TAGS = (
    "a|abbr|b|blockquote|br|code|del|div|em|h[1-6]|hr|i|img|ins|kbd|li|ol|p|pre|"
    "s|span|strong|sub|sup|table|tbody|td|th|thead|tr|u|ul"
)
_STRUCTURAL_TAG_RE = re.compile(r"<\s*br\s*/?>|</\s*(?:p|div|li|h[1-6]|tr)\s*>", re.IGNORECASE)
_HTML_TAG_RE = re.compile(rf"</?(?:{_HTML_TAGS})(?:\s[^>]*)?/?>", re.IGNORECASE)


def _strip_markup(value: str) -> str:
    """Strip known HTML markup, mapping structural tags to line breaks. Assumes
    entity references have already been decoded (so ``<pre>`` matches, not
    ``&lt;pre&gt;``). A deliberate whitelist — anything that is not a recognised
    HTML tag (e.g. a ``<value>`` outline placeholder) is left untouched."""
    text = _STRUCTURAL_TAG_RE.sub("\n", value)
    return _HTML_TAG_RE.sub("", text)


def gherkin_text_from_acceptance(value: Optional[str]) -> str:
    """Recover plain Gherkin text from a stored ``acceptance_criteria`` value.

    Acceptance criteria are persisted HTML-escaped and may be wrapped in a
    ``<pre><code class="language-gherkin">`` block (AI-converted) or stored as
    entity-escaped raw text (Gherkin editor). Both must collapse back to the
    original multi-line Gherkin, with line breaks preserved.

    Entities are decoded *first* so the wrapping tags become real markup that the
    stripper can remove; any inner entities (``&quot;`` inside a step) are decoded
    by a second pass.
    """
    if not value:
        return ""
    text = _strip_markup(html.unescape(value))
    text = html.unescape(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text.strip("\n").rstrip()


def _description_to_text(value: Optional[str]) -> str:
    """Flatten an HTML/entity-escaped description into plain, paragraph-spaced text."""
    if not value:
        return ""
    text = _strip_markup(html.unescape(value))
    text = html.unescape(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln.strip() for ln in text.split("\n")]
    # Collapse runs of blank lines.
    out: List[str] = []
    for ln in lines:
        if not ln and (not out or not out[-1]):
            continue
        out.append(ln)
    return "\n".join(out).strip()


# ---------------------------------------------------------------------------
# Canonical Gherkin formatting (2-space ladder + aligned tables)
# ---------------------------------------------------------------------------

def _split_cells(line: str) -> List[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def format_gherkin(value: str) -> str:
    """Re-indent a Gherkin document to the canonical two-space ladder
    (Feature → 0, Scenario/Background → 2, steps/Examples → 4, tables/doc
    strings → 6) and align pipe-table columns. Doc-string bodies are preserved
    verbatim. Mirrors the frontend ``formatGherkin`` so files round-trip."""
    if not value.strip():
        return value
    FEATURE, BLOCK, STEP, INNER = "", "  ", "    ", "      "
    out: List[str] = []
    feature_seen = False
    in_doc = False
    table: List[str] = []

    def flush_table() -> None:
        nonlocal table
        if not table:
            return
        rows = [_split_cells(r) for r in table]
        col_count = max(len(r) for r in rows)
        widths = [max((len(r[c]) if c < len(r) else 0) for r in rows) for c in range(col_count)]
        for r in rows:
            cells = [(r[c] if c < len(r) else "").ljust(widths[c]) for c in range(col_count)]
            out.append(f"{INNER}| " + " | ".join(cells) + " |")
        table = []

    for raw in value.replace("\t", "  ").split("\n"):
        trimmed = raw.strip()
        if in_doc:
            if _FENCE_RE.match(trimmed):
                out.append(f"{INNER}{trimmed}")
                in_doc = False
            else:
                out.append(raw.rstrip())
            continue
        if trimmed.startswith("|"):
            table.append(trimmed)
            continue
        flush_table()
        if not trimmed:
            out.append("")
            continue
        if _FENCE_RE.match(trimmed):
            out.append(f"{INNER}{trimmed}")
            in_doc = True
            continue
        if trimmed.startswith("#") or trimmed.startswith("@"):
            out.append(f"{BLOCK if feature_seen else FEATURE}{trimmed}")
            continue
        if re.match(r"^Feature:", trimmed, re.IGNORECASE):
            feature_seen = True
            out.append(f"{FEATURE}{trimmed}")
            continue
        if re.match(r"^Examples:", trimmed, re.IGNORECASE):
            out.append(f"{STEP}{trimmed}")
            continue
        if _BLOCK_RE.match(trimmed):
            out.append(f"{BLOCK}{trimmed}")
            continue
        if _STEP_RE.match(trimmed):
            out.append(f"{STEP}{trimmed}")
            continue
        out.append(f"{STEP if feature_seen else BLOCK}{trimmed}")
    flush_table()
    while out and out[-1] == "":
        out.pop()
    return "\n".join(out)


def _dedent(text: str) -> str:
    """Strip the common leading indentation from every line (textwrap.dedent
    that ignores blank lines). Turns ``  Scenario:`` / ``    Given`` into
    ``Scenario:`` / ``  Given`` — the storage shape used elsewhere."""
    lines = text.split("\n")
    indents = [len(ln) - len(ln.lstrip(" ")) for ln in lines if ln.strip()]
    if not indents:
        return text.strip("\n")
    cut = min(indents)
    out = [ln[cut:] if len(ln) >= cut else ln.lstrip(" ") for ln in lines]
    return "\n".join(out).strip("\n")


# ---------------------------------------------------------------------------
# Export: requirement → .feature
# ---------------------------------------------------------------------------

def _tags_to_gherkin(tags: Optional[str]) -> List[str]:
    if not tags:
        return []
    out: List[str] = []
    for raw in re.split(r"[,\s]+", tags.strip()):
        raw = raw.strip().lstrip("@")
        if not raw:
            continue
        out.append("@" + re.sub(r"\s+", "-", raw))
    return out


def build_feature_file(
    *,
    title: str,
    description: Optional[str],
    acceptance_criteria: Optional[str],
    requirement_key: Optional[str] = None,
    tags: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
) -> str:
    """Render a requirement as a canonical ``.feature`` document.

    When the acceptance criteria already declare a ``Feature:`` line it is kept
    verbatim (just reformatted); otherwise a ``Feature:`` header is synthesised
    from the title with the description as the feature narrative, and the stored
    scenarios are nested beneath it. Requirement metadata is emitted as leading
    comments/tags so an export can be re-imported with its identity intact.
    """
    body = gherkin_text_from_acceptance(acceptance_criteria)
    desc = _description_to_text(description)

    header: List[str] = []
    if requirement_key:
        header.append(f"# Requirement: {requirement_key}")
    meta = " | ".join(
        part for part in (
            f"Status: {status}" if status else "",
            f"Priority: {priority}" if priority else "",
        ) if part
    )
    if meta:
        header.append(f"# {meta}")

    tag_line = " ".join(_tags_to_gherkin(tags))

    if _HAS_FEATURE_RE.search(body):
        # Already a full feature — reformat as-is.
        document = format_gherkin(body)
        # Inject the requirement tag above the Feature line if not present.
        if tag_line and tag_line not in document:
            document = f"{tag_line}\n{document}"
    else:
        parts = [f"Feature: {title.strip() or 'Untitled'}"]
        if desc:
            parts += ["", desc]
        if body:
            parts += ["", body]
        raw = "\n".join(parts)
        if tag_line:
            raw = f"{tag_line}\n{raw}"
        document = format_gherkin(raw)

    prefix = ("\n".join(header) + "\n") if header else ""
    return f"{prefix}{document}\n"


def feature_filename(requirement_key: Optional[str], title: str) -> str:
    """A filesystem-safe ``.feature`` name, e.g. ``REQ-007-user-login.feature``."""
    slug = re.sub(r"[^a-z0-9]+", "-", (title or "").lower()).strip("-")[:60]
    key = (requirement_key or "").strip()
    stem = "-".join(part for part in (key, slug) if part) or "requirement"
    return f"{stem}.feature"


# ---------------------------------------------------------------------------
# Import: .feature → requirement drafts
# ---------------------------------------------------------------------------

@dataclass
class ParsedFeature:
    title: str
    description: str = ""
    scenarios: str = ""
    tags: List[str] = field(default_factory=list)
    source_key: Optional[str] = None  # REQ-xxx recovered from comment/tag, if any


def _meta_key_from_lines(lines: List[str]) -> Optional[str]:
    for ln in lines:
        m = _REQ_KEY_RE.search(ln)
        if m:
            return m.group(0).upper()
    return None


def parse_feature_documents(text: str, fallback_title: str = "Imported Feature") -> List[ParsedFeature]:
    """Parse a ``.feature`` file (one or more ``Feature:`` blocks) into drafts.

    Tags/comments immediately preceding a ``Feature:`` line are attributed to
    that feature. Everything from the first block keyword (Background/Scenario/
    Rule) onward becomes the scenario body; lines between the ``Feature:`` line
    and the first block keyword become the description narrative.
    """
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.split("\n")

    feature_idxs = [i for i, ln in enumerate(lines) if _FEATURE_RE.match(ln)]
    if not feature_idxs:
        # No Feature header — treat the whole file as one requirement's scenarios.
        scenarios = _dedent(normalized)
        if not scenarios.strip():
            return []
        leading = [ln for ln in lines if ln.strip().startswith("#") or ln.strip().startswith("@")]
        return [ParsedFeature(
            title=fallback_title,
            scenarios=scenarios,
            tags=[t for ln in leading for t in ln.split() if t.startswith("@")],
            source_key=_meta_key_from_lines(lines),
        )]

    # Determine the start of each feature chunk: walk back over the contiguous
    # tag/comment/blank lines that decorate the Feature header.
    starts: List[int] = []
    for fi in feature_idxs:
        s = fi
        while s - 1 >= 0:
            prev = lines[s - 1].strip()
            if prev == "" or prev.startswith("@") or prev.startswith("#"):
                s -= 1
            else:
                break
        starts.append(s)

    features: List[ParsedFeature] = []
    for k, fi in enumerate(feature_idxs):
        chunk_start = starts[k]
        chunk_end = starts[k + 1] if k + 1 < len(starts) else len(lines)
        decoration = lines[chunk_start:fi]
        body_lines = lines[fi:chunk_end]

        title = (_FEATURE_RE.match(lines[fi]).group(1) or "").strip() or fallback_title
        tags = [t for ln in decoration for t in ln.split() if t.startswith("@")]

        # Split description (post-Feature narrative) from the scenario body.
        desc_lines: List[str] = []
        scenario_lines: List[str] = []
        seen_block = False
        for ln in body_lines[1:]:  # skip the Feature: line itself
            stripped = ln.strip()
            if not seen_block and (_BLOCK_RE.match(stripped) or stripped.startswith("@") or re.match(r"^Examples:", stripped, re.IGNORECASE)):
                seen_block = True
            if seen_block:
                scenario_lines.append(ln)
            elif stripped.startswith("#"):
                continue  # comments in the narrative are dropped
            else:
                desc_lines.append(ln)

        features.append(ParsedFeature(
            title=title[:255],
            description="\n".join(desc_lines).strip(),
            scenarios=_dedent("\n".join(scenario_lines)),
            tags=tags,
            source_key=_meta_key_from_lines(decoration),
        ))

    return features
