# Kips Bay / Murray Hill feasibility study

Status: 25-restaurant discovery panel surfaced, first anonymous pass and two signed-in basket comparisons complete; multi-day repetition not started
Verified: 2026-08-09  
Study center: East 34th Street and Third Avenue, New York, NY 10016  
Boundary: all 25 candidates fit within an OpenStreetMap pedestrian-route estimate of 11 minutes; field calibration remains pending

This is dated research evidence, not live Sidewalk pricing. The POC renders only
captured facts and labels them with their observation date.

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
- All 25 catalog entries now appear in the POC even when checkout evidence is
  absent. Six currently have captured baskets; catalog-only entries never receive
  synthetic availability, prices, or totals.
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

The preliminary public menu observations are in
[`observations.json`](./observations.json). The first live anonymous pickup pass
is in [`checkout-observations.json`](./checkout-observations.json). The first
signed-in-where-available comparison is in
[`signed-in-checkout-observations.json`](./signed-in-checkout-observations.json).
The first promotion-threshold comparison is in
[`threshold-checkout-observations.json`](./threshold-checkout-observations.json).
The live files supersede preliminary rows when they conflict.

## First anonymous checkout pass

The evening pass tested five restaurants without signing in, entering personal
information, or placing an order:

| Restaurant | Basket | Direct result | Marketplace result | Conclusion |
| --- | --- | --- | --- | --- |
| Pio Pio 7 | Whole Juanita's Chicken | $28 menu price; channels closed or not accepting orders | DoorDash $28 menu price; closed | Equivalent menu price, no immediate quote |
| Tara Rose | Tara Rose Burger | $23 menu price; not accepting orders | Uber Eats $23 menu price; available Monday | Earlier $14 Classic Burger basket is obsolete |
| Bhatti Indian Grill | Dilli Ka Butter Chicken | Exact checkout: $23.95 + $2.12 tax = **$26.07** with $0 tip and no fee | DoorDash cart: $23.95, final total hidden behind sign-in; Uber Eats stopped at a security challenge | Exact direct quote, no defensible winner |
| Little Ruby's Murray Hill | Classic Cheeseburger | Active-cart total: $16.50 + $1.46 tax = **$17.96** | Uber Eats cart: $16.50, final total hidden behind sign-in | Exact cart total, no defensible winner |
| Banc Cafe | The Banker | $23 public menu price; online ordering unavailable | DoorDash $23 menu price; order-for-later only | Equivalent menu price, no immediate quote |

This is a useful negative result. Availability is part of a quote's identity,
not a decoration, and anonymous marketplace checkout is often intentionally
incomplete. The POC must say `unavailable` or `sign-in required` instead of
estimating a winner from menu prices.

The pass also invalidated two seed assumptions: Tara Rose no longer exposes the
$14 Classic Burger, and Bhatti's live Uber Eats item price was $23.95 rather than
the previously indexed $24. This is essential menu-version and freshness
complexity, not evidence that we need a generalized crawler.

## Next open-hours capture targets

A late-evening preflight on August 9 confirmed the next two comparison targets
without creating scheduled orders:

| Restaurant | Verified location | Single-basket target | Channels ready for an open-hours pass | Current constraint |
| --- | --- | --- | --- | --- |
| Bhatti Indian Grill | 100 Lexington Avenue | One Dilli Ka Butter Chicken with every optional add-on unselected | DoorDash-powered storefront and Uber Eats both showed the same item at $23.95 | Both channels were closed; the storefront showed a noon opening |
| Little Ruby's Murray Hill | 442 Third Avenue | One Classic Cheeseburger with no modifiers | Toast and Uber Eats resolve to the same location; Uber showed the target at $16.50 | Both channels were closed; Toast hides its live menu until Monday at 9 AM |

