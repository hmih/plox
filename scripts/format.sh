#!/bin/bash
# format.sh - Apply prettier formatting to the project

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

cd "$PROJECT_ROOT"

# Use the local environment if available
if [ -f "./env.sh" ]; then
    source ./env.sh > /dev/null
fi

echo "🎨 Formatting project files..."

# Format TS, JS, CSS, JSON, and MD files
npx prettier --write \
    "src/**/*.{ts,js}" \
    "tests/**/*.{ts,js}" \
    "extension/**/*.{html,css,json,js}" \
    "*.{js,json,md}" \
    "scripts/*.sh"

echo "✅ Formatting complete!"
