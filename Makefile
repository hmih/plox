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

build:
	cd extension && npm run build

test:
	cd extension && npm test

format:
	cd extension && ./scripts/format.sh

clean:
	rm -rf extension/dist/*.js
	rm -rf extension/test-results/
	rm -rf extension/playwright-report/

dist: build
	@echo "📦 Preparing deployment package..."
	zip -r plox_extension.zip extension/dist/ -x "extension/dist/*.map"
	@echo "✅ Deployment package created: plox_extension.zip"

server-up:
	docker compose up --build

server-down:
	docker compose down

server-test:
	cd server && python3 -m pytest tests/ -v
