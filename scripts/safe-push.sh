#!/bin/bash
# Safe push script - validates build before pushing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/pre-push-check.sh"

echo ""
echo "🚀 Pushing to GitHub..."
git push "$@"
