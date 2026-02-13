#!/bin/bash
# format.sh - Apply prettier formatting to the project

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Ensure we are using the environment's tools
echo "🎨 Formatting project files..."
npx prettier --write \
    "src/**/*.{ts,js}" \
    "tests/**/*.{ts,js}" \
    "*.{js,json,md}"

echo "🐚 Formatting shell scripts..."
if command -v shfmt &>/dev/null; then
    shfmt -l -w -i 4 ./scripts/*.sh
else
    echo "⚠️  shfmt not found, skipping shell formatting."
fi

echo "✅ Formatting complete!"
