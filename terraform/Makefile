# Last Hope MCP Server - Terraform Makefile
# Provides convenient commands for infrastructure management

.PHONY: help init plan apply destroy test validate clean setup-env check-deps

# Default environment (can be overridden)
ENV ?= dev

# Colors
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m

# Default target
help: ## Show this help message
	@echo "Last Hope MCP Server - Infrastructure Management"
	@echo "==============================================="
	@echo ""
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "Environment: $(ENV)"
	@echo "Set ENV=prod for production deployment"

init: check-deps ## Initialize Terraform
	@echo "$(YELLOW)Initializing Terraform...$(NC)"
	@terraform init
	@echo "$(GREEN)Terraform initialized successfully!$(NC)"

plan: init ## Plan infrastructure changes
	@echo "$(YELLOW)Planning infrastructure changes...$(NC)"
	@terraform plan -var="environment=$(ENV)" -out=tfplan
	@echo "$(GREEN)Plan completed. Review changes above.$(NC)"

apply: ## Apply infrastructure changes (requires plan)
	@echo "$(YELLOW)Applying infrastructure changes...$(NC)"
	@terraform apply tfplan
	@rm -f tfplan
	@echo "$(GREEN)Infrastructure deployed successfully!$(NC)"

deploy: plan apply setup-secrets ## Full deployment (plan + apply + secrets)
	@echo "$(GREEN)Full deployment completed!$(NC)"
	@$(MAKE) test

destroy: ## Destroy infrastructure (with confirmation)
	@echo "$(RED)WARNING: This will destroy all infrastructure!$(NC)"
	@read -p "Are you sure? Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ]
	@terraform destroy -var="environment=$(ENV)" -auto-approve
	@echo "$(GREEN)Infrastructure destroyed.$(NC)"

test: ## Run infrastructure validation tests
	@echo "$(YELLOW)Running infrastructure tests...$(NC)"
	@./validate.sh test

validate: ## Quick health check
	@./validate.sh health

info: ## Show service information
	@./validate.sh info

setup-env: ## Set up environment (copy example files)
	@echo "$(YELLOW)Setting up environment...$(NC)"
	@if [ ! -f terraform.tfvars ]; then \
		cp terraform.tfvars.example terraform.tfvars; \
		echo "$(GREEN)Created terraform.tfvars from example$(NC)"; \
		echo "$(YELLOW)Please edit terraform.tfvars with your configuration$(NC)"; \
	else \
		echo "$(YELLOW)terraform.tfvars already exists$(NC)"; \
	fi

setup-secrets: ## Set up API secrets interactively
	@echo "$(YELLOW)Setting up secrets...$(NC)"
	@./deploy.sh secrets

check-deps: ## Check if required tools are installed
	@echo "$(YELLOW)Checking dependencies...$(NC)"
	@command -v terraform >/dev/null 2>&1 || (echo "$(RED)terraform is required but not installed$(NC)" && exit 1)
	@command -v gcloud >/dev/null 2>&1 || (echo "$(RED)gcloud is required but not installed$(NC)" && exit 1)
	@command -v docker >/dev/null 2>&1 || (echo "$(RED)docker is required but not installed$(NC)" && exit 1)
	@echo "$(GREEN)All dependencies are installed$(NC)"

clean: ## Clean up temporary files
	@echo "$(YELLOW)Cleaning up temporary files...$(NC)"
	@rm -f tfplan
	@rm -f terraform.tfstate.backup
	@echo "$(GREEN)Cleanup completed$(NC)"

logs: ## Show Cloud Run service logs
	@echo "$(YELLOW)Fetching service logs...$(NC)"
	@PROJECT_ID=$$(terraform output -raw project_id 2>/dev/null || gcloud config get-value project) && \
	SERVICE_NAME=$$(terraform output -raw service_name 2>/dev/null || echo "last-hope-mcp-server") && \
	gcloud logging read "resource.type=cloud_run_revision resource.labels.service_name=$$SERVICE_NAME" --project=$$PROJECT_ID --limit=50 --format="table(timestamp,severity,textPayload)"

monitoring: ## Open monitoring dashboard
	@echo "$(YELLOW)Opening monitoring dashboard...$(NC)"
	@PROJECT_ID=$$(terraform output -raw project_id 2>/dev/null || gcloud config get-value project) && \
	echo "Monitoring dashboard: https://console.cloud.google.com/monitoring/dashboards?project=$$PROJECT_ID"

# Development shortcuts
dev-deploy: ENV=dev
dev-deploy: deploy ## Deploy to development environment

staging-deploy: ENV=staging
staging-deploy: deploy ## Deploy to staging environment

prod-deploy: ENV=prod
prod-deploy: deploy ## Deploy to production environment

# Quick commands
quick-deploy: ## Quick deployment with minimal prompts
	@./deploy.sh deploy

quick-test: ## Quick validation test
	@./validate.sh health

quick-destroy: ## Quick destroy (be careful!)
	@terraform destroy -var="environment=$(ENV)" -auto-approve

# Format and validate
fmt: ## Format Terraform files
	@terraform fmt -recursive

validate-config: ## Validate Terraform configuration
	@terraform validate

security-scan: ## Basic security scan (requires tfsec)
	@if command -v tfsec >/dev/null 2>&1; then \
		tfsec .; \
	else \
		echo "$(YELLOW)tfsec not installed. Install with: go install github.com/aquasecurity/tfsec/cmd/tfsec@latest$(NC)"; \
	fi

# Environment-specific targets
dev: ENV=dev
dev: info ## Show development environment info

staging: ENV=staging  
staging: info ## Show staging environment info

prod: ENV=prod
prod: info ## Show production environment info

# Output useful information
outputs: ## Show Terraform outputs
	@terraform output

state: ## Show Terraform state
	@terraform state list

# Backup and restore
backup-state: ## Backup Terraform state (to backup/ directory)
	@mkdir -p backup
	@cp terraform.tfstate backup/terraform.tfstate.$(shell date +%Y%m%d_%H%M%S)
	@echo "$(GREEN)State backed up to backup/ directory$(NC)"

# Documentation
docs: ## Generate documentation
	@echo "$(YELLOW)Available documentation:$(NC)"
	@echo "  - GCP_SETUP_GUIDE.md: Setup instructions"
	@echo "  - terraform.tfvars.example: Configuration template"
	@echo "  - README.md: Project overview"

# Advanced operations
refresh: ## Refresh Terraform state
	@terraform refresh -var="environment=$(ENV)"

import: ## Import existing resource (requires RESOURCE and ID variables)
	@terraform import -var="environment=$(ENV)" $(RESOURCE) $(ID)

taint: ## Taint a resource for recreation (requires RESOURCE variable)
	@terraform taint $(RESOURCE)

untaint: ## Remove taint from a resource (requires RESOURCE variable)
	@terraform untaint $(RESOURCE)

# Debug commands
debug: ## Show debug information
	@echo "$(YELLOW)Debug Information:$(NC)"
	@echo "Environment: $(ENV)"
	@echo "Terraform version: $$(terraform version | head -n1)"
	@echo "gcloud version: $$(gcloud version --format='value(Google Cloud SDK)' 2>/dev/null || echo 'Not available')"
	@echo "Current project: $$(gcloud config get-value project 2>/dev/null || echo 'Not set')"
	@echo "Working directory: $$(pwd)"
	@echo "Files present:"
	@ls -la | grep -E '\.(tf|tfvars|json)$$' || echo "  No Terraform files found"