Bhatti's direct item dialog exposed only optional add-on groups, including naan
and rice, so the unmodified entrée is a reproducible basket. Little Ruby's Toast
configuration still needs to be rechecked while open before its Uber basket can
be declared equivalent. Uber also displayed account-specific and time-limited
offers during the preflight; those are observations to recapture at checkout,
not durable basket assumptions.

## First qualifying comparison

At 11:12 PM local time, Kips Bay Deli was accepting immediate pickup orders on
its Slice-powered direct site and Uber Eats. The basket was one `16. Reuben on
Rye Classic Deli Sandwich`, size Roll, with no extras:

| Channel | Account context | Item | Tax | Fee | Tip | Final total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Restaurant direct (Slice) | Anonymous | $9.99 | $0.89 | $1.99 | $0 | **$12.87** |
| Uber Eats | Signed in | $11.19 | $0.99 | $0 | $0 | **$12.18** |

The quotes were captured 50 seconds apart and immediately rechecked. Uber Eats
was **$0.69 cheaper** despite its $1.20 higher item price because the direct
checkout added a $1.99 service fee. No promotion applied. DoorDash was excluded
because the similarly named result it surfaced was a different physical
location. Both temporary carts were cleared and no order was placed.

This result changes one rule from the anonymous pass: comparisons should model
the account context actually available on each channel, not require every
channel to share an artificial context. The context must be recorded per quote,
and repetitions should test how much it changes the result.

## First promotion-threshold comparison

The same session tested two matching Roll Reubens, the smallest simple basket
that crossed Uber's visible $20 promotion minimum:

| Channel | Account context | Item | Discount | Tax | Fee | Final total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Restaurant direct (Slice) | Anonymous | $19.98 | $0 | $1.77 | $1.99 | **$23.74** |
| Uber Eats | Signed in | $22.38 | $6.12 | $1.54 | $0 | **$17.80** |

Uber applied a $5 promotion and a separately labeled $1.12 Membership Benefit.
The two checkouts were rechecked together inside five seconds. Uber was
**$5.94 cheaper**, even though its pre-discount item subtotal was $2.40 higher.
This is direct evidence that menu-price comparison alone can select the wrong
channel and that threshold baskets must remain distinct from single baskets.

## Complexity assessment

| Class | Complexity in this POC | Treatment now |
| --- | --- | --- |
| Essential | Physical-location identity, pedestrian reachability, equivalent baskets and modifiers, conditional promotions, account personalization, freshness, and final payable total | Model explicitly in the observation protocol |
| Imported | Dynamic provider UIs, sign-in state, anti-automation controls, opaque restaurant/provider handoffs, platform terms, and inconsistent public pages | Isolate through manual/browser-assisted collection; do not pretend it is our domain |
| Accidental | A generalized crawler, adapter framework, database, queue, cache, accounts, recommendations, or service split before data feasibility is known | Do not build |
| Transitional | A fixed study center, a curated 25-restaurant ledger, manual route checks, and human-assisted checkout capture | Accept for the one-to-two-week experiment, then delete or replace only if evidence warrants it |
| Unknown | How often totals change, how much offers personalize, how many baskets are genuinely comparable, and which provider families dominate the neighborhood | Measure before choosing architecture |

Decision: continue Phase 0 and surface the qualifying evidence in the existing
POC. The essential difficulty remains acquiring a trustworthy equivalent
checkout quote, not inventing an adapter hierarchy.

## Evidence and quote rules

Every observation gets one of these levels:

1. `exact_checkout`: same fulfillment mode, location, basket, and modifiers;
   each channel's account context is recorded, and the final payable total is
   visible immediately before order.
2. `exact_active_cart`: subtotal, tax, and cart total are visible, but the final
   checkout page was not captured. This remains distinct from checkout.
3. `exact_menu`: exact public item and modifier prices, but no final checkout
   total. Useful for parity work, never sufficient to declare a winner.
4. `estimated`: at least one component is inferred, stale, unmatched, or hidden.
5. `unavailable`: the channel or equivalent basket could not be obtained.

