"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  QuoteComparison,
  formatMoney,
  type PickupObservation,
  type StudyBasket,
  type StudyRestaurant,
} from "./domain";
import { STUDY_RESTAURANTS, STUDY_SUMMARY } from "./study-data";
import { StudyMap } from "./study-map";

const CUISINES = [
  "All",
  ...new Set(STUDY_RESTAURANTS.map((restaurant) => restaurant.cuisine)),
];

const AVAILABILITY_LABELS = {
  available_now: "Available in capture",
  not_accepting_online_orders: "Not accepting orders",
  closed_opens_11am: "Closed · opens 11 AM",
  available_monday_11am: "Available Monday 11 AM",
  online_ordering_unavailable: "Online ordering unavailable",
  closed_order_for_later: "Closed · order for later",
} as const;

const RESULT_LABELS = {
  exact_checkout: "Exact checkout",
  exact_active_cart: "Exact active cart",
  checkout_blocked_by_sign_in: "Sign-in required",
  challenge_blocked_before_cart: "Security check blocked",
  availability_blocked: "Availability blocked",
} as const;

const DEFAULT_RESTAURANT_ID =
  STUDY_RESTAURANTS.find(
    (restaurant) =>
      restaurant.baskets.some(
        (basket) =>
          new QuoteComparison(basket.observations).outcome.kind !== "incomplete",
      ),
  )?.id ?? STUDY_RESTAURANTS[0].id;

function basketEvidenceScore(basket: StudyBasket): number {
  const outcome = new QuoteComparison(basket.observations).outcome;

  return outcome.kind === "incomplete" ? -1 : (outcome.savingsCents ?? 0);
}

function featuredBasket(restaurant: StudyRestaurant): StudyBasket | null {
  const [firstBasket, ...otherBaskets] = restaurant.baskets;

  if (!firstBasket) {
    return null;
  }

  return otherBaskets.reduce((best, candidate) => {
    return basketEvidenceScore(candidate) > basketEvidenceScore(best)
      ? candidate
      : best;
  }, firstBasket);
}

function PanelHeader({
  restaurant,
  label,
}: {
  restaurant: StudyRestaurant;
  label: string;
}) {
  return (
    <div className="comparison-header">
      <div>
        <span className="section-index section-index--light">/03</span>
        <p>{label}</p>
        <h2>{restaurant.name}</h2>
      </div>
      <span className="walk-badge">
        {restaurant.walkMinutes}
        <small>MIN</small>
      </span>
    </div>
  );
}

function formatNullableMoney(cents: number | null) {
  return cents === null ? "Not captured" : formatMoney(cents);
}

const CAPTURE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

function basketCaptureLabel(basket: StudyBasket): string {
  if (!basket.observedAt) return basket.kind;

  return `${basket.kind} · ${CAPTURE_TIME_FORMATTER.format(new Date(basket.observedAt))}`;
}

function observationPrice(observation: PickupObservation) {
  if (observation.finalTotalCents !== null) {
    return {
      label:
        observation.result === "exact_checkout"
          ? "pickup total"
          : "active-cart total",
      value: formatMoney(observation.finalTotalCents),
    };
  }

  return {
    label: "item price only",
    value: formatMoney(observation.itemsSubtotalCents),
  };
}

function QuoteRow({
  observation,
  selected,
  onSelect,
}: {
  observation: PickupObservation;
  selected: boolean;
  onSelect: () => void;
}) {
  const price = observationPrice(observation);

  return (
    <button
      className={`quote-row${selected ? " quote-row--selected" : ""}`}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={`channel-mark channel-mark--${observation.channel.kind}`}>
        {observation.channel.shortName}
      </span>
      <span className="quote-channel">
        <strong>{observation.channel.name}</strong>
        <small>{observation.channel.provider}</small>
      </span>
      <span className="quote-total">
        <small>{price.label}</small>
        <strong>{price.value}</strong>
      </span>
    </button>
  );
}

