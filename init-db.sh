#!/bin/bash
set -e

echo "Initializing database..."

# Create extensions if needed
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable required extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- Create initial schema if needed
    -- This script can be used to run initial SQL setup
EOSQL

echo "Database initialization completed."
