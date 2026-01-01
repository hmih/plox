#!/bin/bash

# Get the absolute path of the directory where this script is located
# This ensures it works regardless of where you call it from.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
NODE_BIN="$SCRIPT_DIR/.node-env/bin"

if [ -d "$NODE_BIN" ]; then
    export PATH="$NODE_BIN:$PATH"
    echo "✅ Isolated Node environment activated."
    echo "Node: $(node -v)"
    echo "npm:  $(npm -v)"
else
    echo "❌ Error: .node-env directory not found at $NODE_BIN"
    echo "Please ensure you are running this from the plox root or that the environment was set up correctly."
fi
