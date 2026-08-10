import type {
  CartLine,
  CheckoutSnapshot,
  PickupQuote,
  ProviderKind,
} from "./domain.js";

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function money(value: string): number | null {
  const match = value.match(/^(-)?\$([\d,]+(?:\.\d{2})?)$/);
  if (!match) return null;

  const cents = Math.round(Number(match[2].replaceAll(",", "")) * 100);
  return match[1] ? -cents : cents;
}

function amountAfter(allLines: readonly string[], label: RegExp): number | null {
  for (const [labelIndex, line] of allLines.entries()) {
    if (!label.test(line)) continue;

    for (const candidate of allLines.slice(labelIndex + 1, labelIndex + 4)) {
      const amount = money(candidate);
      if (amount !== null) return amount;
    }
  }

  return null;
}

function textAfter(allLines: readonly string[], label: RegExp): string | null {
  const labelIndex = allLines.findIndex((line) => label.test(line));
  return labelIndex >= 0 ? (allLines[labelIndex + 1] ?? null) : null;
}

function pickupWindowAfter(allLines: readonly string[]): string | null {
  const labelIndex = allLines.findIndex((line) =>
    /^(Pickup time|Scheduled)$/i.test(line),
  );
  if (labelIndex < 0) return null;

  return (
    allLines
      .slice(labelIndex + 1, labelIndex + 9)
      .find((line) => /\d{1,2}:\d{2}\s*(?:AM|PM)|\bASAP\b/i.test(line)) ??
    null
  );
}

function stableSourceUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  const pathWithoutCheckoutIdentity = url.pathname.replace(
    /\/checkout\/[^/]+.*$/,
    "",
  );
  return `${url.origin}${pathWithoutCheckoutIdentity}`;
}

function requiredAmount(
  allLines: readonly string[],
  label: RegExp,
  field: string,
): number {
  const value = amountAfter(allLines, label);
  if (value === null) throw new Error(`Could not read ${field}.`);
  return value;
}

export abstract class CheckoutParser {
  abstract readonly provider: ProviderKind;
  abstract supports(url: URL): boolean;
  protected abstract parseCart(allLines: readonly string[]): readonly CartLine[];
  protected abstract restaurantName(allLines: readonly string[]): string | null;

  parse(snapshot: CheckoutSnapshot): PickupQuote {
    const allLines = lines(snapshot.text);
    const subtotalCents = requiredAmount(
      allLines,
      /^Subtotal$/i,
      "the subtotal",
    );
    const totalCents = requiredAmount(allLines, /^Total$/i, "the total");
    const taxCents =
      amountAfter(allLines, /^(Estimated )?Tax(?:es)?$|^Sales tax$/i) ?? 0;
    const feesCents = amountAfter(allLines, /^(Fees?|Service fee)$/i) ?? 0;
    const tipCents =
      amountAfter(allLines, /^(Tip|Tip the staff|Dasher tip)$/i) ?? 0;
    const discount =
      amountAfter(
        allLines,
        /^(Membership Benefit|Discount|Promo savings|Promotion discount)$/i,
      ) ?? 0;
    const restaurantName = this.restaurantName(allLines);
    const cart = this.parseCart(allLines);

    if (!restaurantName) throw new Error("Could not read the restaurant name.");
    if (cart.length === 0) throw new Error("Open the cart summary, then retry.");

    const discountCents = Math.abs(discount);
    const expectedTotal =
      subtotalCents + taxCents + feesCents + tipCents - discountCents;

    if (expectedTotal !== totalCents) {
      throw new Error(
        `The visible checkout components do not reconcile (${expectedTotal} !== ${totalCents}).`,
      );
    }

    return {
      provider: this.provider,
      restaurantName,
      cart,
      subtotalCents,
      taxCents,
      feesCents,
      discountCents,
      tipCents,
      totalCents,
      pickupWindow: pickupWindowAfter(allLines),
      benefits:
        discountCents > 0
          ? allLines.filter((line) => /benefit|promotion|discount/i.test(line))
          : [],
      capturedAt: snapshot.capturedAt,
      sourceUrl: stableSourceUrl(snapshot.url),
    };
  }
}

function cartSection(
  allLines: readonly string[],
  startPattern: RegExp,
  endPattern: RegExp,
): readonly string[] {
  const start = allLines.findIndex((line) => startPattern.test(line));
  const end = allLines.findIndex(
    (line, index) => index > start && endPattern.test(line),
  );

  return start >= 0
    ? allLines.slice(start + 1, end > start ? end : undefined)
    : [];
}

