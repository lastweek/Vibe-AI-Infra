#!/bin/bash
# Pre-push validation script
# This ensures the build passes before pushing to GitHub

echo "🔍 Running pre-push validation..."
echo ""

echo "Step 1: Type checking..."
if ! npm run astro check --no-build 2>&1 | grep -q "error ts("; then
  echo "✓ Type check passed"
else
  echo "❌ Type check failed!"
  exit 1
fi
echo ""

echo "Step 2: Building project..."
if npm run build 2>&1 | grep -q "Complete!"; then
  echo "✓ Build successful"
else
  echo "❌ Build failed!"
  exit 1
fi
echo ""

echo "✅ All checks passed! Safe to push."
