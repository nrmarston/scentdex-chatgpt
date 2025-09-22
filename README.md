# Scentdex

A blazing-fast "Pokedex of Perfumes" built with Astro and a lightweight React search island. The app delivers a read-only fragrance catalog with instant fuzzy search, brand filtering, and focused detail pages—prioritizing speed and minimal UI as outlined in the original brief.

## Highlights
- **Speed-first architecture** – Astro 5 renders static shells, while a client-side island fetches pre-sharded JSON data on demand.
- **Accent-insensitive fuzzy search** – Fuse.js runs in-memory queries across names, brands, perfumers, notes, and year, returning the top 50 hits.
- **Deterministic filtering** – Brand filter works hand-in-hand with search input, updating counts without network round-trips.
- **Offline-friendly data layer** – Catalog lives under `public/data`, split into `brands.json` and `fragrances-<brand>.json` shards to avoid monolithic payloads.
- **Minimal UI surface area** – Baseline styling via Tailwind CSS v4/shadcn primitives, no auth, no reviews, no e-commerce—only reference data.

## Tech Stack
- [Astro 5](https://astro.build/) with islands architecture (SSR disabled for index, opt-in SSR for dynamic fragrance page)
- React 19 + Fuse.js search island (`src/ui/SearchIsland.jsx`)
- Tailwind CSS v4 with `tailwind-merge` utilities (`src/styles/global.css`)
- Static JSON data served directly from `/public`

## Project Layout
- `src/pages/index.astro` – Homepage shell, preloads brand list and mounts the search island.
- `src/ui/SearchIsland.jsx` – Client-only React component handling data fetching, filtering, and fuzzy search.
- `src/pages/fragrance/[slug].astro` – Dynamic detail page that loads a single fragrance from the JSON shards.
- `public/data/` – Source of truth for brands, fragrances, and supporting note metadata.
- `src/types.ts` – Shared TypeScript definitions for `Brand`, `Fragrance`, and search filter state.

## Getting Started
1. Install dependencies (uses **pnpm**):
   ```bash
   pnpm install
   ```
2. Start the dev server:
   ```bash
   pnpm dev
   ```
   Astro serves at http://localhost:4321 by default.
3. Build for production:
   ```bash
   pnpm build
   ```
4. Preview the production build locally:
   ```bash
   pnpm preview
   ```

## Data & Search Model
- **Brands** (`public/data/brands.json`): list of `{ slug, name, country_code? }` objects used to seed filters and determine which fragrance shards to fetch.
- **Fragrances** (`public/data/fragrances-<brand>.json`): arrays of rich `Fragrance` objects including `concentration`, `gender`, `country_code`, `longevity`, `sillage`, `perfumer_names`, `notes`, `description`, and `similar_slugs`.
- Search island normalizes diacritics, lazily imports Fuse.js, and caches both the raw data and folded fields for accent-insensitive matching.
- Brand filters apply before and after searching to keep result counts accurate; the UI caps rendered results to 50 while showing total matches.

## Adding or Updating Catalog Data
1. Append a new brand to `public/data/brands.json`.
2. Create `public/data/fragrances-<brand-slug>.json` with that brand's fragrances.
3. (Optional) Expand `public/data/notes.json` if you need consistent note labels.
4. Redeploy—no code changes are required unless new fields are introduced.

## Performance Considerations
- Data shards are fetched in parallel and only on first interaction, keeping the initial page load tiny.
- `link rel="preload"` primes the brand list, enabling instant filter hydration.
- Search computations run entirely client-side without additional network requests.
- Detail pages use `prerender = false` to load directly from the latest JSON without rebuilding the site.

## Non-goals & Assumptions
- Read-only reference experience: no authentication, comments, wishlists, or cart flows.
- Desktop-first minimal UI; additional filters (notes, perfumer, concentration, etc.) can be layered on the existing data if needed.
- Hosting assumes a static-friendly platform (e.g., Vercel, Netlify, or Astro SSR adapter) serving the `/public/data` directory as-is.

## Next Steps Ideas
- Layer additional filters (perfumer, notes, concentration, longevity) onto the existing search island.
- Add precomputed similarity lookups to cross-link fragrances using `similar_slugs`.
- Integrate analytics or search logging to understand popular queries while keeping the app stateless.
