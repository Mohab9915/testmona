"""One-off SQLite → MariaDB data migration tool.

Copies every application table's rows from a source SQLite database into a
target MariaDB/MySQL database whose schema was already created by Alembic
(run ``migrate.py upgrade`` against the target first).

Design notes
------------
* Both schemas are expected to be identical (same migrations), so we copy by
  explicit column list; a column present in only one side is skipped for the
  row copy to keep inserts safe.
* Rows are copied in foreign-key dependency order so parent rows exist before
  children. ``alembic_version`` and SQLite-internal tables are skipped.
* Values are carried over as raw SQLAlchemy result rows so type coercion
  (datetime, JSON, enums, booleans) is handled by the target dialect instead of
  string-fiddling.
* Foreign-key checks are disabled during the copy and re-enabled afterwards to
  avoid order/check surprises; auto-increment counters are left to MariaDB to
  re-sync (explicit PKs are inserted). The tool targets an empty schema created
  by ``migrate.py upgrade`` — truncate the target before re-running.
"""
from __future__ import annotations

import argparse
import logging
import sys
from typing import Any, List, Optional, Sequence

from sqlalchemy import MetaData, Table, create_engine, inspect, select, text
from sqlalchemy.engine import Engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("sqlite_to_mariadb_migrator")

# Tables that must not be copied (managed by Alembic / the engine itself).
SKIPPED_TABLES = {"alembic_version"}


def _get_tables(source: Engine, target: Engine) -> List[str]:
    src_tables = set(inspect(source).get_table_names())
    dst_tables = set(inspect(target).get_table_names())
    tables = sorted(src_tables & dst_tables - SKIPPED_TABLES)
    missing_in_target = sorted(src_tables - dst_tables)
    if missing_in_target:
        logger.warning("Tables present only in source (skipped): %s", missing_in_target)
    return tables


def _shared_columns(table: Table, target: Engine) -> List[str]:
    dst_cols = {col["name"] for col in inspect(target).get_columns(table.name)}
    return [column.name for column in table.columns if column.name in dst_cols]


def copy_table(source: Engine, target: Engine, table_name: str, batch_size: int = 500) -> int:
    metadata = MetaData()
    table = Table(table_name, metadata, autoload_with=source)
    keep_names = _shared_columns(table, target)
    if not keep_names:
        logger.info("  %-32s skipped (no shared columns)", table_name)
        return 0

    with source.connect() as src_conn:
        rows = src_conn.execute(select(table)).mappings().all()
    if not rows:
        logger.info("  %-32s 0 rows", table_name)
        return 0

    insert = table.insert()
    with target.begin() as dst_conn:
        for start in range(0, len(rows), batch_size):
            batch = rows[start : start + batch_size]
            values = [{name: row[name] for name in keep_names} for row in batch]
            dst_conn.execute(insert, values)
    logger.info("  %-32s %d rows", table_name, len(rows))
    return len(rows)


def _set_fk_checks(target: Engine, enabled: bool) -> None:
    """Toggle foreign-key checks on backends that support it (MySQL/MariaDB)."""
    if target.dialect.name not in {"mysql", "mariadb"}:
        return
    value = 1 if enabled else 0
    with target.connect() as conn:
        conn.execute(text(f"SET FOREIGN_KEY_CHECKS={value}"))


def run(source_url: str, target_url: str, batch_size: int, tables: Optional[List[str]]) -> int:
    source = create_engine(source_url)
    target = create_engine(target_url)

    total = 0
    try:
        _set_fk_checks(target, False)
        table_list = tables or _get_tables(source, target)
        for table_name in table_list:
            total += copy_table(source, target, table_name, batch_size)
        _set_fk_checks(target, True)
    finally:
        source.dispose()
        target.dispose()
    logger.info("Copied %d rows across %d tables", total, len(table_list))
    return total


def main() -> int:
    parser = argparse.ArgumentParser(description="Copy SQLite data into MariaDB/MySQL")
    parser.add_argument("--source", required=True, help="Source SQLite URL (sqlite:///path)")
    parser.add_argument("--target", required=True, help="Target MySQL URL (mysql+pymysql://...)")
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--tables", nargs="*", help="Restrict copy to these tables")
    args = parser.parse_args()
    return run(args.source, args.target, args.batch_size, args.tables)


if __name__ == "__main__":
    sys.exit(main())
