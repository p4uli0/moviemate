// ===============================
// MOVIEMATE – MAIN APP
// NEAR-ME FIRST:
// - Use UK Cinema API showtimes as the source of truth
// - Derive film list from local showtimes
// - (Optionally) decorate with TMDB via tmdbId
// ===============================

import { useState, useEffect, useRef } from "react";
import "./index.css";
import { getMovieDetails } from "./api/tmdb.js";
import AdBanner from "./components/AdBanner.jsx";
import { getShowtimesFromApi } from "./api/ukCinema";

// -------------------------------
// Helper functions
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

// Normalise film titles for fuzzy matching
function normaliseTitle(str) {
  if (!str) return "";

  return str
    .toLowerCase()
    // remove anything in brackets e.g. (12A), (U), (Subtitled)
    .replace(/\([^)]*\)/g, " ")
    // treat dashes/colons as word boundaries
    .replace(/[-:–—]/g, " ")
    // remove common junk words and rating codes
    .replace(/\b(3d|2d|imax|the movie|movie|film|u|pg|12a|12|15|18)\b/g, "")
    // strip anything that's not alphanumeric
    .replace(/[^a-z0-9]+/g, " ")
    // collapse spaces
    .replace(/\s+/g, " ")
    .trim();
}

// -------------------------------
// MAIN APP
// -------------------------------
export default function App() {
  const [allShowtimes, setAllShowtimes] = useState([]);       // from ukCinema.js
  const [films, setFilms] = useState([]);                     // derived from showtimes
  const [filmDetailsByTmdbId, setFilmDetailsByTmdbId] = useState({}); // TMDB details map

  const [selectedFilm, setSelectedFilm] = useState(null);     // { key, title, tmdbId }
  const [sortMode, setSortMode] = useState("price");          // "price" | "distance"
  const [dateFilter, setDateFilter] = useState("today");

  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

  const [trailerOpen, setTrailerOpen] = useState(false);

  const showtimesRef = useRef(null);
  const moviesRef = useRef(null);

  // -------------------------------
  // Load UK Cinema showtimes
  // -------------------------------
  useEffect(() => {
    async function loadShowtimesFromApi() {
      try {
        const apiShowtimes = await getShowtimesFromApi();
        console.log("Showtimes from API (normalised):", apiShowtimes);

        if (Array.isArray(apiShowtimes)) {
          setAllShowtimes(apiShowtimes);
        } else {
          setAllShowtimes([]);
        }
      } catch (err) {
        console.error("UK Cinema API error:", err);
        setAllShowtimes([]);
      }
    }

    loadShowtimesFromApi();
  }, []);

  // -------------------------------
  // Geolocation (for distance)
// -------------------------------
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported in this browser.");
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
  // Derive "near me in date range" showtimes
  // -------------------------------
  const filteredShowtimes = (() => {
    console.log("DEBUG total showtimes:", allShowtimes.length);
    if (!allShowtimes.length) return [];

    let list = allShowtimes.slice();

    // 1) Filter by date range
    const { start, end } = getDateRange(dateFilter);
    const sKey = normaliseDate(start);
    const eKey = normaliseDate(end);

    list = list.filter((s) => {
      const k = normaliseDate(s.date);
      return k >= sKey && k <= eKey;
    });
    console.log("After date filter:", list.length);

    if (!list.length) return [];

    // 2) Add distances & filter by radius if we have location
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

      console.log(
        "With coords:",
        withCoords.length,
        "out of",
        list.length
      );

      // Hard 50-mile radius for "near me"
      const withinRadius = withCoords.filter(
        (s) => s.distanceMiles <= 50
      );

      if (withinRadius.length > 0) {
        console.log("Within 50 miles:", withinRadius.length);
        list = withinRadius;
      } else {
        console.log(
          "No showtimes within 50 miles; falling back to all (date-only filtered) showtimes."
        );
      }
    }

    return list;
  })();

  // -------------------------------
  // Derive unique films from filtered showtimes
  // -------------------------------
  useEffect(() => {
    const map = new Map();

    for (const s of filteredShowtimes) {
      const normTitle = normaliseTitle(s.film);
      const key =
        s.tmdbId != null
          ? `tmdb-${String(s.tmdbId)}`
          : `title-${normTitle || s.film}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          title: s.film,
          tmdbId: s.tmdbId ?? null,
        });
      }
    }

    const filmArray = Array.from(map.values());
    console.log("Derived films from showtimes:", filmArray);
    setFilms(filmArray);

    // If the currently selected film disappears from the local list (e.g. date changed),
    // clear the selection.
    if (
      selectedFilm &&
      !filmArray.some((f) => f.key === selectedFilm.key)
    ) {
      setSelectedFilm(null);
      setTrailerOpen(false);
    }
  }, [filteredShowtimes]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------
  // Fetch TMDB details for any films with tmdbId
  // -------------------------------
  useEffect(() => {
    async function fetchDetails() {
      const toFetch = films.filter(
        (f) =>
          f.tmdbId &&
          !filmDetailsByTmdbId[String(f.tmdbId)]
      );

      if (!toFetch.length) return;

      for (const f of toFetch) {
        try {
          const details = await getMovieDetails(f.tmdbId);
          setFilmDetailsByTmdbId((prev) => ({
            ...prev,
            [String(f.tmdbId)]: details,
          }));
        } catch (err) {
          console.error(
            "Failed to fetch TMDB details for",
            f.title,
            "tmdbId:",
            f.tmdbId,
            err
          );
        }
      }
    }

    fetchDetails();
  }, [films, filmDetailsByTmdbId]);

  // -------------------------------
  // Movie click → select film + scroll
  // -------------------------------
  function handleFilmClick(film) {
    setSelectedFilm(film);
    setTrailerOpen(false);

    setTimeout(() => {
      showtimesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 120);
  }

  function clearFilm() {
    setSelectedFilm(null);
    setTrailerOpen(false);

    setTimeout(() => {
      moviesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  }

  // -------------------------------
  // FILTER + SORT SHOWTIMES FOR SELECTED FILM
  // -------------------------------
  const visibleShowtimes = (() => {
    if (!selectedFilm) return [];

    let list = filteredShowtimes.slice();

    const selectedNormTitle = normaliseTitle(selectedFilm.title);
    const selectedTmdbId = selectedFilm.tmdbId || null;

    console.log(
      "Selected film:",
      selectedFilm.title,
      "| tmdbId:",
      selectedTmdbId,
      "| normTitle:",
      selectedNormTitle
    );

    // 1) Prefer tmdbId match if available
    let matched = [];
    if (selectedTmdbId != null) {
      matched = list.filter(
        (s) =>
          s.tmdbId != null &&
          String(s.tmdbId) === String(selectedTmdbId)
      );
      console.log("Matched by tmdbId:", matched.length);
    }

    // 2) Fallback: fuzzy title match
    if (!matched.length) {
      matched = list.filter((s) => {
        const t = normaliseTitle(s.film);
        return (
          t &&
          (t === selectedNormTitle ||
            t.includes(selectedNormTitle) ||
            selectedNormTitle.includes(t))
        );
      });
      console.log("Matched by title:", matched.length);
    }

    if (!matched.length) {
      console.warn(
        "⚠ No showtimes matched by tmdbId or title for this film."
      );
      return [];
    }

    list = matched;

    // 3) Sort list
    list = list.map((s) => {
      // distanceMiles is already on filteredShowtimes when userLocation is set
      if (!userLocation && s.distanceMiles == null) {
        return { ...s, distanceMiles: Infinity };
      }
      return s;
    });

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

      // default / price
      return a.priceValue - b.priceValue;
    });

    return list;
  })();

  const cheapest =
    visibleShowtimes.length > 0
      ? Math.min(...visibleShowtimes.map((x) => x.priceValue))
      : null;

  const selectedFilmDetails =
    selectedFilm?.tmdbId != null
      ? filmDetailsByTmdbId[String(selectedFilm.tmdbId)]
      : null;

  // ===============================
  // RENDER
  // ===============================
  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="header">
        <div className="logo">🎬 MovieMate</div>
        <p className="tagline">Showtimes near you</p>
      </header>

      {/* MOVIES GRID – derived from showtimes */}
      <section className="now-playing-section" ref={moviesRef}>
        <h2 className="section-title">
          Now in cinemas near you
        </h2>

        <div className="movies-grid">
          {films.map((film) => {
            const details =
              film.tmdbId != null
                ? filmDetailsByTmdbId[String(film.tmdbId)]
                : null;

            const posterPath = details?.poster_path || null;
            const rating =
              details?.vote_average != null
                ? details.vote_average
                : null;

            return (
              <button
                key={film.key}
                className="movie-card"
                onClick={() => handleFilmClick(film)}
              >
                <div className="movie-poster-wrapper">
                  <img
                    className="movie-poster"
                    src={
                      posterPath
                        ? `https://image.tmdb.org/t/p/w500${posterPath}`
                        : "https://via.placeholder.com/500x750?text=No+Image"
                    }
                    alt={film.title}
                  />
                  {rating != null && (
                    <div className="movie-rating-pill">
                      ★ {rating.toFixed(1)}
                    </div>
                  )}
                </div>
                <p className="movie-name">{film.title}</p>
              </button>
            );
          })}
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

        {/* FILM DETAILS HEADER */}
        {selectedFilm && (
          <div className="film-detail-header">
            <div className="film-detail-text">
              <h3 className="film-detail-title">
                {selectedFilm.title}
              </h3>

              {selectedFilmDetails && (
                <>
                  <div className="film-detail-meta">
                    {selectedFilmDetails.cert && (
                      <span className="film-cert">
                        {selectedFilmDetails.cert}
                      </span>
                    )}
                    {selectedFilmDetails.vote_average && (
                      <span className="film-rating">
                        ★{" "}
                        {selectedFilmDetails.vote_average.toFixed(
                          1
                        )}
                      </span>
                    )}
                  </div>

                  {selectedFilmDetails.overview && (
                    <p className="film-overview">
                      {selectedFilmDetails.overview}
                    </p>
                  )}

                  {selectedFilmDetails.cast && (
                    <p className="film-cast">
                      <strong>Cast:</strong>{" "}
                      {selectedFilmDetails.cast.join(", ")}
                    </p>
                  )}

                  {selectedFilmDetails.trailerUrl && (
                    <button
                      className="trailer-btn"
                      onClick={() => setTrailerOpen(true)}
                    >
                      ▶ View trailer
                    </button>
                  )}
                </>
              )}

              <button className="back-btn" onClick={clearFilm}>
                ← Back to all films
              </button>
            </div>

            {selectedFilmDetails?.poster_path && (
              <img
                className="film-detail-poster"
                src={`https://image.tmdb.org/t/p/w500${selectedFilmDetails.poster_path}`}
                alt={selectedFilm.title}
              />
            )}
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

                {cheapest !== null && s.priceValue === cheapest && (
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

          {selectedFilm && visibleShowtimes.length === 0 && (
            <p className="no-results">
              No showtimes found near you in this date range for this
              film.
            </p>
          )}

          {!selectedFilm && (
            <p className="no-results">
              Select a film above to see local showtimes.
            </p>
          )}
        </div>

        {/* TRAILER MODAL */}
        {trailerOpen &&
          selectedFilmDetails?.trailerUrl && (
            <div
              className="trailer-overlay"
              onClick={() => setTrailerOpen(false)}
            >
              <div
                className="trailer-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="trailer-close"
                  onClick={() => setTrailerOpen(false)}
                >
                  ✕
                </button>

                <div className="trailer-iframe-wrapper">
                  <iframe
                    src={selectedFilmDetails.trailerUrl}
                    title="Trailer"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              </div>
            </div>
          )}
      </section>

      {/* ⭐ AD BANNER (Sticky bottom ad) */}
      <AdBanner />
    </div>
  );
}
