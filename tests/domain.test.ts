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
    finalTotalCents: 2_100,
    capturedAt: "2026-08-10T12:11:00-04:00",
  });

  const outcome = new QuoteComparison([first, second]).outcome;

  assert.equal(outcome.kind, "incomplete");
  assert.equal(outcome.headline, "Quotes are too far apart");
});

test("requires two distinct channels with valid timestamps", () => {
  const duplicateDirect = observation({ id: "direct-again" });
  const invalidTimestamp = observation({
    id: "marketplace",
    channel: DOORDASH_CHANNEL,
    capturedAt: "not-a-timestamp",
  });

  assert.equal(
    new QuoteComparison([observation(), duplicateDirect]).outcome.kind,
    "incomplete",
  );
  assert.equal(
    new QuoteComparison([observation(), invalidTimestamp]).outcome.headline,
    "Quote timing is invalid",
  );
});
