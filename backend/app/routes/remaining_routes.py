"""
Remaining routes for execution environments, additional analytics endpoints, and audit trails.
"""

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from .. import crud, schemas, auth, rbac, models
from ..database import get_db
from ..auth import get_current_active_user


def register_remaining_routes(app):
    """Register remaining routes with the FastAPI app."""
    
    # Execution Environment Endpoints
    @app.get("/execution-environments/", response_model=List[schemas.ExecutionEnvironment])
    def get_execution_environments(
        project_id: int = None,
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        if project_id is not None and not rbac.has_permission(current_user, "read", project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        environments = crud.get_execution_environments(db, project_id=project_id)
        return environments[skip:skip+limit]

    @app.get("/execution-environments/{environment_id}", response_model=schemas.ExecutionEnvironment)
    def get_execution_environment(
        environment_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        environment = crud.get_execution_environment(db, environment_id=environment_id)
        if environment is None:
            raise HTTPException(status_code=404, detail="Environment not found")
        
        if not rbac.has_permission(current_user, "read", environment.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return environment

    @app.post("/execution-environments/", response_model=schemas.ExecutionEnvironment)
    def create_execution_environment(
        environment: schemas.ExecutionEnvironmentCreate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        if not rbac.has_permission(current_user, "manage", environment.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        db_environment = crud.create_execution_environment(db, environment.model_dump())
        
        # Create audit trail
        try:
            from ..services.audit_service import get_audit_service
            from ..schemas_audit import AuditTrailCreate
            from ..models import AuditAction, EntityType
            audit_service = get_audit_service(db)
            audit_data = AuditTrailCreate(
                user_id=current_user.id if current_user else None,
                action=AuditAction.CREATE.value,
                entity_type=EntityType.EXECUTION_ENVIRONMENT.value,
                entity_id=db_environment.id,
                project_id=db_environment.project_id,
                description=f"Execution environment created: {environment.name or 'Untitled'}",
            )
            audit_service.create_audit_trail(audit_data)
        except Exception as e:
            print(f"Failed to create audit trail for execution environment creation: {e}")
        
        return db_environment

    @app.put("/execution-environments/{environment_id}", response_model=schemas.ExecutionEnvironment)
    def update_execution_environment(
        environment_id: int,
        environment: schemas.ExecutionEnvironmentUpdate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        db_environment = crud.get_execution_environment(db, environment_id=environment_id)
        if db_environment is None:
            raise HTTPException(status_code=404, detail="Environment not found")
        
        if not rbac.has_permission(current_user, "manage", db_environment.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        update_data = environment.model_dump(exclude_unset=True)
        db_environment = crud.update_execution_environment(db, environment_id, update_data)
        
        # Create audit trail
        try:
            from ..services.audit_service import get_audit_service
            from ..schemas_audit import AuditTrailCreate
            from ..models import AuditAction, EntityType
            audit_service = get_audit_service(db)
            audit_data = AuditTrailCreate(
                user_id=current_user.id if current_user else None,
                action=AuditAction.UPDATE.value,
                entity_type=EntityType.EXECUTION_ENVIRONMENT.value,
                entity_id=db_environment.id,
                project_id=db_environment.project_id,
                description=f"Execution environment updated: {db_environment.name or 'Untitled'}",
            )
            audit_service.create_audit_trail(audit_data)
        except Exception as e:
            print(f"Failed to create audit trail for execution environment update: {e}")
        
        return db_environment

    @app.delete("/execution-environments/{environment_id}")
    def delete_execution_environment(
        environment_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        db_environment = crud.get_execution_environment(db, environment_id=environment_id)
        if db_environment is None:
            raise HTTPException(status_code=404, detail="Environment not found")
        
        if not rbac.has_permission(current_user, "manage", db_environment.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Store data for audit trail before deletion
        environment_id_val = db_environment.id
        environment_name = db_environment.name
        project_id = db_environment.project_id
        
        crud.delete_execution_environment(db, environment_id)
        
        # Create audit trail
        try:
            from ..services.audit_service import get_audit_service
            from ..schemas_audit import AuditTrailCreate
            from ..models import AuditAction, EntityType
            audit_service = get_audit_service(db)
            audit_data = AuditTrailCreate(
                user_id=current_user.id if current_user else None,
                action=AuditAction.DELETE.value,
                entity_type=EntityType.EXECUTION_ENVIRONMENT.value,
                entity_id=environment_id_val,
                project_id=project_id,
                description=f"Execution environment deleted: {environment_name or 'Untitled'}",
            )
            audit_service.create_audit_trail(audit_data)
        except Exception as e:
            print(f"Failed to create audit trail for execution environment deletion: {e}")
        
        return {"message": "Environment deleted successfully"}

    # Environments Endpoints (for frontend compatibility)
    @app.get("/environments", response_model=List[schemas.ExecutionEnvironment])
    def get_environments(
        project_id: int = None,
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Get environments - endpoint to match frontend expectations"""
        if project_id is not None and not rbac.has_permission(current_user, "read", project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        environments = crud.get_execution_environments(db, project_id=project_id)
        return environments[skip:skip+limit]

    @app.get("/environments/{environment_id}", response_model=schemas.ExecutionEnvironment)
    def get_environment(
        environment_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Get environment by ID - endpoint to match frontend expectations"""
        environment = crud.get_execution_environment(db, environment_id=environment_id)
        if environment is None:
            raise HTTPException(status_code=404, detail="Environment not found")
        
        if not rbac.has_permission(current_user, "read", environment.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return environment

    @app.post("/environments", response_model=schemas.ExecutionEnvironment)
    def create_environment(
        environment: schemas.ExecutionEnvironmentCreate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Create environment - endpoint to match frontend expectations"""
        if not rbac.has_permission(current_user, "manage", environment.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return crud.create_execution_environment(db, environment.model_dump())

    @app.put("/environments/{environment_id}", response_model=schemas.ExecutionEnvironment)
    def update_environment(
        environment_id: int,
        environment: schemas.ExecutionEnvironmentUpdate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Update environment - endpoint to match frontend expectations"""
        db_environment = crud.get_execution_environment(db, environment_id=environment_id)
        if db_environment is None:
            raise HTTPException(status_code=404, detail="Environment not found")
        
        if not rbac.has_permission(current_user, "manage", db_environment.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        update_data = environment.model_dump(exclude_unset=True)
        return crud.update_execution_environment(db, environment_id, update_data)

    @app.delete("/environments/{environment_id}")
    def delete_environment(
        environment_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Delete environment - endpoint to match frontend expectations"""
        db_environment = crud.get_execution_environment(db, environment_id=environment_id)
        if db_environment is None:
            raise HTTPException(status_code=404, detail="Environment not found")
        
        if not rbac.has_permission(current_user, "manage", db_environment.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        crud.delete_execution_environment(db, environment_id)
        return {"message": "Environment deleted successfully"}

    # Additional Analytics GET Endpoints
    @app.get("/analytics/dashboard/analytics")
    def get_dashboard_analytics_get(
        project_id: int,
        time_range: str = "7d",
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Get dashboard analytics for a project with time range filtering"""
        if not rbac.has_permission(current_user, "read", project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        try:
            # Use real analytics calculation from CRUD
            return crud.generate_dashboard_analytics(db, project_id, time_range)
        except Exception as e:
            print(f"Error in get_dashboard_analytics_get: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate analytics")

    @app.get("/analytics/granular-insights")
    def get_granular_insights_get(
        project_id: int,
        filter_type: str = "all",
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Get granular insights for a project"""
        if not rbac.has_permission(current_user, "read", project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Use real KPI data from CRUD
        kpis = crud.calculate_project_kpis(db, project_id, "7d")
        
        return {
            "project_id": project_id,
            "filter_type": filter_type,
            "insights": [
                {
                    "category": "Test Execution",
                    "metric": "Average Execution Time",
                    "value": f"{kpis['avg_execution_time']}h",
                    "trend": "stable",
                    "details": "Based on recent test runs"
                },
                {
                    "category": "Defect Analysis",
                    "metric": "Defect Density",
                    "value": str(kpis['defect_density']),
                    "trend": "stable",
                    "details": f"Defects per {kpis['total_tests']} tests"
                },
                {
                    "category": "Test Coverage",
                    "metric": "Coverage",
                    "value": f"{kpis['coverage']}%",
                    "trend": "stable",
                    "details": f"{kpis['passed_tests']} passed out of {kpis['total_tests']}"
                }
            ]
        }

    @app.get("/analytics/traceability-matrix")
    def get_traceability_matrix_get(
        project_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Get traceability matrix for a project"""
        if not rbac.has_permission(current_user, "read", project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Use real traceability data from CRUD
        from ..models import Requirement, TestCase, TraceabilityMatrix, TestSuite
        
        # Get all requirements for the project
        requirements = db.query(Requirement).filter(Requirement.project_id == project_id).all()
        total_requirements = len(requirements)
        
        # Get all test cases for the project (through test suites)
        test_suite_ids = db.query(TestSuite.id).filter(TestSuite.project_id == project_id).all()
        test_suite_id_list = [ts.id for ts in test_suite_ids]
        test_cases = db.query(TestCase).filter(TestCase.test_suite_id.in_(test_suite_id_list)).all()
        total_test_cases = len(test_cases)
        
        # Get traceability matrix entries filtered by project's requirements and test cases
        requirement_ids = [req.id for req in requirements]
        test_case_ids = [tc.id for tc in test_cases]
        
        if requirement_ids and test_case_ids:
            traceability_entries = db.query(TraceabilityMatrix).filter(
                TraceabilityMatrix.requirement_id.in_(requirement_ids),
                TraceabilityMatrix.test_case_id.in_(test_case_ids)
            ).all()
        else:
            traceability_entries = []
        
        requirements_covered = len(set([entry.requirement_id for entry in traceability_entries]))
        test_cases_linked = len(set([entry.test_case_id for entry in traceability_entries]))
        
        coverage_percentage = (requirements_covered / total_requirements * 100) if total_requirements > 0 else 0
        
        # Find uncovered requirements
        covered_requirement_ids = set([entry.requirement_id for entry in traceability_entries])
        gaps = []
        for req in requirements:
            if req.id not in covered_requirement_ids:
                gaps.append({
                    "requirement_id": req.requirement_id or f"REQ-{req.id}",
                    "requirement_name": req.title,
                    "status": "uncovered",
                    "suggested_test_cases": []
                })
        
        return {
            "project_id": project_id,
            "matrix": {
                "requirements_covered": requirements_covered,
                "total_requirements": total_requirements,
                "test_cases_linked": test_cases_linked,
                "total_test_cases": total_test_cases,
                "coverage_percentage": round(coverage_percentage, 2)
            },
            "gaps": gaps
        }

    @app.get("/analytics/coverage-reports")
    def get_coverage_reports_get(
        project_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Get coverage reports for a project"""
        if not rbac.has_permission(current_user, "read", project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Generate coverage report dynamically from test data
        from ..models import TestCase, TestSuite, TestResult, TestRun, Requirement, TraceabilityMatrix, PriorityDefinition
        
        # Get all test cases for the project
        test_suite_ids = db.query(TestSuite.id).filter(TestSuite.project_id == project_id).all()
        test_suite_id_list = [ts.id for ts in test_suite_ids]
        total_test_cases = db.query(TestCase).filter(TestCase.test_suite_id.in_(test_suite_id_list)).count()
        
        # Get test results for executed tests
        test_run_ids = db.query(TestRun.id).filter(TestRun.project_id == project_id).all()
        test_run_id_list = [tr.id for tr in test_run_ids]
        test_results = db.query(TestResult).filter(TestResult.test_run_id.in_(test_run_id_list)).all()
        
        executed_test_cases = len(set([r.test_case_id for r in test_results]))
        passed_test_cases = len([r for r in test_results if r.status == 'passed'])
        failed_test_cases = len([r for r in test_results if r.status == 'failed'])
        blocked_test_cases = len([r for r in test_results if r.status == 'blocked'])
        
        # Get requirements and coverage
        requirements = db.query(Requirement).filter(Requirement.project_id == project_id).all()
        total_requirements = len(requirements)
        
        # Get traceability entries
        requirement_ids = [req.id for req in requirements]
        test_case_ids = [tc.id for tc in db.query(TestCase).filter(TestCase.test_suite_id.in_(test_suite_id_list)).all()]
        
        if requirement_ids and test_case_ids:
            traceability_entries = db.query(TraceabilityMatrix).filter(
                TraceabilityMatrix.requirement_id.in_(requirement_ids),
                TraceabilityMatrix.test_case_id.in_(test_case_ids)
            ).all()
            covered_requirements = len(set([entry.requirement_id for entry in traceability_entries]))
        else:
            covered_requirements = 0
        
        coverage_percentage = (covered_requirements / total_requirements * 100) if total_requirements > 0 else 0
        
        # Calculate priority-wise coverage using dynamic priorities from PriorityDefinition
        priority_definitions = db.query(PriorityDefinition).filter(PriorityDefinition.is_active == True).order_by(PriorityDefinition.value.desc()).all()
        
        priority_coverage = {}
        for priority_def in priority_definitions:
            priority_name = priority_def.name.lower()
            priority_coverage[priority_name] = 0
        
        for priority_def in priority_definitions:
            priority_name = priority_def.name.lower()
            # Match requirements by priority name (case-insensitive)
            reqs_with_priority = [req for req in requirements if req.priority and req.priority.value.lower() == priority_name]
            total_reqs_priority = len(reqs_with_priority)
            
            if total_reqs_priority > 0:
                req_ids_priority = [req.id for req in reqs_with_priority]
                if req_ids_priority and test_case_ids:
                    traceability_priority = db.query(TraceabilityMatrix).filter(
                        TraceabilityMatrix.requirement_id.in_(req_ids_priority),
                        TraceabilityMatrix.test_case_id.in_(test_case_ids)
                    ).all()
                    covered_priority = len(set([entry.requirement_id for entry in traceability_priority]))
                    priority_coverage[priority_name] = round((covered_priority / total_reqs_priority) * 100, 2)
                else:
                    priority_coverage[priority_name] = 0
        
        # Return a single dynamically generated coverage report
        return [
            {
                "id": "COV-DYNAMIC",
                "title": "Current Coverage Report",
                "generated_at": datetime.now().isoformat(),
                "coverage_percentage": round(coverage_percentage, 2),
                "total_requirements": total_requirements,
                "covered_requirements": covered_requirements,
                "test_cases_count": total_test_cases,
                "executed_tests": executed_test_cases,
                "report_data": {
                    "by_priority": priority_coverage,
                    "by_status": {
                        "passed": round((passed_test_cases / executed_test_cases * 100) if executed_test_cases > 0 else 0, 2),
                        "failed": round((failed_test_cases / executed_test_cases * 100) if executed_test_cases > 0 else 0, 2),
                        "blocked": round((blocked_test_cases / executed_test_cases * 100) if executed_test_cases > 0 else 0, 2),
                        "not_executed": round(((total_test_cases - executed_test_cases) / total_test_cases * 100) if total_test_cases > 0 else 0, 2)
                    }
                }
            }
        ]

    @app.post("/analytics/coverage-reports/generate")
    def generate_coverage_report_post(
        request: dict,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Generate a new coverage report"""
        project_id = request.get("project_id")
        if not rbac.has_permission(current_user, "read", project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Calculate actual coverage metrics
        from ..models import TestCase, TestSuite, TestResult, TestRun, Requirement, TraceabilityMatrix, PriorityDefinition
        
        # Get all test cases for the project
        test_suite_ids = db.query(TestSuite.id).filter(TestSuite.project_id == project_id).all()
        test_suite_id_list = [ts.id for ts in test_suite_ids]
        total_test_cases = db.query(TestCase).filter(TestCase.test_suite_id.in_(test_suite_id_list)).count()
        
        # Get test results for executed tests
        test_run_ids = db.query(TestRun.id).filter(TestRun.project_id == project_id).all()
        test_run_id_list = [tr.id for tr in test_run_ids]
        test_results = db.query(TestResult).filter(TestResult.test_run_id.in_(test_run_id_list)).all()
        
        executed_test_cases = len(set([r.test_case_id for r in test_results]))
        passed_test_cases = len([r for r in test_results if r.status == 'passed'])
        failed_test_cases = len([r for r in test_results if r.status == 'failed'])
        blocked_test_cases = len([r for r in test_results if r.status == 'blocked'])
        
        # Get requirements and coverage
        requirements = db.query(Requirement).filter(Requirement.project_id == project_id).all()
        total_requirements = len(requirements)
        
        # Get traceability entries
        requirement_ids = [req.id for req in requirements]
        test_case_ids = [tc.id for tc in db.query(TestCase).filter(TestCase.test_suite_id.in_(test_suite_id_list)).all()]
        
        if requirement_ids and test_case_ids:
            traceability_entries = db.query(TraceabilityMatrix).filter(
                TraceabilityMatrix.requirement_id.in_(requirement_ids),
                TraceabilityMatrix.test_case_id.in_(test_case_ids)
            ).all()
            covered_requirements = len(set([entry.requirement_id for entry in traceability_entries]))
        else:
            covered_requirements = 0
        
        coverage_percentage = (covered_requirements / total_requirements * 100) if total_requirements > 0 else 0
        
        # Calculate priority-wise coverage using dynamic priorities from PriorityDefinition
        priority_definitions = db.query(PriorityDefinition).filter(PriorityDefinition.is_active == True).order_by(PriorityDefinition.value.desc()).all()
        
        priority_coverage = {}
        for priority_def in priority_definitions:
            priority_name = priority_def.name.lower()
            priority_coverage[priority_name] = 0
        
        for priority_def in priority_definitions:
            priority_name = priority_def.name.lower()
            # Match requirements by priority name (case-insensitive)
            reqs_with_priority = [req for req in requirements if req.priority and req.priority.value.lower() == priority_name]
            total_reqs_priority = len(reqs_with_priority)
            
            if total_reqs_priority > 0:
                req_ids_priority = [req.id for req in reqs_with_priority]
                if req_ids_priority and test_case_ids:
                    traceability_priority = db.query(TraceabilityMatrix).filter(
                        TraceabilityMatrix.requirement_id.in_(req_ids_priority),
                        TraceabilityMatrix.test_case_id.in_(test_case_ids)
                    ).all()
                    covered_priority = len(set([entry.requirement_id for entry in traceability_priority]))
                    priority_coverage[priority_name] = round((covered_priority / total_reqs_priority) * 100, 2)
                else:
                    priority_coverage[priority_name] = 0
        
        # Generate and return new coverage report with actual data
        return {
            "id": f"COV-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "title": f"Coverage Report - {datetime.now().strftime('%Y-%m-%d')}",
            "generated_at": datetime.now().isoformat(),
            "coverage_percentage": round(coverage_percentage, 2),
            "total_requirements": total_requirements,
            "covered_requirements": covered_requirements,
            "test_cases_count": total_test_cases,
            "executed_tests": executed_test_cases,
            "report_data": {
                "by_priority": priority_coverage,
                "by_status": {
                    "passed": round((passed_test_cases / executed_test_cases * 100) if executed_test_cases > 0 else 0, 2),
                    "failed": round((failed_test_cases / executed_test_cases * 100) if executed_test_cases > 0 else 0, 2),
                    "blocked": round((blocked_test_cases / executed_test_cases * 100) if executed_test_cases > 0 else 0, 2),
                    "not_executed": round(((total_test_cases - executed_test_cases) / total_test_cases * 100) if total_test_cases > 0 else 0, 2)
                }
            }
        }

    @app.get("/analytics/test-execution-status")
    def get_test_execution_status_get(
        project_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Get test execution status for a project"""
        if not rbac.has_permission(current_user, "read", project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Use real KPI data from CRUD
        kpis = crud.calculate_project_kpis(db, project_id, "7d")
        
        total_tests = kpis["total_tests"]
        executed = kpis["passed_tests"] + kpis["failed_tests"] + kpis["blocked_tests"]
        not_executed = total_tests - executed
        passed = kpis["passed_tests"]
        failed = kpis["failed_tests"]
        blocked = kpis["blocked_tests"]
        
        return {
            "project_id": project_id,
            "summary": {
                "total_test_cases": total_tests,
                "executed_test_cases": executed,
                "not_tested_test_cases": not_executed,
                "passed_test_cases": passed,
                "failed_test_cases": failed,
                "blocked_test_cases": blocked
            },
            "status": {
                "total_tests": total_tests,
                "executed": executed,
                "passed": passed,
                "failed": failed,
                "blocked": blocked,
                "not_executed": not_executed
            },
            "execution_rate": round((executed / total_tests) * 100, 1) if total_tests > 0 else 0,
            "success_rate": round((passed / executed) * 100, 1) if executed > 0 else 0,
            "status_percentages": {
                "passed": round((passed / executed) * 100, 1) if executed > 0 else 0,
                "failed": round((failed / executed) * 100, 1) if executed > 0 else 0,
                "blocked": round((blocked / executed) * 100, 1) if executed > 0 else 0
            },
            "overall_percentages": {
                "passed": round((passed / total_tests) * 100, 1) if total_tests > 0 else 0,
                "failed": round((failed / total_tests) * 100, 1) if total_tests > 0 else 0,
                "blocked": round((blocked / total_tests) * 100, 1) if total_tests > 0 else 0,
                "not_executed": round((not_executed / total_tests) * 100, 1) if total_tests > 0 else 0
            },
            "last_execution": datetime.now().isoformat()
        }

    @app.get("/analytics/root-cause-analyses")
    def get_root_cause_analyses_get(
        project_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Get root cause analyses for a project"""
        if not rbac.has_permission(current_user, "read", project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Use real root cause analyses from CRUD
        analyses = crud.get_root_cause_analyses(db, project_id=project_id)
        
        # Convert to response format
        return [
            {
                "id": f"RCA-{analysis.id}",
                "title": analysis.title or f"Root Cause Analysis {analysis.id}",
                "created_at": analysis.created_at.isoformat() if analysis.created_at else datetime.now().isoformat(),
                "defect_id": analysis.defect_id,
                "root_cause": analysis.root_cause,
                "severity": analysis.severity,
                "recommendations": analysis.recommendations or []
            }
            for analysis in analyses
        ]

    # Audit Endpoint
    @app.get("/audit/project-activity-summary")
    def get_project_activity_summary_direct(
        project_id: int,
        days: int = 7,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Get project activity summary - direct endpoint to match frontend expectations"""
        if not rbac.has_permission(current_user, "read", project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Import the audit service
        from ..services.audit_service import get_audit_service
        audit_service = get_audit_service(db)
        
        # Get the activity summary from the audit service
        summary = audit_service.get_project_activity_summary(project_id, days)
        return summary
