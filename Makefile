# Automatic isolated environment activation
NODE_BIN := $(CURDIR)/.node-env/bin
export PATH := $(NODE_BIN):$(PATH)

# Load configuration from .env if it exists
-include .env
export $(shell [ -f .env ] && sed 's/=.*//' .env)

.PHONY: help env build test format check-format clean dist setup

setup:
	@chmod +x scripts/setup_env.sh
	./scripts/setup_env.sh

help:
	@echo "Available commands:"
	@echo "  make env     - Activate the isolated node environment (usage: source env.sh)"
	@echo "  make build   - Build the extension into the extension/ directory"
	@echo "  make test    - Run Playwright integration tests"
	@echo "  make format       - Format code using Prettier and shfmt"
	@echo "  make check-format - Check if code is properly formatted"
	@echo "  make clean        - Remove build artifacts and test results"
	@echo "  make dist    - Prepare a zip file for deployment"

# Note: 'source env.sh' must be run in the shell, cannot be a make command 
# that affects the parent process. But we can remind the user.
env:
	@echo "Please run: source env.sh"

build:
	npm run build

test:
	npm test

format:
	./scripts/format.sh

check-format:
	./scripts/format.sh --check

clean:
	rm -rf extension/*.js
	rm -rf test-results/
	rm -rf playwright-report/

dist: build
	@echo "📦 Preparing deployment package..."
	zip -r plox_extension.zip extension/ -x "extension/src/*" "extension/*.map"
	@echo "✅ Deployment package created: plox_extension.zip"
