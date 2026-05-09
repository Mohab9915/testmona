#!/usr/bin/env python3

import sqlite3
import os
from app.auth import get_password_hash

def create_test_data_simple():
    db_path = "test_management.db"
    
    # Remove existing database if it has enum issues
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"🗑️ Removed existing database")
    
    # Create new database connection
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Create tables manually (simplified version)
        cursor.execute('''
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username VARCHAR(50) UNIQUE,
                email VARCHAR(100) UNIQUE,
                hashed_password VARCHAR(255),
                full_name VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE,
                is_superuser BOOLEAN DEFAULT FALSE,
                role VARCHAR(20) DEFAULT 'TESTER',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY,
                name VARCHAR(100),
                description TEXT,
                owner_id INTEGER,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE project_assignments (
                id INTEGER PRIMARY KEY,
                user_id INTEGER,
                project_id INTEGER,
                role VARCHAR(20) DEFAULT 'TESTER',
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (project_id) REFERENCES projects (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE test_suites (
                id INTEGER PRIMARY KEY,
                name VARCHAR(100),
                description TEXT,
                project_id INTEGER,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE test_case_sections (
                id INTEGER PRIMARY KEY,
                name VARCHAR(100),
                description TEXT,
                test_suite_id INTEGER,
                parent_section_id INTEGER,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (test_suite_id) REFERENCES test_suites (id),
                FOREIGN KEY (parent_section_id) REFERENCES test_case_sections (id)
            )
        ''')
        
        # Insert admin user
        hashed_password = get_password_hash("admin123")
        cursor.execute('''
            INSERT INTO users (username, email, hashed_password, is_superuser, role)
            VALUES (?, ?, ?, ?, ?)
        ''', ("admin", "admin@testmona.com", hashed_password, True, "ADMIN"))
        
        admin_id = cursor.lastrowid
        
        # Insert project
        cursor.execute('''
            INSERT INTO projects (name, description, owner_id)
            VALUES (?, ?, ?)
        ''', ("Demo Project", "Demo project for testing sections", admin_id))
        
        project_id = cursor.lastrowid
        
        # Insert project assignment
        cursor.execute('''
            INSERT INTO project_assignments (user_id, project_id, role)
            VALUES (?, ?, ?)
        ''', (admin_id, project_id, "ADMIN"))
        
        # Insert test suite
        cursor.execute('''
            INSERT INTO test_suites (name, description, project_id)
            VALUES (?, ?, ?)
        ''', ("Default Test Suite", "Default test suite for demo", project_id))
        
        test_suite_id = cursor.lastrowid
        
        # Insert sections
        cursor.execute('''
            INSERT INTO test_case_sections (name, description, test_suite_id)
            VALUES (?, ?, ?)
        ''', ("Authentication Tests", "Tests for authentication functionality", test_suite_id))
        
        auth_section_id = cursor.lastrowid
        
        cursor.execute('''
            INSERT INTO test_case_sections (name, description, test_suite_id, parent_section_id)
            VALUES (?, ?, ?, ?)
        ''', ("Login Tests", "Login related test cases", test_suite_id, auth_section_id))
        
        cursor.execute('''
            INSERT INTO test_case_sections (name, description, test_suite_id, parent_section_id)
            VALUES (?, ?, ?, ?)
        ''', ("Logout Tests", "Logout related test cases", test_suite_id, auth_section_id))
        
        cursor.execute('''
            INSERT INTO test_case_sections (name, description, test_suite_id)
            VALUES (?, ?, ?)
        ''', ("API Tests", "Tests for API endpoints", test_suite_id))
        
        conn.commit()
        
        print(f"✅ Created test data successfully!")
        print(f"📊 Project ID: {project_id}")
        print(f"📊 Test Suite ID: {test_suite_id}")
        print(f"📊 Admin User ID: {admin_id}")
        print(f"\n🔑 Login credentials:")
        print(f"   Username: admin")
        print(f"   Password: admin123")
        print(f"\n🌐 Visit: http://localhost:3000/projects/{project_id}/sections")
        
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    create_test_data_simple()
