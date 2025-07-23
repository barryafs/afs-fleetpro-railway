#!/bin/bash
# AFS FleetPro - Demo Data Loader
# This script loads demo data into your Railway-deployed AFS FleetPro system
# Usage: ./scripts/load-demo-data.sh [internal-api-url] [portal-api-url] [comms-api-url]

set -e  # Exit on any error

# Color codes for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  AFS FleetPro - Demo Data Loader       ${NC}"
echo -e "${BLUE}=========================================${NC}"

# Function to check if a URL is valid and accessible
check_url() {
    local url=$1
    if curl --output /dev/null --silent --head --fail "$url"; then
        return 0
    else
        return 1
    fi
}

# Function to load demo data for a specific service
load_demo_data() {
    local service_name=$1
    local base_url=$2
    local endpoint=$3

    echo -e "\n${YELLOW}Loading demo data for ${service_name}...${NC}"
    
    # Check if the URL is accessible
    if ! check_url "${base_url}/health"; then
        echo -e "${RED}Error: Cannot connect to ${service_name} at ${base_url}${NC}"
        echo -e "${YELLOW}Skipping ${service_name}...${NC}"
        return 1
    fi
    
    # Make the API call to load demo data
    response=$(curl -s -X POST "${base_url}${endpoint}")
    
    # Check if the response contains an error
    if echo "$response" | grep -q "error"; then
        echo -e "${RED}Failed to load demo data for ${service_name}:${NC}"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        return 1
    else
        echo -e "${GREEN}Successfully loaded demo data for ${service_name}!${NC}"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        return 0
    fi
}

# Parse command line arguments or use Railway URLs from environment
INTERNAL_API_URL=${1:-$RAILWAY_INTERNAL_API_URL}
PORTAL_API_URL=${2:-$RAILWAY_PORTAL_API_URL}
COMMS_API_URL=${3:-$RAILWAY_COMMS_API_URL}

# Check if URLs are provided
if [ -z "$INTERNAL_API_URL" ] || [ -z "$PORTAL_API_URL" ] || [ -z "$COMMS_API_URL" ]; then
    echo -e "${YELLOW}Some API URLs are missing. Please provide them as arguments:${NC}"
    echo -e "Usage: $0 [internal-api-url] [portal-api-url] [comms-api-url]"
    
    # Try to detect URLs from Railway CLI if installed
    echo -e "\n${YELLOW}Trying to detect URLs from Railway...${NC}"
    if command -v railway &> /dev/null; then
        echo -e "${BLUE}Railway CLI detected, attempting to get service URLs...${NC}"
        
        # Get Railway service URLs
        RAILWAY_SERVICES=$(railway service list 2>/dev/null)
        
        if [ $? -eq 0 ]; then
            INTERNAL_API_URL=$(echo "$RAILWAY_SERVICES" | grep internal-api | awk '{print $2}')
            PORTAL_API_URL=$(echo "$RAILWAY_SERVICES" | grep portal-api | awk '{print $2}')
            COMMS_API_URL=$(echo "$RAILWAY_SERVICES" | grep comms-api | awk '{print $2}')
            
            echo -e "Detected URLs:"
            echo -e "  Internal API: ${INTERNAL_API_URL:-Not found}"
            echo -e "  Portal API: ${PORTAL_API_URL:-Not found}"
            echo -e "  Comms API: ${COMMS_API_URL:-Not found}"
        else
            echo -e "${RED}Failed to get Railway service URLs. Please make sure you're logged in:${NC}"
            echo -e "  railway login"
            echo -e "  railway link"
        fi
    else
        echo -e "${YELLOW}Railway CLI not found. Install it with:${NC}"
        echo -e "  npm i -g @railway/cli"
        echo -e "Then login and link your project:"
        echo -e "  railway login"
        echo -e "  railway link"
    fi
    
    # Prompt for manual URL entry if still missing
    if [ -z "$INTERNAL_API_URL" ]; then
        echo -e "\n${YELLOW}Enter Internal API URL:${NC}"
        read -r INTERNAL_API_URL
    fi
    
    if [ -z "$PORTAL_API_URL" ]; then
        echo -e "\n${YELLOW}Enter Portal API URL:${NC}"
        read -r PORTAL_API_URL
    fi
    
    if [ -z "$COMMS_API_URL" ]; then
        echo -e "\n${YELLOW}Enter Comms API URL:${NC}"
        read -r COMMS_API_URL
    fi
fi

# Remove trailing slashes from URLs if present
INTERNAL_API_URL=${INTERNAL_API_URL%/}
PORTAL_API_URL=${PORTAL_API_URL%/}
COMMS_API_URL=${COMMS_API_URL%/}

echo -e "\n${BLUE}Using the following URLs:${NC}"
echo -e "  Internal API: ${INTERNAL_API_URL}"
echo -e "  Portal API: ${PORTAL_API_URL}"
echo -e "  Comms API: ${COMMS_API_URL}"

# Confirm with user
echo -e "\n${YELLOW}This will load demo data into your AFS FleetPro system.${NC}"
echo -e "${YELLOW}Continue? (y/n)${NC}"
read -r confirm

if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    echo -e "${RED}Operation cancelled.${NC}"
    exit 0
fi

# Load demo data for each service
success_count=0
total_services=3

# Internal API
if load_demo_data "Internal API" "$INTERNAL_API_URL" "/internal/v1/demo-data"; then
    ((success_count++))
fi

# Portal API
if load_demo_data "Portal API" "$PORTAL_API_URL" "/portal/v1/demo-data"; then
    ((success_count++))
fi

# Comms API
if load_demo_data "Comms API" "$COMMS_API_URL" "/comms/v1/demo-data"; then
    ((success_count++))
fi

# Summary
echo -e "\n${BLUE}=========================================${NC}"
if [ $success_count -eq $total_services ]; then
    echo -e "${GREEN}All demo data loaded successfully!${NC}"
else
    echo -e "${YELLOW}Loaded demo data for $success_count out of $total_services services.${NC}"
fi

# Display tracker demo URL
echo -e "\n${BLUE}Try the customer tracker demo:${NC}"
echo -e "${YELLOW}${PORTAL_API_URL}/portal/v1/tracker/demo1234567890abcdef1234567890ab${NC}"

# Display frontend URL if available
if [ -n "$RAILWAY_FRONTEND_URL" ]; then
    echo -e "\n${BLUE}Access the frontend:${NC}"
    echo -e "${YELLOW}${RAILWAY_FRONTEND_URL}${NC}"
fi

echo -e "\n${GREEN}Happy testing!${NC}"
