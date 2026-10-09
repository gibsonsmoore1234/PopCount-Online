# Pop Count

**popcount.ai**: a location-based social app. You opt in, drop into your campus or town **bubble** on a live U.S. map, and see where your **Aura** (a 0–100 score) lands among your peers.

- **Interactive map:** campus and town bubbles sized by membership. Each bubble's ring is colored by its average Aura. Pan and zoom from the national view down to street level, and drop new bubbles anywhere in the U.S. (max 100 per county).
- **Campus feed:** a full-screen roster of 2:3 portrait cards, each framed in its Aura color. Sort by Best %, Top Males, Top Females, Lowest %, Most Votes and Least Votes. Search within the campus, plus local leaderboards and group channels.
- **Profile page:** a full-screen view of one person. It shows the tenths-precision score, a gender tag, the vote tally, 🔥/👎 quick votes and an exact 0–100 slider. It also has the **$0.01/click boost widget** (10 clicks per day), stickers (`Most Known`, `Most AURA`, `Least AURA`, percentile badges), and separate **Comments** and **Aura Advice** threads.
- **National rankings:** Top/Bottom 50 overall and Top 100 Males/Females, plus a campus-bubble leaderboard (Most Active, Highest/Lowest Avg %, Total Votes).
- **Global search** across people and bubbles, showing each person's national rank.
- **Trust and safety:** a mandatory 3-part onboarding (guidelines, liability, 18+), reporting, auto-hide after 3 reports, an admin moderation queue (hide, restore, delete, ban), a profanity filter and rate limits.

> **Profiles are opt-in.** Each account can create one profile, and only of itself, after confirming the photo is of them and that they are 18+. There is no way to post someone else. If a site lets anyone upload a classmate's photo, name and handle to be publicly ranked (with "Bottom 50" lists and a comment thread), it works as a harassment tool. It also carries real legal exposure around privacy and right of publicity, and app stores reject it. Owners can edit or permanently delete their profile at any time.

---

## Quick start

```bash
npm install
npm run dev          # migrates + seeds an embedded Postgres (PGlite) on first run
open http://localhost:3000
```

No database server is needed for local development. Without `DATABASE_URL`, the app runs **PGlite** (real PostgreSQL compiled to WASM) and stores the data in `.data/pglite`.

| Demo account | Login               | Password      |
| ------------ | ------------------- | ------------- |
| Member       | `demo@popcount.ai`  | `password123` |
| Admin        | `admin@popcount.ai` | `admin12345`  |

The seed creates 6 campus bubbles (Duke, Ole Miss, NYU, UCLA, UT Austin, UMiami), 64 demo profiles, about 240 accounts, about 2,400 ratings, comments, advice and group chats. Every demo person is fictional. Their photos are generated illustrations (DiceBear "Notionists", CC0), not pictures of real people.

### Against a real PostgreSQL server

```bash
docker compose up -d                                         # or any Postgres 14+
export DATABASE_URL=postgres://pc:pc@localhost:5432/popularity
npm run db:migrate && npm run db:seed
npm run dev
```

## Scripts

| Script                                 | What it does                                                            |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                          | Migrate, seed if empty, then start Next.js in dev mode                  |
| `npm run build` / `npm start`          | Production build / migrate and serve                                    |
| `npm run check`                        | Typecheck, lint and test                                                |
| `npm test`                             | Vitest: unit tests plus service integration tests on in-memory Postgres |
| `npm run db:generate`                  | Generate a SQL migration from `src/lib/db/schema.ts`                    |
| `npm run db:migrate`                   | Apply migrations                                                        |
| `npm run db:seed` / `npm run db:reset` | Seed demo data / wipe and reseed                                        |
| `npm run format`                       | Prettier (with Tailwind class sorting)                                  |

With PGlite, stop `npm run dev` before running `db:reset`, because only one process may open the embedded database at a time.

## Tech stack

