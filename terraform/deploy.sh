#!/bin/bash
# Last Hope MCP Server - Deployment Script
# This script automates the deployment of the Last Hope MCP Server infrastructure

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}"
SERVICE_ACCOUNT_KEY="service-account-key.json"
TERRAFORM_VARS="terraform.tfvars"

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

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if required tools are installed
    local missing_tools=()
    
    if ! command -v terraform &> /dev/null; then
        missing_tools+=("terraform")
    fi
    
    if ! command -v gcloud &> /dev/null; then
        missing_tools+=("gcloud")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_error "Please install the missing tools and try again."
        exit 1
    fi
    
    # Check if service account key exists
    if [ ! -f "${TERRAFORM_DIR}/${SERVICE_ACCOUNT_KEY}" ]; then
        print_error "Service account key file not found: ${SERVICE_ACCOUNT_KEY}"
        print_error "Please follow the GCP_SETUP_GUIDE.md to create the service account key."
        exit 1
    fi
    
    # Check if terraform.tfvars exists
    if [ ! -f "${TERRAFORM_DIR}/${TERRAFORM_VARS}" ]; then
        print_error "Terraform variables file not found: ${TERRAFORM_VARS}"
        print_error "Please copy terraform.tfvars.example to terraform.tfvars and configure it."
        exit 1
    fi
    
    print_success "All prerequisites check passed!"
}

# Function to validate Terraform configuration
validate_terraform() {
    print_status "Validating Terraform configuration..."
    
    cd "${TERRAFORM_DIR}"
    
    # Initialize Terraform if not already done
    if [ ! -d ".terraform" ]; then
        print_status "Initializing Terraform..."
        terraform init
    fi
    
    # Validate configuration
    if terraform validate; then
        print_success "Terraform configuration is valid!"
    else
        print_error "Terraform configuration validation failed!"
        exit 1
    fi
}

# Function to plan deployment
plan_deployment() {
    print_status "Planning deployment..."
    
    cd "${TERRAFORM_DIR}"
    
    if terraform plan -out=tfplan; then
        print_success "Terraform plan completed successfully!"
        print_status "Review the plan above before proceeding with deployment."
    else
        print_error "Terraform plan failed!"
        exit 1
    fi
}

# Function to apply deployment
apply_deployment() {
    print_status "Applying deployment..."
    
    cd "${TERRAFORM_DIR}"
    
    if terraform apply tfplan; then
        print_success "Deployment completed successfully!"
        
        # Clean up plan file
        rm -f tfplan
        
        # Display outputs
        print_status "Deployment outputs:"
        terraform output
        
    else
        print_error "Deployment failed!"
        exit 1
    fi
}

# Function to set up secrets
setup_secrets() {
    print_status "Setting up secrets..."
    
    read -p "Do you want to set up API keys now? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Get project ID from terraform output
        PROJECT_ID=$(cd "${TERRAFORM_DIR}" && terraform output -raw project_id 2>/dev/null || echo "")
        
        if [ -z "$PROJECT_ID" ]; then
            read -p "Enter your GCP project ID: " PROJECT_ID
        fi
        
        gcloud config set project "$PROJECT_ID"
        
        # HTX API Key
        read -p "Enter HTX API Key (or press Enter to skip): " HTX_API_KEY
        if [ ! -z "$HTX_API_KEY" ]; then
            echo "$HTX_API_KEY" | gcloud secrets versions add htx-api-key --data-file=-
            print_success "HTX API key stored successfully!"
        fi
        
        # HTX API Secret
        read -p "Enter HTX API Secret (or press Enter to skip): " HTX_API_SECRET
        if [ ! -z "$HTX_API_SECRET" ]; then
            echo "$HTX_API_SECRET" | gcloud secrets versions add htx-api-secret --data-file=-
            print_success "HTX API secret stored successfully!"
        fi
        
        # OpenAI API Key
        read -p "Enter OpenAI API Key (or press Enter to skip): " OPENAI_API_KEY
        if [ ! -z "$OPENAI_API_KEY" ]; then
            echo "$OPENAI_API_KEY" | gcloud secrets versions add openai-api-key --data-file=-
            print_success "OpenAI API key stored successfully!"
        fi
        
        # CoinGecko API Key
        read -p "Enter CoinGecko API Key (or press Enter to skip): " COINGECKO_API_KEY
        if [ ! -z "$COINGECKO_API_KEY" ]; then
            echo "$COINGECKO_API_KEY" | gcloud secrets versions add coingecko-api-key --data-file=-
            print_success "CoinGecko API key stored successfully!"
        fi
        
        # Generate Fernet key
        print_status "Generating Fernet encryption key..."
        python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" | \
            gcloud secrets versions add fernet-encryption-key --data-file=-
        print_success "Fernet encryption key generated and stored successfully!"
    else
        print_warning "Skipping secret setup. You can set up secrets later using the gcloud CLI."
    fi
}

