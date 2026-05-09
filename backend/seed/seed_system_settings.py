#!/usr/bin/env python3
"""
Seed system settings with default values
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import SystemSettings

def seed_system_settings():
    """Seed database with default system settings"""
    db = SessionLocal()
    
    try:
        # Default system settings
        default_settings = [
            {
                'key': 'maintenance_mode',
                'value': 'false',
                'description': 'Enable/disable maintenance mode'
            },
            {
                'key': 'signup_enabled',
                'value': 'true',
                'description': 'Enable/disable public user registration'
            },
            {
                'key': 'debug_logging',
                'value': 'false',
                'description': 'Enable detailed logging for troubleshooting'
            },
            {
                'key': 'session_timeout',
                'value': '60',
                'description': 'Session timeout in minutes'
            },
            {
                'key': 'password_complexity',
                'value': 'high',
                'description': 'Password complexity requirement (low, medium, high)'
            }
        ]
        
        for setting_data in default_settings:
            existing = db.query(SystemSettings).filter(SystemSettings.key == setting_data['key']).first()
            if not existing:
                setting = SystemSettings(**setting_data)
                db.add(setting)
                print(f"Created system setting: {setting_data['key']}")
            else:
                print(f"System setting already exists: {setting_data['key']}")
        
        db.commit()
        print("System settings seeded successfully!")
        
    except Exception as e:
        print(f"Error seeding system settings: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_system_settings()
