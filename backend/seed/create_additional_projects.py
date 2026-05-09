#!/usr/bin/env python3

import sqlite3
import os
import random
from datetime import datetime, timedelta
from app.auth import get_password_hash

def create_additional_projects():
    """Create additional projects with diverse test scenarios"""
    
    db_path = "test_management.db"
    
    if not os.path.exists(db_path):
        print("Database not found. Please run seed/create_simple_test_data.py first.")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Additional projects to create
        projects_data = [
            {
                'name': 'E-Commerce Platform',
                'description': 'Complete e-commerce solution with shopping cart, payments, and inventory management',
                'test_suites': [
                    {
                        'name': 'Shopping Cart',
                        'sections': [
                            {
                                'name': 'Cart Operations',
                                'test_cases': [
                                    {
                                        'title': 'Add Product to Cart',
                                        'description': 'Verify user can add products to shopping cart',
                                        'steps': '''1. Navigate to product page
2. Click "Add to Cart" button
3. Verify product appears in cart
4. Verify cart count updates
5. Verify product details are correct''',
                                        'expected_result': 'Product should be successfully added to cart with correct details',
                                        'priority': 'high'
                                    },
                                    {
                                        'title': 'Remove Product from Cart',
                                        'description': 'Verify user can remove products from shopping cart',
                                        'steps': '''1. Add product to cart
2. Navigate to cart page
3. Click "Remove" button
4. Verify product is removed
5. Verify cart total updates''',
                                        'expected_result': 'Product should be removed from cart and total updated',
                                        'priority': 'high'
                                    },
                                    {
                                        'title': 'Update Cart Quantity',
                                        'description': 'Verify user can change product quantity in cart',
                                        'steps': '''1. Add product to cart
2. Navigate to cart page
3. Change quantity to 3
4. Verify subtotal updates
5. Verify total updates correctly''',
                                        'expected_result': 'Cart should update quantities and totals correctly',
                                        'priority': 'medium'
                                    }
                                ]
                            },
                            {
                                'name': 'Checkout Process',
                                'test_cases': [
                                    {
                                        'title': 'Guest Checkout',
                                        'description': 'Verify guest users can complete checkout process',
                                        'steps': '''1. Add products to cart
2. Proceed to checkout as guest
3. Fill shipping information
4. Fill billing information
5. Select shipping method
6. Enter payment details
7. Complete purchase''',
                                        'expected_result': 'Guest user should successfully complete checkout',
                                        'priority': 'critical'
                                    },
                                    {
                                        'title': 'Registered User Checkout',
                                        'description': 'Verify registered users can complete checkout with saved addresses',
                                        'steps': '''1. Login as registered user
2. Add products to cart
3. Proceed to checkout
4. Select saved shipping address
5. Select saved payment method
6. Complete purchase''',
                                        'expected_result': 'Registered user should complete checkout with saved information',
                                        'priority': 'high'
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        'name': 'Payment Processing',
                        'sections': [
                            {
                                'name': 'Credit Card Payments',
                                'test_cases': [
                                    {
                                        'title': 'Valid Credit Card Payment',
                                        'description': 'Verify payment processing with valid credit card',
                                        'steps': '''1. Proceed to checkout
2. Select credit card payment
3. Enter valid card details
4. Enter valid billing address
5. Submit payment
6. Verify payment success''',
                                        'expected_result': 'Payment should be processed successfully',
                                        'priority': 'critical'
                                    },
                                    {
                                        'title': 'Invalid Credit Card Decline',
                                        'description': 'Verify payment decline with invalid credit card',
                                        'steps': '''1. Proceed to checkout
2. Select credit card payment
3. Enter invalid card number
4. Submit payment
5. Verify decline message
6. Verify user can retry payment''',
                                        'expected_result': 'Payment should be declined with appropriate error message',
                                        'priority': 'high'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                'name': 'Mobile Banking Application',
                'description': 'Secure mobile banking application with account management and transactions',
                'test_suites': [
                    {
                        'name': 'Account Management',
                        'sections': [
                            {
                                'name': 'Account Registration',
                                'test_cases': [
                                    {
                                        'title': 'New Account Registration',
                                        'description': 'Verify user can register for new banking account',
                                        'steps': '''1. Open banking app
2. Click "Register New Account"
3. Fill personal information
4. Verify identity documents
5. Set up security questions
6. Create login credentials
7. Accept terms and conditions''',
                                        'expected_result': 'User should successfully register new banking account',
                                        'priority': 'critical'
                                    },
                                    {
                                        'title': 'Account Verification',
                                        'description': 'Verify account verification process works correctly',
                                        'steps': '''1. Register new account
2. Check email for verification code
3. Enter verification code in app
4. Verify account is activated
5. Test login with new credentials''',
                                        'expected_result': 'Account should be verified and activated successfully',
                                        'priority': 'high'
                                    }
                                ]
                            },
                            {
                                'name': 'Security Features',
                                'test_cases': [
                                    {
                                        'title': 'Two-Factor Authentication',
                                        'description': 'Verify 2FA works for secure login',
                                        'steps': '''1. Enable 2FA in account settings
2. Logout and attempt login
3. Enter username and password
4. Enter 2FA code from authenticator app
5. Verify successful login''',
                                        'expected_result': '2FA should work correctly and enhance account security',
                                        'priority': 'critical'
                                    },
                                    {
                                        'title': 'Biometric Login',
                                        'description': 'Verify fingerprint/face recognition login',
                                        'steps': '''1. Enable biometric login
2. Logout of app
3. Attempt login with biometric
4. Verify successful authentication
5. Test biometric failure scenarios''',
                                        'expected_result': 'Biometric login should work when enabled and fail appropriately when disabled',
                                        'priority': 'medium'
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        'name': 'Transactions',
                        'sections': [
                            {
                                'name': 'Money Transfers',
                                'test_cases': [
                                    {
                                        'title': 'Internal Transfer',
                                        'description': 'Verify money transfer between user accounts',
                                        'steps': '''1. Login to banking app
2. Navigate to transfers
3. Select internal transfer
4. Enter recipient account number
5. Enter transfer amount
6. Add note and confirm transfer
7. Verify transfer success''',
                                        'expected_result': 'Internal transfer should complete successfully',
                                        'priority': 'high'
                                    },
                                    {
                                        'title': 'External Transfer',
                                        'description': 'Verify transfer to external bank accounts',
                                        'steps': '''1. Add external bank account
2. Navigate to transfers
3. Select external transfer
4. Choose external account
5. Enter amount and details
6. Confirm transfer
7. Verify processing status''',
                                        'expected_result': 'External transfer should be processed successfully',
                                        'priority': 'high'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                'name': 'Healthcare Management System',
                'description': 'Comprehensive healthcare management system with patient records and appointments',
                'test_suites': [
                    {
                        'name': 'Patient Management',
                        'sections': [
                            {
                                'name': 'Patient Registration',
                                'test_cases': [
                                    {
                                        'title': 'New Patient Registration',
                                        'description': 'Verify registration of new patients in the system',
                                        'steps': '''1. Navigate to patient registration
2. Enter patient demographics
3. Enter medical history
4. Enter insurance information
5. Add emergency contacts
6. Save patient record
7. Verify patient ID generation''',
                                        'expected_result': 'New patient should be registered with complete information',
                                        'priority': 'high'
                                    },
                                    {
                                        'title': 'Patient Record Update',
                                        'description': 'Verify updating existing patient information',
                                        'steps': '''1. Search for existing patient
2. Open patient record
3. Update contact information
4. Update medical history
5. Save changes
6. Verify updated information''',
                                        'expected_result': 'Patient record should be updated successfully',
                                        'priority': 'medium'
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        'name': 'Appointment Scheduling',
                        'sections': [
                            {
                                'name': 'Booking Appointments',
                                'test_cases': [
                                    {
                                        'title': 'Schedule New Appointment',
                                        'description': 'Verify scheduling appointments for patients',
                                        'steps': '''1. Select patient from list
2. Choose appointment type
3. Select available date and time
4. Select healthcare provider
5. Add appointment notes
6. Confirm appointment
7. Verify appointment details''',
                                        'expected_result': 'Appointment should be scheduled successfully',
                                        'priority': 'high'
                                    },
                                    {
                                        'title': 'Cancel Appointment',
                                        'description': 'Verify appointment cancellation process',
                                        'steps': '''1. View scheduled appointments
2. Select appointment to cancel
3. Enter cancellation reason
4. Confirm cancellation
5. Verify appointment status
6. Check for cancellation notifications''',
                                        'expected_result': 'Appointment should be cancelled with proper notifications',
                                        'priority': 'medium'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
        
        # Get admin user for project ownership
        cursor.execute("SELECT id FROM users WHERE username = 'admin'")
        admin_result = cursor.fetchone()
        
        if not admin_result:
            print("Admin user not found. Please run create_simple_test_data.py first.")
            return
        
        admin_id = admin_result[0]
        
        projects_created = 0
        test_suites_created = 0
        sections_created = 0
        test_cases_created = 0
        
        for project_data in projects_data:
            print(f"\n📁 Creating project: {project_data['name']}")
            
            # Create project
            cursor.execute('''
                INSERT INTO projects (name, description, owner_id)
                VALUES (?, ?, ?)
            ''', (project_data['name'], project_data['description'], admin_id))
            
            project_id = cursor.lastrowid
            projects_created += 1
            
            # Create project assignment for admin
            cursor.execute('''
                INSERT INTO project_assignments (user_id, project_id, role)
                VALUES (?, ?, ?)
            ''', (admin_id, project_id, 'ADMIN'))
            
            # Create test suites
            for test_suite_data in project_data['test_suites']:
                print(f"  📋 Creating test suite: {test_suite_data['name']}")
                
                cursor.execute('''
                    INSERT INTO test_suites (name, description, project_id)
                    VALUES (?, ?, ?)
                ''', (test_suite_data['name'], f"Test suite for {test_suite_data['name']}", project_id))
                
                test_suite_id = cursor.lastrowid
                test_suites_created += 1
                
                # Create sections and test cases
                for section_data in test_suite_data['sections']:
                    print(f"    📂 Creating section: {section_data['name']}")
                    
                    # Create main section
                    cursor.execute('''
                        INSERT INTO test_case_sections (name, description, test_suite_id)
                        VALUES (?, ?, ?)
                    ''', (section_data['name'], f"Test cases for {section_data['name']}", test_suite_id))
                    
                    section_id = cursor.lastrowid
                    sections_created += 1
                    
                    # Create test cases
                    for test_case in section_data['test_cases']:
                        cursor.execute('''
                            INSERT INTO test_cases (title, description, test_suite_id, priority,
                                              preconditions, steps, expected_result, test_type, section_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            test_case['title'],
                            test_case['description'],
                            test_suite_id,
                            test_case['priority'],
                            f"Precondition for {test_case['title'].lower()}",
                            test_case['steps'],
                            test_case['expected_result'],
                            random.choice(['manual', 'automated', 'regression']),
                            section_id
                        ))
                        
                        test_cases_created += 1
                    
                    print(f"      ✅ Created {len(section_data['test_cases'])} test cases")
        
        conn.commit()
        
        print(f"\n✅ Additional projects creation completed!")
        print(f"📊 Statistics:")
        print(f"   - New Projects Created: {projects_created}")
        print(f"   - New Test Suites Created: {test_suites_created}")
        print(f"   - New Sections Created: {sections_created}")
        print(f"   - New Test Cases Created: {test_cases_created}")
        
        # Show total statistics
        cursor.execute("SELECT COUNT(*) FROM projects")
        total_projects = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM test_suites")
        total_suites = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM test_cases")
        total_test_cases = cursor.fetchone()[0]
        
        print(f"\n📈 Total Database Statistics:")
        print(f"   - Total Projects: {total_projects}")
        print(f"   - Total Test Suites: {total_suites}")
        print(f"   - Total Test Cases: {total_test_cases}")
        
        print(f"\n🎯 Ready for comprehensive testing!")
        print(f"🌐 Visit: http://localhost:3000/projects")
        
    except Exception as e:
        print(f"❌ Error creating additional projects: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    create_additional_projects()