| Layer      | Choice                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Route Handlers, Turbopack), React 19, TypeScript (strict)                                                       |
| Styling    | Tailwind CSS v4 design tokens (`src/app/globals.css`), Plus Jakarta Sans (self-hosted), Lucide icons, Motion animations                 |
| UI         | Radix primitives (Dialog, Tabs, DropdownMenu, Slider, Slot) wrapped as shadcn-style components in `src/components/ui`                   |
| State      | TanStack Query for server state (optimistic votes, comments and chat, live polling); Zustand for UI state (modals, map viewport, terms) |
| Map        | Leaflet with react-leaflet and CARTO Voyager tiles; offline county lookup from the Census boundaries in `us-atlas`                      |
| Data       | PostgreSQL with Drizzle ORM and SQL migrations. PGlite locally, `pg` pool in production                                                 |
| Validation | Zod schemas shared by forms and API routes                                                                                              |
| Auth       | Database sessions: random 256-bit token in an httpOnly cookie, SHA-256 hash stored server-side, scrypt passwords, USER/ADMIN roles      |
| Payments   | Stripe Checkout over REST, with a signature-verified idempotent webhook. Demo mode works without keys                                   |
| Moderation | `obscenity` profanity masking, reports, auto-hide, admin queue                                                                          |
| Tests      | Vitest, with integration tests running the real services against migrated in-memory Postgres                                            |

**Why not NextAuth/Clerk?** Clerk needs external keys before anything works, and the app only needs email and password. A small session layer (`src/lib/auth`) gives HttpOnly/SameSite cookies, server-side revocation (bans log users out immediately), sliding expiry and timing-safe logins, with no third-party dependency. Adding OAuth later is a contained change behind `createSession()`.

## Architecture

```
src/
├─ app/                    # Routes (layers) + REST API
│  ├─ page.tsx             # Layer 1 — interactive map
│  ├─ b/[slug]/            # Layer 2 — full-screen campus feed (Roster · Leaderboards · Groups)
│  ├─ p/[id]/              # Layer 3 — full-screen profile
│  ├─ rankings/  admin/  login/  signup/  terms/  guidelines/  privacy/  credits/success/
│  └─ api/                 # Route handlers (thin: auth → zod → service)
├─ components/             # ui/ primitives, map/, bubble/, profile/, rankings/, onboarding/, credits/, admin/
├─ hooks/api.ts            # TanStack Query hooks + optimistic updates
├─ stores/                 # Zustand stores
├─ server/                 # Business logic (bubbles, profiles, ratings, comments, groups, reports, credits, images)
├─ lib/
│  ├─ db/                  # Drizzle schema + driver selection (pg / PGlite)
│  ├─ auth/                # sessions, scrypt
│  ├─ api/route.ts         # api() wrapper: CSRF check, JSON errors, Zod → 400
│  ├─ aura.ts              # Aura math, tiers, colours, credit packs — shared client/server
│  ├─ validation.ts        # Zod schemas shared by forms and routes
│  ├─ geo/county.ts        # point-in-county lookup
│  └─ moderation.ts, rate-limit.ts, image.ts
├─ proxy.ts                # Next 16 proxy (middleware): bounce signed-out users from /admin
drizzle/                   # SQL migrations
scripts/                   # migrate + seed
tests/                     # Vitest
```

### Data model

`users` · `sessions` · `bubbles` · `bubble_members` · `profiles` (one per user, with denormalised Aura aggregates) · `ratings` (one per rater per profile, `value` 0–100 and `weight` = 1 + boosts) · `vote_events` (append-only log for activity rankings, boost caps and audits) · `comments` (COMMENT | ADVICE) · `groups` · `group_messages` · `reports` · `credit_transactions` (signed ledger; purchases are unique by Stripe session) · `images` (uploads stored as `bytea`).

### Aura math

```
Aura = Σ(value × weight) / Σ(weight)       rounded to tenths
       e.g. 45, 88, 20, 77, 90  →  64.0
🔥 Upvote = a rating of 100 · 👎 Downvote = a rating of 0 · the slider sets any whole number 0–100
Each paid boost click adds +1 weight to the booster's existing rating ($0.01, max 10 per profile per 24h)
Frame colour (on the displayed value): green 67.0–100 · yellow 34.0–66.9 · coral 0–33.9
```

