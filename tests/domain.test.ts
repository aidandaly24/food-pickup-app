import assert from "node:assert/strict";
import test from "node:test";
import {
  QuoteComparison,
  type PickupObservation,
} from "../app/domain.ts";

const DOORDASH_CHANNEL: PickupObservation["channel"] = {
  kind: "doordash",
  name: "DoorDash",
  shortName: "DD",
  provider: "DoorDash",
};

function observation(
  overrides: Partial<PickupObservation> = {},
): PickupObservation {
  return {
    id: "direct",
    captureRunId: "run-1",
    restaurantId: "restaurant-1",
    basketKey: "basket-1",
    itemSignature: "One configured item; quantity 1",
    fulfillment: "pickup",
    channel: {
      kind: "direct",
      name: "Restaurant direct",
      shortName: "DIR",
      provider: "Test provider",
    },
    availability: "available_now",
    captureStage: "checkout",
    result: "exact_checkout",
    accountContext: "anonymous",
    itemsSubtotalCents: 2_000,
    taxCents: 178,
    feesCents: 0,
    discountCents: 0,
    tipCents: 0,
    finalTotalCents: 2_178,
    basketComparable: true,
    capturedAt: "2026-08-10T12:00:00-04:00",
    promotions: [],
    sourceUrl: "https://example.com/direct",
    ...overrides,
  };
}

test("names a winner from time-matched checkouts with recorded channel contexts", () => {
  const direct = observation();
  const marketplace = observation({
    id: "marketplace",
    channel: DOORDASH_CHANNEL,
    accountContext: "signed_in",
    feesCents: 172,
    finalTotalCents: 2_350,
    capturedAt: "2026-08-10T12:08:00-04:00",
  });

  const outcome = new QuoteComparison([marketplace, direct]).outcome;

  assert.equal(outcome.kind, "winner");
  assert.equal(outcome.winner?.id, "direct");
  assert.equal(outcome.savingsCents, 172);
});

test("does not promote an active-cart total into a winner", () => {
  const activeCart = observation({
    result: "exact_active_cart",
    captureStage: "active_cart",
    capturedAt: undefined,
  });
  const menuOnly = observation({
    id: "menu",
    result: "availability_blocked",
    captureStage: "menu",
    finalTotalCents: null,
    capturedAt: undefined,
  });

  const comparison = new QuoteComparison([activeCart, menuOnly]);

  assert.equal(comparison.outcome.kind, "incomplete");
  assert.equal(comparison.outcome.headline, "No winner yet");
  assert.equal(comparison.mostCompleteObservation.id, activeCart.id);
});

test("rejects exact checkout totals captured outside ten minutes", () => {
  const first = observation();
  const second = observation({
    id: "later",
    channel: DOORDASH_CHANNEL,
    capturedAt: "2026-08-10T12:11:00-04:00",
  });

  const outcome = new QuoteComparison([first, second]).outcome;

  assert.equal(outcome.kind, "incomplete");
  assert.equal(outcome.headline, "Quotes are too far apart");
});

test("compares scheduled quotes only when pickup windows overlap", () => {
  const direct = observation({
    pickupWindowStart: "2026-08-10T13:30:00-04:00",
    pickupWindowEnd: "2026-08-10T14:00:00-04:00",
  });
  const marketplace = observation({
    id: "marketplace",
    channel: DOORDASH_CHANNEL,
    feesCents: 172,
    finalTotalCents: 2_350,
    pickupWindowStart: "2026-08-10T13:30:00-04:00",
    pickupWindowEnd: "2026-08-10T13:50:00-04:00",
  });

  const outcome = new QuoteComparison([direct, marketplace]).outcome;

  assert.equal(outcome.kind, "winner");
  assert.equal(outcome.winner?.id, "direct");
});

