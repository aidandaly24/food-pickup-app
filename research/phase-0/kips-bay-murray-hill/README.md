# Kips Bay / Murray Hill feasibility study

Status: seed pass complete; repeated checkout observations not started  
Verified: 2026-08-09  
Study center: East 34th Street and Third Avenue, New York, NY 10016  
Boundary: all 25 candidates fit within an OpenStreetMap pedestrian-route estimate of 11 minutes; field calibration remains pending

This is research data, not live Sidewalk product data. The deployed POC remains
explicitly fictional until the study produces trustworthy, comparable checkout
quotes.

## Product question

For one person at one saved Manhattan location, can Sidewalk reliably answer:

> Which real restaurants are within a true 15-minute walk, which ordering
> channels serve the same pickup basket, and which channel has the lowest final
> payable total right now?

A result is useful only when it identifies the correct physical location,
compares equivalent items and modifiers, distinguishes public from personalized
offers, and states whether the total is exact or estimated.

## What this seed pass established

- The seed catalog contains 25 real restaurants with street addresses and source
  URLs in [`restaurants.json`](./restaurants.json).
- All 25 candidates resolved to pedestrian routes of 2–11 estimated minutes from
  the study center. The route evidence is in [`routes.json`](./routes.json); it
  still needs spot-calibration for walking pace and signal delay.
- A restaurant-branded ordering link is not a provider. The initial set already
  includes Toast, DoorDash Commerce Platform (`order.online`), Sauce, Slice,
  Grubhub-backed ordering, and brand-owned or unresolved storefronts.
- A single restaurant may expose multiple nominally "direct" choices. Pio Pio 7,
  for example, links to Toast, DoorDash Storefront, and DoorDash Marketplace from
  its own location page.
- Menu parity cannot be assumed. Little Ruby's Bronte description differs between
  currently indexed sources even when the item name is the same.
- Public list-price differences exist, but not for every restaurant. Pio Pio's
  Matador Combo is currently listed at $76 on both Toast and DoorDash, while
  other sampled items show small cross-channel differences.
- Public pages are insufficient for a trusted winner. Taxes, pickup fees,
  minimums, promotions, account state, and final totals usually appear only in
  an active cart or at checkout.
- Restaurant websites are themselves unreliable data. Penelope's otherwise
  legitimate official page currently contains unrelated spam links in its
  footer, so blindly following or crawling every first-party link would be a
  security and data-quality mistake.

The public menu observations supporting these findings are in
[`observations.json`](./observations.json). They are deliberately labeled
`menu_only`; none is an exact checkout quote.

## Complexity assessment

| Class | Complexity in this POC | Treatment now |
| --- | --- | --- |
| Essential | Physical-location identity, pedestrian reachability, equivalent baskets and modifiers, conditional promotions, account personalization, freshness, and final payable total | Model explicitly in the observation protocol |
| Imported | Dynamic provider UIs, sign-in state, anti-automation controls, opaque restaurant/provider handoffs, platform terms, and inconsistent public pages | Isolate through manual/browser-assisted collection; do not pretend it is our domain |
| Accidental | A generalized crawler, adapter framework, database, queue, cache, accounts, recommendations, or service split before data feasibility is known | Do not build |
| Transitional | A fixed study center, a curated 25-restaurant ledger, manual route checks, and human-assisted checkout capture | Accept for the one-to-two-week experiment, then delete or replace only if evidence warrants it |
| Unknown | How often totals change, how much offers personalize, how many baskets are genuinely comparable, and which provider families dominate the neighborhood | Measure before choosing architecture |

Decision: continue Phase 0. Do not expand the product or replace the demo data
yet. The essential difficulty is acquiring a trustworthy equivalent checkout
quote, not rendering a restaurant card or inventing an adapter hierarchy.

## Evidence and quote rules

Every observation gets one of these levels:

1. `exact_checkout`: same fulfillment mode, location, basket, modifiers, account
   context, and timestamp; final payable total visible immediately before order.
