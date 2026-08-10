import assert from "node:assert/strict";
import test from "node:test";
import {
  DoorDashStorefrontCheckoutParser,
  UberEatsCheckoutParser,
} from "../src/checkout-parser.ts";
import { QuoteComparison, type PickupQuote } from "../src/domain.ts";

const capturedAt = "2026-08-10T14:00:00.000Z";

const uberText = `
Pickup Details
Delivery
Pickup
Map
Storefront
Bhatti Indian Grill
100 Lexington Ave, New York, NY 10016
Pickup time
Mon, Aug 10, 12:30 PM — 1:00 PM
Cart summary (2 items)
Dilli Ka Butter Chicken
Spice: Mild
$23.95
1
Naan
$11.00
2
Promotion
Add promo code
Order total
Subtotal
$34.95
Membership Benefit
-$1.75
Taxes
$3.10
Total
$36.30
Place order
`;

const directText = `
Checkout
Pickup address
100 Lexington Ave, New York, NY 10016, USA
Bhatti Indian Grill
Scheduled
12:40 PM–12:50 PM
Order summary
1
×
Dilli Ka Butter Chicken
Spice: Mild
$23.95
2
×
Naan
$11.00
Subtotal
$34.95
Estimated Tax
$3.10
Fees
$0.00
Tip the staff
$0.00
Total
$38.05
Place Pickup Order
`;

test("parses an arbitrary multi-item Uber Eats checkout", () => {
  const quote = new UberEatsCheckoutParser().parse({
    url: "https://www.ubereats.com/checkout?private=value",
    text: uberText,
    capturedAt,
  });

  assert.equal(quote.totalCents, 3630);
  assert.equal(quote.discountCents, 175);
  assert.deepEqual(
    quote.cart.map(({ name, quantity }) => ({ name, quantity })),
    [
      { name: "Dilli Ka Butter Chicken", quantity: 1 },
      { name: "Naan", quantity: 2 },
    ],
  );
  assert.deepEqual(quote.cart[0]?.modifiers, ["Spice: Mild"]);
  assert.equal(quote.sourceUrl, "https://www.ubereats.com/checkout");
});

test("parses an arbitrary DoorDash storefront checkout", () => {
  const quote = new DoorDashStorefrontCheckoutParser().parse({
    url: "https://order.online/business/115609/checkout/cart-token?cart=private",
    text: directText,
    capturedAt,
  });

  assert.equal(quote.totalCents, 3805);
  assert.deepEqual(quote.cart[0]?.modifiers, ["Spice: Mild"]);
  assert.equal(quote.cart[1]?.quantity, 2);
  assert.equal(
    quote.sourceUrl,
    "https://order.online/business/115609",
  );
});

function quote(overrides: Partial<PickupQuote> = {}): PickupQuote {
  return {
    provider: "uber_eats",
    restaurantName: "Bhatti Indian Grill",
    cart: [
      {
        name: "Dilli Ka Butter Chicken",
        quantity: 1,
        modifiers: [],
        totalCents: 2395,
      },
    ],
    subtotalCents: 2395,
    taxCents: 213,
    feesCents: 0,
    discountCents: 120,
    tipCents: 0,
    totalCents: 2488,
    pickupWindow: "12:30 PM-1:00 PM",
    benefits: ["Membership Benefit"],
    capturedAt,
    sourceUrl: "https://www.ubereats.com/checkout",
    ...overrides,
  };
}

test("compares equivalent arbitrary carts", () => {
  const direct = quote({
    provider: "doordash_storefront",
    taxCents: 212,
    discountCents: 0,
    totalCents: 2607,
    pickupWindow: "12:40 PM-12:50 PM",
    sourceUrl: "https://order.online/store/bhatti-indian-grill-221684",
  });

  const result = new QuoteComparison(quote(), direct).result;

  assert.equal(result.kind, "winner");
  assert.equal(result.winner?.provider, "uber_eats");
  assert.equal(result.savingsCents, 119);
});

test("refuses to compare mismatched carts", () => {
  const direct = quote({
    provider: "doordash_storefront",
    cart: [
      {
        name: "Chicken Tikka Masala",
        quantity: 1,
        modifiers: [],
        totalCents: 2295,
      },
    ],
  });

  assert.equal(new QuoteComparison(quote(), direct).result.kind, "basket_mismatch");
});

test("refuses to compare different modifiers on the same item", () => {
  const direct = quote({
    provider: "doordash_storefront",
    cart: [
      {
        name: "Dilli Ka Butter Chicken",
        quantity: 1,
        modifiers: ["Spice: Mild"],
        totalCents: 2395,
      },
    ],
  });
  const uber = quote({
    cart: [
      {
        name: "Dilli Ka Butter Chicken",
        quantity: 1,
        modifiers: ["Spice: Hot"],
        totalCents: 2395,
      },
    ],
  });

  assert.equal(new QuoteComparison(uber, direct).result.kind, "basket_mismatch");
});

test("refuses quotes captured more than ten minutes apart", () => {
  const later = quote({ capturedAt: "2026-08-10T14:10:01.000Z" });

  assert.equal(new QuoteComparison(quote(), later).result.kind, "stale");
});

test("refuses non-overlapping pickup windows", () => {
  const laterPickup = quote({ pickupWindow: "1:10 PM-1:30 PM" });

  assert.equal(
    new QuoteComparison(quote(), laterPickup).result.kind,
    "timing_mismatch",
  );
});
