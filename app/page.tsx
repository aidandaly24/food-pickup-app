"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { RESTAURANTS } from "./demo-data";
import {
  QuoteComparison,
  formatMoney,
  type RankedQuote,
  type Restaurant,
} from "./domain";

const CUISINES = [
  "All",
  "Japanese",
  "Mediterranean",
  "Pizza",
  "Indian",
  "Mexican",
  "Sandwiches",
] as const;

type Cuisine = (typeof CUISINES)[number];

function restaurantPrice(
  restaurant: Restaurant,
  includePersonalOffers: boolean,
) {
  return new QuoteComparison(
    restaurant.quotes,
    includePersonalOffers,
  ).winner.totalCents;
}

function freshnessLabel(minutes: number) {
  if (minutes < 2) return "just now";
  return `${minutes}m ago`;
}

function QuoteRow({
  result,
  winnerId,
  selected,
  onSelect,
}: {
  result: RankedQuote;
  winnerId: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { quote } = result;

  return (
    <button
      className={`quote-row${selected ? " quote-row--selected" : ""}`}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={`channel-mark channel-mark--${quote.channel.kind}`}>
        {quote.channel.shortName}
      </span>
      <span className="quote-channel">
        <strong>{quote.channel.name}</strong>
        <small>
          {quote.channel.provider
            ? `via ${quote.channel.provider}`
            : quote.confidence === "exact"
              ? "Cart verified"
              : "Menu estimate"}
        </small>
      </span>
      <span className="quote-total">
        {quote.id === winnerId && <small>Best today</small>}
        <strong>{formatMoney(result.totalCents)}</strong>
      </span>
    </button>
  );
}

export default function Home() {
  const [maxWalkMinutes, setMaxWalkMinutes] = useState(15);
  const [cuisine, setCuisine] = useState<Cuisine>("All");
  const [search, setSearch] = useState("");
  const [newOnly, setNewOnly] = useState(false);
  const [includePersonalOffers, setIncludePersonalOffers] = useState(false);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(
    RESTAURANTS[0].id,
  );
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [handoffMessage, setHandoffMessage] = useState(false);

  const visibleRestaurants = useMemo(() => {
    const query = search.trim().toLowerCase();

    return RESTAURANTS.filter((restaurant) => {
      const withinRange = restaurant.walkMinutes <= maxWalkMinutes;
      const matchesCuisine =
        cuisine === "All" || restaurant.cuisine === cuisine;
      const matchesHistory = !newOnly || !restaurant.hasOrderedBefore;
      const matchesQuery =
        !query ||
        restaurant.name.toLowerCase().includes(query) ||
        restaurant.cuisine.toLowerCase().includes(query) ||
        restaurant.basketName.toLowerCase().includes(query);

      return withinRange && matchesCuisine && matchesHistory && matchesQuery;
    }).sort((left, right) => {
      return (
        restaurantPrice(left, includePersonalOffers) -
        restaurantPrice(right, includePersonalOffers)
      );
    });
  }, [cuisine, includePersonalOffers, maxWalkMinutes, newOnly, search]);

  const selectedRestaurant =
    visibleRestaurants.find(
      (restaurant) => restaurant.id === selectedRestaurantId,
    ) ?? visibleRestaurants[0];

  const comparison = selectedRestaurant
    ? new QuoteComparison(
        selectedRestaurant.quotes,
        includePersonalOffers,
      )
    : null;
  const rankedQuotes = comparison?.rankedQuotes ?? [];
  const activeQuote =
    rankedQuotes.find((result) => result.quote.id === selectedQuoteId) ??
    rankedQuotes[0];

  function selectRestaurant(restaurantId: string) {
    setSelectedRestaurantId(restaurantId);
    setSelectedQuoteId(null);
    setHandoffMessage(false);
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
          <span /> POC · CURATED DATA
        </div>
        <button className="avatar-button" type="button" aria-label="Demo profile">
          AD
        </button>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">NEW YORK PICKUP, MINUS THE GUESSWORK</p>
          <h1>
            Good food.
            <br />
            <em>Better route.</em>
          </h1>
        </div>
        <div className="hero-note">
          <span className="hero-note-number">01</span>
          <p>
            Find something worth the walk, then compare the same order across
            every available pickup channel.
          </p>
        </div>
      </section>

      <section className="control-deck" aria-label="Discovery controls">
        <div className="location-control">
          <span className="control-icon" aria-hidden="true">
            ●
          </span>
          <span>
            <small>Starting from</small>
            <strong>Union Square, Manhattan</strong>
          </span>
          <button type="button" aria-label="Change demo location">
            Change
          </button>
        </div>

        <label className="search-control">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search food or restaurants"
            aria-label="Search food or restaurants"
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
            max="20"
            step="5"
            value={maxWalkMinutes}
            onChange={(event) => setMaxWalkMinutes(Number(event.target.value))}
            aria-label="Maximum walking time"
          />
          <div className="range-labels" aria-hidden="true">
            <span>5m</span>
            <span>20m</span>
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
          className={`new-toggle${newOnly ? " is-active" : ""}`}
          type="button"
          aria-pressed={newOnly}
          onClick={() => setNewOnly((current) => !current)}
        >
          <span>✦</span> New to me
        </button>
      </section>

      <section className="workspace">
        <div className="restaurant-column">
          <div className="section-heading">
            <div>
              <span className="section-index">/01</span>
              <h2>Worth the walk</h2>
            </div>
            <p>
              {visibleRestaurants.length} place
              {visibleRestaurants.length === 1 ? "" : "s"} · sorted by best
              current total
            </p>
          </div>

          {visibleRestaurants.length > 0 ? (
            <div className="restaurant-grid">
              {visibleRestaurants.map((restaurant) => {
                const restaurantComparison = new QuoteComparison(
                  restaurant.quotes,
                  includePersonalOffers,
                );
                const winner = restaurantComparison.winner;
                const isSelected = restaurant.id === selectedRestaurant?.id;

                return (
                  <button
                    key={restaurant.id}
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
                        {!restaurant.hasOrderedBefore && <span>NEW TO YOU</span>}
                      </span>
                      <strong className="restaurant-name">{restaurant.name}</strong>
                      <span className="restaurant-description">
                        {restaurant.description}
                      </span>
                      <span className="basket-preview">
                        <small>Compared basket</small>
                        {restaurant.basketName}
                      </span>
                      <span className="restaurant-footer">
                        <span>
                          <small>Best via</small>
                          <strong>{winner.quote.channel.name}</strong>
                        </span>
                        <span className="card-price">
                          <small>pickup total</small>
                          <strong>{formatMoney(winner.totalCents)}</strong>
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
              <h3>No places match this exact mix.</h3>
              <p>Try a longer walk, another cuisine, or clear your search.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCuisine("All");
                  setNewOnly(false);
                  setMaxWalkMinutes(15);
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        <aside className="comparison-panel" aria-live="polite">
          {selectedRestaurant && comparison && activeQuote ? (
            <>
              <div className="comparison-header">
                <div>
                  <span className="section-index section-index--light">/02</span>
                  <p>Compare pickup</p>
                  <h2>{selectedRestaurant.name}</h2>
                </div>
                <span className="walk-badge">
                  {selectedRestaurant.walkMinutes}
                  <small>MIN</small>
                </span>
              </div>

              <div className="basket-card">
                <span className="basket-label">SAME BASKET EVERYWHERE</span>
                <strong>{selectedRestaurant.basketName}</strong>
                <p>{selectedRestaurant.basketItems.join(" · ")}</p>
              </div>

              <div className="pricing-mode">
                <span>
                  <small>Pricing context</small>
                  <strong>
                    {includePersonalOffers ? "Aidan’s demo offers" : "Public prices"}
                  </strong>
                </span>
                <button
                  className={`switch${includePersonalOffers ? " is-on" : ""}`}
                  type="button"
                  role="switch"
                  aria-checked={includePersonalOffers}
                  onClick={() => setIncludePersonalOffers((current) => !current)}
                >
                  <span />
                </button>
              </div>

              <div className="quote-list">
                {rankedQuotes.map((result) => (
                  <QuoteRow
                    key={result.quote.id}
                    result={result}
                    winnerId={comparison.winner.quote.id}
                    selected={activeQuote.quote.id === result.quote.id}
                    onSelect={() => setSelectedQuoteId(result.quote.id)}
                  />
                ))}
              </div>

              <div className="breakdown">
                <div className="breakdown-heading">
                  <span>
                    <small>Selected breakdown</small>
                    <strong>{activeQuote.quote.channel.name}</strong>
                  </span>
                  <span
                    className={`confidence confidence--${activeQuote.quote.confidence}`}
                  >
                    {activeQuote.quote.confidence === "exact"
                      ? "Cart verified"
                      : "Estimated"}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Items</dt>
                    <dd>{formatMoney(activeQuote.quote.itemsSubtotalCents)}</dd>
                  </div>
                  <div>
                    <dt>Pickup fees</dt>
                    <dd>
                      {activeQuote.quote.feesCents === 0
                        ? "—"
                        : formatMoney(activeQuote.quote.feesCents)}
                    </dd>
                  </div>
                  <div>
                    <dt>NYC tax</dt>
                    <dd>{formatMoney(activeQuote.quote.taxCents)}</dd>
                  </div>
                  <div className="discount-line">
                    <dt>Savings applied</dt>
                    <dd>
                      {activeQuote.discountCents === 0
                        ? "—"
                        : `−${formatMoney(activeQuote.discountCents)}`}
                    </dd>
                  </div>
                  <div className="total-line">
                    <dt>Pickup total</dt>
                    <dd>{formatMoney(activeQuote.totalCents)}</dd>
                  </div>
                </dl>

                {activeQuote.appliedOffers.length > 0 && (
                  <div className="offer-note">
                    <span>✦</span>
                    <p>
                      <strong>{activeQuote.appliedOffers.join(" + ")}</strong>
                      {activeQuote.quote.offerCondition}
                    </p>
                  </div>
                )}

                <div className="provenance-row">
                  <span>
                    Checked {freshnessLabel(activeQuote.quote.freshnessMinutes)}
                  </span>
                  <span>Demo snapshot</span>
                </div>
              </div>

              <div className="winner-summary">
                <span>YOU SAVE</span>
                <strong>
                  {formatMoney(comparison.savingsAgainstNextBestCents)}
                </strong>
                <p>
                  by choosing {comparison.winner.quote.channel.name} over the
                  next-best channel for this basket.
                </p>
              </div>

              <button
                className="handoff-button"
                type="button"
                onClick={() => setHandoffMessage(true)}
              >
                Continue with {comparison.winner.quote.channel.name}
                <span>↗</span>
              </button>
              {handoffMessage && (
                <p className="handoff-note">
                  POC handoff verified. A live build will open the exact
                  storefront after its source URL is validated.
                </p>
              )}
            </>
          ) : (
            <div className="comparison-empty">
              <span>↙</span>
              <h2>Choose a restaurant</h2>
              <p>We’ll line up its pickup channels here.</p>
            </div>
          )}
        </aside>
      </section>

      <section className="proof-strip" aria-label="POC boundaries">
        <div>
          <span className="section-index">/03</span>
          <h2>What this POC proves</h2>
        </div>
        <div className="proof-item">
          <strong>06</strong>
          <span>curated restaurants</span>
        </div>
        <div className="proof-item">
          <strong>18</strong>
          <span>comparable quotes</span>
        </div>
        <div className="proof-item">
          <strong>04</strong>
          <span>direct-site providers</span>
        </div>
        <p>
          Prices are intentionally seeded demonstration data—not live claims.
          The next experiment replaces one source at a time with verified
          observations.
        </p>
      </section>

      <footer>
        <span>SIDEWALK / NYC PICKUP POC</span>
        <span>Built to learn, not to pretend.</span>
      </footer>
    </main>
  );
}
