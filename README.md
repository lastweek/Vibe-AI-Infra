# Vibe AI Infra

Hub for Nano AI Infrastructure projects - tracking progress across silicon, virtualization, compilers, frameworks, and AI agents.

## Projects

This hub tracks 13 projects across 5 categories:

- **Silicon**: Nano GPU (SIMT + DSA architecture)
- **Virt**: Nano KVM, Nano Container
- **Compiler**: Nano TVM, Nano MLIR, Nano TileLang, Nano KernelGen
- **Framework**: Nano Collective, Nano Torch, Nano Megatron, Nano Serving, Nano AReal
- **Agent**: Nano OpenCode

## Development

Install dependencies:
```bash
npm install
```

Run development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Updating Project Status

Edit `src/projects.ts` to update project information. Each project has:

- `status`: `'TBD'` | `'WIP'` | `'Done'`
- `github`: GitHub repo name (optional, links to `github.com/lastweek/<repo>`)
- `description`: Brief project description
- `goals`: Array of specific project goals

## Deployment

The site is configured for GitHub Pages deployment. Build outputs to `dist/` and can be served from GitHub Pages or any static host.
