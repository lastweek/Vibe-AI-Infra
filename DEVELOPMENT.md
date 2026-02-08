# Development Workflow

This project uses a local validation gate before pushing and the same validation in CI.

## Day-to-day commands

```bash
npm run dev
npm run check
npm run build
npm run ci
```

## Safe push flow

```bash
npm run pre-push   # check + build
npm run push       # pre-push + git push
```

You can also run:

```bash
git safe-push
```

if that alias is configured locally.

## What validation includes

`npm run ci` runs:

1. Astro type/content checks (`npm run check`)
2. Production static build (`npm run build`)

If either step fails, push should be blocked.

## Content editing workflow

1. Add or edit YAML in `src/content/projects/` for project tracker data.
2. Add markdown in `src/content/pages/` for general subpages.
3. Add markdown in `src/content/insights/` for insight articles.
4. Run `npm run ci` before pushing.

## Base path configuration

`astro.config.mjs` currently uses:

```js
base: '/'
```

For GitHub project pages, this must be updated to `/<repo-name>/`.