2. `exact_menu`: exact public item and modifier prices, but no final checkout
   total. Useful for parity work, never sufficient to declare a winner.
3. `estimated`: at least one component is inferred, stale, unmatched, or hidden.
4. `unavailable`: the channel or equivalent basket could not be obtained.

An exact comparison requires all channels to be captured within a 10-minute
window. Personalized and anonymous/public observations are separate experiments.
Pickup and delivery are never mixed. A promotion is recorded with minimum spend,
maximum discount, eligible items, membership requirement, expiration, and
whether it was automatically applied.

## Representative baskets

Each restaurant starts with two deliberately boring baskets:

- `single`: one popular entrée plus the smallest normal accompaniment needed to
  make it a plausible one-person order.
- `threshold`: the same core food scaled with a side or second entrée to cross
  the first visible promotion minimum, when one exists.

The anchor item in `restaurants.json` is only a candidate until its exact name,
size, included sides, required modifiers, and availability are confirmed on at
least two channels. This prevents a "same name" match from becoming a false
equivalence.

## Collection schedule

### Days 1–2: identity and walking coverage (routing seed complete)

- Confirm the storefront is open and the address identifies the same kitchen on
  every channel.
- Spot-check the pedestrian routes from the study center; remove candidates over
  15 observed minutes or whose storefront identity is wrong.
- Replace removed candidates to keep approximately 25 restaurants.

### Days 3–5: basket and channel coverage

- Confirm the `single` and `threshold` baskets.
- Capture anonymous/public menu observations for restaurant direct, DoorDash,
  and Uber Eats where present.
- Record unsupported modifiers and channel-specific menu gaps rather than
  forcing a match.

### Days 6–10: exact quote repetition

- Capture final pickup totals within one 10-minute comparison window.
- Repeat at lunch and dinner on at least three nonconsecutive days.
- Record collection time and every blocked, broken, or ambiguous attempt.
- Only after the anonymous pass, repeat a small subset in the user's signed-in
  accounts to measure personalization separately.

## Advancement gates

Do not move to the technical POC until the sample shows:

- at least 80% of relevant nearby restaurants are discoverable;
- at least 95% of channel links resolve to the correct physical location;
- exact checkout quotes are obtainable for at least 70% of selected restaurants;
- at least 80% of captured comparisons use genuinely equivalent baskets;
- at least 90% of reported winners remain valid when immediately rechecked;
- the median manual capture takes five minutes or less per restaurant;
- meaningful savings appear often enough to matter; and
- no provider family requires repair or manual interpretation on most attempts.

These are experiment thresholds, not product promises. After ten days we should
keep, revise, or reject them based on the actual failure distribution.

## Keys and access

No key is required for this seed pass: the 25 initial routes were obtained from
OpenStreetMap's pedestrian service. A production or higher-volume experiment may
still warrant Mapbox or another supported routing API after manual checks confirm
the boundary. Signed-in Uber Eats and DoorDash observations require
the user's existing browser sessions and explicit permission; they are not API-key
work.

## Primary source examples

- [Sarge's official site links directly to Toast](https://sargesdeli.com/)
- [Pio Pio 7 lists Toast, Storefront, and DoorDash](https://www.piopio.shop/pio-7-kips-bay)
- [Nom Nam links to Sauce](https://www.nomnamnyc.com/)
- [Banc links to Toast pickup, Grubhub, and DoorDash](https://www.banccafe.com/delivery-pickup)
- [Patrizia's links to Toast and Sauce](https://www.patrizias.com/location/patrizias-manhattan/)
- [Momosan links to order.online](https://momosanramen.com/restaurants/lexington/)
- [Kips Bay Deli identifies Slice as its provider](https://www.kipsbaydeli.com/)
- [Medium Rare's storefront identifies DoorDash Commerce Platform](https://sf-classic.order.online/store/medium-rare-31602501/)