An exact comparison requires all channels to be captured within a 10-minute
window. Account context is explicit for every quote so personalization can be
measured rather than hidden. Pickup and delivery are never mixed. A promotion
is recorded with minimum spend, maximum discount, eligible items, membership
requirement, expiration, and whether it was automatically applied.

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

### Days 3–5: basket and channel coverage (first five complete)

- Confirm the `single` and `threshold` baskets.
- Capture anonymous/public menu observations for restaurant direct, DoorDash,
  and Uber Eats where present.
- Record unsupported modifiers and channel-specific menu gaps rather than
  forcing a match.

### Days 6–10: exact quote repetition (next)

- Capture final pickup totals within one 10-minute comparison window.
- Record a timestamp for every channel observation; the first live pass only
  recorded the session date and therefore cannot declare a comparison winner.
- Repeat at lunch and dinner on at least three nonconsecutive days.
- Record collection time and every blocked, broken, or ambiguous attempt.
- Only after the anonymous pass, repeat a small subset in the user's signed-in
  accounts to measure personalization separately.

## Advancement gates

For the concierge POC, discovery coverage is measured against the fixed
25-restaurant evaluation panel in this directory. Restaurants leave the
denominator only when closure, duplicate identity, or an observed walk over 15
minutes is verified, and each removal requires a replacement. This makes the
gate reproducible without pretending the panel is an exhaustive census of every
restaurant in the neighborhood. A separate held-out sample is required before
claiming broader NYC recall.

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

### Current gate snapshot

| Gate signal | Evidence so far | Judgment |
| --- | --- | --- |
| Relevant restaurant discovery | 25 of 25 fixed-panel restaurants appear in the POC; six have checkout research | 100% panel recall passes the POC gate; neighborhood-wide recall remains unproven |
| Correct physical-location matching | One DoorDash same-name/different-address result was detected and rejected | Identity rule works; sample is too small for a rate |
| Exact comparison coverage | Two complete comparisons, both for Kips Bay Deli | Proven possible, not broad enough for the 70% gate |
| Equivalent baskets | 2 of 2 declared comparisons used identical item, size, quantity, and modifiers | 100% in a very small sample |
| Winner recheck stability | 2 of 2 winners remained unchanged on immediate recheck | 100% in a very small sample |
| Meaningful savings | $0.69 on the single basket and $5.94 on the threshold basket | Promising; frequency remains unknown |
| Manual capture time and adapter burden | Capture duration is not yet recorded consistently; no automated adapter exists | Unknown |

## Keys and access

No key is required for this seed pass: the 25 initial routes were obtained from
OpenStreetMap's pedestrian service. A production or higher-volume experiment may
still warrant Mapbox or another supported routing API after manual checks confirm
the boundary. Signed-in Uber Eats and DoorDash observations require
the user's existing browser sessions and explicit permission; they are not API-key
work.

## Public-repository boundary

Only stable public source URLs, restaurant/menu facts, sanitized totals, and the
collection protocol belong in this repository. Do not commit screenshots,
cookies, browser profiles, checkout or cart identifiers, authentication URLs,
account details, personal addresses, contact fields, or scratch notes.

## Primary source examples

- [Sarge's official site links directly to Toast](https://sargesdeli.com/)
- [Pio Pio 7 lists Toast, Storefront, and DoorDash](https://www.piopio.shop/pio-7-kips-bay)
- [Nom Nam links to Sauce](https://www.nomnamnyc.com/)
- [Banc links to Toast pickup, Grubhub, and DoorDash](https://www.banccafe.com/delivery-pickup)
- [Patrizia's links to Toast and Sauce](https://www.patrizias.com/location/patrizias-manhattan/)
- [Momosan links to order.online](https://momosanramen.com/restaurants/lexington/)
- [Kips Bay Deli identifies Slice as its provider](https://www.kipsbaydeli.com/)
- [Medium Rare's storefront identifies DoorDash Commerce Platform](https://sf-classic.order.online/store/medium-rare-31602501/)
