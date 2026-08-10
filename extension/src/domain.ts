export type ProviderKind = "doordash_storefront" | "uber_eats";

export interface CartLine {
  readonly name: string;
  readonly quantity: number;
  readonly modifiers: readonly string[];
  readonly totalCents: number | null;
}

export interface PickupQuote {
  readonly provider: ProviderKind;
  readonly restaurantName: string;
  readonly cart: readonly CartLine[];
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly feesCents: number;
  readonly discountCents: number;
  readonly tipCents: number;
  readonly totalCents: number;
  readonly pickupWindow: string | null;
  readonly benefits: readonly string[];
  readonly capturedAt: string;
  readonly sourceUrl: string;
}

export interface CheckoutSnapshot {
  readonly url: string;
  readonly text: string;
  readonly capturedAt: string;
}

export interface QuoteComparisonResult {
  readonly kind:
    | "winner"
    | "tie"
    | "basket_mismatch"
    | "restaurant_mismatch"
    | "stale"
    | "timing_mismatch";
  readonly message: string;
  readonly savingsCents: number | null;
  readonly winner: PickupQuote | null;
}

function canonicalText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cartSignature(cart: readonly CartLine[]): string {
  return cart
    .map((line) => {
      const modifiers = line.modifiers.map(canonicalText).sort().join("+");
      return `${line.quantity}x${canonicalText(line.name)}[${modifiers}]`;
    })
    .sort()
    .join("|");
}

const MAX_QUOTE_AGE_MILLISECONDS = 10 * 60 * 1_000;

function captureTime(quote: PickupQuote): number | null {
  const milliseconds = new Date(quote.capturedAt).getTime();
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function minutesAfterMidnight(
  hoursText: string,
  minutesText: string,
  meridiem: string,
): number {
  const hours = Number(hoursText) % 12;
  const minutes = Number(minutesText);
  return hours * 60 + minutes + (meridiem.toUpperCase() === "PM" ? 720 : 0);
}

function pickupInterval(
  value: string | null,
): readonly [number, number] | null {
  if (!value) return null;
  const matches = [
    ...value.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi),
  ];
  if (matches.length < 2) return null;

  const [start, end] = matches;
  const startMinutes = minutesAfterMidnight(start[1], start[2], start[3]);
  let endMinutes = minutesAfterMidnight(end[1], end[2], end[3]);
  if (endMinutes < startMinutes) endMinutes += 24 * 60;

  return [startMinutes, endMinutes];
}

function pickupWindowsOverlap(
  first: string | null,
  second: string | null,
): boolean {
  const firstInterval = pickupInterval(first);
  const secondInterval = pickupInterval(second);
  if (!firstInterval || !secondInterval) return false;

  return (
    Math.max(firstInterval[0], secondInterval[0]) <=
    Math.min(firstInterval[1], secondInterval[1])
  );
}

export class QuoteComparison {
  private readonly first: PickupQuote;
  private readonly second: PickupQuote;

  constructor(
    first: PickupQuote,
    second: PickupQuote,
  ) {
    this.first = first;
    this.second = second;
  }

  get result(): QuoteComparisonResult {
    const firstCapturedAt = captureTime(this.first);
    const secondCapturedAt = captureTime(this.second);
    if (
      firstCapturedAt === null ||
      secondCapturedAt === null ||
      Math.abs(firstCapturedAt - secondCapturedAt) >
        MAX_QUOTE_AGE_MILLISECONDS
    ) {
      return {
        kind: "stale",
        message: "Capture both quotes within ten minutes.",
        savingsCents: null,
        winner: null,
      };
    }

    if (
      canonicalText(this.first.restaurantName) !==
      canonicalText(this.second.restaurantName)
    ) {
      return {
        kind: "restaurant_mismatch",
        message: "These quotes belong to different restaurants.",
        savingsCents: null,
        winner: null,
      };
    }

    if (cartSignature(this.first.cart) !== cartSignature(this.second.cart)) {
      return {
        kind: "basket_mismatch",
        message: "The carts are not equivalent yet.",
        savingsCents: null,
        winner: null,
      };
    }

    if (
      !pickupWindowsOverlap(
        this.first.pickupWindow,
        this.second.pickupWindow,
      )
    ) {
      return {
        kind: "timing_mismatch",
        message: "The pickup windows do not overlap.",
        savingsCents: null,
        winner: null,
      };
    }

    if (this.first.totalCents === this.second.totalCents) {
      return {
        kind: "tie",
        message: "The exact pickup totals are tied.",
        savingsCents: 0,
        winner: null,
      };
    }

    const winner =
      this.first.totalCents < this.second.totalCents
        ? this.first
        : this.second;

    return {
      kind: "winner",
      message: `${providerName(winner.provider)} is cheaper.`,
      savingsCents: Math.abs(this.first.totalCents - this.second.totalCents),
      winner,
    };
  }
}

export function providerName(provider: ProviderKind): string {
  return provider === "uber_eats" ? "Uber Eats" : "Restaurant direct";
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}