# Function to test deployment
test_deployment() {
    print_status "Testing deployment..."
    
    cd "${TERRAFORM_DIR}"
    
    # Get service URL from terraform output
    SERVICE_URL=$(terraform output -raw service_url 2>/dev/null || echo "")
    
    if [ -z "$SERVICE_URL" ]; then
        print_error "Could not get service URL from Terraform output"
        return 1
    fi
    
    print_status "Testing health endpoint: ${SERVICE_URL}/health"
    
    # Test health endpoint with retries
    local max_retries=5
    local retry_count=0
    local wait_time=10
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -f -s "${SERVICE_URL}/health" > /dev/null; then
            print_success "Health check passed! Service is running correctly."
            
            # Test actual response
            print_status "Service response:"
            curl -s "${SERVICE_URL}/health" | jq . || curl -s "${SERVICE_URL}/health"
            return 0
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $max_retries ]; then
                print_warning "Health check failed. Retrying in ${wait_time} seconds... (${retry_count}/${max_retries})"
                sleep $wait_time
            fi
        fi
    done
    
    print_error "Health check failed after ${max_retries} attempts"
    print_error "The service may still be starting up. Please check the Cloud Run logs."
    return 1
}

# Function to clean up
cleanup() {
    print_status "Cleaning up temporary files..."
    cd "${TERRAFORM_DIR}"
    rm -f tfplan
}

# Function to display help
show_help() {
    cat << EOF
Last Hope MCP Server Deployment Script

Usage: $0 [OPTION]

Options:
    deploy      Full deployment (plan + apply + setup secrets + test)
    plan        Plan deployment only
    apply       Apply deployment only (requires existing plan)
    test        Test existing deployment
    secrets     Set up secrets only
    destroy     Destroy infrastructure
    help        Show this help message

Examples:
    $0 deploy       # Full deployment
    $0 plan         # Plan only
    $0 test         # Test existing deployment
    $0 destroy      # Destroy infrastructure

EOF
}

# Function to destroy infrastructure
destroy_infrastructure() {
    print_warning "This will destroy all infrastructure resources!"
    read -p "Are you sure you want to proceed? (type 'yes' to confirm): " -r
    
    if [ "$REPLY" = "yes" ]; then
        print_status "Destroying infrastructure..."
        cd "${TERRAFORM_DIR}"
        
        if terraform destroy -auto-approve; then
            print_success "Infrastructure destroyed successfully!"
        else
            print_error "Infrastructure destruction failed!"
            exit 1
        fi
    else
        print_status "Destruction cancelled."
    fi
}

# Main function
main() {
    case "${1:-deploy}" in
        "deploy")
            print_status "Starting full deployment..."
            check_prerequisites
            validate_terraform
            plan_deployment
            apply_deployment
            setup_secrets
            test_deployment
            cleanup
            print_success "Deployment completed successfully!"
            ;;
        "plan")
            check_prerequisites
            validate_terraform
            plan_deployment
            ;;
        "apply")
            check_prerequisites
            validate_terraform
            apply_deployment
            cleanup
            ;;
        "test")
            test_deployment
            ;;
        "secrets")
            setup_secrets
            ;;
        "destroy")
            destroy_infrastructure
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

# Set trap to cleanup on exit
trap cleanup EXIT

# Run main function with all arguments
main "$@"