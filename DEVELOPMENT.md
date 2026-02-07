# Development Workflow

This project uses a robust build validation process to ensure all changes are tested before being pushed to GitHub.

## Pre-Push Validation

Before pushing any changes, the build process is validated to catch errors early:

### Option 1: Using npm scripts
```bash
npm run push          # Runs validation, then pushes
npm run pre-push      # Only runs validation (doesn't push)
```

### Option 2: Using git alias
```bash
git safe-push         # Runs validation, then pushes
```

### Option 3: Manual validation
```bash
npm run build         # Verify build passes
git push              # Then push manually
```

## Validation Steps

The pre-push check performs:
1. **Type checking** - Runs Astro's type checker
2. **Build** - Ensures the project builds successfully
3. **Report** - Shows status and prevents push if anything fails

## Development Commands

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run preview       # Preview production build
npm run pre-push      # Validate before pushing
npm run push          # Validate and push safely
```

## Configuration Notes

### Base Path Configuration (`astro.config.mjs`)

The `base` path in Astro config must match your GitHub Pages deployment:

- **Custom subdomain** (e.g., `vibe-ai-infra.lastweek.io`): Use `base: '/'`
- **GitHub user/org pages** (e.g., `username.github.io`): Use `base: '/'`
- **Project pages** (e.g., `username.github.io/repo-name`): Use `base: '/repo-name/'`

**Current setup:** This site uses a custom subdomain, so `base: '/'`

When changing deployment type, ALWAYS update:
1. `astro.config.mjs` - the `base` property
2. All internal links - if changing to/from project pages

## Why This Matters

- Catches TypeScript errors before they reach GitHub Actions
- Saves time by failing fast locally instead of on CI
- Ensures the main branch always builds successfully
- Prevents broken deployments to production
- Avoids 404 errors from incorrect base path configuration
