#!/bin/bash
# Pre-push validation script
# This ensures the build passes before pushing to GitHub

set -euo pipefail

echo "🔍 Running pre-push validation..."
echo ""

echo "Step 1: Type checking..."
npm run check
echo "✓ Type check passed"
echo ""

echo "Step 2: Building project..."
npm run build
echo "✓ Build successful"
echo ""

echo "✅ All checks passed! Safe to push."
