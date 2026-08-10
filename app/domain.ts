export type ChannelKind = "direct" | "doordash" | "uber-eats";
export type QuoteConfidence = "exact" | "estimated";

export interface OrderingChannel {
  readonly kind: ChannelKind;
  readonly name: string;
  readonly shortName: string;
  readonly provider?: string;
}

export interface PersonalOffer {
  readonly label: string;
  readonly discountCents: number;
}

export interface PickupQuote {
  readonly id: string;
  readonly channel: OrderingChannel;
  readonly itemsSubtotalCents: number;
  readonly feesCents: number;
  readonly taxCents: number;
  readonly publicDiscountCents: number;
  readonly publicOffer?: string;
  readonly personalOffer?: PersonalOffer;
  readonly offerCondition?: string;
  readonly freshnessMinutes: number;
  readonly confidence: QuoteConfidence;
}

export interface Restaurant {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly cuisine: string;
  readonly description: string;
  readonly address: string;
  readonly walkMinutes: number;
  readonly hasOrderedBefore: boolean;
  readonly accent: string;
  readonly basketName: string;
  readonly basketItems: readonly string[];
  readonly quotes: readonly PickupQuote[];
}

export interface RankedQuote {
  readonly quote: PickupQuote;
  readonly discountCents: number;
  readonly totalCents: number;
  readonly appliedOffers: readonly string[];
}

/**
 * The one earned abstraction in the POC: every restaurant needs identical,
 * auditable quote math for both its discovery card and comparison panel.
 */
export class QuoteComparison {
  public constructor(
    private readonly quotes: readonly PickupQuote[],
    private readonly includePersonalOffers: boolean,
  ) {
    if (quotes.length < 2) {
      throw new Error("A comparison requires at least two pickup quotes.");
    }
  }

  public get rankedQuotes(): readonly RankedQuote[] {
    return this.quotes
      .map((quote) => this.rank(quote))
      .sort((left, right) => left.totalCents - right.totalCents);
  }

  public get winner(): RankedQuote {
    return this.rankedQuotes[0];
  }

  public get savingsAgainstNextBestCents(): number {
    const [winner, runnerUp] = this.rankedQuotes;
    return Math.max(0, runnerUp.totalCents - winner.totalCents);
  }

  private rank(quote: PickupQuote): RankedQuote {
    const personalDiscount = this.includePersonalOffers
      ? (quote.personalOffer?.discountCents ?? 0)
      : 0;
    const discountCents = quote.publicDiscountCents + personalDiscount;
    const appliedOffers = [
      quote.publicOffer,
      this.includePersonalOffers ? quote.personalOffer?.label : undefined,
    ].filter((offer): offer is string => Boolean(offer));

    return {
      quote,
      discountCents,
      appliedOffers,
      totalCents: Math.max(
        0,
        quote.itemsSubtotalCents +
          quote.feesCents +
          quote.taxCents -
          discountCents,
      ),
    };
  }
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
