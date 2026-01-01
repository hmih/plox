#!/bin/bash
# format.sh - Apply prettier formatting to the project

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Check for --check flag
CHECK_MODE=false
if [ "$1" == "--check" ]; then
    CHECK_MODE=true
    echo "🔍 Checking formatting (no changes will be made)..."
else
    echo "🎨 Formatting project files..."
fi

# Ensure we are using the project's node environment if it exists
if [ -d "./.node-env/bin" ]; then
    export PATH="$(pwd)/.node-env/bin:$PATH"
fi


# Format TS, JS, CSS, JSON, and MD files
if [ "$CHECK_MODE" = true ]; then
    npx prettier --check \
        "src/**/*.{ts,js}" \
        "tests/**/*.{ts,js}" \
        "extension/**/*.{html,css,json,js}" \
        "*.{js,json,md}"
else
    npx prettier --write \
        "src/**/*.{ts,js}" \
        "tests/**/*.{ts,js}" \
        "extension/**/*.{html,css,json,js}" \
        "*.{js,json,md}"
fi

if [ "$CHECK_MODE" = true ]; then
    echo "🐚 Checking shell scripts..."
else
    echo "🐚 Formatting shell scripts..."
fi

if command -v shfmt &> /dev/null; then
    if [ "$CHECK_MODE" = true ]; then
        shfmt -d -i 4 ./*.sh ./scripts/*.sh
    else
        shfmt -l -w -i 4 ./*.sh ./scripts/*.sh
    fi
else
    echo "⚠️  shfmt not found, skipping shell formatting."
fi

echo "✅ Formatting complete!"
