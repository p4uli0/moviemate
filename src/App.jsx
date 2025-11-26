// src/App.jsx
// ==================================================================
// MOVIEMATE – MINIMAL "NEAR ME" VERSION
// - Ignores ./api/ukCinema.js completely
// - Calls /.netlify/functions/ukCinema directly
// - Derives films + showtimes from raw API data
// - No TMDB, no posters — just make the logic WORK
// ==================================================================

import { useEffect, useRef, useState } from "react";
import "./index.css";
import AdBanner from "./components/AdBanner.jsx";

// -------------------------------
// Helper: distance in miles
// -------------------------------
function distanceMiles(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null
  ) {
    return Infinity;
  }

  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normaliseDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}

function formatShowDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getDateRange(mode) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (mode === "today") {
    return { start: today, end: today };
  }

  if (mode === "7days") {
    const end = new Date(today);
    end.setDate(today.getDate() + 6);
    return { start: today, end };
  }

  if (mode === "weekend") {
    const day = today.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return { start: friday, end: sunday };
  }

  return { start: today, end: today };
}

// -------------------------------
// Deep search helpers
// -------------------------------
function isProbablyUrl(str) {
  return /https?:\/\//i.test(str) || /\bwww\./i.test(str);
}

// recursive search for a string that looks like a film title
function findTitleDeep(obj, depth = 0, maxDepth = 4) {
  if (!obj || typeof obj !== "object" || depth > maxDepth) return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findTitleDeep(item, depth + 1, maxDepth);
      if (found) return found;
    }
    return null;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      const lowerKey = key.toLowerCase();
      const looksLikeTitleKey =
        /film|title|movie|name/i.test(lowerKey);
      const looksLikeTitleValue =
        value.length > 3 &&
        /\D/.test(value) && // not pure numbers
        !isProbablyUrl(value);

      if (looksLikeTitleKey && looksLikeTitleValue) {
        return value;
      }
    }
  }

  // fallback: any decent-looking string
  for (const value of Object.values(obj)) {
    if (typeof value === "string") {
      if (
        value.length > 3 &&
        /\s/.test(value) && // has a space
        !isProbablyUrl(value)
      ) {
        return value;
      }
    }
  }

  // recurse into child objects
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findTitleDeep(value, depth + 1, maxDepth);
      if (found) return found;
    }
  }

  return null;
}

function findCinemaDeep(obj, depth = 0, maxDepth = 4) {
  if (!obj || typeof obj !== "object" || depth > maxDepth) return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findCinemaDeep(item, depth + 1, maxDepth);
      if (found) return found;
    }
    return null;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      const lowerKey = key.toLowerCase();
      const matchesKey =
        /cinema|venue|theatre|theater|location|site/i.test(lowerKey);
      if (matchesKey && value.length > 1 && !isProbablyUrl(value)) {
        return value;
      }
    }
  }

  // fallback: nothing
  return null;
}

function findBookingUrlDeep(obj, depth = 0, maxDepth = 4) {
  if (!obj || typeof obj !== "object" || depth > maxDepth) return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findBookingUrlDeep(item, depth + 1, maxDepth);
      if (found) return found;
    }
    return null;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      const lowerKey = key.toLowerCase();
      const keyMatches =
        /book|ticket|url|link/i.test(lowerKey);
      if (keyMatches && isProbablyUrl(value)) {
        return value;
      }
    }
  }

  // fallback: any URL-looking string
  for (const value of Object.values(obj)) {
    if (typeof value === "string" && isProbablyUrl(value)) {
      return value;
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findBookingUrlDeep(value, depth + 1, maxDepth);
      if (found) return found;
    }
  }

  return null;
}

