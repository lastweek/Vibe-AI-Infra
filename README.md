# Vibe AI Infra

Vibe AI Infra is an Astro site for infrastructure work spanning silicon, virtualization, compilers, frameworks, and AI agents.

## Stack

- Astro 4 + TypeScript
- React islands for interactive project views
- Astro content collections for markdown-driven pages and insights

## Local Development

```bash
npm install
npm run dev
```

Key scripts:

```bash
npm run check      # astro check --no-build
npm run build      # production build
npm run ci         # check + build
npm run pre-push   # local pre-push validation
npm run push       # validate then git push
```

## Content Model

### Nano projects data

Edit YAML files in `src/content/projects/`:

- `silicon.yaml`
- `virt.yaml`
- `compiler.yaml`
- `framework.yaml`
- `agent.yaml`

### Markdown subpages

Add markdown files in `src/content/pages/`:

- `src/content/pages/about.md` -> `/about`
- `src/content/pages/roadmap.md` -> `/roadmap`
- nested files map to nested URLs

### Markdown insights

Add markdown files in `src/content/insights/`:

- `src/content/insights/roofline.md` -> `/insights/roofline`
- `src/content/insights/serving-cost.md` -> `/insights/serving-cost`

## Deployment

GitHub Actions deploys on push to `main` via `.github/workflows/deploy.yml`:

1. `npm ci`
2. `npm run ci`
3. deploy `dist/` to GitHub Pages
