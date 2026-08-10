import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const studyRoot = new URL(
  "../research/phase-0/kips-bay-murray-hill/",
  import.meta.url,
);
interface RawRestaurant {
  readonly id: string;
  readonly website: string;
  readonly channelsObserved: readonly {
    readonly channel: string;
    readonly provider: string;
    readonly url: string;
  }[];
}

interface RawRestaurantStudy {
  readonly walkingLimitMinutes: number;
  readonly restaurants: readonly RawRestaurant[];
}

interface RawRouteStudy {
  readonly routes: readonly {
    readonly restaurantId: string;
    readonly latitude: number;
    readonly longitude: number;
    readonly distanceMeters: number;
    readonly durationSeconds: number;
    readonly estimatedMinutes: number;
  }[];
}

interface RawObservation {
  readonly restaurantId: string;
  readonly basketKey: string;
  readonly itemSignature: string;
  readonly channel: string;
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
  readonly comparison?: {
    readonly winnerChannel: string;
    readonly savingsCents: number;
    readonly quoteWindowSeconds: number;
    readonly recheckedAt: string;
  };
  readonly observations: readonly RawObservation[];
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
  assert.equal(new Set(restaurantIds).size, restaurantIds.length);
  assert.equal(new Set(routeIds).size, routeIds.length);
  assert.deepEqual([...routeIds].sort(), [...restaurantIds].sort());

  for (const restaurant of catalog.restaurants) {
    assert.match(restaurant.website, /^https?:\/\//);
    for (const channel of restaurant.channelsObserved) {
      assert.ok(channel.channel.length > 0);
      assert.match(channel.url, /^https?:\/\//);
      assert.notEqual(channel.url, "https://order.toasttab.com/");
      assert.notEqual(channel.url, "https://www.grubhub.com/");
      assert.notEqual(channel.url, "https://order.online/");
      assert.notEqual(channel.url, "https://www.getsauce.com/");
    }
  }

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

  assert.equal(comparisons.length, 3);

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

  assert.equal(repeats.length, 1);

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
    assert.equal(
      repeat.comparison.winnerChannel,
      original?.comparison?.winnerChannel,
    );

    for (const repeatQuote of repeatQuotes) {
      const originalQuote = originalQuotes.find(
        (quote) => quote.channel === repeatQuote.channel,
      );

      assert.ok(originalQuote);
      assert.equal(repeatQuote.itemSignature, originalQuote?.itemSignature);
      assert.equal(repeatQuote.finalTotalCents, originalQuote?.finalTotalCents);
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
    assert.ok(repeatDelay < 92 * 60 * 1_000);
  }
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
  assert.equal(observations.length, 18);
  assert.equal(
    observations.filter((observation) => observation.finalTotalCents !== null)
      .length,
    8,
  );
  assert.deepEqual(savings.sort((left, right) => left - right), [69, 69, 594]);
});