function findLatLngDeep(obj, depth = 0, maxDepth = 4) {
  if (!obj || typeof obj !== "object" || depth > maxDepth) {
    return { lat: null, lng: null };
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findLatLngDeep(item, depth + 1, maxDepth);
      if (found.lat != null && found.lng != null) return found;
    }
    return { lat: null, lng: null };
  }

  let lat = null;
  let lng = null;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "number") {
      const lowerKey = key.toLowerCase();
      if (/lat/.test(lowerKey)) lat = value;
      if (/lng|lon|long/.test(lowerKey)) lng = value;
    }
  }

  if (lat != null && lng != null) return { lat, lng };

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findLatLngDeep(value, depth + 1, maxDepth);
      if (found.lat != null && found.lng != null) return found;
    }
  }

  return { lat: null, lng: null };
}

function findDateDeep(obj, depth = 0, maxDepth = 4) {
  if (!obj || typeof obj !== "object" || depth > maxDepth) return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findDateDeep(item, depth + 1, maxDepth);
      if (found) return found;
    }
    return null;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      const lowerKey = key.toLowerCase();
      const keyMatches =
        /showing|start|time|date|datetime/i.test(lowerKey);
      if (keyMatches) {
        const dt = new Date(value);
        if (!isNaN(dt.getTime())) return dt;
      }
    }
  }

  // fallback: any ISO-looking string
  for (const value of Object.values(obj)) {
    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        const dt = new Date(value);
        if (!isNaN(dt.getTime())) return dt;
      }
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findDateDeep(value, depth + 1, maxDepth);
      if (found) return found;
    }
  }

  return null;
}

function findPriceDeep(obj, depth = 0, maxDepth = 4) {
  if (!obj || typeof obj !== "object" || depth > maxDepth) return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findPriceDeep(item, depth + 1, maxDepth);
      if (found != null) return found;
    }
    return null;
  }

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (typeof value === "number") {
      if (/price|cost|amount|fee/i.test(lowerKey)) {
        return value;
      }
    }
  }

  for (const value of Object.values(obj)) {
    if (typeof value === "string") {
      if (/£|\d/.test(value) && !isProbablyUrl(value)) {
        const m = value.match(/([\d,.]+)/);
        if (m) {
          const num = parseFloat(m[1].replace(",", ""));
          if (!isNaN(num)) return num;
        }
      }
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findPriceDeep(value, depth + 1, maxDepth);
      if (found != null) return found;
    }
  }

  return null;
}