test("rejects scheduled quotes whose pickup windows do not overlap", () => {
  const direct = observation({
    pickupWindowStart: "2026-08-10T13:30:00-04:00",
    pickupWindowEnd: "2026-08-10T13:50:00-04:00",
  });
  const marketplace = observation({
    id: "marketplace",
    channel: DOORDASH_CHANNEL,
    pickupWindowStart: "2026-08-10T14:00:00-04:00",
    pickupWindowEnd: "2026-08-10T14:20:00-04:00",
  });

  assert.equal(
    new QuoteComparison([direct, marketplace]).outcome.headline,
    "Pickup windows do not overlap",
  );
});

test("rejects a scheduled quote mixed with an ASAP quote", () => {
  const scheduled = observation({
    id: "marketplace",
    channel: DOORDASH_CHANNEL,
    pickupWindowStart: "2026-08-10T13:30:00-04:00",
    pickupWindowEnd: "2026-08-10T13:50:00-04:00",
  });

  assert.equal(
    new QuoteComparison([observation(), scheduled]).outcome.headline,
    "Pickup timing mismatch",
  );
});

test("rejects an incomplete scheduled pickup window", () => {
  const direct = observation({
    pickupWindowStart: "2026-08-10T13:30:00-04:00",
    pickupWindowEnd: "2026-08-10T14:00:00-04:00",
  });
  const marketplace = observation({
    id: "marketplace",
    channel: DOORDASH_CHANNEL,
    pickupWindowStart: "2026-08-10T13:30:00-04:00",
  });

  assert.equal(
    new QuoteComparison([direct, marketplace]).outcome.headline,
    "Pickup timing is invalid",
  );
});

test("requires two distinct channels with valid timestamps", () => {
  const duplicateDirect = observation({ id: "direct-again" });
  const marketplace = observation({
    id: "marketplace",
    channel: DOORDASH_CHANNEL,
  });
  const invalidTimestamp = observation({
    id: "marketplace",
    channel: DOORDASH_CHANNEL,
    capturedAt: "not-a-timestamp",
  });

  assert.equal(
    new QuoteComparison([observation(), duplicateDirect, marketplace]).outcome
      .headline,
    "Duplicate channel quotes",
  );
  assert.equal(
    new QuoteComparison([observation(), invalidTimestamp]).outcome.headline,
    "Quote timing is invalid",
  );
});

test("rejects quotes with different run or basket identities", () => {
  const marketplace = observation({
    id: "marketplace",
    channel: DOORDASH_CHANNEL,
    captureRunId: "run-2",
  });

  assert.equal(
    new QuoteComparison([observation(), marketplace]).outcome.headline,
    "Quote identity mismatch",
  );

  assert.equal(
    new QuoteComparison([
      observation(),
      observation({
        id: "other-basket",
        channel: DOORDASH_CHANNEL,
        basketKey: "basket-2",
      }),
    ]).outcome.headline,
    "Quote identity mismatch",
  );
});

test("rejects an exact checkout whose components do not reconcile", () => {
  const marketplace = observation({
    id: "marketplace",
    channel: DOORDASH_CHANNEL,
    finalTotalCents: 2_179,
  });

  assert.equal(
    new QuoteComparison([observation(), marketplace]).outcome.headline,
    "Checkout total is inconsistent",
  );
});

test("validates an inconsistent exact checkout even without a comparison", () => {
  const inconsistent = observation({
    basketComparable: false,
    finalTotalCents: 2_179,
  });

  assert.equal(
    new QuoteComparison([inconsistent]).outcome.headline,
    "Checkout total is inconsistent",
  );

  assert.equal(
    new QuoteComparison([observation({ finalTotalCents: null })]).outcome
      .headline,
    "Checkout total is inconsistent",
  );
});

test("reports equal exact checkout totals as a tie", () => {
  const marketplace = observation({
    id: "marketplace",
    channel: DOORDASH_CHANNEL,
  });
  const outcome = new QuoteComparison([observation(), marketplace]).outcome;

  assert.equal(outcome.kind, "tie");
  assert.equal(outcome.headline, "Pickup totals are tied");
  assert.equal(outcome.winner, undefined);
  assert.equal(outcome.savingsCents, undefined);
});