With only thumbs votes, the Aura equals the classic `up / (up + down)`, so the prototype's percentage is a special case. Overall and Bottom leaderboards and stickers require at least 3 votes. Gender boards rank by vote volume, as specified. Every rating write locks the profile row (`SELECT … FOR UPDATE`) and recomputes the aggregates from `ratings`. Boost debits are a conditional `UPDATE … WHERE balance >= cost`, backed by a `CHECK (credit_balance >= 0)` constraint. A test fires 15 concurrent boosts and gets exactly 10 accepted with a matching ledger.

### API

All endpoints return JSON. Mutations require a same-origin `Origin` and a JSON or multipart body (CSRF defence).

| Method           | Path                                                                      | Notes                                                       |
| ---------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| POST             | `/api/auth/signup` · `/api/auth/login` · `/api/auth/logout`               | rate-limited                                                |
| GET              | `/api/me` · POST `/api/me/terms`                                          | session + terms acceptance                                  |
| GET/POST         | `/api/bubbles`                                                            | list / create (county lookup, 100-per-county cap)           |
| GET              | `/api/bubbles/rankings?sort=active\|highest\|lowest\|votes`               | global bubble leaderboard                                   |
| GET              | `/api/bubbles/:slug` · `/api/bubbles/:slug/profiles?sort=&q=&cursor=`     | campus stats · roster feed                                  |
| POST/DELETE      | `/api/bubbles/:slug/membership`                                           | join / leave                                                |
| GET/POST         | `/api/bubbles/:slug/groups` · `/api/groups/:id/messages?after=`           | group channels · live chat                                  |
| POST             | `/api/profiles`                                                           | create **your own** profile (`consent: true`)               |
| GET/PATCH/DELETE | `/api/profiles/:id`                                                       | detail (rank, stickers, your rating) · owner edit/delete    |
| PUT              | `/api/profiles/:id/rating`                                                | `{ value: 0–100 }`                                          |
| POST             | `/api/profiles/:id/boost`                                                 | `{ clicks: 1–10 }`                                          |
| GET/POST         | `/api/profiles/:id/comments?kind=COMMENT\|ADVICE`                         | threads                                                     |
| GET              | `/api/leaderboards?scope=national\|bubble&bubble=&board=`                 | `top_overall`, `bottom_overall`, `top_males`, `top_females` |
| GET              | `/api/search?q=`                                                          | people (with national rank) + bubbles                       |
| POST             | `/api/credits/checkout` · `/api/credits/confirm` · `/api/credits/webhook` | Stripe or demo                                              |
| POST             | `/api/uploads` · GET `/api/images/:id`                                    | magic-byte sniffed JPEG/PNG/WebP ≤ 2 MB                     |
| POST             | `/api/reports` · GET/PATCH `/api/admin/reports[/:id]`                     | report · admin queue                                        |

## Deploying

1. Provision Postgres (Neon, Supabase, RDS, …) and set `DATABASE_URL` (plus `DATABASE_SSL=true` if your host requires TLS).
2. Set `APP_URL`. For payments, set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, and point a Stripe webhook at `/api/credits/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
3. `npm run build`, then `npm start`. The start script applies migrations first. On Vercel, run `npm run db:migrate` as part of the build command.

See `.env.example` for every variable.

### Before going public

- **Map tiles:** CARTO's free basemaps have usage limits and terms for commercial use. Buy a plan, or swap the tile URL in `src/components/map/campus-map.tsx` (e.g. Stadia, MapTiler).
- **Rate limiting** is in-memory (per instance). Back `src/lib/rate-limit.ts` with Redis/Upstash when you run more than one instance.
- **Images** live in Postgres (`bytea`) so the app works anywhere with no extra service. At scale, move them to object storage (S3/R2) behind the same `/api/images/:id` URL.
- **Email verification** and password reset need an email provider and aren't wired up yet.
- **Legal:** `/terms`, `/guidelines` and `/privacy` are starting templates. Have counsel review them, along with how the rating mechanic fits the app-store and campus policies you care about.
- **Demo payments:** never deploy with `PAYMENTS_MODE=demo` publicly, because it hands out free credits.
