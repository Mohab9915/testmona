#!/bin/bash
set -e

# Wait for database to be ready if using PostgreSQL
if [[ "$DATABASE_URL" == postgresql* ]]; then
    echo "Waiting for PostgreSQL..."
    while ! nc -z $(echo $DATABASE_URL | sed 's/.*:\/\/\([^:]*\):.*/\1/') $(echo $DATABASE_URL | sed 's/.*:\([^\/]*\)\/.*/\1/'); do
        sleep 0.1
    done
    echo "PostgreSQL is ready!"
fi

# Run database migrations
echo "Running database migrations..."
python migrate.py --env prod upgrade

# Start the application
echo "Starting TestMona application..."
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