// ===============================
// MAIN APP
// ===============================
export default function App() {
  const [showtimes, setShowtimes] = useState([]); // normalised
  const [films, setFilms] = useState([]);         // derived from showtimes
  const [selectedFilmKey, setSelectedFilmKey] = useState(null);
  const [dateFilter, setDateFilter] = useState("today");
  const [sortMode, setSortMode] = useState("price");

  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

  const moviesRef = useRef(null);
  const showtimesRef = useRef(null);

  // -------------------------------
  // Fetch raw UK Cinema data directly via Netlify function
  // -------------------------------
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/.netlify/functions/ukCinema");
        if (!res.ok) {
          const text = await res.text();
          console.error("UK Cinema proxy error:", res.status, text);
          setShowtimes([]);
          return;
        }

        const raw = await res.json();
        const rawArray = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];

        // One console just so you know *something* happened
        console.log("UK Cinema raw rows:", rawArray.length);

        const normalised = rawArray.map((item, index) => {
          const show = item.showtime || item;

          const filmTitle =
            findTitleDeep(show) ||
            findTitleDeep(item) ||
            "Unknown film";

          const cinemaName =
            findCinemaDeep(show) ||
            findCinemaDeep(item) ||
            "Unknown cinema";

          const dt =
            findDateDeep(show) ||
            findDateDeep(item) ||
            new Date();

          const priceVal =
            findPriceDeep(show) ||
            findPriceDeep(item) ||
            9.99;

          const { lat, lng } =
            findLatLngDeep(show) || findLatLngDeep(item);

          const bookingUrl =
            findBookingUrlDeep(show) ||
            findBookingUrlDeep(item) ||
            "#";

          return {
            id: show.id ?? item.id ?? index,
            film: filmTitle,
            cinema: cinemaName,
            date: dt,
            time: dt.toTimeString().slice(0, 5),
            priceValue: priceVal,
            price: `£${priceVal.toFixed(2)}`,
            lat,
            lng,
            bookingUrl,
          };
        });

        setShowtimes(normalised);
      } catch (err) {
        console.error("UK Cinema fetch error:", err);
        setShowtimes([]);
      }
    }

    load();
  }, []);

  // -------------------------------
  // Geolocation
  // -------------------------------
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationError("");
      },
      (err) => {
        console.warn("Geolocation error:", err);
        setLocationError("Location permission denied.");
      }
    );
  }, []);

  // -------------------------------
  // Filter showtimes by date + distance, then derive films
  // -------------------------------
  const filteredShowtimes = (() => {
    if (!showtimes.length) return [];

    const { start, end } = getDateRange(dateFilter);
    const sKey = normaliseDate(start);
    const eKey = normaliseDate(end);

    let list = showtimes.filter((s) => {
      const k = normaliseDate(s.date);
      return k >= sKey && k <= eKey;
    });

    if (!list.length) return [];

    if (userLocation) {
      list = list.map((s) => ({
        ...s,
        distanceMiles: distanceMiles(
          userLocation.lat,
          userLocation.lng,
          s.lat,
          s.lng
        ),
      }));

      const withCoords = list.filter(
        (s) =>
          typeof s.distanceMiles === "number" &&
          isFinite(s.distanceMiles)
      );

      // 50-mile radius for "near me"
      const withinRadius = withCoords.filter(
        (s) => s.distanceMiles <= 50
      );

      if (withinRadius.length > 0) {
        list = withinRadius;
      }
    }

    return list;
  })();

  useEffect(() => {
    const map = new Map();

    for (const s of filteredShowtimes) {
      const normTitle = s.film.trim();
      if (!normTitle) continue;
      const key = normTitle.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          key,
          title: s.film,
        });
      }
    }

    const filmList = Array.from(map.values());
    setFilms(filmList);

    if (
      selectedFilmKey &&
      !filmList.some((f) => f.key === selectedFilmKey)
    ) {
      setSelectedFilmKey(null);
    }
  }, [filteredShowtimes, selectedFilmKey]);

  // -------------------------------
  // Showtimes for selected film
  // -------------------------------
  const visibleShowtimes = (() => {
    if (!selectedFilmKey) return [];

    let list = filteredShowtimes.filter(
      (s) => s.film.trim().toLowerCase() === selectedFilmKey
    );

    if (!list.length) return [];

    if (userLocation) {
      list = list.map((s) => ({
        ...s,
        distanceMiles:
          typeof s.distanceMiles === "number"
            ? s.distanceMiles
            : distanceMiles(
                userLocation.lat,
                userLocation.lng,
                s.lat,
                s.lng
              ),
      }));
    }

    list = list.sort((a, b) => {
      if (sortMode === "distance" && userLocation) {
        const da =
          typeof a.distanceMiles === "number"
            ? a.distanceMiles
            : Infinity;
        const db =
          typeof b.distanceMiles === "number"
            ? b.distanceMiles
            : Infinity;
        return da - db;
      }

      return a.priceValue - b.priceValue;
    });

    return list;
  })();

  const cheapest =
    visibleShowtimes.length > 0
      ? Math.min(...visibleShowtimes.map((x) => x.priceValue))
      : null;

  const selectedFilmTitle =
    films.find((f) => f.key === selectedFilmKey)?.title || "";

  // ===============================
  // RENDER
  // ===============================
  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="header">
        <div className="logo">🎬 MovieMate</div>
        <p className="tagline">What&apos;s on near you</p>
      </header>

      {/* MOVIES GRID – from showtimes */}
      <section className="now-playing-section" ref={moviesRef}>
        <h2 className="section-title">
          Now in cinemas near you
        </h2>

        <div className="movies-grid">
          {films.map((film) => (
            <button
              key={film.key}
              className="movie-card"
              onClick={() => {
                setSelectedFilmKey(film.key);
                setTimeout(() => {
                  showtimesRef.current?.scrollIntoView({
                    behavior: "smooth",
                  });
                }, 120);
              }}
            >
              <div className="movie-poster-wrapper">
                {/* Simple colour block instead of poster for now */}
                <div className="movie-poster placeholder-poster">
                  {film.title}
                </div>
              </div>
            </button>
          ))}
        </div>

        {!films.length && (
          <p className="no-results">
            No films found near you in this date range.
          </p>
        )}
      </section>

      {/* SHOWTIMES */}
      <section className="showtimes-section" ref={showtimesRef}>
        <h2 className="section-title-small">Showtimes</h2>

        {/* DATE FILTERS */}
        <div className="date-filter-bar">
          <button
            className={dateFilter === "today" ? "active" : ""}
            onClick={() => setDateFilter("today")}
          >
            Today
          </button>
          <button
            className={dateFilter === "weekend" ? "active" : ""}
            onClick={() => setDateFilter("weekend")}
          >
            This weekend
          </button>
          <button
            className={dateFilter === "7days" ? "active" : ""}
            onClick={() => setDateFilter("7days")}
          >
            Next 7 days
          </button>
        </div>

        {/* SELECTED FILM HEADER */}
        {selectedFilmKey && (
          <div className="film-detail-header">
            <div className="film-detail-text">
              <h3 className="film-detail-title">
                {selectedFilmTitle}
              </h3>
              <button
                className="back-btn"
                onClick={() => setSelectedFilmKey(null)}
              >
                ← Back to all films
              </button>
            </div>
          </div>
        )}

        {/* SORTING */}
        <div className="sort-bar">
          <button
            className={sortMode === "price" ? "active" : ""}
            onClick={() => setSortMode("price")}
          >
            Cheapest
          </button>

          <button
            className={sortMode === "distance" ? "active" : ""}
            onClick={() => setSortMode("distance")}
          >
            Nearest
          </button>
        </div>

        {/* LOCATION ERROR */}
        {locationError && (
          <p className="location-error">{locationError}</p>
        )}

        {/* SHOWTIME CARDS */}
        <div className="showtime-list">
          {visibleShowtimes.map((s) => (
            <div
              key={s.id}
              className={`showtime-card ${
                cheapest !== null && s.priceValue === cheapest
                  ? "cheapest"
                  : ""
              }`}
            >
              <div className="showtime-row-top">
                <h4 className="cinema-name">{s.cinema}</h4>

                {userLocation &&
                  s.distanceMiles != null &&
                  isFinite(s.distanceMiles) && (
                    <p className="distance-text">
                      {s.distanceMiles.toFixed(1)} miles away
                    </p>
                  )}
              </div>

              <div className="showtime-info">
                <span className="showtime-date">
                  {formatShowDate(s.date)}
                </span>
                <span className="showtime-time">{s.time}</span>
                <span className="showtime-price">{s.price}</span>

                {cheapest !== null &&
                  s.priceValue === cheapest && (
                    <span className="cheapest-badge">Cheapest</span>
                  )}
              </div>

              <a
                href={s.bookingUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className="book-btn"
              >
                Book →
              </a>
            </div>
          ))}

          {selectedFilmKey && visibleShowtimes.length === 0 && (
            <p className="no-results">
              No showtimes found near you in this date range for this
              film.
            </p>
          )}

          {!selectedFilmKey && (
            <p className="no-results">
              Select a film above to see local showtimes.
            </p>
          )}
        </div>
      </section>

      {/* ⭐ AD BANNER (Sticky bottom ad) */}
      <AdBanner />
    </div>
  );
}
