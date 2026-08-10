import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const studyRoot = new URL(
  "../research/phase-0/kips-bay-murray-hill/",
  import.meta.url,
);
interface RawRestaurant {
  readonly id: string;
  readonly address: string;
  readonly website: string;
  readonly channelsObserved: readonly {
    readonly channel: string;
    readonly provider: string;
    readonly locationMatch: string;
    readonly url: string;
  }[];
}

interface RawRestaurantStudy {
  readonly studyCenter: string;
  readonly walkingLimitMinutes: number;
  readonly routeStatus: string;
  readonly restaurants: readonly RawRestaurant[];
}

interface RawRouteStudy {
  readonly router: string;
  readonly method: string;
  readonly routes: readonly {
    readonly restaurantId: string;
    readonly latitude: number;
    readonly longitude: number;
    readonly distanceMeters: number;
    readonly durationSeconds: number;
    readonly estimatedMinutes: number;
  }[];
}

interface RawRouteCrossCheckStudy {
  readonly source: string;
  readonly evidenceClass: string;
  readonly fieldObservationStatus: string;
  readonly studyCenter: string;
  readonly walkingLimitMinutes: number;
  readonly sampleSelection: string;
  readonly method: string;
  readonly routes: readonly {
    readonly restaurantId: string;
    readonly destinationAddress: string;
    readonly osmEstimatedMinutes: number;
    readonly googleEstimatedMinutes: number;
    readonly googleDistanceMiles: number;
    readonly differenceMinutes: number;
    readonly sourceUrl: string;
  }[];
}

interface RawObservation {
  readonly restaurantId: string;
  readonly basketKey: string;
  readonly itemSignature: string;
  readonly channel: string;
  readonly provider: string;
  readonly result: string;
  readonly itemsSubtotalCents: number;
  readonly taxCents: number | null;
  readonly feesCents: number | null;
  readonly discountCents: number | null;
  readonly tipCents: number | null;
  readonly finalTotalCents: number | null;
  readonly capturedAt?: string;
  readonly source: string;
}

interface RawCaptureStudy {
  readonly captureRunId: string;
  readonly repeatOfCaptureRunId?: string;
  readonly basketKind: string;
  readonly fulfillment: string;
  readonly collection?: {
    readonly scope: string;
    readonly startedAt: string;
    readonly completedAt: string;
    readonly durationSeconds: number;
  };
  readonly comparison?: {
    readonly winnerChannel: string;
    readonly savingsCents: number;
    readonly quoteWindowSeconds: number;
    readonly recheckedAt: string;
  };
  readonly observations: readonly RawObservation[];
}

interface RawMenuStudy {
  readonly observations: readonly {
    readonly provider: string;
    readonly evidenceLevel: string;
  }[];
}

interface RawProviderMatrix {
  readonly adapterDecision: {
    readonly status: string;
    readonly leadingCandidate: string;
  };
  readonly providers: readonly {
    readonly id: string;
    readonly labels: readonly string[];
    readonly surfaces: readonly string[];
    readonly catalogLinkCount: number;
    readonly restaurantCount: number;
    readonly verifiedLocationLinkCount: number;
    readonly exactMenuObservations: number;
    readonly exactCheckoutObservations: number;
    readonly exactActiveCartObservations: number;
    readonly blockedCheckoutAttempts: number;
  }[];
}

async function readCaptureStudies(): Promise<readonly RawCaptureStudy[]> {
  const captureFiles = (await readdir(studyRoot))
    .filter((file) => file.endsWith("checkout-observations.json"))
    .sort();

  assert.ok(captureFiles.length > 0, "at least one capture file is required");

  return Promise.all(
    captureFiles.map(async (file) =>
      JSON.parse(await readFile(new URL(file, studyRoot), "utf8")),
    ),
  );
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(new URL(file, studyRoot), "utf8"));
}

function exactComparison(study: RawCaptureStudy) {
  return study.observations.filter(
    (observation) =>
      observation.result === "exact_checkout" && observation.capturedAt,
  );
}