export default function Home() {
  const [maxWalkMinutes, setMaxWalkMinutes] = useState(15);
  const [cuisine, setCuisine] = useState("All");
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(
    DEFAULT_RESTAURANT_ID,
  );
  const [selectedObservationId, setSelectedObservationId] = useState<
    string | null
  >(null);
  const [selectedBasketId, setSelectedBasketId] = useState<string | null>(null);

  const visibleRestaurants = useMemo(() => {
    const query = search.trim().toLowerCase();

    return STUDY_RESTAURANTS.filter((restaurant) => {
      const isAvailable = restaurant.baskets.some((basket) =>
        basket.observations.some(
          (observation) => observation.availability === "available_now",
        ),
      );

      return (
        restaurant.walkMinutes <= maxWalkMinutes &&
        (cuisine === "All" || restaurant.cuisine === cuisine) &&
        (!availableOnly || isAvailable) &&
        (!query ||
          restaurant.name.toLowerCase().includes(query) ||
          restaurant.cuisine.toLowerCase().includes(query) ||
          restaurant.baskets.some((basket) =>
            basket.name.toLowerCase().includes(query),
          ))
      );
    }).sort((left, right) => left.walkMinutes - right.walkMinutes);
  }, [availableOnly, cuisine, maxWalkMinutes, search]);

  const selectedRestaurant =
    visibleRestaurants.find(
      (restaurant) => restaurant.id === selectedRestaurantId,
    ) ?? visibleRestaurants[0];
  const selectedBasket = selectedRestaurant
    ? (selectedRestaurant.baskets.find(
        (basket) => basket.id === selectedBasketId,
      ) ?? featuredBasket(selectedRestaurant))
    : null;
  const comparison = selectedBasket
    ? new QuoteComparison(selectedBasket.observations)
    : null;
  const activeObservation = selectedBasket
    ? (selectedBasket.observations.find(
        (observation) => observation.id === selectedObservationId,
      ) ??
      comparison?.outcome.winner ??
      comparison?.mostCompleteObservation)
    : null;

  function selectRestaurant(restaurantId: string) {
    setSelectedRestaurantId(restaurantId);
    setSelectedBasketId(null);
    setSelectedObservationId(null);
  }

  function selectBasket(basketId: string) {
    setSelectedBasketId(basketId);
    setSelectedObservationId(null);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Sidewalk home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>SIDEWALK</span>
        </a>
        <div className="prototype-pill">
          <span /> POC · OBSERVED DATA
        </div>
        <span className="study-area">KIPS BAY / MURRAY HILL</span>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">REAL NYC PICKUP EVIDENCE</p>
          <h1>
            Real places.
            <br />
            <em>Honest totals.</em>
          </h1>
        </div>
        <div className="hero-note">
          <span className="hero-note-number">01</span>
          <p>
            {STUDY_SUMMARY.restaurants} nearby restaurants,{" "}
            {STUDY_SUMMARY.knownChannels} known ordering links, and{" "}
            {STUDY_SUMMARY.comparisons} basket comparisons backed by equivalent
            checkout totals.
          </p>
        </div>
      </section>

      <section className="study-notice" aria-label="Data freshness">
        <strong>Observed August 9–10, 2026</strong>
        <span>
          These are dated anonymous and signed-in pickup observations, not live
          prices. Open a channel to confirm its current total before ordering.
        </span>
      </section>

      <section className="control-deck" aria-label="Discovery controls">
        <div className="location-control">
          <span className="control-icon" aria-hidden="true">
            ●
          </span>
          <span>
            <small>Starting from</small>
            <strong>East 34th St &amp; Third Ave</strong>
          </span>
        </div>

        <label className="search-control">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search restaurant, cuisine, or basket"
            aria-label="Search restaurant, cuisine, or basket"
          />
        </label>

        <div className="walk-control">
          <div className="walk-copy">
            <span>
              <small>Walk up to</small>
              <strong>{maxWalkMinutes} minutes</strong>
            </span>
            <span className="walk-value">{maxWalkMinutes}</span>
          </div>
          <input
            type="range"
            min="5"
            max="15"
            step="5"
            value={maxWalkMinutes}
            onChange={(event) => setMaxWalkMinutes(Number(event.target.value))}
            aria-label="Maximum walking time"
          />
          <div className="range-labels" aria-hidden="true">
            <span>5m</span>
            <span>15m</span>
          </div>
        </div>
      </section>

      <section className="filter-row" aria-label="Restaurant filters">
        <div className="cuisine-list">
          {CUISINES.map((option) => (
            <button
              key={option}
              className={cuisine === option ? "filter-chip is-active" : "filter-chip"}
              type="button"
              aria-pressed={cuisine === option}
              onClick={() => setCuisine(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <button
          className={`new-toggle${availableOnly ? " is-active" : ""}`}
          type="button"
          aria-pressed={availableOnly}
          onClick={() => setAvailableOnly((current) => !current)}
        >
          <span>●</span> Available in capture
        </button>
      </section>

      <StudyMap
        restaurants={visibleRestaurants}
        selectedRestaurantId={selectedRestaurant?.id ?? ""}
        onSelect={selectRestaurant}
      />

      <section className="workspace">
        <div className="restaurant-column">
          <div className="section-heading">
            <div>
              <span className="section-index">/02</span>
              <h2>Within walking range</h2>
            </div>
            <p>
              {visibleRestaurants.length} place
              {visibleRestaurants.length === 1 ? "" : "s"} · sorted by walk
            </p>
          </div>

          {visibleRestaurants.length > 0 ? (
            <div className="restaurant-grid">
              {visibleRestaurants.map((restaurant) => {
                const basket = featuredBasket(restaurant);
                const restaurantComparison = basket
                  ? new QuoteComparison(basket.observations)
                  : null;
                const evidence = restaurantComparison
                  ? (restaurantComparison.outcome.winner ??
                    restaurantComparison.mostCompleteObservation)
                  : null;
                const price = evidence ? observationPrice(evidence) : null;
                const isSelected = restaurant.id === selectedRestaurant?.id;
                const wasAvailable = restaurant.baskets.some((candidate) =>
                  candidate.observations.some(
                    (observation) =>
                      observation.availability === "available_now",
                  ),
                );

                return (
                  <button
                    key={restaurant.id}
                    data-restaurant-id={restaurant.id}
                    type="button"
                    className={`restaurant-card${
                      isSelected ? " restaurant-card--selected" : ""
                    }`}
                    style={
                      {
                        "--restaurant-accent": restaurant.accent,
                      } as CSSProperties
                    }
                    onClick={() => selectRestaurant(restaurant.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="restaurant-visual" aria-hidden="true">
                      <span className="visual-orbit" />
                      <b>{restaurant.initials}</b>
                      <small>{restaurant.cuisine}</small>
                    </span>
                    <span className="restaurant-body">
                      <span className="restaurant-meta">
                        <span>{restaurant.walkMinutes} MIN WALK</span>
                        <span>
                          {wasAvailable
                            ? "AVAILABLE IN CAPTURE"
                            : basket
                              ? "CAPTURED"
                              : "CATALOG"}
                        </span>
                      </span>
                      <strong className="restaurant-name">{restaurant.name}</strong>
                      <span className="restaurant-description">
                        {restaurant.address}
                      </span>
                      <span className="basket-preview">
                        <small>{basket ? "Observed basket" : "Basket target"}</small>
                        {basket?.name ?? restaurant.anchorItem}
                      </span>
                      <span className="restaurant-footer">
                        <span>
                          <small>
                            {evidence ? "Strongest evidence" : "Known channels"}
                          </small>
                          <strong>
                            {evidence
                              ? RESULT_LABELS[evidence.result]
                              : `${restaurant.channels.length} found`}
                          </strong>
                        </span>
                        <span className="card-price">
                          <small>{price?.label ?? "quote status"}</small>
                          <strong>{price?.value ?? "Not captured"}</strong>
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <span>○</span>
              <h3>No observed places match.</h3>
              <p>Try a longer walk, another cuisine, or clear your search.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCuisine("All");
                  setAvailableOnly(false);
                  setMaxWalkMinutes(15);
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        <aside className="comparison-panel" aria-live="polite">
          {selectedRestaurant &&
          selectedBasket &&
          comparison &&
          activeObservation ? (
            <>
              <PanelHeader
                restaurant={selectedRestaurant}
                label="Observed pickup channels"
              />

              {selectedRestaurant.baskets.length > 1 && (
                <div className="basket-options" aria-label="Observed baskets">
                  {selectedRestaurant.baskets.map((basket) => (
                    <button
                      key={basket.id}
                      type="button"
                      className={
                        basket.id === selectedBasket.id ? "is-active" : ""
                      }
                      aria-pressed={basket.id === selectedBasket.id}
                      onClick={() => selectBasket(basket.id)}
                    >
                      <small>{basketCaptureLabel(basket)}</small>
                      <strong>{basket.name}</strong>
                    </button>
                  ))}
                </div>
              )}

              <div className="basket-card">
                <span className="basket-label">EQUIVALENT BASKET TARGET</span>
                <strong>{selectedBasket.name}</strong>
                <p>{selectedBasket.description}</p>
              </div>

              <div className="quote-list">
                {selectedBasket.observations.map((observation) => (
                  <QuoteRow
                    key={observation.id}
                    observation={observation}
                    selected={activeObservation.id === observation.id}
                    onSelect={() => setSelectedObservationId(observation.id)}
                  />
                ))}
              </div>

              <div className="breakdown">
                <div className="breakdown-heading">
                  <span>
                    <small>Selected observation</small>
                    <strong>{activeObservation.channel.name}</strong>
                  </span>
                  <span className={`confidence confidence--${activeObservation.result}`}>
                    {RESULT_LABELS[activeObservation.result]}
                  </span>
                </div>
                <p className="availability-line">
                  {AVAILABILITY_LABELS[activeObservation.availability]}
                </p>
                <dl>
                  <div>
                    <dt>Item price</dt>
                    <dd>{formatMoney(activeObservation.itemsSubtotalCents)}</dd>
                  </div>
                  <div>
                    <dt>Pickup fees</dt>
                    <dd>{formatNullableMoney(activeObservation.feesCents)}</dd>
                  </div>
                  <div>
                    <dt>NYC tax</dt>
                    <dd>{formatNullableMoney(activeObservation.taxCents)}</dd>
                  </div>
                  <div>
                    <dt>Discount</dt>
                    <dd>{formatNullableMoney(activeObservation.discountCents)}</dd>
                  </div>
                  <div>
                    <dt>Tip</dt>
                    <dd>{formatNullableMoney(activeObservation.tipCents)}</dd>
                  </div>
                  <div className="total-line">
                    <dt>Pickup total</dt>
                    <dd>
                      {formatNullableMoney(activeObservation.finalTotalCents)}
                    </dd>
                  </div>
                </dl>

                {activeObservation.promotions.map((promotion) => (
                  <div className="offer-note" key={promotion.label}>
                    <span>✦</span>
                    <p>
                      <strong>{promotion.label}</strong>
                      {promotion.applied
                        ? "Applied to this basket."
                        : promotion.conditionsVerified
                          ? "Not applied; the basket did not meet the verified conditions."
                          : "Not applied; conditions were not fully verified."}
                    </p>
                  </div>
                ))}

                {activeObservation.notes && (
                  <p className="observation-note">{activeObservation.notes}</p>
                )}

                <div className="provenance-row">
                  <span>
                    {activeObservation.accountContext === "signed_in"
                      ? "Signed-in pickup"
                      : "Anonymous pickup"}
                  </span>
                  <span>
                    Observed {selectedBasket.capturedOn}
                    {selectedBasket.quoteWindowSeconds !== null
                      ? ` · ${selectedBasket.quoteWindowSeconds}s window`
                      : ""}
                  </span>
                </div>
              </div>

              <div className={`outcome-summary outcome-summary--${comparison.outcome.kind}`}>
                <span>COMPARISON RESULT</span>
                <strong>{comparison.outcome.headline}</strong>
                <p>{comparison.outcome.explanation}</p>
                {comparison.outcome.savingsCents !== undefined && (
                  <b>Save {formatMoney(comparison.outcome.savingsCents)}</b>
                )}
              </div>

              <a
                className="handoff-button"
                href={activeObservation.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open {activeObservation.channel.name}
                <span>↗</span>
              </a>
              <p className="handoff-note">
                Sidewalk hands off to the source. It never places the order.
              </p>
            </>
          ) : selectedRestaurant ? (
            <>
              <PanelHeader
                restaurant={selectedRestaurant}
                label="Catalog discovery"
              />

              <div className="basket-card catalog-basket-card">
                <span className="basket-label">BASKET TARGET</span>
                <strong>{selectedRestaurant.anchorItem}</strong>
                <p>
                  This target still needs item, modifier, and availability
                  confirmation across at least two channels.
                </p>
              </div>

              <div
                className="catalog-channel-list"
                aria-label="Known ordering channels"
              >
                {selectedRestaurant.channels.length > 0 ? (
                  selectedRestaurant.channels.map((channel) => (
                    <a
                      className="catalog-channel"
                      href={channel.sourceUrl}
                      key={`${channel.key}-${channel.sourceUrl}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>
                        <small>{channel.name}</small>
                        <strong>{channel.provider}</strong>
                      </span>
                      <b aria-hidden="true">↗</b>
                    </a>
                  ))
                ) : (
                  <div className="catalog-channel-empty">
                    No ordering channel was confirmed in the seed pass.
                  </div>
                )}
              </div>

              <div className="outcome-summary outcome-summary--incomplete">
                <span>QUOTE STATUS</span>
                <strong>No checkout evidence yet</strong>
                <p>
                  The location and walking route are real. Known links are
                  discovery evidence only—not current availability or price
                  quotes.
                </p>
              </div>

              <a
                className="handoff-button"
                href={selectedRestaurant.websiteUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open restaurant website
                <span>↗</span>
              </a>
              <p className="handoff-note">
                Sidewalk hands off to the source. It never places the order.
              </p>
            </>
          ) : (
            <div className="comparison-empty">
              <span>↙</span>
              <h2>Choose a restaurant</h2>
              <p>We’ll show its observed pickup channels here.</p>
            </div>
          )}
        </aside>
      </section>

      <section className="proof-strip" aria-label="POC evidence">
        <div>
          <span className="section-index">/04</span>
          <h2>What works now</h2>
        </div>
        <div className="proof-item">
          <strong>{String(STUDY_SUMMARY.restaurants).padStart(2, "0")}</strong>
          <span>real restaurants</span>
        </div>
        <div className="proof-item">
          <strong>{String(STUDY_SUMMARY.observations).padStart(2, "0")}</strong>
          <span>channel observations</span>
        </div>
        <div className="proof-item">
          <strong>{String(STUDY_SUMMARY.completeTotals).padStart(2, "0")}</strong>
          <span>complete totals</span>
        </div>
        <p>
          All 25 panel restaurants support discovery, walking filters, map
          selection, and source handoff. {STUDY_SUMMARY.quotedRestaurants}{" "}
          currently have checkout research.
        </p>
      </section>

      <footer>
        <span>SIDEWALK / NYC PICKUP POC</span>
        <span>OpenStreetMap data · observed ordering evidence</span>
      </footer>
    </main>
  );
}
