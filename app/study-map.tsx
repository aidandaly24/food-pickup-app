"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { STUDY_CENTER } from "./study-data";
import type { StudyRestaurant } from "./domain";

export function StudyMap({
  restaurants,
  selectedRestaurantId,
  onSelect,
}: {
  restaurants: readonly StudyRestaurant[];
  selectedRestaurantId: string;
  onSelect: (restaurantId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef(new Map<string, LeafletMarker>());
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedRestaurantId);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let disposed = false;
    const markers = markersRef.current;

    void import("leaflet").then((L) => {
      if (disposed || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      L.circleMarker([STUDY_CENTER.latitude, STUDY_CENTER.longitude], {
        radius: 7,
        color: "#171714",
        weight: 2,
        fillColor: "#dafe61",
        fillOpacity: 1,
      })
        .bindTooltip(`Start: ${STUDY_CENTER.label}`)
        .addTo(map);

      for (const restaurant of restaurants) {
        const marker = L.marker([restaurant.latitude, restaurant.longitude], {
          title: restaurant.name,
          icon: L.divIcon({
            className: `sidewalk-map-marker${
              restaurant.id === selectedIdRef.current ? " is-selected" : ""
            }`,
            html: `<span style="--marker-color:${restaurant.accent}">${restaurant.initials}</span>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
          }),
        })
          .bindTooltip(
            `<strong>${restaurant.name}</strong><br>${restaurant.walkMinutes} min walk`,
          )
          .on("click", () => onSelectRef.current(restaurant.id))
          .addTo(map);

        markers.set(restaurant.id, marker);
      }

      const points = [
        [STUDY_CENTER.latitude, STUDY_CENTER.longitude],
        ...restaurants.map((restaurant) => [
          restaurant.latitude,
          restaurant.longitude,
        ]),
      ] as [number, number][];

      map.fitBounds(L.latLngBounds(points).pad(0.22), { maxZoom: 15 });
    });

    return () => {
      disposed = true;
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [restaurants]);

  useEffect(() => {
    selectedIdRef.current = selectedRestaurantId;

    for (const [restaurantId, marker] of markersRef.current) {
      marker
        .getElement()
        ?.classList.toggle("is-selected", restaurantId === selectedRestaurantId);
    }
  }, [selectedRestaurantId]);

  return (
    <section className="map-section" aria-labelledby="map-heading">
      <div className="map-heading">
        <div>
          <span className="section-index">/01</span>
          <h2 id="map-heading">What’s actually walkable</h2>
        </div>
        <p>
          OpenStreetMap pedestrian estimates from {STUDY_CENTER.label}. Select a
          marker or restaurant below.
        </p>
      </div>
      <div
        ref={containerRef}
        className="map-canvas"
        role="img"
        aria-label={`Map of ${restaurants.length} study restaurants around ${STUDY_CENTER.label}`}
      />
      <div className="map-legend" aria-label="Map restaurants">
        {restaurants.map((restaurant) => (
          <button
            key={restaurant.id}
            className={
              restaurant.id === selectedRestaurantId ? "is-selected" : ""
            }
            type="button"
            onClick={() => onSelect(restaurant.id)}
          >
            <span style={{ background: restaurant.accent }} />
            {restaurant.name}
          </button>
        ))}
      </div>
    </section>
  );
}
