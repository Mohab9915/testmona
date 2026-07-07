from sqlalchemy.orm import Session, joinedload, noload, selectinload
from sqlalchemy.orm.attributes import set_committed_value
from sqlalchemy import func, or_, text
from sqlalchemy.exc import IntegrityError, OperationalError
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import re
from .. import schemas
from ..services.execution_timing import apply_test_result_execution_timing
from ..services.user_lifecycle import (
    create_user_invitation,
    delete_user_invitation,
    get_onboarding_checklist,
    get_user_invitation,
    get_user_invitation_by_token,
    get_user_invitations,
    initialize_onboarding_checklist,
    mark_invitation_as_used,
    update_onboarding_task,
)
from ..models import Project, TestSuite, TestCase, TestCaseStep, TestRun, TestResult, User, Role, CustomFieldDefinition, CustomFieldValue, CustomFieldType, JiraIntegration, JiraIssue, Requirement, Defect, TestPlan, Milestone, TraceabilityMatrix, CoverageReport, Notification, TestCaseSection, SharedStep, GlobalParameter, TestDataset, TestMindmap, ImpactAnalysis, ExecutionEnvironment, ExecutionLog, TestSchedule, ExecutionEngine, TestRunEnvironment, DefectComment, DefectAttachment, DefectHistory, DefectWorkflow, DefectTemplate, TestResultDefectLink, DefectLinkType, DefectStatus, IssueTrackerIntegration, SyncLog, KPIData, TestStepResult, ShareableReport, RootCauseAnalysis, DashboardWidget, TestCaseRevision, RequirementStatus, Priority, EntityType, TestTypeDefinition, PriorityDefinition, SharedStepTemplate, TestExecutionSettings, NotificationSettings, AutomationSettings, SystemSettings, requirement_test_case_links, requirement_test_plan_links, RequirementVersion, RequirementChatConversation, RequirementChatMessage, RequirementFolder
from ..schemas import (
    ProjectCreate, ProjectUpdate,
    TestSuiteCreate, TestSuiteUpdate,
    TestCaseCreate, TestCaseUpdate,
    TestRunCreate, TestRunUpdate,
    TestResultCreate, TestResultUpdate,
    UserCreate, UserUpdate,
    CustomFieldDefinitionCreate, CustomFieldDefinitionUpdate,
    CustomFieldValueCreate, CustomFieldValueUpdate,
    JiraIntegrationCreate, JiraIntegrationUpdate,
    JiraIssueCreate, JiraIssueUpdate,
    RequirementCreate, RequirementUpdate,
    DefectCreate, DefectUpdate,
    TestPlanCreate, TestPlanUpdate,
    MilestoneCreate, MilestoneUpdate,
    TraceabilityMatrixCreate,
    CoverageReportCreate,
    NotificationCreate, NotificationUpdate,
    TestCaseSectionCreate, TestCaseSectionUpdate,
    TestCaseRevisionCreate,
    TestCaseStepCreate, TestCaseStepUpdate,
    KPIDataCreate, TestStepResultCreate, ShareableReportCreate, RootCauseAnalysisCreate,
    DashboardWidgetCreate,
    TestTypeDefinitionCreate, TestTypeDefinitionUpdate,
    PriorityDefinitionCreate, PriorityDefinitionUpdate,
    SharedStepTemplateCreate, SharedStepTemplateUpdate,
    TestExecutionSettingsCreate, TestExecutionSettingsUpdate,
    NotificationSettingsCreate, NotificationSettingsUpdate,
    AutomationSettingsCreate, AutomationSettingsUpdate,
    SystemSettingsCreate, SystemSettingsUpdate
)

from .deletion_helpers import delete_project_dependents as _delete_project_dependents


def safe_commit(db: Session) -> bool:
    """Safely commit a transaction with rollback on error.
    Returns True if commit succeeded, False otherwise.
    """
    try:
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


def get_project(db: Session, project_id: int):
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        # Add test case counts for the project
        test_case_count = db.query(TestCase).join(TestSuite).filter(
            TestSuite.project_id == project.id,
            ((TestCase.is_deleted.is_(None)) | (TestCase.is_deleted.is_(False))),
        ).count()
        test_suite_count = db.query(TestSuite).filter(TestSuite.project_id == project.id).count()
        test_run_count = db.query(TestRun).filter(TestRun.project_id == project.id).count()
        
        # Add counts as attributes
        project.test_cases_count = test_case_count
        project.test_suites_count = test_suite_count
        project.test_runs_count = test_run_count
    
    return project


def get_projects(db: Session, skip: int = 0, limit: int = 100):
    projects = db.query(Project).offset(skip).limit(limit).all()
    
    # Add test case counts for each project
    for project in projects:
        # Count test cases through test suites
        test_case_count = db.query(TestCase).join(TestSuite).filter(
            TestSuite.project_id == project.id,
            ((TestCase.is_deleted.is_(None)) | (TestCase.is_deleted.is_(False))),
        ).count()
        test_suite_count = db.query(TestSuite).filter(TestSuite.project_id == project.id).count()
        test_run_count = db.query(TestRun).filter(TestRun.project_id == project.id).count()
        
        # Add counts as attributes (these won't be saved to DB but will be returned)
        project.test_cases_count = test_case_count
        project.test_suites_count = test_suite_count
        project.test_runs_count = test_run_count
    
    return projects


def create_project(db: Session, project: ProjectCreate):
    db_project = Project(**project.model_dump())
    db.add(db_project)
    safe_commit(db)
    db.refresh(db_project)
    return db_project


def update_project(db: Session, project_id: int, project: ProjectUpdate):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if db_project:
        for key, value in project.model_dump(exclude_unset=True).items():
            setattr(db_project, key, value)
        safe_commit(db)
        db.refresh(db_project)
    return db_project


def delete_project(db: Session, project_id: int):
    db_project = db.query(Project).options(
        noload(Project.test_suites),
        noload(Project.test_runs),
        noload(Project.test_plans),
        noload(Project.milestones),
        noload(Project.requirements),
        noload(Project.defects),
        noload(Project.coverage_reports),
        noload(Project.user_assignments),
        noload(Project.owner),
        noload(Project.custom_field_definitions),
        noload(Project.jira_integrations)
    ).filter(Project.id == project_id).first()
    if db_project:
        _delete_project_dependents(db, project_id)
        
        # Finally delete the project
        db.delete(db_project)
        safe_commit(db)
    return db_project
