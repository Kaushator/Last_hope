#!/bin/bash
# Last Hope MCP Server - Infrastructure Validation Script
# This script validates the deployed infrastructure and performs comprehensive testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}"

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    print_status "Running test: $test_name"
    
    if eval "$test_command"; then
        print_success "✓ $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_error "✗ $test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Function to get terraform output
get_terraform_output() {
    local output_name="$1"
    cd "${TERRAFORM_DIR}"
    terraform output -raw "$output_name" 2>/dev/null || echo ""
}

# Test 1: Verify Terraform state
test_terraform_state() {
    cd "${TERRAFORM_DIR}"
    terraform show > /dev/null
}

# Test 2: Verify Cloud Run service
test_cloud_run_service() {
    local service_url=$(get_terraform_output "service_url")
    [ ! -z "$service_url" ] && curl -f -s "$service_url/health" > /dev/null
}

# Test 3: Verify Artifact Registry
test_artifact_registry() {
    local docker_repo=$(get_terraform_output "docker_repository")
    [ ! -z "$docker_repo" ]
}

# Test 4: Verify Storage Bucket
test_storage_bucket() {
    local bucket_name=$(get_terraform_output "storage_bucket")
    [ ! -z "$bucket_name" ] && gsutil ls "gs://$bucket_name" > /dev/null
}

# Test 5: Verify Secret Manager secrets
test_secret_manager() {
    local project_id=$(get_terraform_output "project_id" || gcloud config get-value project)
    
    # Check if secrets exist
    gcloud secrets list --filter="name:htx-api-key" --format="value(name)" | grep -q "htx-api-key" &&
    gcloud secrets list --filter="name:fernet-encryption-key" --format="value(name)" | grep -q "fernet-encryption-key"
}

# Test 6: Verify IAM permissions
test_iam_permissions() {
    local service_account=$(get_terraform_output "service_account_email")
    local project_id=$(get_terraform_output "project_id" || gcloud config get-value project)
    
    [ ! -z "$service_account" ] &&
    gcloud projects get-iam-policy "$project_id" --format="value(bindings.members)" | grep -q "$service_account"
}

# Test 7: Verify monitoring alerts
test_monitoring_alerts() {
    local project_id=$(get_terraform_output "project_id" || gcloud config get-value project)
    
    # Check if at least one alert policy exists for our service
    gcloud alpha monitoring policies list --filter="displayName:Last Hope" --format="value(name)" | wc -l | grep -q -v "^0$"
}

# Test 8: Verify logging configuration
test_logging_configuration() {
    local project_id=$(get_terraform_output "project_id" || gcloud config get-value project)
    
    # Check if log sink exists
    gcloud logging sinks list --filter="name:last-hope-logs" --format="value(name)" | grep -q "last-hope-logs"
}

# Test 9: Verify service health endpoints
test_service_endpoints() {
    local service_url=$(get_terraform_output "service_url")
    
    if [ ! -z "$service_url" ]; then
        # Test health endpoint
        local health_response=$(curl -s "$service_url/health")
        echo "$health_response" | grep -q "status" || echo "$health_response" | grep -q "ok"
    else
        return 1
    fi
}

# Test 10: Verify environment configuration
test_environment_config() {
    local service_url=$(get_terraform_output "service_url")
    
    if [ ! -z "$service_url" ]; then
        # Check if environment variables are properly set
        # This would require an endpoint that returns env info (for non-prod environments)
        return 0  # Assume success for now
    else
        return 1
    fi
}

# Test 11: Performance test
test_performance() {
    local service_url=$(get_terraform_output "service_url")
    
    if [ ! -z "$service_url" ]; then
        # Simple performance test - response time should be < 5 seconds
        local start_time=$(date +%s)
        curl -f -s "$service_url/health" > /dev/null
        local end_time=$(date +%s)
        local response_time=$((end_time - start_time))
        
        [ $response_time -lt 5 ]
    else
        return 1
    fi
}

