import anonymousCheckoutStudy from "../research/phase-0/kips-bay-murray-hill/checkout-observations.json";
import restaurantStudy from "../research/phase-0/kips-bay-murray-hill/restaurants.json";
import routeStudy from "../research/phase-0/kips-bay-murray-hill/routes.json";
import signedInCheckoutStudy from "../research/phase-0/kips-bay-murray-hill/signed-in-checkout-observations.json";
import thresholdCheckoutStudy from "../research/phase-0/kips-bay-murray-hill/threshold-checkout-observations.json";
import { QuoteComparison } from "./domain";
import type {
  AccountContext,
  Availability,
  BasketKind,
  CaptureStage,
  ChannelKind,
  Fulfillment,
  ObservationResult,
  PickupObservation,
  StudyBasket,
  StudyRestaurant,
} from "./domain";

const STUDY_RESTAURANT_IDS = [
  "pio-pio-7",
  "tara-rose",
  "bhatti-indian-grill",
  "little-rubys-murray-hill",
  "banc-cafe",
  "kips-bay-deli",
] as const;

const RAW_OBSERVATIONS = [
  ...anonymousCheckoutStudy.observations.map((observation) => ({
    ...observation,
    accountContext: anonymousCheckoutStudy.accountContext,
    basketKind: anonymousCheckoutStudy.basketKind,
    captureRunId: anonymousCheckoutStudy.captureRunId,
    capturedOn: anonymousCheckoutStudy.capturedOn,
    fulfillment: anonymousCheckoutStudy.fulfillment,
    quoteWindowSeconds: null,
  })),
  ...signedInCheckoutStudy.observations.map((observation) => ({
    ...observation,
    basketKind: signedInCheckoutStudy.basketKind,
    captureRunId: signedInCheckoutStudy.captureRunId,
    capturedOn: signedInCheckoutStudy.capturedOn,
    fulfillment: signedInCheckoutStudy.fulfillment,
    quoteWindowSeconds: signedInCheckoutStudy.comparison.quoteWindowSeconds,
  })),
  ...thresholdCheckoutStudy.observations.map((observation) => ({
    ...observation,
    basketKind: thresholdCheckoutStudy.basketKind,
    captureRunId: thresholdCheckoutStudy.captureRunId,
    capturedOn: thresholdCheckoutStudy.capturedOn,
    fulfillment: thresholdCheckoutStudy.fulfillment,
    quoteWindowSeconds: thresholdCheckoutStudy.comparison.quoteWindowSeconds,
  })),
];

const ACCOUNT_CONTEXTS = [
  "anonymous",
  "signed_in",
] as const satisfies readonly AccountContext[];

const FULFILLMENTS = ["pickup"] as const satisfies readonly Fulfillment[];

const BASKET_KINDS = [
  "single",
  "threshold",
] as const satisfies readonly BasketKind[];

const AVAILABILITIES = [
  "available_now",
  "not_accepting_online_orders",
  "closed_opens_11am",
  "available_monday_11am",
  "online_ordering_unavailable",
  "closed_order_for_later",
] as const satisfies readonly Availability[];

const CAPTURE_STAGES = [
  "menu",
  "cart",
  "active_cart",
  "checkout",
] as const satisfies readonly CaptureStage[];

const OBSERVATION_RESULTS = [
  "exact_checkout",
  "exact_active_cart",
  "checkout_blocked_by_sign_in",
  "challenge_blocked_before_cart",
  "availability_blocked",
] as const satisfies readonly ObservationResult[];

const PRESENTATION = {
  "pio-pio-7": { initials: "PP", accent: "#ff7a45", basketName: "Whole chicken" },
  "tara-rose": { initials: "TR", accent: "#dafe61", basketName: "Tara Rose Burger" },
  "bhatti-indian-grill": { initials: "BI", accent: "#b7a6ff", basketName: "Butter chicken" },
  "little-rubys-murray-hill": { initials: "LR", accent: "#80b8ff", basketName: "Classic cheeseburger" },
  "banc-cafe": { initials: "BC", accent: "#ffd15b", basketName: "The Banker" },
  "kips-bay-deli": {
    initials: "KD",
    accent: "#ff9ecb",
    basketName: "Reuben on Rye",
    thresholdBasketName: "Two Reubens",
  },
} as const;

function parseOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  field: string,
): T {
  if (!allowed.includes(value as T)) {
    throw new Error(`Unknown ${field}: ${value}`);
  }

  return value as T;
}

function channelKind(channel: string): ChannelKind {
  if (channel === "restaurant_direct") return "direct";
  if (channel === "restaurant_storefront") return "storefront";
  if (channel === "doordash_marketplace") return "doordash";
  if (channel === "uber_eats") return "uber-eats";
  throw new Error(`Unknown channel: ${channel}`);
}

function channelLabel(channel: string) {
  if (channel === "restaurant_direct") {
    return { name: "Restaurant direct", shortName: "DIR" };
  }
  if (channel === "restaurant_storefront") {
    return { name: "Restaurant storefront", shortName: "SF" };
  }
  if (channel === "doordash_marketplace") {
    return { name: "DoorDash", shortName: "DD" };
  }
  if (channel === "uber_eats") {
    return { name: "Uber Eats", shortName: "UE" };
  }
  throw new Error(`Unknown channel: ${channel}`);
}

