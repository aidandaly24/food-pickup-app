# Sidewalk

A TypeScript proof of concept for discovering walkable NYC pickup restaurants
and comparing the same basket across restaurant websites, DoorDash, and Uber
Eats.

The current build uses real, dated observations from a six-restaurant Kips Bay
and Murray Hill feasibility study. It does not claim those observations are live
or name a cheapest channel without two equivalent, time-matched checkout totals.

The first qualifying comparison found Uber Eats $0.69 cheaper than Kips Bay
Deli's direct checkout for one equivalent pickup basket. That is a dated
observation, not a claim that Uber Eats is always cheaper.

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run lint
npm test
```

## Code shape

- `app/domain.ts` contains the domain types and the shared comparison invariant.
- `app/study-data.ts` converts the public research files into the UI model.
- `app/study-map.tsx` provides the Leaflet/OpenStreetMap map.
- `app/page.tsx` contains the interactive discovery and comparison POC.
- `app/globals.css` contains the responsive visual system.

No database, authentication, queue, scraper, or provider framework is included
until a feasibility experiment demonstrates the need.

## Phase 0 research

The first real-data feasibility study is scoped to Kips Bay and Murray Hill. Its
25-restaurant seed ledger, evidence rules, complexity assessment, and collection
protocol live in
[`research/phase-0/kips-bay-murray-hill`](./research/phase-0/kips-bay-murray-hill/README.md).

The app reads the sanitized Phase 0 files directly. Menu-only and blocked
observations remain visibly incomplete; only exact checkout evidence is eligible
to produce a comparison winner.

## Map data

The map uses the open-source [Leaflet](https://leafletjs.com/) library and
OpenStreetMap coordinates and tiles. OpenStreetMap attribution is displayed in
the map, and this low-volume POC follows the public tile-service usage policy.
