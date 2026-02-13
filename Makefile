# Load configuration from .env if it exists
-include .env
export $(shell [ -f .env ] && sed 's/=.*//' .env)

.PHONY: help build test format clean dist server-up server-down server-test

help:
	@echo "Available commands:"
	@echo "  make build        - Build the extension into extension/dist/"
	@echo "  make test         - Run Playwright integration tests"
	@echo "  make format       - Format code using Prettier"
	@echo "  make clean        - Remove build artifacts and test results"
	@echo "  make dist         - Prepare a zip file for deployment"
	@echo "  make server-up    - Build and start plox server (foreground with logs)"
	@echo "  make server-down  - Stop containers"
	@echo "  make server-test  - Run Python server tests"

extension-build:
	cd extension && npm run build:dev && npm run build:prod

extension-test:
	cd extension && npm run test

format:
	cd extension && ./scripts/format.sh

clean:
	rm -rf extension/dist/dev/*
	rm -rf extension/dist/prod/*
	rm -rf extension/test-results/
	rm -rf extension/playwright-report/
	rm -f plox_extension.zip

extension-dist: extension-build
	@echo "📦 Preparing deployment package (PRODUCTION)..."
	rm -f plox_extension.zip
	cd extension/dist/prod && zip -r ../../../plox_extension.zip . -x "*.map"
	@echo "✅ Deployment package created: plox_extension.zip"

server-up:
	docker compose up --build

server-down:
	docker compose down

server-logs:
	docker compose logs -f

server-test:
	cd server && python3 -m pytest tests/ -v
