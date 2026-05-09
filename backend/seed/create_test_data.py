#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app import models, crud, schemas
from app.auth import get_password_hash

def create_test_data():
    db = SessionLocal()
    
    try:
        # Delete existing admin user with wrong role
        existing_admin = db.query(models.User).filter(models.User.username == "admin").first()
        if existing_admin:
            db.delete(existing_admin)
            db.commit()
            print(f"🗑️ Deleted existing admin user with wrong role")
        
        # Create admin user
        admin_user = models.User(
            username="admin",
            email="admin@testmona.com",
            hashed_password=get_password_hash("admin123"),
            is_superuser=True,
            role=models.Role.ADMIN
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        print(f"✅ Created admin user: {admin_user.username}")
        
        # Create a project
        project = db.query(models.Project).filter(models.Project.name == "Demo Project").first()
        if not project:
            project = models.Project(
                name="Demo Project",
                description="Demo project for testing sections",
                owner_id=admin_user.id
            )
            db.add(project)
            db.commit()
            db.refresh(project)
            print(f"✅ Created project: {project.name}")
        else:
            print(f"✅ Using existing project: {project.name}")
        
        # Create project assignment for admin
        assignment = db.query(models.ProjectAssignment).filter(
            models.ProjectAssignment.user_id == admin_user.id,
            models.ProjectAssignment.project_id == project.id
        ).first()
        if not assignment:
            assignment = models.ProjectAssignment(
                user_id=admin_user.id,
                project_id=project.id,
                role=models.Role.ADMIN
            )
            db.add(assignment)
            db.commit()
            print(f"✅ Created project assignment for admin")
        
        # Create a test suite
        test_suite = db.query(models.TestSuite).filter(
            models.TestSuite.project_id == project.id,
            models.TestSuite.name == "Default Test Suite"
        ).first()
        if not test_suite:
            test_suite = models.TestSuite(
                name="Default Test Suite",
                description="Default test suite for demo",
                project_id=project.id
            )
            db.add(test_suite)
            db.commit()
            db.refresh(test_suite)
            print(f"✅ Created test suite: {test_suite.name}")
        else:
            print(f"✅ Using existing test suite: {test_suite.name}")
        
        # Create some sections
        sections_data = [
            {
                "name": "Authentication Tests",
                "description": "Tests for authentication functionality",
                "test_suite_id": test_suite.id,
                "parent_section_id": None
            },
            {
                "name": "Login Tests",
                "description": "Login related test cases",
                "test_suite_id": test_suite.id,
                "parent_section_id": None  # Will be updated to reference auth section
            },
            {
                "name": "Logout Tests", 
                "description": "Logout related test cases",
                "test_suite_id": test_suite.id,
                "parent_section_id": None  # Will be updated to reference auth section
            },
            {
                "name": "API Tests",
                "description": "Tests for API endpoints",
                "test_suite_id": test_suite.id,
                "parent_section_id": None
            }
        ]
        
        created_sections = {}
        for section_data in sections_data:
            section = db.query(models.TestCaseSection).filter(
                models.TestCaseSection.name == section_data["name"],
                models.TestCaseSection.test_suite_id == section_data["test_suite_id"]
            ).first()
            if not section:
                section = models.TestCaseSection(**section_data)
                db.add(section)
                db.commit()
                db.refresh(section)
                created_sections[section.name] = section
                print(f"✅ Created section: {section.name}")
            else:
                created_sections[section.name] = section
                print(f"✅ Using existing section: {section.name}")
        
        # Update parent-child relationships
        if "Authentication Tests" in created_sections:
            auth_section = created_sections["Authentication Tests"]
            if "Login Tests" in created_sections:
                login_section = created_sections["Login Tests"]
                login_section.parent_section_id = auth_section.id
                db.commit()
                print(f"✅ Set Login Tests as child of Authentication Tests")
            
            if "Logout Tests" in created_sections:
                logout_section = created_sections["Logout Tests"]
                logout_section.parent_section_id = auth_section.id
                db.commit()
                print(f"✅ Set Logout Tests as child of Authentication Tests")
        
        print(f"\n🎉 Test data created successfully!")
        print(f"📊 Project ID: {project.id}")
        print(f"📊 Test Suite ID: {test_suite.id}")
        print(f"📊 Admin User ID: {admin_user.id}")
        print(f"\n🔑 You can now login with:")
        print(f"   Username: admin")
        print(f"   Password: admin123")
        print(f"\n🌐 Visit: http://localhost:3000/projects/{project.id}/sections")
        
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_test_data()