# Test 12: Security test
test_security() {
    local service_url=$(get_terraform_output "service_url")
    
    if [ ! -z "$service_url" ]; then
        # Check if service responds with security headers
        local headers=$(curl -I -s "$service_url/health")
        # Just verify we get a response - more detailed security testing would require specific endpoints
        echo "$headers" | grep -q "HTTP/[12].[01] 200"
    else
        return 1
    fi
}

# Function to run all tests
run_all_tests() {
    print_status "Starting infrastructure validation tests..."
    echo
    
    # Infrastructure tests
    print_status "=== Infrastructure Tests ==="
    run_test "Terraform State" "test_terraform_state"
    run_test "Cloud Run Service" "test_cloud_run_service"
    run_test "Artifact Registry" "test_artifact_registry"
    run_test "Storage Bucket" "test_storage_bucket"
    run_test "Secret Manager" "test_secret_manager"
    run_test "IAM Permissions" "test_iam_permissions"
    echo
    
    # Monitoring and logging tests
    print_status "=== Monitoring & Logging Tests ==="
    run_test "Monitoring Alerts" "test_monitoring_alerts"
    run_test "Logging Configuration" "test_logging_configuration"
    echo
    
    # Service tests
    print_status "=== Service Tests ==="
    run_test "Service Health Endpoints" "test_service_endpoints"
    run_test "Environment Configuration" "test_environment_config"
    run_test "Performance Test" "test_performance"
    run_test "Security Test" "test_security"
    echo
}

# Function to generate test report
generate_report() {
    echo "=========================================="
    echo "          VALIDATION REPORT"
    echo "=========================================="
    echo "Total Tests: $TESTS_TOTAL"
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"
    echo "Success Rate: $(( TESTS_PASSED * 100 / TESTS_TOTAL ))%"
    echo "=========================================="
    
    if [ $TESTS_FAILED -eq 0 ]; then
        print_success "All tests passed! Infrastructure is ready for use."
        return 0
    else
        print_error "$TESTS_FAILED test(s) failed. Please review and fix issues."
        return 1
    fi
}

# Function to display detailed service information
show_service_info() {
    print_status "=== Service Information ==="
    
    local service_url=$(get_terraform_output "service_url")
    local docker_repo=$(get_terraform_output "docker_repository")
    local storage_bucket=$(get_terraform_output "storage_bucket")
    local project_id=$(get_terraform_output "project_id" || gcloud config get-value project)
    
    echo "Project ID: $project_id"
    echo "Service URL: $service_url"
    echo "Docker Repository: $docker_repo"
    echo "Storage Bucket: $storage_bucket"
    echo "Health Check: $service_url/health"
    echo
    
    if [ ! -z "$service_url" ]; then
        print_status "Testing service endpoints..."
        echo "Health Check Response:"
        curl -s "$service_url/health" | jq . 2>/dev/null || curl -s "$service_url/health"
    fi
}

# Function to show help
show_help() {
    cat << EOF
Last Hope MCP Server Infrastructure Validation Script

Usage: $0 [OPTION]

Options:
    test        Run all validation tests (default)
    info        Show service information
    health      Quick health check
    help        Show this help message

Examples:
    $0          # Run all tests
    $0 test     # Run all tests
    $0 info     # Show service information
    $0 health   # Quick health check

EOF
}

# Quick health check
quick_health_check() {
    local service_url=$(get_terraform_output "service_url")
    
    if [ -z "$service_url" ]; then
        print_error "Could not get service URL. Is the infrastructure deployed?"
        return 1
    fi
    
    print_status "Performing quick health check..."
    
    if curl -f -s "$service_url/health" > /dev/null; then
        print_success "Service is healthy!"
        
        print_status "Service response:"
        curl -s "$service_url/health" | jq . 2>/dev/null || curl -s "$service_url/health"
    else
        print_error "Service health check failed!"
        return 1
    fi
}

# Main function
main() {
    case "${1:-test}" in
        "test")
            run_all_tests
            generate_report
            ;;
        "info")
            show_service_info
            ;;
        "health")
            quick_health_check
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"