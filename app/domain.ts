export type ChannelKind =
  | "direct"
  | "storefront"
  | "doordash"
  | "uber-eats";

export type Availability =
  | "available_now"
  | "not_accepting_online_orders"
  | "closed_opens_11am"
  | "available_monday_11am"
  | "online_ordering_unavailable"
  | "closed_order_for_later";

export type CaptureStage = "menu" | "cart" | "active_cart" | "checkout";

export type AccountContext = "anonymous" | "signed_in";

export type Fulfillment = "pickup";

export type BasketKind = "single" | "threshold";

export type ObservationResult =
  | "exact_checkout"
  | "exact_active_cart"
  | "checkout_blocked_by_sign_in"
  | "challenge_blocked_before_cart"
  | "availability_blocked";

export interface OrderingChannel {
  readonly kind: ChannelKind;
  readonly name: string;
  readonly shortName: string;
  readonly provider: string;
}

export interface PromotionObservation {
  readonly label: string;
  readonly applied: boolean;
  readonly conditionsVerified: boolean;
}

export interface PickupObservation {
  readonly id: string;
  readonly captureRunId: string;
  readonly restaurantId: string;
  readonly basketKey: string;
  readonly itemSignature: string;
  readonly fulfillment: Fulfillment;
  readonly channel: OrderingChannel;
  readonly availability: Availability;
  readonly captureStage: CaptureStage;
  readonly result: ObservationResult;
  readonly accountContext: AccountContext;
  readonly itemsSubtotalCents: number;
  readonly taxCents: number | null;
  readonly feesCents: number | null;
  readonly discountCents: number | null;
  readonly tipCents: number | null;
  readonly finalTotalCents: number | null;
  readonly basketComparable: boolean;
  readonly capturedAt?: string;
  readonly promotions: readonly PromotionObservation[];
  readonly notes?: string;
  readonly sourceUrl: string;
}

export interface StudyBasket {
  readonly id: string;
  readonly kind: BasketKind;
  readonly name: string;
  readonly basketKey: string;
  readonly description: string;
  readonly capturedOn: string;
  readonly quoteWindowSeconds: number | null;
  readonly observations: readonly PickupObservation[];
}

export interface StudyRestaurant {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly cuisine: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly walkMinutes: number;
  readonly accent: string;
  readonly baskets: readonly StudyBasket[];
}

export interface ComparisonOutcome {
  readonly kind: "winner" | "tie" | "incomplete";
  readonly headline: string;
  readonly explanation: string;
  readonly winner?: PickupObservation;
  readonly savingsCents?: number;
}

/**
 * Quote eligibility is shared by the discovery card and comparison panel.
 * A winner needs two equivalent exact checkouts for the intended user's real
 * channel contexts, captured within ten minutes. Menu prices and active-cart
 * totals remain useful evidence, never winners.
 */
export class QuoteComparison {
  private readonly observations: readonly PickupObservation[];

  public constructor(observations: readonly PickupObservation[]) {
    this.observations = observations;
  }

  public get outcome(): ComparisonOutcome {
    const exactObservations = this.observations.filter(
      (observation) => observation.result === "exact_checkout",
    );

    if (
      exactObservations.some(
        (observation) => !this.totalReconciles(observation),
      )
    ) {
      return {
        kind: "incomplete",
        headline: "Checkout total is inconsistent",
        explanation:
          "The item subtotal, tax, fees, discount, and tip must reconcile to the captured total.",
      };
    }

    const exactCandidates = exactObservations.filter(
      (observation) => observation.basketComparable && observation.capturedAt,
    );

    if (
      new Set(exactCandidates.map((observation) => observation.channel.kind))
        .size !== exactCandidates.length
    ) {
      return {
        kind: "incomplete",
        headline: "Duplicate channel quotes",
        explanation:
          "A comparison run needs one unambiguous checkout per ordering channel.",
      };
    }

    const exactCheckouts = [...exactCandidates].sort(
      (left, right) =>
        (left.finalTotalCents ?? Infinity) -
        (right.finalTotalCents ?? Infinity),
    );

    if (exactCheckouts.length < 2) {
      return {
        kind: "incomplete",
        headline: "No winner yet",
        explanation:
          "We need at least two exact checkout totals for the same basket.",
      };
    }

    if (!this.hasOneQuoteIdentity(exactCheckouts)) {
      return {
        kind: "incomplete",
        headline: "Quote identity mismatch",
        explanation:
          "Every compared checkout must share one capture run, restaurant, basket, item configuration, and fulfillment mode.",
      };
    }

    const timestamps = exactCheckouts.map((observation) =>
      new Date(observation.capturedAt as string).getTime(),
    );

    if (timestamps.some((timestamp) => !Number.isFinite(timestamp))) {
      return {
        kind: "incomplete",
        headline: "Quote timing is invalid",
        explanation: "Every exact checkout needs a valid capture timestamp.",
      };
    }

    const comparisonWindowMinutes =
      (Math.max(...timestamps) - Math.min(...timestamps)) / 60_000;

    if (comparisonWindowMinutes > 10) {
      return {
        kind: "incomplete",
        headline: "Quotes are too far apart",
        explanation:
          "Exact checkout totals must be captured within one ten-minute window.",
      };
    }

    const [winner, runnerUp] = exactCheckouts;

    if (winner.finalTotalCents === runnerUp.finalTotalCents) {
      return {
        kind: "tie",
        headline: "Pickup totals are tied",
        explanation: "Equivalent, time-matched checkout totals are the same.",
      };
    }

    return {
      kind: "winner",
      headline: `${winner.channel.name} is cheapest`,
      explanation: "Compared from equivalent, time-matched checkout totals.",
      winner,
      savingsCents:
        (runnerUp.finalTotalCents as number) -
        (winner.finalTotalCents as number),
    };
  }

  public get mostCompleteObservation(): PickupObservation {
    const ranked = [...this.observations].sort(
      (left, right) => this.completeness(right) - this.completeness(left),
    );

    if (!ranked[0]) {
      throw new Error("A restaurant needs at least one channel observation.");
    }

    return ranked[0];
  }

  private completeness(observation: PickupObservation): number {
    if (observation.result === "exact_checkout") return 4;
    if (observation.result === "exact_active_cart") return 3;
    if (observation.captureStage === "cart") return 2;
    return 1;
  }

  private hasOneQuoteIdentity(
    observations: readonly PickupObservation[],
  ): boolean {
    const [first] = observations;

    return observations.every(
      (observation) =>
        observation.captureRunId === first.captureRunId &&
        observation.restaurantId === first.restaurantId &&
        observation.basketKey === first.basketKey &&
        observation.itemSignature === first.itemSignature &&
        observation.fulfillment === first.fulfillment,
    );
  }

  private totalReconciles(observation: PickupObservation): boolean {
    const { taxCents, feesCents, discountCents, tipCents, finalTotalCents } =
      observation;

    if (
      taxCents === null ||
      feesCents === null ||
      discountCents === null ||
      tipCents === null ||
      finalTotalCents === null
    ) {
      return false;
    }

    return (
      observation.itemsSubtotalCents +
        taxCents +
        feesCents +
        tipCents -
        discountCents ===
      finalTotalCents
    );
  }
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
