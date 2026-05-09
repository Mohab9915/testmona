#!/usr/bin/env python3
"""
Production migration script for TestMona application.
This script handles database migrations for production environments.
"""

import os
import sys
import argparse
import shutil
import logging
import signal
from datetime import datetime
from pathlib import Path
from alembic.config import Config
from alembic import command
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from app.config import settings

# Setup logging
def setup_logging():
    """Setup logging to both file and console"""
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    log_file = log_dir / f"migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logging()

def validate_env_vars(env):
    """Validate required environment variables are set"""
    if env == 'prod':
        if not os.getenv('DATABASE_URL'):
            logger.warning("DATABASE_URL not set, using default SQLite")
    return True

def check_database_connection(db_url):
    """Check if database is accessible"""
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("✅ Database connection successful")
        return True
    except SQLAlchemyError as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False

def backup_sqlite_database(db_url):
    """Create backup of SQLite database before migration"""
    if not db_url.startswith('sqlite'):
        logger.info("Skipping backup (not SQLite)")
        return None
    
    # Extract database file path
    db_path = db_url.replace('sqlite:///', '')
    if not os.path.exists(db_path):
        logger.warning(f"Database file not found: {db_path}")
        return None
    
    # Create backup
    backup_dir = Path("backups")
    backup_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = backup_dir / f"{Path(db_path).stem}_{timestamp}.db"
    
    try:
        shutil.copy2(db_path, backup_path)
        logger.info(f"✅ Database backed up to: {backup_path}")
        return str(backup_path)
    except Exception as e:
        logger.error(f"❌ Backup failed: {e}")
        return None

def check_sqlite_limitations(db_url):
    """Check for SQLite-specific limitations"""
    if not db_url.startswith('sqlite'):
        return True
    
    logger.info("Checking SQLite limitations...")
    # SQLite limitations are handled by Alembic, but we log awareness
    logger.info("⚠️  SQLite has limited ALTER TABLE support")
    logger.info("⚠️  Some schema changes may require manual intervention")
    return True

def timeout_handler(signum, frame):
    """Handle timeout for long-running migrations"""
    logger.error("❌ Migration timeout reached")
    sys.exit(1)