function groupedCartLines(section: readonly string[]): readonly CartLine[] {
  const cart: CartLine[] = [];
  let groupStart = 0;

  for (let index = 0; index < section.length; index += 1) {
    const lineTotal = money(section[index]);
    if (lineTotal === null) continue;

    const itemDetails = section
      .slice(groupStart, index)
      .filter((line) => !/^\d+$/.test(line) && !/^[×x]$/.test(line));
    const [name, ...modifiers] = itemDetails;
    if (!name) continue;

    const possibleQuantity = section[index + 1];
    const quantity = /^\d+$/.test(possibleQuantity)
      ? Number(possibleQuantity)
      : 1;

    cart.push({ name, quantity, modifiers, totalCents: lineTotal });
    groupStart = index + (quantity === 1 && possibleQuantity !== "1" ? 1 : 2);
  }

  return cart;
}

export class UberEatsCheckoutParser extends CheckoutParser {
  readonly provider = "uber_eats" as const;

  supports(url: URL): boolean {
    return url.hostname === "www.ubereats.com" && url.pathname === "/checkout";
  }

  protected restaurantName(allLines: readonly string[]): string | null {
    const pickupIndex = allLines.findIndex((line) => line === "Pickup");
    const pickupTimeIndex = allLines.findIndex((line) => line === "Pickup time");
    const between = allLines.slice(pickupIndex + 1, pickupTimeIndex);
    return between.find((line) => !/map|storefront/i.test(line)) ?? null;
  }

  protected parseCart(allLines: readonly string[]): readonly CartLine[] {
    return groupedCartLines(
      cartSection(allLines, /^Cart summary/i, /^Promotion$/i),
    );
  }
}

export class DoorDashStorefrontCheckoutParser extends CheckoutParser {
  readonly provider = "doordash_storefront" as const;

  supports(url: URL): boolean {
    return url.hostname === "order.online";
  }

  protected restaurantName(allLines: readonly string[]): string | null {
    const explicitName = textAfter(
      allLines,
      /^(Pickup from|Your order from)$/i,
    );
    if (explicitName) return explicitName;

    const addressIndex = allLines.findIndex((line) => /^Pickup address$/i.test(line));
    return addressIndex >= 0 ? (allLines[addressIndex + 2] ?? null) : null;
  }

  protected parseCart(allLines: readonly string[]): readonly CartLine[] {
    const section = cartSection(
      allLines,
      /^(Your order|Order summary)$/i,
      /^Subtotal$/i,
    );
    const cart: CartLine[] = [];

    for (let index = 0; index < section.length - 1; index += 1) {
      const match = section[index].match(/^(\d+)\s*[×x]\s+(.+)$/i);
      const sameLineMoneyIndex = match
        ? section.findIndex(
            (line, candidateIndex) =>
              candidateIndex > index && money(line) !== null,
          )
        : -1;
      if (match && sameLineMoneyIndex > index) {
        cart.push({
          name: match[2],
          quantity: Number(match[1]),
          modifiers: section.slice(index + 1, sameLineMoneyIndex),
          totalCents: money(section[sameLineMoneyIndex]),
        });
        index = sameLineMoneyIndex;
        continue;
      }

      if (
        /^\d+$/.test(section[index]) &&
        /^[×x]$/.test(section[index + 1] ?? "")
      ) {
        const name = section[index + 2];
        const splitMoneyIndex = section.findIndex(
          (line, candidateIndex) =>
            candidateIndex > index + 2 && money(line) !== null,
        );
        if (name && splitMoneyIndex > index + 2) {
          cart.push({
            name,
            quantity: Number(section[index]),
            modifiers: section.slice(index + 3, splitMoneyIndex),
            totalCents: money(section[splitMoneyIndex]),
          });
          index = splitMoneyIndex;
        }
      }
    }

    return cart.length > 0 ? cart : groupedCartLines(section);
  }
}

export const CHECKOUT_PARSERS: readonly CheckoutParser[] = [
  new UberEatsCheckoutParser(),
  new DoorDashStorefrontCheckoutParser(),
];

export function parserFor(url: string): CheckoutParser | null {
  const parsedUrl = new URL(url);
  return CHECKOUT_PARSERS.find((parser) => parser.supports(parsedUrl)) ?? null;
}
