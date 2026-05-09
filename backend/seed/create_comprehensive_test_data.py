#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import random
from datetime import datetime, timedelta
from app.auth import get_password_hash

def create_comprehensive_test_data():
    """Create comprehensive test data with multiple projects, sections, and test cases"""
    
    db_path = "test_management.db"
    
    # Check if database exists, if not create it
    if not os.path.exists(db_path):
        print("Database not found. Please run seed/create_simple_test_data.py first.")
        return
    
    # Create database connection
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Test case data templates
        test_case_templates = {
            'Authentication': [
                {
                    'title': 'User Login with Valid Credentials',
                    'description': 'Verify user can login with correct username and password',
                    'steps': '''1. Navigate to login page
2. Enter valid username
3. Enter valid password
4. Click login button
5. Verify successful login''',
                    'expected_result': 'User should be successfully logged in and redirected to dashboard',
                    'priority': 'high'
                },
                {
                    'title': 'User Login with Invalid Password',
                    'description': 'Verify login fails with incorrect password',
                    'steps': '''1. Navigate to login page
2. Enter valid username
3. Enter invalid password
4. Click login button
5. Verify error message''',
                    'expected_result': 'Login should fail with appropriate error message',
                    'priority': 'high'
                },
                {
                    'title': 'User Registration with Valid Data',
                    'description': 'Verify new user can register with valid information',
                    'steps': '''1. Navigate to registration page
2. Fill all required fields with valid data
3. Click register button
4. Verify email confirmation
5. Verify account created''',
                    'expected_result': 'User should be successfully registered and receive confirmation',
                    'priority': 'medium'
                },
                {
                    'title': 'Password Reset Functionality',
                    'description': 'Verify user can reset forgotten password',
                    'steps': '''1. Navigate to login page
2. Click "Forgot Password" link
3. Enter registered email
4. Submit request
5. Check email for reset link
6. Follow reset link and set new password''',
                    'expected_result': 'User should receive password reset email and be able to set new password',
                    'priority': 'medium'
                },
                {
                    'title': 'Session Timeout Handling',
                    'description': 'Verify session expires after inactivity',
                    'steps': '''1. Login with valid credentials
2. Wait for session timeout period
3. Try to access protected page
4. Verify redirect to login
5. Verify session expired message''',
                    'expected_result': 'User should be logged out and redirected to login with timeout message',
                    'priority': 'low'
                }
            ],
            'API Testing': [
                {
                    'title': 'GET Endpoint Response Validation',
                    'description': 'Verify API returns correct response format and status codes',
                    'steps': '''1. Send GET request to API endpoint
2. Verify response status code is 200
3. Verify response contains expected fields
4. Verify response data format is correct
5. Verify response time is acceptable''',
                    'expected_result': 'API should return 200 status with properly formatted response',
                    'priority': 'high'
                },
                {
                    'title': 'POST Endpoint with Valid Data',
                    'description': 'Verify API handles POST requests with valid data correctly',
                    'steps': '''1. Prepare valid request data
2. Send POST request to endpoint
3. Verify response status code is 201
4. Verify resource is created
5. Verify response contains created resource data''',
                    'expected_result': 'API should create resource and return 201 status with resource data',
                    'priority': 'high'
                },
                {
                    'title': 'API Authentication Validation',
                    'description': 'Verify API properly validates authentication tokens',
                    'steps': '''1. Send request without authentication
2. Verify 401 status code
3. Send request with invalid token
4. Verify 401 status code
5. Send request with valid token
6. Verify successful response''',
                    'expected_result': 'API should reject unauthenticated requests and accept valid ones',
                    'priority': 'critical'
                },
                {
                    'title': 'Rate Limiting Test',
                    'description': 'Verify API implements rate limiting for abuse prevention',
                    'steps': '''1. Send multiple rapid requests to endpoint
2. Monitor response status codes
3. Verify rate limit is enforced after threshold
4. Verify rate limit headers are present
5. Wait for rate limit reset
6. Verify requests work again after reset''',
                    'expected_result': 'API should enforce rate limiting and recover after reset period',
                    'priority': 'medium'
                }
            ],
            'UI Testing': [
                {
                    'title': 'Responsive Design Validation',
                    'description': 'Verify application displays correctly on different screen sizes',
                    'steps': '''1. Open application on desktop browser
2. Resize browser to tablet size
3. Verify layout adapts correctly
4. Resize to mobile size
5. Verify mobile layout works
6. Test on different browsers''',
                    'expected_result': 'Application should be fully responsive across all screen sizes',
                    'priority': 'high'
                },
                {
                    'title': 'Form Validation Testing',
                    'description': 'Verify forms properly validate user input',
                    'steps': '''1. Submit form with empty required fields
2. Verify validation errors appear
3. Submit form with invalid email format
4. Verify email validation error
5. Submit form with valid data
6. Verify successful submission''',
                    'expected_result': 'Forms should validate input correctly and show appropriate error messages',
                    'priority': 'high'
                },
                {
                    'title': 'Navigation Menu Functionality',
                    'description': 'Verify navigation menu works correctly on all pages',
                    'steps': '''1. Click each navigation item
2. Verify correct page loads
3. Test breadcrumb navigation
4. Test back/forward browser buttons
5. Test mobile hamburger menu
6. Verify all links are accessible''',
                    'expected_result': 'Navigation should work seamlessly across all pages and devices',
                    'priority': 'medium'
                }
            ],
            'Performance Testing': [
                {
                    'title': 'Page Load Time Measurement',
                    'description': 'Verify pages load within acceptable time limits',
                    'steps': '''1. Clear browser cache
2. Navigate to each major page
3. Measure load time with developer tools
4. Verify all pages load under 3 seconds
5. Test with slow network simulation
6. Verify acceptable performance on 3G''',
                    'expected_result': 'All pages should load within acceptable time limits',
                    'priority': 'medium'
                },
                {
                    'title': 'Database Query Performance',
                    'description': 'Verify database queries execute efficiently',
                    'steps': '''1. Monitor database query times
2. Test with large datasets
3. Verify query execution times
4. Check for slow queries
5. Optimize identified slow queries
6. Verify improved performance''',
                    'expected_result': 'Database queries should execute efficiently even with large datasets',
                    'priority': 'medium'
                }
            ],
            'Security Testing': [
                {
                    'title': 'SQL Injection Prevention',
                    'description': 'Verify application is protected against SQL injection attacks',
                    'steps': '''1. Attempt SQL injection in login form
2. Try malicious SQL in search fields
3. Test SQL injection in API parameters
4. Verify no database errors are exposed
5. Verify queries are properly escaped
6. Test with various SQL injection payloads''',
                    'expected_result': 'Application should reject all SQL injection attempts',
                    'priority': 'critical'
                },
                {
                    'title': 'XSS Protection Validation',
                    'description': 'Verify application prevents cross-site scripting attacks',
                    'steps': '''1. Submit XSS payload in text fields
2. Try script tags in comments
3. Test XSS in user profiles
4. Verify scripts are not executed
5. Check HTML encoding in output
6. Test various XSS vectors''',
                    'expected_result': 'Application should properly sanitize and escape all user input',
                    'priority': 'critical'
                },
                {
                    'title': 'CSRF Token Validation',
                    'description': 'Verify CSRF protection is implemented for state-changing operations',
                    'steps': '''1. Submit form without CSRF token
2. Verify request is rejected
3. Submit form with invalid CSRF token
4. Verify request is rejected
5. Submit form with valid CSRF token
6. Verify request succeeds''',
                    'expected_result': 'Application should reject requests without valid CSRF tokens',
                    'priority': 'high'
                }
            ],
            'Integration Testing': [
                {
                    'title': 'Third-Party API Integration',
                    'description': 'Verify integration with external services works correctly',
                    'steps': '''1. Test third-party API calls
2. Verify error handling for API failures
3. Test retry logic for failed requests
4. Verify data transformation is correct
5. Test rate limiting handling
6. Verify authentication with external services''',
                    'expected_result': 'Third-party integrations should work reliably with proper error handling',
                    'priority': 'high'
                },
                {
                    'title': 'Database Connection Pool',
                    'description': 'Verify database connection pool handles concurrent requests',
                    'steps': '''1. Generate multiple concurrent requests
2. Monitor database connections
3. Verify connection pool limits
4. Test connection reuse
5. Test connection timeout handling
6. Verify no connection leaks''',
                    'expected_result': 'Database connection pool should efficiently handle concurrent requests',
                    'priority': 'medium'
                }
            ],
            'Regression Testing': [
                {
                    'title': 'Core Functionality Regression',
                    'description': 'Verify core features still work after recent changes',
                    'steps': '''1. Test user registration flow
2. Test user login flow
3. Test basic CRUD operations
4. Test search functionality
5. Test file upload/download
6. Verify all core features work''',
                    'expected_result': 'All core functionality should work as expected after changes',
                    'priority': 'high'
                },
                {
                    'title': 'UI Regression Testing',
                    'description': 'Verify UI elements display correctly after updates',
                    'steps': '''1. Check all page layouts
2. Verify responsive design
3. Test all buttons and forms
4. Check color schemes and fonts
5. Verify accessibility features
6. Test on different browsers''',
                    'expected_result': 'UI should display correctly across all platforms and browsers',
                    'priority': 'medium'
                }
            ]
        }
        
        # Get existing projects and test suites
        cursor.execute("SELECT id, name FROM projects")
        projects = cursor.fetchall()
        
        if not projects:
            print("No projects found. Please run seed/create_simple_test_data.py first.")
            return
        
        cursor.execute("SELECT id, name, project_id FROM test_suites")
        test_suites = cursor.fetchall()
        
        if not test_suites:
            print("No test suites found. Please run create_simple_test_data.py first.")
            return
        
        # Create sections and subsections for each test suite
        test_cases_created = 0
        sections_created = 0
        
        for project_id, project_name in projects:
            print(f"\n📁 Creating test data for project: {project_name}")
            
            # Get test suites for this project
            project_suites = [(ts_id, ts_name) for ts_id, ts_name, ts_project_id in test_suites if ts_project_id == project_id]
            
            for test_suite_id, test_suite_name in project_suites:
                print(f"  📋 Processing test suite: {test_suite_name}")
                
                # Create sections based on test case categories
                for category_name, test_cases in test_case_templates.items():
                    # Create main section
                    cursor.execute('''
                        INSERT INTO test_case_sections (name, description, test_suite_id)
                        VALUES (?, ?, ?)
                    ''', (category_name, f"Test cases for {category_name} functionality", test_suite_id))
                    
                    main_section_id = cursor.lastrowid
                    sections_created += 1
                    
                    print(f"    📂 Created section: {category_name}")
                    
                    # Create subsections for better organization
                    subsections = []
                    if len(test_cases) > 3:
                        # Split into subsections if there are many test cases
                        mid_point = len(test_cases) // 2
                        
                        # Create first subsection
                        cursor.execute('''
                            INSERT INTO test_case_sections (name, description, test_suite_id, parent_section_id)
                            VALUES (?, ?, ?, ?)
                        ''', (f"{category_name} - Part 1", f"First half of {category_name} test cases", test_suite_id, main_section_id))
                        
                        subsection1_id = cursor.lastrowid
                        subsections.append(subsection1_id)
                        
                        # Create second subsection
                        cursor.execute('''
                            INSERT INTO test_case_sections (name, description, test_suite_id, parent_section_id)
                            VALUES (?, ?, ?, ?)
                        ''', (f"{category_name} - Part 2", f"Second half of {category_name} test cases", test_suite_id, main_section_id))
                        
                        subsection2_id = cursor.lastrowid
                        subsections.append(subsection2_id)
                        
                        print(f"      📂 Created subsections: {category_name} - Part 1 & 2")
                    
                    # Create test cases
                    for i, test_case in enumerate(test_cases):
                        # Determine which section to place this test case
                        if subsections:
                            # Place in subsections
                            section_id = subsections[0] if i < mid_point else subsections[1]
                        else:
                            # Place in main section
                            section_id = main_section_id
                        
                        # Add some variation to test case data
                        priority_variants = ['critical', 'high', 'medium', 'low']
                        priority = test_case.get('priority', 'medium')
                        if random.random() < 0.3:  # 30% chance to change priority
                            priority = random.choice(priority_variants)
                        
                        # Create test case with additional details
                        cursor.execute('''
                            INSERT INTO test_cases (title, description, test_suite_id, priority, 
                                              preconditions, steps, expected_result, test_type)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            test_case['title'],
                            test_case['description'],
                            test_suite_id,
                            priority,
                            f"Precondition for {test_case['title'].lower()}",
                            test_case['steps'],
                            test_case['expected_result'],
                            random.choice(['manual', 'automated', 'regression'])
                        ))
                        
                        test_cases_created += 1
                        
                        if test_cases_created % 10 == 0:
                            print(f"      ✅ Created {test_cases_created} test cases...")
        
        conn.commit()
        
        print(f"\n✅ Test data creation completed!")
        print(f"📊 Statistics:")
        print(f"   - Projects: {len(projects)}")
        print(f"   - Test Suites: {len(test_suites)}")
        print(f"   - Sections Created: {sections_created}")
        print(f"   - Test Cases Created: {test_cases_created}")
        
        # Show breakdown by project
        print(f"\n📈 Test Cases by Project:")
        for project_id, project_name in projects:
            project_suites = [(ts_id, ts_name) for ts_id, ts_name, ts_project_id in test_suites if ts_project_id == project_id]
            project_test_cases = 0
            
            for test_suite_id, _ in project_suites:
                cursor.execute("SELECT COUNT(*) FROM test_cases WHERE test_suite_id = ?", (test_suite_id,))
                count = cursor.fetchone()[0]
                project_test_cases += count
            
            print(f"   - {project_name}: {project_test_cases} test cases")
        
        print(f"\n🎯 Ready for testing!")
        print(f"🌐 Visit: http://localhost:3000/projects")
        
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    create_comprehensive_test_data()
