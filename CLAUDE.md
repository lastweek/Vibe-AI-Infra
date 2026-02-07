# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vibe AI Infra is a static website hub that tracks progress across multiple Nano AI Infrastructure projects. It's built with Vite + React + TypeScript using a minimal dark theme.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Lint code
npm run lint
```

## Architecture

### Core Structure

- `src/projects.ts` - Single source of truth for all project data. Contains:
  - `projects` array: All 13 projects with status, goals, descriptions
  - `categories` array: The 5 top-level categories (Silicon, Virt, Compiler, Framework, Agent)
  - `statusOrder`: Controls sorting priority (Done > WIP > TBD)

- `src/App.tsx` - Main component that:
  - Computes statistics (done/wip/tbd counts)
  - Groups and sorts projects by category
  - Renders project cards with GitHub links

- `src/App.css` - Minimal dark theme styling matching GitHub/Vercel aesthetic

### Data Flow

1. `projects.ts` exports `projects` array as single source of truth
2. `App.tsx` filters projects by category and sorts by status
3. Component renders stats, category sections, and project cards

## Adding/Updating Projects

Edit `src/projects.ts` directly:

```typescript
{
  id: 'unique-id',
  name: 'Project Name',
  category: 'Silicon', // Must be one of: Silicon, Virt, Compiler, Framework, Agent
  status: 'WIP',       // 'TBD' | 'WIP' | 'Done'
  github: 'repo-name', // Optional - links to github.com/lastweek/repo-name
  description: 'Brief description of the project',
  goals: [
    'Specific goal 1',
    'Specific goal 2',
  ],
}
```

## GitHub Integration

- Set `base` path in `vite.config.ts` to match your repo name
- `github: 'repo-name'` in project data adds a GitHub icon linking to `github.com/lastweek/repo-name`
- No automation - status updates are manual via editing `src/projects.ts`

## Styling Conventions

- Dark theme: `#0d1117` background, `rgba(255,255,255,0.87)` text
- Status colors:
  - Done: green `#3fb950`
  - WIP: yellow `#d29922`
  - TBD: gray `#8b949e`
- Accent: blue `#58a6ff` for links
- Border: `rgba(255,255,255,0.1)` for subtle separation
