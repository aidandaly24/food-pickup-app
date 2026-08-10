# Sidewalk

A TypeScript proof of concept for discovering walkable NYC pickup restaurants
and comparing the same basket across restaurant websites, DoorDash, and Uber
Eats.

The current build discovers all 25 real restaurants in a routed Kips Bay and
Murray Hill evaluation panel. The five farthest route estimates have an
independent provider cross-check, while field walks remain pending. Seven
restaurants currently have dated checkout research. The POC does not claim
those observations are live or name a cheapest channel without two equivalent,
time-matched checkout totals for the same pickup opportunity.

The first qualifying comparison found Uber Eats $0.69 cheaper than Kips Bay
Deli's direct checkout for one equivalent pickup basket. That is a dated
observation, not a claim that Uber Eats is always cheaper.

A second, promotion-threshold basket made the reason to model deals explicit:
two matching Reubens totaled $23.74 direct and $17.80 on signed-in Uber Eats
after $6.12 in applied savings. The POC exposes both baskets separately rather
than mixing their quotes.

A scheduled Sarge's comparison added a second restaurant: signed-in Uber Eats
totaled $31.94 versus $33.47 on DoorDash for overlapping pickup windows. Toast's
lower displayed amount remains incomplete because its disclosed card surcharge
was unresolved without a payment method.

Bhatti added a third restaurant and the first comparison through a DoorDash
Commerce Platform storefront: signed-in Uber Eats totaled $24.88 versus $26.07
direct. Uber's $1.20 membership benefit reversed a one-cent pre-benefit direct
advantage.

## Browser-side acquisition spike

The next POC now targets sustainable, arbitrary-basket acquisition rather than
adding more manually curated baskets. [`extension/`](./extension/) contains a
TypeScript Chrome companion that reads exact pickup totals from an open Uber
Eats or DoorDash Commerce Platform checkout, normalizes visible cart items and
modifiers, rejects mismatches, and compares the normalized quotes locally.

The live spike has extracted the Bhatti checkout on both provider families. It
stores neither raw page text nor checkout/account identifiers and never presses
the final order action. Automatic basket replication is the next experiment.

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

The app reads the sanitized Phase 0 files directly. A restaurant can appear from
catalog and walking-route evidence before it has a quote. Menu-only and blocked
observations remain visibly incomplete; only exact checkout evidence is eligible
to produce a comparison winner.

## Map data

The map uses the open-source [Leaflet](https://leafletjs.com/) library and
OpenStreetMap coordinates and tiles. OpenStreetMap attribution is displayed in
the map, and this low-volume POC follows the public tile-service usage policy.
