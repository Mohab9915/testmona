"""Undo the HTML entity escaping that used to be applied to text on write

User-supplied text used to be run through ``html.escape`` in the Pydantic
schemas before it was stored, so ordinary prose was persisted mangled:
``Noise & Turn`` as ``Noise &amp; Turn`` and ``customer's`` as
``customer&#x27;s``. Escaping now happens on render instead (React escapes
text nodes; ``dangerouslySetInnerHTML`` paths go through DOMPurify), so the
stored values have to be decoded once to match.

Only the five entities ``html.escape`` itself produces are reversed, in the
order that makes the round-trip exact (``&amp;`` last). A generic
``html.unescape`` is deliberately not used -- it would also decode entities
such as ``&copy;`` that this application never wrote and that a user may have
typed literally.

Values that look like JSON are skipped: decoding ``&quot;`` inside a JSON
document would corrupt its structure. That leaves audit-trail payloads and
settings blobs untouched, which is what we want -- they are historical
records, not editable content.

Revision ID: unescape_stored_user_text
Revises: add_test_plan_suites_and_run_build
Create Date: 2026-09-07 15:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "unescape_stored_user_text"
down_revision = "add_test_plan_suites_and_run_build"
branch_labels = None
depends_on = None


# Ordered so that "&amp;lt;" decodes to "&lt;" rather than "<": every other
# entity is decoded first, and the ampersand itself last.
_ENTITIES = [
    ("&lt;", "<"),
    ("&gt;", ">"),
    ("&quot;", '"'),
    ("&#x27;", "'"),
    ("&#39;", "'"),
    ("&amp;", "&"),
]

# Text columns whose contents are structured payloads rather than prose.
_SKIP_COLUMNS = {
    ("audit_trails", "old_values"),
    ("audit_trails", "new_values"),
    ("audit_trails", "field_changes"),
}


def _decode(value: str) -> str:
    for entity, char in _ENTITIES:
        value = value.replace(entity, char)
    return value


def _looks_like_json(value: str) -> bool:
    stripped = value.lstrip()
    return stripped.startswith("{") or stripped.startswith("[")


def _text_columns(inspector, table: str):
    for column in inspector.get_columns(table):
        if isinstance(column["type"], sa.types.String) or isinstance(column["type"], sa.types.Text):
            yield column["name"]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for table in inspector.get_table_names():
        if table == "alembic_version":
            continue
        primary_key = inspector.get_pk_constraint(table).get("constrained_columns") or []
        if len(primary_key) != 1:
            # Association tables carry no prose; a compound key also makes the
            # row-by-row update below ambiguous.
            continue
        key = primary_key[0]

        for column in _text_columns(inspector, table):
            if (table, column) in _SKIP_COLUMNS or column == key:
                continue
            rows = bind.execute(
                sa.text(
                    f'SELECT "{key}", "{column}" FROM "{table}" '
                    f'WHERE "{column}" LIKE :pattern'
                ),
                {"pattern": "%&%;%"},
            ).fetchall()
            for row_id, value in rows:
                if not isinstance(value, str) or _looks_like_json(value):
                    continue
                decoded = _decode(value)
                if decoded != value:
                    bind.execute(
                        sa.text(f'UPDATE "{table}" SET "{column}" = :value WHERE "{key}" = :id'),
                        {"value": decoded, "id": row_id},
                    )


def downgrade() -> None:
    # Re-escaping would corrupt any text a user has legitimately written since
    # (an apostrophe is now stored as an apostrophe), so this is one-way.
    pass