test("the 25-restaurant catalog and pedestrian routes stay aligned", async () => {
  const [catalog, routeStudy] = await Promise.all([
    readJson<RawRestaurantStudy>("restaurants.json"),
    readJson<RawRouteStudy>("routes.json"),
  ]);
  const restaurantIds = catalog.restaurants.map((restaurant) => restaurant.id);
  const routeIds = routeStudy.routes.map((route) => route.restaurantId);

  assert.equal(catalog.restaurants.length, 25);
  assert.match(catalog.routeStatus, /estimate/);
  assert.match(catalog.routeStatus, /field_calibration_pending/);
  assert.match(routeStudy.router, /OpenStreetMap/);
  assert.match(routeStudy.method, /does not include a field-observed pace/);
  assert.equal(new Set(restaurantIds).size, restaurantIds.length);
  assert.equal(new Set(routeIds).size, routeIds.length);
  assert.deepEqual([...routeIds].sort(), [...restaurantIds].sort());

  for (const restaurant of catalog.restaurants) {
    assert.match(restaurant.website, /^https?:\/\//);
    for (const channel of restaurant.channelsObserved) {
      assert.ok(channel.channel.length > 0);
      assert.match(channel.url, /^https?:\/\//);
      assert.ok(
        ["verified_exact", "unverified"].includes(channel.locationMatch),
      );
      assert.notEqual(channel.url, "https://order.toasttab.com/");
      assert.notEqual(channel.url, "https://www.grubhub.com/");
      assert.notEqual(channel.url, "https://order.online/");
      assert.notEqual(channel.url, "https://www.getsauce.com/");
    }
  }

  const channels = catalog.restaurants.flatMap((restaurant) =>
    restaurant.channelsObserved.map((channel) => ({ restaurant, channel })),
  );
  const verifiedChannels = channels.filter(
    ({ channel }) => channel.locationMatch === "verified_exact",
  );
  const unverifiedChannels = channels
    .filter(({ channel }) => channel.locationMatch === "unverified")
    .map(({ restaurant, channel }) => `${restaurant.id}/${channel.provider}`)
    .sort();

  assert.equal(channels.length, 47);
  assert.equal(verifiedChannels.length, 45);
  assert.ok(verifiedChannels.length / channels.length >= 0.95);
  assert.deepEqual(unverifiedChannels, [
    "patrizias-manhattan/Sauce",
    "stickys-murray-hill/Appfront / Just Order",
  ]);

  for (const route of routeStudy.routes) {
    assert.ok(Number.isFinite(route.latitude));
    assert.ok(Number.isFinite(route.longitude));
    assert.ok(route.distanceMeters > 0);
    assert.ok(route.durationSeconds > 0);
    assert.equal(route.estimatedMinutes, Math.ceil(route.durationSeconds / 60));
    assert.ok(route.estimatedMinutes <= catalog.walkingLimitMinutes);
  }

  const coletta = catalog.restaurants.find(
    (restaurant) => restaurant.id === "coletta",
  );
  assert.deepEqual(
    coletta?.channelsObserved.map(({ channel, provider }) => ({
      channel,
      provider,
    })),
    [
      { channel: "restaurant_direct", provider: "Square" },
      {
        channel: "restaurant_storefront",
        provider: "DoorDash Commerce Platform",
      },
    ],
  );

  const bareburger = catalog.restaurants.find(
    (restaurant) => restaurant.id === "bareburger-murray-hill",
  );
  assert.equal(bareburger?.channelsObserved[0]?.provider, "Lunchbox");

  const dig = catalog.restaurants.find(
    (restaurant) => restaurant.id === "dig-murray-hill",
  );
  assert.equal(
    dig?.channelsObserved[0]?.url,
    "https://www.diginn.com/menu/228552",
  );

  const shakeShack = catalog.restaurants.find(
    (restaurant) => restaurant.id === "shake-shack-midtown-east",
  );
  assert.equal(
    shakeShack?.website,
    "https://shakeshack.com/location/midtown-east-ny",
  );
  assert.equal(shakeShack?.channelsObserved[0]?.url, shakeShack?.website);
});

test("the boundary-risk route sample remains independently reproducible", async () => {
  const [catalog, routeStudy, crossCheck] = await Promise.all([
    readJson<RawRestaurantStudy>("restaurants.json"),
    readJson<RawRouteStudy>("routes.json"),
    readJson<RawRouteCrossCheckStudy>("route-cross-checks.json"),
  ]);
  const catalogById = new Map(
    catalog.restaurants.map((restaurant) => [restaurant.id, restaurant]),
  );
  const routesById = new Map(
    routeStudy.routes.map((route) => [route.restaurantId, route]),
  );
  const boundaryRiskIds = [...routeStudy.routes]
    .sort((left, right) => right.durationSeconds - left.durationSeconds)
    .slice(0, 5)
    .map((route) => route.restaurantId)
    .sort();

  assert.match(crossCheck.source, /Google Maps/);
  assert.equal(crossCheck.evidenceClass, "cross_provider_estimate");
  assert.equal(crossCheck.fieldObservationStatus, "pending");
  assert.equal(crossCheck.studyCenter, catalog.studyCenter);
  assert.equal(crossCheck.walkingLimitMinutes, catalog.walkingLimitMinutes);
  assert.match(crossCheck.sampleSelection, /five routes/);
  assert.match(crossCheck.method, /not field-observed walks/);
  assert.equal(crossCheck.routes.length, 5);
  assert.equal(
    new Set(crossCheck.routes.map((route) => route.restaurantId)).size,
    crossCheck.routes.length,
  );
  assert.deepEqual(
    crossCheck.routes.map((route) => route.restaurantId).sort(),
    boundaryRiskIds,
  );

  for (const route of crossCheck.routes) {
    const catalogRestaurant = catalogById.get(route.restaurantId);
    const osmRoute = routesById.get(route.restaurantId);
    const sourceUrl = new URL(route.sourceUrl);

    assert.ok(catalogRestaurant);
    assert.ok(osmRoute);
    assert.equal(route.destinationAddress, catalogRestaurant?.address);
    assert.equal(route.osmEstimatedMinutes, osmRoute?.estimatedMinutes);
    assert.equal(
      route.differenceMinutes,
      route.googleEstimatedMinutes - route.osmEstimatedMinutes,
    );
    assert.ok(route.googleDistanceMiles > 0);
    assert.ok(route.googleEstimatedMinutes <= crossCheck.walkingLimitMinutes);
    assert.ok(
      crossCheck.walkingLimitMinutes -
        Math.max(route.osmEstimatedMinutes, route.googleEstimatedMinutes) >=
        4,
    );
    assert.equal(sourceUrl.origin, "https://www.google.com");
    assert.equal(sourceUrl.pathname, "/maps/dir/");
    assert.equal(sourceUrl.searchParams.get("origin"), crossCheck.studyCenter);
    assert.equal(
      sourceUrl.searchParams.get("destination"),
      route.destinationAddress,
    );
    assert.equal(sourceUrl.searchParams.get("travelmode"), "walking");
  }
});

test("every captured exact total reconciles and uses a public source", async () => {
  const [studies, catalog] = await Promise.all([
    readCaptureStudies(),
    readJson<RawRestaurantStudy>("restaurants.json"),
  ]);
  const restaurantIds = new Set(
    catalog.restaurants.map((restaurant) => restaurant.id),
  );
  const restaurantsById = new Map(
    catalog.restaurants.map((restaurant) => [restaurant.id, restaurant]),
  );

  assert.equal(
    new Set(studies.map((study) => study.captureRunId)).size,
    studies.length,
    "capture run ids must be unique",
  );

  for (const study of studies) {
    assert.ok(["single", "threshold"].includes(study.basketKind));
    assert.equal(study.fulfillment, "pickup");
    assert.ok(study.observations.length > 0);

    for (const observation of study.observations) {
      assert.ok(
        restaurantIds.has(observation.restaurantId),
        `unknown restaurant ${observation.restaurantId}`,
      );
      assert.ok(
        restaurantsById
          .get(observation.restaurantId)
          ?.channelsObserved.some(
            (channel) => channel.channel === observation.channel,
          ),
        `${observation.restaurantId} is missing observed channel ${observation.channel}`,
      );
      assert.ok(observation.basketKey.length > 0);
      assert.ok(observation.itemSignature.length > 0);
      assert.match(observation.source, /^https:\/\//);

      if (observation.result !== "exact_checkout") continue;

      const { taxCents, feesCents, discountCents, tipCents, finalTotalCents } =
        observation;

      assert.notEqual(taxCents, null);
      assert.notEqual(feesCents, null);
      assert.notEqual(discountCents, null);
      assert.notEqual(tipCents, null);
      assert.notEqual(finalTotalCents, null);

      if (
        taxCents === null ||
        feesCents === null ||
        discountCents === null ||
        tipCents === null ||
        finalTotalCents === null
      ) {
        assert.fail("exact checkout components must all be captured");
      }

      assert.equal(
        observation.itemsSubtotalCents +
          taxCents +
          feesCents +
          tipCents -
          discountCents,
        finalTotalCents,
        `${study.captureRunId}/${observation.channel} does not reconcile`,
      );
    }
  }
});

test("declared comparisons are derived from equivalent fresh quotes", async () => {
  const studies = await readCaptureStudies();
  const comparisons = studies.filter((study) => study.comparison);

  assert.equal(comparisons.length, 4);

  for (const study of comparisons) {
    const { comparison } = study;
    const exactCheckouts = exactComparison(study);

    assert.ok(comparison);
    assert.ok(exactCheckouts.length >= 2);
    assert.equal(
      new Set(exactCheckouts.map((observation) => observation.channel)).size,
      exactCheckouts.length,
    );
    assert.equal(
      new Set(exactCheckouts.map((observation) => observation.restaurantId)).size,
      1,
    );
    assert.equal(
      new Set(exactCheckouts.map((observation) => observation.basketKey)).size,
      1,
    );
    assert.equal(
      new Set(exactCheckouts.map((observation) => observation.itemSignature)).size,
      1,
    );

    const sorted = [...exactCheckouts].sort(
      (left, right) =>
        (left.finalTotalCents as number) - (right.finalTotalCents as number),
    );
    const [winner, runnerUp] = sorted;
    const timestamps = exactCheckouts.map((observation) =>
      new Date(observation.capturedAt as string).getTime(),
    );
    const quoteWindowSeconds = Math.round(
      (Math.max(...timestamps) - Math.min(...timestamps)) / 1_000,
    );
    const recheckedAt = new Date(comparison.recheckedAt).getTime();

    assert.ok(timestamps.every(Number.isFinite));
    assert.ok(Number.isFinite(recheckedAt));
    assert.ok(recheckedAt >= Math.max(...timestamps));
    assert.ok(
      recheckedAt - Math.max(...timestamps) <= 10 * 60 * 1_000,
      `${study.captureRunId} was not rechecked within ten minutes`,
    );
    assert.equal(comparison.winnerChannel, winner.channel);
    assert.equal(
      comparison.savingsCents,
      (runnerUp.finalTotalCents as number) -
        (winner.finalTotalCents as number),
    );
    assert.equal(comparison.quoteWindowSeconds, quoteWindowSeconds);
    assert.ok(quoteWindowSeconds <= 10 * 60);
  }
});

test("repeat captures point to an earlier equivalent comparison", async () => {
  const studies = await readCaptureStudies();
  const studiesById = new Map(
    studies.map((study) => [study.captureRunId, study]),
  );
  const repeats = studies.filter((study) => study.repeatOfCaptureRunId);

  assert.equal(repeats.length, 2);

  for (const repeat of repeats) {
    const original = studiesById.get(repeat.repeatOfCaptureRunId as string);
    const originalQuotes = original ? exactComparison(original) : [];
    const repeatQuotes = exactComparison(repeat);

    assert.ok(original, "repeat target must exist");
    assert.ok(original?.comparison, "repeat target must be a comparison");
    assert.ok(repeat.comparison, "repeat must be a comparison");
    assert.deepEqual(
      repeatQuotes.map((quote) => quote.channel).sort(),
      originalQuotes.map((quote) => quote.channel).sort(),
    );
    assert.deepEqual(
      [...new Set(repeatQuotes.map((quote) => quote.basketKey))],
      [...new Set(originalQuotes.map((quote) => quote.basketKey))],
    );
    for (const repeatQuote of repeatQuotes) {
      const originalQuote = originalQuotes.find(
        (quote) => quote.channel === repeatQuote.channel,
      );

      assert.ok(originalQuote);
      assert.equal(repeatQuote.itemSignature, originalQuote?.itemSignature);
    }

    const originalLatest = Math.max(
      ...originalQuotes.map((quote) =>
        new Date(quote.capturedAt as string).getTime(),
      ),
    );
    const repeatEarliest = Math.min(
      ...repeatQuotes.map((quote) =>
        new Date(quote.capturedAt as string).getTime(),
      ),
    );

    const repeatDelay = repeatEarliest - originalLatest;

    assert.ok(repeatDelay >= 90 * 60 * 1_000);
  }
});

test("timed collection metadata reconciles", async () => {
  const studies = await readCaptureStudies();
  const timedStudies = studies.filter((study) => study.collection);

  assert.ok(timedStudies.length > 0);

  for (const study of timedStudies) {
    const collection = study.collection;

    assert.ok(collection);
    assert.ok(collection.scope.length > 0);
    const startedAt = new Date(collection.startedAt).getTime();
    const completedAt = new Date(collection.completedAt).getTime();

    assert.ok(Number.isFinite(startedAt));
    assert.ok(Number.isFinite(completedAt));
    assert.ok(completedAt > startedAt);
    assert.equal(
      collection.durationSeconds,
      Math.round((completedAt - startedAt) / 1_000),
    );
    assert.equal(study.comparison?.recheckedAt, collection.completedAt);
  }
});

test("the provider matrix partitions the catalog and matches observed evidence", async () => {
  const [matrix, catalog, menuStudy, checkoutStudies] = await Promise.all([
    readJson<RawProviderMatrix>("provider-capabilities.json"),
    readJson<RawRestaurantStudy>("restaurants.json"),
    readJson<RawMenuStudy>("observations.json"),
    readCaptureStudies(),
  ]);
  const providerIds = matrix.providers.map((provider) => provider.id);
  const labelOwners = new Map<string, string>();

  assert.equal(new Set(providerIds).size, providerIds.length);

  for (const provider of matrix.providers) {
    assert.ok(provider.labels.length > 0);
    for (const label of provider.labels) {
      assert.ok(!labelOwners.has(label), `duplicate provider label ${label}`);
      labelOwners.set(label, provider.id);
    }
  }

  const catalogChannels = catalog.restaurants.flatMap((restaurant) =>
    restaurant.channelsObserved.map((channel) => ({
      restaurantId: restaurant.id,
      ...channel,
    })),
  );
  const checkoutObservations = checkoutStudies.flatMap(
    (study) => study.observations,
  );

  assert.equal(catalogChannels.length, 47);
  assert.ok(
    catalogChannels.every((channel) => labelOwners.has(channel.provider)),
  );
  assert.deepEqual(
    [...labelOwners.keys()].sort(),
    [...new Set(catalogChannels.map((channel) => channel.provider))].sort(),
  );
  assert.equal(
    [...matrix.providers]
      .sort((left, right) => right.catalogLinkCount - left.catalogLinkCount)
      .slice(0, 4)
      .reduce((total, provider) => total + provider.catalogLinkCount, 0),
    32,
  );

  for (const provider of matrix.providers) {
    const channels = catalogChannels.filter((channel) =>
      provider.labels.includes(channel.provider),
    );
    const exactMenuObservations = menuStudy.observations.filter(
      (observation) =>
        provider.labels.includes(observation.provider) &&
        observation.evidenceLevel === "exact_menu",
    );
    const providerCheckouts = checkoutObservations.filter((observation) =>
      provider.labels.includes(observation.provider),
    );

    assert.equal(provider.catalogLinkCount, channels.length);
    assert.equal(
      provider.restaurantCount,
      new Set(channels.map((channel) => channel.restaurantId)).size,
    );
    assert.equal(
      provider.verifiedLocationLinkCount,
      channels.filter((channel) => channel.locationMatch === "verified_exact")
        .length,
    );
    assert.deepEqual(
      [...provider.surfaces].sort(),
      [...new Set(channels.map((channel) => channel.channel))].sort(),
    );
    assert.equal(provider.exactMenuObservations, exactMenuObservations.length);
    assert.equal(
      provider.exactCheckoutObservations,
      providerCheckouts.filter(
        (observation) => observation.result === "exact_checkout",
      ).length,
    );
    assert.equal(
      provider.exactActiveCartObservations,
      providerCheckouts.filter(
        (observation) => observation.result === "exact_active_cart",
      ).length,
    );
    assert.equal(
      provider.blockedCheckoutAttempts,
      providerCheckouts.filter((observation) =>
        [
          "checkout_blocked_by_sign_in",
          "challenge_blocked_before_cart",
        ].includes(observation.result),
      ).length,
    );
  }

  const leader = matrix.providers.find(
    (provider) => provider.id === matrix.adapterDecision.leadingCandidate,
  );

  assert.equal(matrix.adapterDecision.status, "deferred_until_phase_0_gate");
  assert.ok(leader);
  assert.equal(
    leader?.catalogLinkCount,
    Math.max(...matrix.providers.map((provider) => provider.catalogLinkCount)),
  );
  assert.ok((leader?.exactCheckoutObservations ?? 0) > 0);
});

test("published Phase 0 counts remain reproducible", async () => {
  const [studies, catalog] = await Promise.all([
    readCaptureStudies(),
    readJson<RawRestaurantStudy>("restaurants.json"),
  ]);
  const observations = studies.flatMap((study) => study.observations);
  const observedRestaurants = new Set(
    observations.map((observation) => observation.restaurantId),
  );
  const savings = studies.flatMap((study) =>
    study.comparison ? [study.comparison.savingsCents] : [],
  );

  assert.equal(catalog.restaurants.length, 25);
  assert.equal(observedRestaurants.size, 6);
  assert.equal(observations.length, 20);
  assert.equal(
    observations.filter((observation) => observation.finalTotalCents !== null)
      .length,
    10,
  );
  assert.deepEqual(savings.sort((left, right) => left - right), [
    69,
    69,
    69,
    594,
  ]);
});
