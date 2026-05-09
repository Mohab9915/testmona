#!/bin/bash

# Test Management System Installation Script
# This script sets up the entire system with all dependencies

set -e

echo "🚀 Starting Test Management System Installation..."

# Check if Python 3.13+ is installed
PYTHON_CMD=""
for cmd in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v $cmd &> /dev/null; then
        PYTHON_VERSION=$($cmd --version | awk '{print $2}')
        PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
        PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
        if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 13 ]; then
            PYTHON_CMD=$cmd
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "❌ Python 3.13+ is required but not found. Please install Python 3.13 or higher first."
    echo "   Current system python3 version: $(python3 --version 2>&1)"
    exit 1
fi

echo "✅ Using $PYTHON_CMD ($($PYTHON_CMD --version))"

# Check if Node.js 18+ is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed. Please install npm first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create virtual environment for backend
echo "📦 Setting up Python virtual environment..."
cd backend
$PYTHON_CMD -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "🔐 Creating environment file with SECRET_KEY..."
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    cat > .env << EOF
# Database Configuration
DATABASE_URL=sqlite:///./test_management.db

# Security
SECRET_KEY=$SECRET_KEY
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS Settings
ALLOWED_ORIGINS=http://localhost:3000
EOF
    echo "✅ Environment file created"
fi

cd ..

# Initialize database and seed demo user
echo "🗄️ Initializing database and seeding demo user..."
cd backend
source venv/bin/activate

# Run database initialization and seed data
python -c "
from app.database import init_db, SessionLocal
from app.models import User
from app.auth import get_password_hash
from app.crud import create_system_setting
from app.schemas import SystemSettingsCreate

# Initialize database tables
init_db()

# Seed data
db = SessionLocal()
try:
    # Create demo user if it doesn't exist
    existing_user = db.query(User).filter(User.email == 'demo@testmona.com').first()
    if not existing_user:
        demo_user = User(
            username='demo',
            email='demo@testmona.com',
            hashed_password=get_password_hash('demo123'),
            role='admin',
            is_active=True,
            is_superuser=True,
            force_password_change=True
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)
        print('✅ Demo user created successfully')
        
        # Initialize onboarding checklist for demo user
        from app.crud import initialize_onboarding_checklist
        initialize_onboarding_checklist(db, demo_user.id)
        print('✅ Onboarding checklist initialized for demo user')
    else:
        print('✅ Demo user already exists')
        # Ensure force_password_change is set for existing demo user
        if not hasattr(existing_user, 'force_password_change') or existing_user.force_password_change is None:
            existing_user.force_password_change = True
            db.commit()
            print('✅ Force password change flag set for existing demo user')
    
    # Create signup_enabled setting if it doesn't exist
    from app.models import SystemSettings as SystemSettingsModel
    existing_setting = db.query(SystemSettingsModel).filter(SystemSettingsModel.key == 'signup_enabled').first()
    if not existing_setting:
        signup_setting = SystemSettingsCreate(
            key='signup_enabled',
            value='true',
            description='Enable/disable public user registration'
        )
        create_system_setting(db, signup_setting)
        print('✅ Signup enabled setting created')
    else:
        print('✅ Signup enabled setting already exists')
    
    # Initialize onboarding checklist for existing users (migration)
    from app.models import User, OnboardingChecklist
    from app.crud import initialize_onboarding_checklist
    existing_users = db.query(User).all()
    for user in existing_users:
        existing_checklist = db.query(OnboardingChecklist).filter(
            OnboardingChecklist.user_id == user.id
        ).first()
        if not existing_checklist:
            try:
                initialize_onboarding_checklist(db, user.id)
                print(f'✅ Onboarding checklist initialized for user {user.username}')
            except Exception as e:
                print(f'Failed to initialize onboarding checklist for user {user.username}: {e}')
finally:
    db.close()
"

cd ..

# Setup frontend
echo "📦 Setting up frontend dependencies..."
cd frontend
npm install

# Build frontend for production
echo "🏗️ Building frontend..."
npm run build

cd ..

echo "✅ Installation completed successfully!"
echo ""
echo "🎉 Test Management System is ready to use!"
echo ""
echo "📋 Next Steps:"
echo "1. Start the backend server:"
echo "   cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo ""
echo "2. Start the frontend server (for development):"
echo "   cd frontend && npm run dev"
echo ""
echo "3. Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   API Documentation: http://localhost:8000/docs"
echo ""
echo "🔑 Default Login:"
echo "   Email: demo@testmona.com"
echo "   Password: demo123"
echo ""
echo "⚠️  Please change the default admin password after first login!"
