# Automatic isolated environment activation
NODE_BIN := $(CURDIR)/extension/.node-env/bin
export PATH := $(NODE_BIN):$(PATH)

# Load configuration from .env if it exists
-include .env
export $(shell [ -f .env ] && sed 's/=.*//' .env)

.PHONY: help env build test format clean dist setup server-up server-down server-test

setup:
	@chmod +x extension/scripts/setup_env.sh
	./extension/scripts/setup_env.sh

help:
	@echo "Available commands:"
	@echo "  make env          - Activate the isolated node environment (usage: source extension/env.sh)"
	@echo "  make build        - Build the extension into extension/dist/"
	@echo "  make test         - Run Playwright integration tests"
	@echo "  make format       - Format code using Prettier"
	@echo "  make clean        - Remove build artifacts and test results"
	@echo "  make dist         - Prepare a zip file for deployment"
	@echo "  make server-up    - Build and start plox server (foreground with logs)"
	@echo "  make server-down  - Stop containers"
	@echo "  make server-test  - Run Python server tests"

# Note: 'source extension/env.sh' must be run in the shell, cannot be a make command
# that affects the parent process. But we can remind the user.
env:
	@echo "Please run: source extension/env.sh"

extension-build:
	cd extension && npm run build:dev && npm run build:prod

extension-test:
	cd extension && npm run test

format:
	cd extension && ./scripts/format.sh

clean:
	rm -rf extension/dist/dev/*.js
	rm -rf extension/dist/prod/*.js
	rm -rf extension/test-results/
	rm -rf extension/playwright-report/

extension-dist: extension-build
	@echo "📦 Preparing deployment package (PRODUCTION)..."
	zip -r plox_extension.zip extension/dist/prod/ -x "*.map"
	@echo "✅ Deployment package created: plox_extension.zip"

server-up:
	docker compose up --build

server-down:
	docker compose down

server-logs:
	docker compose logs -f

server-test:
	cd server && python3 -m pytest tests/ -v
