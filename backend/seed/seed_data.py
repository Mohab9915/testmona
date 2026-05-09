#!/usr/bin/env python3
"""
Seed database with sample data
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, Project, TestSuite, TestCase

def seed_database():
    """Seed database with sample data"""
    db = SessionLocal()
    
    try:
        # Create sample user
        user = User(
            username="demo",
            email="demo@testmona.com",
            hashed_password="$2b$12$bIN4t7cLXlF.ZzR/1Od/EuxAYcXWvWNDyiXA/oBNZL7HugQWcg48O",
            role="admin"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create sample project
        project = Project(
            name="Demo Project",
            description="A demonstration project for testing",
            owner_id=user.id,
            status="ACTIVE"
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        
        # Create sample test suite
        test_suite = TestSuite(
            name="Test Suite 1",
            description="First test suite",
            project_id=project.id,
            status="ACTIVE"
        )
        db.add(test_suite)
        db.commit()
        db.refresh(test_suite)
        
        # Create sample test case
        test_case = TestCase(
            title="Sample Test Case",
            description="This is a sample test case",
            test_type="manual",
            preconditions="User is logged in",
            steps="1. Navigate to home page\n2. Click on test case\n3. Verify content",
            expected_result="Test case should be displayed correctly",
            priority="medium",
            status="active",
            test_suite_id=test_suite.id,
            created_by=user.id
        )
        db.add(test_case)
        db.commit()
        
        print("Sample data seeded successfully!")
        print(f"User: {user.username}")
        print(f"Project: {project.name}")
        print(f"Test Suite: {test_suite.name}")
        print(f"Test Case: {test_case.title}")
        
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