def verify_schema(db_url):
    """Verify database schema after migration"""
    if not db_url.startswith('sqlite'):
        logger.info("Skipping schema verification (not SQLite)")
        return True
    
    logger.info("🔍 Verifying database schema...")
    
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            # Get list of tables
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))
            tables = [row[0] for row in result.fetchall()]
            
            # Expected core tables
            expected_tables = [
                'users',
                'projects',
                'project_assignments',
                'test_suites',
                'test_cases',
                'test_case_sections',
                'test_runs',
                'test_results',
                'defects',
                'alembic_version'
            ]
            
            # Check for missing tables
            missing_tables = [t for t in expected_tables if t not in tables]
            if missing_tables:
                logger.warning(f"⚠️  Missing tables: {missing_tables}")
                logger.warning("Some tables may not exist yet if this is a fresh migration")
            else:
                logger.info("✅ All expected tables present")
            
            # Check alembic_version table exists (indicates migrations are tracked)
            if 'alembic_version' in tables:
                result = conn.execute(text("SELECT version_num FROM alembic_version"))
                version = result.fetchone()
                if version:
                    logger.info(f"✅ Current migration version: {version[0]}")
                else:
                    logger.warning("⚠️  alembic_version table is empty")
            else:
                logger.warning("⚠️  alembic_version table not found - migrations may not be tracked")
            
            # Check for critical columns in users table
            if 'users' in tables:
                result = conn.execute(text("PRAGMA table_info(users)"))
                columns = [row[1] for row in result.fetchall()]
                critical_user_columns = ['id', 'username', 'email', 'hashed_password', 'role']
                missing_user_columns = [c for c in critical_user_columns if c not in columns]
                if missing_user_columns:
                    logger.error(f"❌ Missing critical columns in users table: {missing_user_columns}")
                    return False
                else:
                    logger.info("✅ Users table structure verified")
            
            logger.info("✅ Schema verification completed")
            return True
            
    except Exception as e:
        logger.error(f"❌ Schema verification failed: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Database migration utility')
    parser.add_argument('--env', choices=['dev', 'prod', 'test'], default='dev',
                       help='Environment (dev, prod, test)')
    parser.add_argument('--url', help='Database URL (overrides environment)')
    subparsers = parser.add_subparsers(dest='action', help='Migration actions')
    
    # Upgrade command
    upgrade_parser = subparsers.add_parser('upgrade', help='Upgrade to latest migration')
    upgrade_parser.add_argument('--revision', help='Specific revision to upgrade to')
    upgrade_parser.add_argument('--dry-run', action='store_true', help='Preview changes without applying')
    upgrade_parser.add_argument('--no-backup', action='store_true', help='Skip database backup')
    upgrade_parser.add_argument('--no-verify', action='store_true', help='Skip schema verification after migration')
    
    # Downgrade command
    downgrade_parser = subparsers.add_parser('downgrade', help='Downgrade to specific revision')
    downgrade_parser.add_argument('--revision', required=True, help='Revision to downgrade to')
    downgrade_parser.add_argument('--dry-run', action='store_true', help='Preview changes without applying')
    downgrade_parser.add_argument('--no-backup', action='store_true', help='Skip database backup')
    downgrade_parser.add_argument('--no-verify', action='store_true', help='Skip schema verification after migration')
    
    # Current command
    subparsers.add_parser('current', help='Show current revision')
    
    # History command
    history_parser = subparsers.add_parser('history', help='Show migration history')
    history_parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    # Revision command
    revision_parser = subparsers.add_parser('revision', help='Create new migration')
    revision_parser.add_argument('--message', '-m', required=True, help='Migration message')
    revision_parser.add_argument('--autogenerate', action='store_true', help='Autogenerate migration')
    
    # Stamp command
    stamp_parser = subparsers.add_parser('stamp', help='Stamp database with specific revision')
    stamp_parser.add_argument('--revision', required=True, help='Revision to stamp')
    stamp_parser.add_argument('--purge', action='store_true', help='Purge all versions before stamping')
    
    # Show command
    show_parser = subparsers.add_parser('show', help='Show SQL for migration')
    show_parser.add_argument('--revision', required=True, help='Revision to show')
    
    # Global timeout option
    parser.add_argument('--timeout', type=int, default=300, help='Timeout in seconds (default: 300)')
    
    args = parser.parse_args()
    
    if not args.action:
        parser.print_help()
        return
    
    # Validate environment variables
    if not validate_env_vars(args.env):
        logger.error("❌ Environment validation failed")
        sys.exit(1)
    
    # Configure Alembic
    alembic_cfg = Config("alembic.ini")
    
    # Override database URL based on environment or command line
    if args.url:
        db_url = args.url
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    elif args.env == 'prod':
        # In production, use environment variable or default to SQLite
        db_url = os.getenv('DATABASE_URL', 'sqlite:///./test_management.db')
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    elif args.env == 'test':
        db_url = os.getenv('TEST_DATABASE_URL', 'sqlite:///./test_test.db')
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    else:
        # Dev environment
        db_url = os.getenv('DATABASE_URL', 'sqlite:///./test_management.db')
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    
    logger.info(f"Using database: {db_url}")
    
    # Check SQLite limitations
    if not check_sqlite_limitations(db_url):
        logger.error("❌ SQLite limitations check failed")
        sys.exit(1)
    
    # Set timeout handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(args.timeout)
    
    # For upgrade/downgrade, check connection and create backup
    if args.action in ['upgrade', 'downgrade']:
        if not check_database_connection(db_url):
            logger.error("❌ Cannot proceed without database connection")
            sys.exit(1)
        
        # Create backup unless skipped or dry-run
        if not getattr(args, 'no_backup', False) and not getattr(args, 'dry_run', False):
            backup_path = backup_sqlite_database(db_url)
            if backup_path:
                logger.info(f"Backup created at: {backup_path}")
    
    try:
        if args.action == 'upgrade':
            if getattr(args, 'dry_run', False):
                logger.info("🔍 Dry-run mode: previewing upgrade")
                command.upgrade(alembic_cfg, args.revision if args.revision else "head", sql=True)
            else:
                if args.revision:
                    command.upgrade(alembic_cfg, args.revision)
                else:
                    command.upgrade(alembic_cfg, "head")
                logger.info("✅ Database upgraded successfully")
                
                # Verify schema after upgrade unless skipped
                if not getattr(args, 'no_verify', False):
                    if not verify_schema(db_url):
                        logger.error("❌ Schema verification failed after upgrade")
                        sys.exit(1)
            
        elif args.action == 'downgrade':
            if getattr(args, 'dry_run', False):
                logger.info("🔍 Dry-run mode: previewing downgrade")
                command.downgrade(alembic_cfg, args.revision, sql=True)
            else:
                command.downgrade(alembic_cfg, args.revision)
                logger.info(f"✅ Database downgraded to {args.revision}")
                
                # Verify schema after downgrade unless skipped
                if not getattr(args, 'no_verify', False):
                    if not verify_schema(db_url):
                        logger.error("❌ Schema verification failed after downgrade")
                        sys.exit(1)
            
        elif args.action == 'current':
            command.current(alembic_cfg)
            
        elif args.action == 'history':
            if args.verbose:
                command.history(alembic_cfg, verbose=True)
            else:
                command.history(alembic_cfg)
                
        elif args.action == 'revision':
            command.revision(alembic_cfg, message=args.message, autogenerate=args.autogenerate)
            logger.info(f"✅ New migration created: {args.message}")
            
        elif args.action == 'stamp':
            if getattr(args, 'purge', False):
                command.stamp(alembic_cfg, args.revision, purge=True)
            else:
                command.stamp(alembic_cfg, args.revision)
            logger.info(f"✅ Database stamped to revision: {args.revision}")
            
        elif args.action == 'show':
            logger.info(f"Showing SQL for revision: {args.revision}")
            command.upgrade(alembic_cfg, args.revision, sql=True)
            
    except Exception as e:
        logger.error(f"❌ Migration error: {str(e)}")
        sys.exit(1)
    finally:
        # Cancel timeout
        signal.alarm(0)

if __name__ == "__main__":
    main()
