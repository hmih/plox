#!/bin/bash
set -e

# setup_env.sh - Bootstraps the isolated Node.js environment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NODE_VERSION="v22.12.0"
# OS Detection
OS_RAW="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$OS_RAW" in
darwin*) PLATFORM="darwin" ;;
linux*) PLATFORM="linux" ;;
*)
    echo "❌ Unsupported OS: $OS_RAW"
    exit 1
    ;;
esac

# Architecture Detection
ARCH_RAW="$(uname -m)"
case "$ARCH_RAW" in
x86_64) ARCH="x64" ;;
arm64 | aarch64) ARCH="arm64" ;;
*)
    echo "❌ Unsupported Architecture: $ARCH_RAW"
    exit 1
    ;;
esac

echo "🖥️  Detected System: $PLATFORM-$ARCH"

cd "$PROJECT_ROOT"

# 1. Create .node-env if it doesn't exist
if [ ! -d "./.node-env" ]; then
    echo "📥 Downloading Node.js $NODE_VERSION..."
    NODE_DIST="node-$NODE_VERSION-$PLATFORM-$ARCH"
    curl -O "https://nodejs.org/dist/$NODE_VERSION/$NODE_DIST.tar.gz"

    echo "📦 Extracting Node.js..."
    tar -xzf "$NODE_DIST.tar.gz"
    mv "$NODE_DIST" .node-env
    rm "$NODE_DIST.tar.gz"
fi

# 2. Set PATH for the rest of the script
export PATH="$PROJECT_ROOT/.node-env/bin:$PATH"

echo "✅ Node.js environment ready: $(node -v)"

# 3. Install dependencies
echo "scripts: Installing dependencies..."
npm install

# 4. Success
echo "🚀 Project setup complete! You can now run 'make build' or 'make test'."