function observationsFor(
  restaurantId: string,
  captureRunId: string,
): readonly PickupObservation[] {
  return RAW_OBSERVATIONS
    .filter(
      (observation) =>
        observation.restaurantId === restaurantId &&
        observation.captureRunId === captureRunId,
    )
    .map((observation, index) => {
      const label = channelLabel(observation.channel);

      return {
        id: `${restaurantId}-${observation.channel}-${index}`,
        captureRunId: observation.captureRunId,
        restaurantId: observation.restaurantId,
        basketKey: observation.basketKey,
        itemSignature: observation.itemSignature,
        fulfillment: parseOneOf(
          observation.fulfillment,
          FULFILLMENTS,
          "fulfillment",
        ),
        channel: {
          kind: channelKind(observation.channel),
          name: label.name,
          shortName: label.shortName,
          provider: observation.provider,
        },
        availability: parseOneOf(
          observation.availability,
          AVAILABILITIES,
          "availability",
        ),
        captureStage: parseOneOf(
          observation.captureStage,
          CAPTURE_STAGES,
          "capture stage",
        ),
        result: parseOneOf(
          observation.result,
          OBSERVATION_RESULTS,
          "observation result",
        ),
        accountContext: parseOneOf(
          observation.accountContext,
          ACCOUNT_CONTEXTS,
          "account context",
        ),
        itemsSubtotalCents: observation.itemsSubtotalCents,
        taxCents: observation.taxCents,
        feesCents: observation.feesCents,
        discountCents: observation.discountCents,
        tipCents: observation.tipCents,
        finalTotalCents: observation.finalTotalCents,
        basketComparable: observation.basketComparable,
        capturedAt:
          "capturedAt" in observation &&
          typeof observation.capturedAt === "string"
            ? observation.capturedAt
            : undefined,
        promotions:
          "promotionsObserved" in observation
            ? (observation.promotionsObserved ?? [])
            : [],
        notes: "notes" in observation ? observation.notes : undefined,
        sourceUrl: observation.source,
      };
    });
}

function basketsFor(
  restaurantId: (typeof STUDY_RESTAURANT_IDS)[number],
): readonly StudyBasket[] {
  const rawObservations = RAW_OBSERVATIONS.filter(
    (observation) => observation.restaurantId === restaurantId,
  );
  const captureRunIds = [
    ...new Set(rawObservations.map((observation) => observation.captureRunId)),
  ];

  return captureRunIds.map((captureRunId) => {
    const rawObservation = rawObservations.find(
      (observation) => observation.captureRunId === captureRunId,
    );
    const observations = observationsFor(restaurantId, captureRunId);

    if (!rawObservation || !observations[0]) {
      throw new Error(
        `Incomplete basket data for ${restaurantId}/${captureRunId}`,
      );
    }

    const kind = parseOneOf(
      rawObservation.basketKind,
      BASKET_KINDS,
      "basket kind",
    );
    const presentation = PRESENTATION[restaurantId];
    const thresholdName =
      "thresholdBasketName" in presentation
        ? presentation.thresholdBasketName
        : `${presentation.basketName} threshold`;

    return {
      id: captureRunId,
      kind,
      name: kind === "threshold" ? thresholdName : presentation.basketName,
      basketKey: rawObservation.basketKey,
      description: rawObservation.itemSignature,
      capturedOn: rawObservation.capturedOn,
      quoteWindowSeconds: rawObservation.quoteWindowSeconds,
      observations,
    };
  });
}

export const STUDY_CENTER = {
  label: routeStudy.center.label,
  latitude: routeStudy.center.latitude,
  longitude: routeStudy.center.longitude,
} as const;

export const STUDY_RESTAURANTS: readonly StudyRestaurant[] =
  STUDY_RESTAURANT_IDS.map((id) => {
    const restaurant = restaurantStudy.restaurants.find(
      (candidate) => candidate.id === id,
    );
    const route = routeStudy.routes.find((candidate) => candidate.restaurantId === id);
    const baskets = basketsFor(id);

    if (!restaurant || !route || !baskets[0]) {
      throw new Error(`Incomplete study data for ${id}`);
    }

    return {
      id,
      name: restaurant.name,
      initials: PRESENTATION[id].initials,
      cuisine: restaurant.cuisine,
      address: restaurant.address,
      latitude: route.latitude,
      longitude: route.longitude,
      walkMinutes: route.estimatedMinutes,
      accent: PRESENTATION[id].accent,
      baskets,
    };
  }).sort((left, right) => left.walkMinutes - right.walkMinutes);

export const STUDY_SUMMARY = {
  restaurants: STUDY_RESTAURANTS.length,
  observations: STUDY_RESTAURANTS.reduce(
    (total, restaurant) =>
      total +
      restaurant.baskets.reduce(
        (basketTotal, basket) => basketTotal + basket.observations.length,
        0,
      ),
    0,
  ),
  completeTotals: STUDY_RESTAURANTS.reduce(
    (total, restaurant) =>
      total +
      restaurant.baskets.reduce(
        (basketTotal, basket) =>
          basketTotal +
          basket.observations.filter(
            (observation) => observation.finalTotalCents !== null,
          ).length,
        0,
      ),
    0,
  ),
  comparisons: STUDY_RESTAURANTS.reduce(
    (total, restaurant) =>
      total +
      restaurant.baskets.filter(
        (basket) =>
          new QuoteComparison(basket.observations).outcome.kind !== "incomplete",
      ).length,
    0,
  ),
} as const;
