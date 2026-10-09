# Pop Count

**popcount.online** — a live popularity map. Find a bubble (a campus, town or any place) on the map, browse the people in it, and rate them 0–100. Everyone's score is the average of all ratings, shown as a percentage and a green / yellow / red frame.

- **Map → bubble → profile.** The U.S. map shows bubbles sized by how many people are in them, ringed in their average score colour. Tap one to see its people (ranked) and leaderboards, then tap a person to rate and comment.
- **Anonymous and free.** No sign-up to browse, rate, comment, report or drop a bubble — the first action gives the device an anonymous handle. A free account is only needed to create a profile, and you can only create a profile of yourself.
- **Free.** Rating, commenting, profiles and bubbles cost nothing. There are no payments.
- **Safety.** 3-step disclaimer on first visit (guidelines, liability, 18+), profanity masking, free reporting, auto-hide after 3 reports, and an admin moderation queue.
- **Admin.** `/admin` has the moderation queue and an **Ads** manager to upload image or video ads.

## Quick start

```bash
npm install
npm run dev          # migrates + seeds an embedded Postgres (PGlite) on first run
open http://localhost:3000
```

No database server is needed locally — without `DATABASE_URL` the app uses PGlite stored in `.data/pglite`.

| Demo account | Login                   | Password      |
| ------------ | ----------------------- | ------------- |
| Member       | `demo@popcount.online`  | `password123` |
| Admin        | `admin@popcount.online` | `admin12345`  |

The seed creates 6 bubbles, 64 fictional demo profiles with placeholder photos, ratings, comments and a house ad.

## Scripts

| Script                                 | What it does                                      |
| -------------------------------------- | ------------------------------------------------- |
| `npm run dev`                          | Migrate, seed if empty, start Next.js in dev mode |
| `npm run build` / `npm start`          | Production build / apply migrations then serve    |
| `npm run check`                        | Typecheck, lint and tests                         |
| `npm run db:migrate`                   | Apply migrations                                  |
| `npm run db:seed` / `npm run db:reset` | Seed demo data / wipe and reseed (dev only)       |

## Deploying

The app needs **Node 20+** and **PostgreSQL 14+**. In production `DATABASE_URL` is required (the app refuses to start on the embedded dev database).

**Vercel + Neon (or Supabase)**

1. Create a Postgres database and copy its connection string.
2. Import the repo in Vercel. Set environment variables `DATABASE_URL`, `DATABASE_SSL=true` and `APP_URL=https://your-domain`.
3. Set the build command to `npm run db:migrate && npm run build`.
4. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (8+ characters) in Vercel, deploy, then log in at `/login` with them. Admins get a red **Admin: delete** button on every bubble and profile, plus the `/admin` report queue.
5. Upload your first ad in `/admin → Ads`.

**Any server / Docker**

```bash
docker build -t popcount .
docker run -p 3000:3000 -e DATABASE_URL=postgres://… -e DATABASE_SSL=true -e APP_URL=https://popcount.online popcount
```

`npm start` applies migrations before serving. `docker compose up -d` starts a local Postgres for testing.

### Before going public

- **Map tiles:** street-level tiles use CARTO with the project key in `src/components/map/campus-map.tsx` (override with `NEXT_PUBLIC_CARTO_KEY`).
- **Rate limiting** is in-memory per instance; back `src/lib/rate-limit.ts` with Redis/Upstash for multiple instances.
- **Images and ad videos** are stored in Postgres; move them to object storage (S3/R2) behind `/api/images/:id` at scale.
- **Legal:** `/terms`, `/guidelines` and `/privacy` are templates — have them reviewed.

## Tech

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Radix UI, Motion, TanStack Query, Zustand, Leaflet, Drizzle ORM + PostgreSQL, Zod, Vitest.

```
src/app/          routes (map, /b/[slug], /p/[id], admin, legal) + REST API under /api
src/components/   UI (map, bubble, profile, rankings, onboarding, credits = ad player, admin)
src/server/       business logic (bubbles, profiles, ratings, comments, ads, credits, reports, images)
src/lib/          db schema/client, auth sessions, validation, rating math, moderation, rate limiting
drizzle/          SQL migrations
scripts/          migrate + seed
tests/            Vitest unit + integration tests (real Postgres via PGlite)
```
