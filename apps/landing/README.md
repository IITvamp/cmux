# cmux Landing Page

This is the standalone Next.js landing page for cmux.

## Development

```bash
# From the root of the monorepo
pnpm run landing:dev

# Or directly from this directory
pnpm dev
```

The landing page will run on http://localhost:3000

## Build

```bash
# From the root of the monorepo
pnpm run landing:build

# Or directly from this directory
pnpm build
```

## Production

```bash
# From the root of the monorepo
pnpm run landing:start

# Or directly from this directory
pnpm start
```

## Tech Stack

- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- Shadcn UI components
- Lucide React icons

## Structure

```
apps/landing/
├── app/                  # Next.js App Router pages
│   ├── page.tsx         # Main landing page
│   ├── layout.tsx       # Root layout with metadata
│   └── globals.css      # Global styles
├── components/
│   └── ui/              # Reusable UI components
├── lib/                 # Utility functions
└── public/              # Static assets
```

## Environment

The landing page runs independently from the main cmux application and has no backend dependencies.
