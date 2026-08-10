# Sidewalk

A TypeScript proof of concept for discovering walkable NYC pickup restaurants
and comparing the same basket across restaurant websites, DoorDash, and Uber
Eats.

The current build uses explicit demonstration data. It does not claim live
prices or connect to ordering platforms. That boundary is intentional: the POC
tests the discovery, quote, offer-context, and handoff experience before a data
collection strategy is selected.

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

- `app/domain.ts` contains the domain types and the one shared comparison class.
- `app/demo-data.ts` contains curated restaurant and quote fixtures.
- `app/page.tsx` contains the interactive POC.
- `app/globals.css` contains the responsive visual system.

No database, authentication, queue, scraper, or provider framework is included
until a feasibility experiment demonstrates the need.
