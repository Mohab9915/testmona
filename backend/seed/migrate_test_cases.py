#!/usr/bin/env python3
"""
Migration script to update existing test cases with default values for preconditions, steps, and expected_result
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import TestCase

def migrate_test_cases():
    """Update existing test cases with default values"""
    db = SessionLocal()
    
    try:
        # Get all test cases with None or empty string values for required fields
        test_cases = db.query(TestCase).filter(
            (TestCase.preconditions.is_(None)) | (TestCase.preconditions == "") |
            (TestCase.steps.is_(None)) | (TestCase.steps == "") |
            (TestCase.expected_result.is_(None)) | (TestCase.expected_result == "")
        ).all()
        
        print(f"Found {len(test_cases)} test cases needing migration")
        
        updated_count = 0
        for test_case in test_cases:
            needs_update = False
            
            if test_case.preconditions is None or test_case.preconditions == "":
                test_case.preconditions = "No preconditions defined"
                needs_update = True
            
            if test_case.steps is None or test_case.steps == "":
                test_case.steps = "No steps defined"
                needs_update = True
            
            if test_case.expected_result is None or test_case.expected_result == "":
                test_case.expected_result = "No expected results defined"
                needs_update = True
            
            if needs_update:
                updated_count += 1
                print(f"Updated test case {test_case.id}: {test_case.title}")
        
        if updated_count > 0:
            db.commit()
            print(f"\n✅ Successfully migrated {updated_count} test cases")
        else:
            print("\nℹ️ No test cases needed migration")
        
        return updated_count
        
    except Exception as e:
        print(f"❌ Error migrating test cases: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
        return 0
    finally:
        db.close()

if __name__ == "__main__":
    migrate_test_cases()
