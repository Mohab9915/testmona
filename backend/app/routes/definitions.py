"""
Definition routes for test type and priority definitions.
"""

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import crud, schemas, auth, rbac
from ..database import get_db
from ..auth import get_current_active_user


def register_definitions_routes(app):
    """Register definition routes with the FastAPI app."""
    
    # Test Type Definition Endpoints
    @app.post("/test-type-definitions/", response_model=schemas.TestTypeDefinition)
    def create_test_type_definition(
        test_type: schemas.TestTypeDefinitionCreate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        # Allow regular users to create test type definitions for smoother UX
        if not rbac.has_permission(current_user, "write"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return crud.create_test_type_definition(db=db, test_type=test_type)

    @app.get("/test-type-definitions/", response_model=List[schemas.TestTypeDefinition])
    def read_test_type_definitions(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        if not rbac.has_permission(current_user, "read"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return crud.get_test_type_definitions(db, skip=skip, limit=limit)

    @app.get("/test-type-definitions/{test_type_id}", response_model=schemas.TestTypeDefinition)
    def read_test_type_definition(
        test_type_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        test_type = crud.get_test_type_definition(db, test_type_id=test_type_id)
        if test_type is None:
            raise HTTPException(status_code=404, detail="Test type definition not found")
        return test_type

    @app.put("/test-type-definitions/{test_type_id}", response_model=schemas.TestTypeDefinition)
    def update_test_type_definition(
        test_type_id: int,
        test_type: schemas.TestTypeDefinitionUpdate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        if not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Only admins can update test type definitions")
        
        db_test_type = crud.update_test_type_definition(db, test_type_id=test_type_id, test_type=test_type)
        if db_test_type is None:
            raise HTTPException(status_code=404, detail="Test type definition not found")
        return db_test_type

    @app.delete("/test-type-definitions/{test_type_id}")
    def delete_test_type_definition(
        test_type_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        if not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Only admins can delete test type definitions")
        
        db_test_type = crud.delete_test_type_definition(db, test_type_id=test_type_id)
        if db_test_type is None:
            raise HTTPException(status_code=404, detail="Test type definition not found")
        return {"message": "Test type definition deleted successfully"}

    # Priority Definition Endpoints
    @app.post("/priority-definitions/", response_model=schemas.PriorityDefinition)
    def create_priority_definition(
        priority: schemas.PriorityDefinitionCreate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        # Allow regular users to create priority definitions for smoother UX
        if not rbac.has_permission(current_user, "write"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return crud.create_priority_definition(db=db, priority=priority)

    @app.get("/priority-definitions/", response_model=List[schemas.PriorityDefinition])
    def read_priority_definitions(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        if not rbac.has_permission(current_user, "read"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return crud.get_priority_definitions(db, skip=skip, limit=limit)

    @app.get("/priority-definitions/{priority_id}", response_model=schemas.PriorityDefinition)
    def read_priority_definition(
        priority_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        priority = crud.get_priority_definition(db, priority_id=priority_id)
        if priority is None:
            raise HTTPException(status_code=404, detail="Priority definition not found")
        return priority

    @app.put("/priority-definitions/{priority_id}", response_model=schemas.PriorityDefinition)
    def update_priority_definition(
        priority_id: int,
        priority: schemas.PriorityDefinitionUpdate,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        if not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Only admins can update priority definitions")
        
        db_priority = crud.update_priority_definition(db, priority_id=priority_id, priority=priority)
        if db_priority is None:
            raise HTTPException(status_code=404, detail="Priority definition not found")
        return db_priority

    @app.delete("/priority-definitions/{priority_id}")
    def delete_priority_definition(
        priority_id: int,
        db: Session = Depends(get_db),
        current_user: schemas.User = Depends(get_current_active_user)
    ):
        if not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Only admins can delete priority definitions")
        
        db_priority = crud.delete_priority_definition(db, priority_id=priority_id)
        if db_priority is None:
            raise HTTPException(status_code=404, detail="Priority definition not found")
        return {"message": "Priority definition deleted successfully"}
