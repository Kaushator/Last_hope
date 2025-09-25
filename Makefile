# Development Scripts

## Start all services in development mode
dev:
	docker-compose up -d fingpt mcp-server
	npm run dev

## Build and test the application
build:
	npm run build
	npm run type-check

## Deploy to GCP
deploy:
	gcloud builds submit --tag gcr.io/$(GOOGLE_CLOUD_PROJECT)/htx-analytics
	gcloud run deploy htx-analytics --image gcr.io/$(GOOGLE_CLOUD_PROJECT)/htx-analytics --region us-central1

## Setup infrastructure
infra:
	cd terraform && terraform init && terraform apply

## Run tests
test:
	npm run test
	cd mcp-server && npm test

## Clean up
clean:
	docker-compose down -v
	rm -rf .next node_modules

.PHONY: dev build deploy infra test clean