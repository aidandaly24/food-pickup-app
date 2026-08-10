import anonymousCheckoutStudy from "../research/phase-0/kips-bay-murray-hill/checkout-observations.json";
import crossMidnightCheckoutStudy from "../research/phase-0/kips-bay-murray-hill/cross-midnight-checkout-observations.json";
import repeatCheckoutStudy from "../research/phase-0/kips-bay-murray-hill/repeat-checkout-observations.json";
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
  LocationMatch,
  ObservationResult,
  PickupObservation,
  StudyBasket,
  StudyRestaurant,
} from "./domain";

const EXACT_CHECKOUT_STUDIES = [
  signedInCheckoutStudy,
  thresholdCheckoutStudy,
  repeatCheckoutStudy,
  crossMidnightCheckoutStudy,
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
  ...EXACT_CHECKOUT_STUDIES.flatMap((study) =>
    study.observations.map((observation) => ({
      ...observation,
      basketKind: study.basketKind,
      captureRunId: study.captureRunId,
      capturedOn: study.capturedOn,
      fulfillment: study.fulfillment,
      quoteWindowSeconds: study.comparison.quoteWindowSeconds,
    })),
  ),
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

const LOCATION_MATCHES = [
  "verified_exact",
  "unverified",
] as const satisfies readonly LocationMatch[];

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

const ACCENTS = [
  "#ff7a45",
  "#dafe61",
  "#b7a6ff",
  "#80b8ff",
  "#ffd15b",
  "#ff9ecb",
] as const;

const BASKET_NAMES: Readonly<
  Record<string, { single: string; threshold?: string }>
> = {
  "pio-pio-7": { single: "Whole chicken" },
  "tara-rose": { single: "Tara Rose Burger" },
  "bhatti-indian-grill": { single: "Butter chicken" },
  "little-rubys-murray-hill": { single: "Classic cheeseburger" },
  "banc-cafe": { single: "The Banker" },
  "kips-bay-deli": {
    single: "Reuben on Rye",
    threshold: "Two Reubens",
  },
};

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

function catalogChannelName(channel: string): string {
  if (channel === "restaurant_direct") return "Restaurant direct";
  if (channel === "restaurant_storefront") return "Restaurant storefront";
  if (channel === "doordash_marketplace") return "DoorDash marketplace";
  if (channel === "uber_eats") return "Uber Eats";
  if (channel === "grubhub") return "Grubhub";
  if (channel === "restaurant_delivery") return "Restaurant delivery";
  throw new Error(`Unknown catalog channel: ${channel}`);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
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

function basketsFor(restaurantId: string): readonly StudyBasket[] {
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
    const names = BASKET_NAMES[restaurantId];

    return {
      id: captureRunId,
      kind,
      name:
        kind === "threshold"
          ? (names?.threshold ?? "Threshold basket")
          : (names?.single ?? "Single basket"),
      basketKey: rawObservation.basketKey,
      description: rawObservation.itemSignature,
      capturedOn: rawObservation.capturedOn,
      observedAt: observations
        .flatMap((observation) =>
          observation.capturedAt ? [observation.capturedAt] : [],
        )
        .sort()[0],
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
  restaurantStudy.restaurants.map((restaurant, index) => {
    const route = routeStudy.routes.find(
      (candidate) => candidate.restaurantId === restaurant.id,
    );
    const baskets = basketsFor(restaurant.id);

    if (!route) {
      throw new Error(`Missing pedestrian route for ${restaurant.id}`);
    }

    return {
      id: restaurant.id,
      name: restaurant.name,
      initials: initials(restaurant.name),
      cuisine: restaurant.cuisine,
      address: restaurant.address,
      latitude: route.latitude,
      longitude: route.longitude,
      walkMinutes: route.estimatedMinutes,
      accent: ACCENTS[index % ACCENTS.length],
      anchorItem: restaurant.anchorItem,
      websiteUrl: restaurant.website,
      channels: restaurant.channelsObserved.map((channel) => ({
        key: channel.channel,
        name: catalogChannelName(channel.channel),
        provider: channel.provider,
        locationMatch: parseOneOf(
          channel.locationMatch,
          LOCATION_MATCHES,
          "location match",
        ),
        sourceUrl: channel.url,
      })),
      baskets,
    };
  }).sort((left, right) => left.walkMinutes - right.walkMinutes);

export const STUDY_SUMMARY = {
  restaurants: STUDY_RESTAURANTS.length,
  knownChannels: STUDY_RESTAURANTS.reduce(
    (total, restaurant) => total + restaurant.channels.length,
    0,
  ),
  verifiedChannels: STUDY_RESTAURANTS.reduce(
    (total, restaurant) =>
      total +
      restaurant.channels.filter(
        (channel) => channel.locationMatch === "verified_exact",
      ).length,
    0,
  ),
  quotedRestaurants: STUDY_RESTAURANTS.filter(
    (restaurant) => restaurant.baskets.length > 0,
  ).length,
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
