"""
Custom fields routes for managing custom field definitions.
"""

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import crud, schemas, auth, rbac
from ..database import get_db
from ..auth import get_current_active_user


def register_custom_fields_routes(app):
    """Register custom fields routes with the FastAPI app."""
    
    @app.get("/custom-fields/definitions")
    def get_custom_fields_definitions(
        project_id: int,
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Get custom field definitions - endpoint to match frontend expectations"""
        if not rbac.has_permission(current_user, "read", project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Reuse existing CRUD function
        return crud.get_custom_field_definitions(db, project_id=project_id, skip=skip, limit=limit)

    @app.post("/custom-fields/definitions", response_model=schemas.CustomFieldDefinition)
    def create_custom_fields_definition(
        field: schemas.CustomFieldDefinitionCreate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Create custom field definition - endpoint to match frontend expectations"""
        if not rbac.has_permission(current_user, "write", field.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return crud.create_custom_field_definition(db=db, field=field, user_id=current_user.id)

    @app.get("/custom-fields/definitions/{field_id}", response_model=schemas.CustomFieldDefinition)
    def get_custom_fields_definition(
        field_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Get custom field definition by ID - endpoint to match frontend expectations"""
        field = crud.get_custom_field_definition(db, field_id=field_id)
        if field is None:
            raise HTTPException(status_code=404, detail="Custom field definition not found")
        
        if not rbac.has_permission(current_user, "read", field.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return field

    @app.put("/custom-fields/definitions/{field_id}", response_model=schemas.CustomFieldDefinition)
    def update_custom_fields_definition(
        field_id: int,
        field: schemas.CustomFieldDefinitionUpdate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Update custom field definition - endpoint to match frontend expectations"""
        # Check permissions first by getting the existing field
        existing_field = crud.get_custom_field_definition(db, field_id=field_id)
        if existing_field is None:
            raise HTTPException(status_code=404, detail="Custom field definition not found")
        
        if not rbac.has_permission(current_user, "write", existing_field.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Reuse existing CRUD function
        return crud.update_custom_field_definition(db, field_id=field_id, field=field, user_id=current_user.id)

    @app.delete("/custom-fields/definitions/{field_id}")
    def delete_custom_fields_definition(
        field_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Delete custom field definition - endpoint to match frontend expectations"""
        # Check permissions first by getting the existing field
        existing_field = crud.get_custom_field_definition(db, field_id=field_id)
        if existing_field is None:
            raise HTTPException(status_code=404, detail="Custom field definition not found")
        
        if not rbac.has_permission(current_user, "delete", existing_field.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Reuse existing CRUD function
        crud.delete_custom_field_definition(db, field_id=field_id, user_id=current_user.id)
        return {"message": "Custom field definition deleted successfully"}

    @app.get("/test-cases/{test_case_id}/with-custom-fields", response_model=schemas.TestCaseWithCustomFields)
    def get_test_case_with_custom_fields(
        test_case_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        """Get test case with custom fields"""
        test_case = crud.get_test_case(db, test_case_id=test_case_id)
        if test_case is None:
            raise HTTPException(status_code=404, detail="Test case not found")
        
        test_suite = crud.get_test_suite(db, test_suite_id=test_case.test_suite_id)
        if not rbac.has_permission(current_user, "read", test_suite.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return crud.get_test_case_with_custom_fields(db, test_case_id=test_case_id)

    # Custom Field Definition Endpoints (original path)
    @app.post("/custom-field-definitions/", response_model=schemas.CustomFieldDefinition)
    def create_custom_field_definition_original(
        field: schemas.CustomFieldDefinitionCreate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        if not rbac.has_permission(current_user, "write", field.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return crud.create_custom_field_definition(db=db, field=field, user_id=current_user.id)

    @app.get("/custom-field-definitions")
    def read_custom_field_definitions_original(
        project_id: int = None,
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        if project_id is not None and not rbac.has_permission(current_user, "read", project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        if not project_id:
            return []
        
        return crud.get_custom_field_definitions(db, project_id=project_id, skip=skip, limit=limit)

    @app.get("/custom-field-definitions/{field_id}", response_model=schemas.CustomFieldDefinition)
    def read_custom_field_definition_original(
        field_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        field = crud.get_custom_field_definition(db, field_id=field_id)
        if field is None:
            raise HTTPException(status_code=404, detail="Custom field definition not found")
        
        if not rbac.has_permission(current_user, "read", field.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return field

    @app.put("/custom-field-definitions/{field_id}", response_model=schemas.CustomFieldDefinition)
    def update_custom_field_definition_original(
        field_id: int,
        field: schemas.CustomFieldDefinitionUpdate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        db_field = crud.get_custom_field_definition(db, field_id=field_id)
        if db_field is None:
            raise HTTPException(status_code=404, detail="Custom field definition not found")
        
        if not rbac.has_permission(current_user, "write", db_field.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return crud.update_custom_field_definition(db, field_id=field_id, field=field, user_id=current_user.id)

    @app.delete("/custom-field-definitions/{field_id}")
    def delete_custom_field_definition_original(
        field_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        db_field = crud.get_custom_field_definition(db, field_id=field_id)
        if db_field is None:
            raise HTTPException(status_code=404, detail="Custom field definition not found")
        
        if not rbac.has_permission(current_user, "delete", db_field.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        crud.delete_custom_field_definition(db, field_id=field_id, user_id=current_user.id)
        return {"message": "Custom field definition deleted successfully"}

    @app.get("/custom-field-definitions/{field_id}/with-values", response_model=schemas.CustomFieldDefinitionWithValues)
    def read_custom_field_definition_with_values(
        field_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        field = crud.get_custom_field_definition(db, field_id=field_id)
        if field is None:
            raise HTTPException(status_code=404, detail="Custom field definition not found")
        
        if not rbac.has_permission(current_user, "read", field.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Get values for this field
        values = crud.get_custom_field_values(db, field_definition_id=field_id)
        
        # Return field with values (manual construction since we don't have a direct relationship)
        field_dict = field.__dict__.copy()
        field_dict['values'] = values
        return schemas.CustomFieldDefinitionWithValues(**field_dict)

    # Custom Field Value Endpoints
    @app.post("/custom-field-values/", response_model=schemas.CustomFieldValue)
    def create_custom_field_value(
        value: schemas.CustomFieldValueCreate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        # Check if user has permission to modify the test case
        test_case = crud.get_test_case(db, test_case_id=value.test_case_id)
        if not test_case:
            raise HTTPException(status_code=404, detail="Test case not found")
        
        test_suite = crud.get_test_suite(db, test_suite_id=test_case.test_suite_id)
        if not rbac.has_permission(current_user, "write", test_suite.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return crud.create_custom_field_value(db=db, value=value, user_id=current_user.id)

    @app.get("/custom-field-values/", response_model=List[schemas.CustomFieldValue])
    def read_custom_field_values(
        test_case_id: int = None,
        field_definition_id: int = None,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        if not rbac.has_permission(current_user, "read"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return crud.get_custom_field_values(db, test_case_id=test_case_id, field_definition_id=field_definition_id)

    @app.get("/custom-field-values/{value_id}", response_model=schemas.CustomFieldValue)
    def read_custom_field_value(
        value_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        value = crud.get_custom_field_value(db, value_id=value_id)
        if value is None:
            raise HTTPException(status_code=404, detail="Custom field value not found")
        
        # Check permissions on the test case
        test_case = crud.get_test_case(db, test_case_id=value.test_case_id)
        test_suite = crud.get_test_suite(db, test_suite_id=test_case.test_suite_id)
        if not rbac.has_permission(current_user, "read", test_suite.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return value

    @app.put("/custom-field-values/{value_id}", response_model=schemas.CustomFieldValue)
    def update_custom_field_value(
        value_id: int,
        value: schemas.CustomFieldValueUpdate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        db_value = crud.get_custom_field_value(db, value_id=value_id)
        if db_value is None:
            raise HTTPException(status_code=404, detail="Custom field value not found")
        
        # Check permissions on the test case
        test_case = crud.get_test_case(db, test_case_id=db_value.test_case_id)
        test_suite = crud.get_test_suite(db, test_suite_id=test_case.test_suite_id)
        if not rbac.has_permission(current_user, "write", test_suite.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return crud.update_custom_field_value(db, value_id=value_id, value=value, user_id=current_user.id)

    @app.delete("/custom-field-values/{value_id}")
    def delete_custom_field_value(
        value_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        db_value = crud.get_custom_field_value(db, value_id=value_id)
        if db_value is None:
            raise HTTPException(status_code=404, detail="Custom field value not found")
        
        # Check permissions on the test case
        test_case = crud.get_test_case(db, test_case_id=db_value.test_case_id)
        test_suite = crud.get_test_suite(db, test_suite_id=test_case.test_suite_id)
        if not rbac.has_permission(current_user, "delete", test_suite.project_id, db):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        crud.delete_custom_field_value(db, value_id=value_id, user_id=current_user.id)
        return {"message": "Custom field value deleted successfully"}
