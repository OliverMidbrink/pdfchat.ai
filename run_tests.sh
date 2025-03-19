#!/bin/bash

# Run Authentication Tests Script for pdfchat.ai
# ----------------------------------------------
# This script runs all authentication tests including:
# 1. Backend unit tests
# 2. Backend API tests
# 3. Full integration tests
# 4. Frontend component tests (when available)

# Color definitions
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Track overall test results
PASSED=0
FAILED=0
TOTAL=0

print_header() {
  echo -e "\n${BOLD}${BLUE}$1${NC}\n"
  echo -e "${BLUE}$(printf '=%.0s' {1..50})${NC}\n"
}

print_result() {
  local test_name=$1
  local status=$2
  local duration=$3
  
  if [ "$status" -eq 0 ]; then
    echo -e "${GREEN}✓ PASS:${NC} $test_name ${BLUE}(${duration}s)${NC}"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL:${NC} $test_name ${BLUE}(${duration}s)${NC}"
    FAILED=$((FAILED + 1))
  fi
  
  TOTAL=$((TOTAL + 1))
}

run_test() {
  local test_name=$1
  local command=$2
  
  echo -e "\n${BOLD}Running test: $test_name${NC}"
  
  # Measure execution time
  local start_time=$(date +%s)
  
  # Run the test command
  eval $command
  local status=$?
  
  # Calculate duration
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))
  
  # Print the result
  print_result "$test_name" $status $duration
  
  return $status
}

# Check for Python and pytest
if ! command -v python3 &> /dev/null; then
  echo -e "${RED}Error: Python3 is required but not found in PATH${NC}"
  exit 1
fi

if ! python3 -c "import pytest" &> /dev/null; then
  echo -e "${YELLOW}Warning: pytest is not installed. Installing...${NC}"
  pip install pytest
fi

if ! python3 -c "import httpx" &> /dev/null; then
  echo -e "${YELLOW}Warning: httpx is not installed. Installing...${NC}"
  pip install httpx
fi

print_header "AUTHENTICATION TESTS"

echo -e "${BOLD}Testing environment:${NC}"
echo -e "  Python: $(python3 --version)"
echo -e "  Working directory: $(pwd)"

# Make sure backend and frontend are running
print_header "Checking Services"
echo -e "Ensuring backend and frontend are running..."
./manage.sh status

# Run Backend Unit Tests
print_header "Running Backend Unit Tests"
run_test "Backend Auth Functions" "python3 -m tests.backend.test_auth_functions"
backend_unit_result=$?

# Run Backend API Tests
print_header "Running Backend API Tests"
run_test "Backend Auth API" "python3 -m tests.backend.test_auth_api"
backend_api_result=$?

# Run Integration Tests
print_header "Running Integration Tests"
run_test "Full Auth Flow Integration Test" "python3 tests/integration/test_auth.py --verbose"
integration_result=$?

# Print Summary
print_header "TEST SUMMARY"
echo -e "Total tests run: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}${BOLD}All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}${BOLD}Some tests failed. See above for details.${NC}"
  exit 1
fi 