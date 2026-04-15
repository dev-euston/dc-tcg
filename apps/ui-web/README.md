# @dungeon-crystal/ui-web

Web client for Dungeon Crystal TCG. Built with Vite 6, React 18, TypeScript, and Tailwind CSS v4.

## Dev

```bash
pnpm --filter @dungeon-crystal/ui-web dev   # http://localhost:3000
```

Or from the repo root:

```bash
pnpm dev   # starts server + ui-web together
```

## Build

```bash
pnpm --filter @dungeon-crystal/ui-web build
```

## Structure

```
src/
  main.tsx      — React root mount
  App.tsx       — top-level component
  index.css     — Tailwind v4 import + design tokens (@theme block)
index.html      — HTML entry point
vite.config.ts  — Vite config (React + Tailwind plugins)
tsconfig.json   — TypeScript config
```

## Styling

Tailwind CSS v4 via `@tailwindcss/vite` — no `tailwind.config.js` needed. Design tokens are defined in the `@theme` block in `src/index.css` and are available as Tailwind utilities (e.g. `bg-surface`, `text-essence`, `font-ui`).

Use inline styles for any values that are dynamic at runtime (e.g. card type colours).
