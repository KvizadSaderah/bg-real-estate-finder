#!/bin/bash

# Real Estate Database Setup Script
# This script creates and configures the PostgreSQL database from scratch

set -e  # Exit on any error

echo "🏗️  Real Estate Database Setup Script"
echo "=================================="

# Configuration
DB_NAME="real_estate"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if PostgreSQL is installed and running
check_postgresql() {
    log_info "Checking PostgreSQL installation..."
    
    if ! command -v psql &> /dev/null; then
        log_error "PostgreSQL is not installed. Please install PostgreSQL first."
        echo "On macOS: brew install postgresql"
        echo "On Ubuntu: sudo apt-get install postgresql postgresql-contrib"
        exit 1
    fi
    
    if ! pg_isready -h $DB_HOST -p $DB_PORT &> /dev/null; then
        log_error "PostgreSQL server is not running on $DB_HOST:$DB_PORT"
        echo "Start PostgreSQL service:"
        echo "On macOS: brew services start postgresql"
        echo "On Ubuntu: sudo systemctl start postgresql"
        exit 1
    fi
    
    log_success "PostgreSQL is installed and running"
}

# Check if database exists
database_exists() {
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME
}

# Create database if it doesn't exist
create_database() {
    log_info "Checking if database '$DB_NAME' exists..."
    
    if database_exists; then
        log_warning "Database '$DB_NAME' already exists"
        read -p "Do you want to recreate it? This will DELETE ALL DATA! (y/N): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Dropping existing database..."
            dropdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
            log_success "Database dropped"
        else
            log_info "Using existing database"
            return 0
        fi
    fi
    
    log_info "Creating database '$DB_NAME'..."
    createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
    log_success "Database '$DB_NAME' created successfully"
}

# Create tables using schema
create_tables() {
    log_info "Creating database tables..."
    
    if [ ! -f "src/database/schema.sql" ]; then
        log_error "Schema file 'src/database/schema.sql' not found!"
        log_error "Please run this script from the project root directory"
        exit 1
    fi
    
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f src/database/schema.sql > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        log_success "Database tables created successfully"
    else
        log_warning "Some tables may already exist (this is normal)"
    fi
}

# Verify database setup
verify_setup() {
    log_info "Verifying database setup..."
    
    # Check if tables exist
    TABLES=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('properties', 'property_pricing', 'property_details', 'scraping_sessions')
    ")
    
    if [ "$TABLES" -eq 4 ]; then
        log_success "All required tables exist"
    else
        log_error "Missing required tables. Expected 4, found $TABLES"
        exit 1
    fi
    
    # Test connection with Node.js app
    log_info "Testing database connection with application..."
    if npm run db:status > /dev/null 2>&1; then
        log_success "Application can connect to database"
    else
        log_warning "Application connection test failed. Check your .env configuration"
    fi
}

# Create .env file if it doesn't exist
create_env_file() {
    log_info "Checking environment configuration..."
    
    if [ ! -f ".env" ]; then
        log_info "Creating .env file from template..."
        cp .env.example .env
        
        # Update database configuration in .env
        sed -i.bak "s/DB_HOST=localhost/DB_HOST=$DB_HOST/" .env
        sed -i.bak "s/DB_PORT=5432/DB_PORT=$DB_PORT/" .env
        sed -i.bak "s/DB_NAME=real_estate/DB_NAME=$DB_NAME/" .env
        sed -i.bak "s/DB_USER=postgres/DB_USER=$DB_USER/" .env
        rm .env.bak
        
        log_success ".env file created with database configuration"
        log_warning "Please review and update .env file with your specific settings"
    else
        log_info ".env file already exists"
    fi
}

# Install Node.js dependencies
install_dependencies() {
    log_info "Installing Node.js dependencies..."
    
    if [ ! -f "package.json" ]; then
        log_error "package.json not found! Are you in the correct directory?"
        exit 1
    fi
    
    npm install > /dev/null 2>&1
    log_success "Dependencies installed"
}

# Show usage instructions
show_usage() {
    echo ""
    echo "🎉 Database setup completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Review your .env file configuration"
    echo "2. Test the setup: npm run db:status"
    echo "3. Run your first scan: npm run scan:db"
    echo "4. Start the scheduler: npm run scheduler"
    echo ""
    echo "📊 Available commands:"
    echo "• npm run db:status  - Check database status"
    echo "• npm run scan:db    - Run property scan with database saving"
    echo "• npm run stats      - View property statistics"
    echo "• npm run scheduler  - Start automated data collection"
    echo ""
    echo "📁 Database info:"
    echo "• Database: $DB_NAME"
    echo "• Host: $DB_HOST:$DB_PORT"
    echo "• User: $DB_USER"
    echo ""
}

# Main execution
main() {
    echo ""
    log_info "Starting database setup process..."
    echo ""
    
    check_postgresql
    create_database
    create_tables
    create_env_file
    install_dependencies
    verify_setup
    
    show_usage
}

# Run main function
main "$@"