#!/usr/bin/env python3
"""
Create sample sections and assign test cases to sections
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import TestCaseSection, TestCase, TestSuite

def create_sample_sections():
    """Create sample sections and assign test cases"""
    db = SessionLocal()
    
    try:
        # Get existing test suite
        test_suite = db.query(TestSuite).first()
        if not test_suite:
            print("No test suite found. Please run seed_data.py first.")
            return
        
        print(f"Using test suite: {test_suite.name}")
        
        # Create main sections
        section1 = TestCaseSection(
            name="Authentication",
            description="Authentication related test cases",
            test_suite_id=test_suite.id,
            order_index=1
        )
        section2 = TestCaseSection(
            name="User Management",
            description="User management test cases", 
            test_suite_id=test_suite.id,
            order_index=2
        )
        section3 = TestCaseSection(
            name="API Testing",
            description="API endpoint testing",
            test_suite_id=test_suite.id,
            order_index=3
        )
        
        db.add_all([section1, section2, section3])
        db.commit()
        db.refresh(section1)
        db.refresh(section2)
        db.refresh(section3)
        
        # Create subsections
        subsection1 = TestCaseSection(
            name="Login",
            description="Login functionality tests",
            test_suite_id=test_suite.id,
            parent_section_id=section1.id,
            order_index=1
        )
        subsection2 = TestCaseSection(
            name="Registration",
            description="User registration tests",
            test_suite_id=test_suite.id,
            parent_section_id=section1.id,
            order_index=2
        )
        
        db.add_all([subsection1, subsection2])
        db.commit()
        db.refresh(subsection1)
        db.refresh(subsection2)
        
        # Get existing test cases and assign them to sections
        test_cases = db.query(TestCase).all()
        
        if not test_cases:
            # Create some test cases if none exist
            for i in range(5):
                test_case = TestCase(
                    title=f"Test Case {i+1}",
                    description=f"This is test case {i+1} with a very long description to test the truncation functionality in the modal interface",
                    test_type="manual",
                    preconditions="User is authenticated",
                    steps=f"1. Navigate to test case {i+1}\n2. Execute test\n3. Verify results",
                    expected_result="Test should pass successfully",
                    priority="medium" if i % 2 == 0 else "high",
                    status="active",
                    test_suite_id=test_suite.id,
                    section_id=section1.id if i < 2 else section2.id,
                    created_by=1
                )
                db.add(test_case)
            
            db.commit()
            test_cases = db.query(TestCase).all()
        
        # Assign test cases to sections
        for i, test_case in enumerate(test_cases):
            if i == 0:
                test_case.section_id = subsection1.id  # Login
            elif i == 1:
                test_case.section_id = subsection2.id  # Registration
            elif i == 2:
                test_case.section_id = section2.id      # User Management
            else:
                test_case.section_id = section3.id      # API Testing
        
        db.commit()
        
        print("Sample sections created successfully!")
        print(f"Created sections: {[s.name for s in [section1, section2, section3]]}")
        print(f"Created subsections: {[s.name for s in [subsection1, subsection2]]}")
        print(f"Assigned {len(test_cases)} test cases to sections")
        
    except Exception as e:
        print(f"Error creating sections: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_sample_sections()
