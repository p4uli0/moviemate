// ===============================
// MOVIEMATE – LIVE UK CINEMA + TMDB
// - Posters only for films actually showing locally (radius + date)
// - No showtimes until a film is selected
// - When selected: description, cert, rating, trailer + showtimes
// - Showtimes filtered by date + radius cascade (20→30→50→100)
// - Sort by cheapest / nearest
// - Uses TMDB IDs from UK Cinema API where possible
// ===============================

import { useState, useEffect, useRef, useMemo } from "react";
import "./index.css";
import { getNowPlayingUK, getMovieDetails } from "./api/tmdb.js";
import AdBanner from "./components/AdBanner.jsx";
import { getShowtimesFromApi } from "./api/ukCinema";

// -------------------------------
// RADIUS CASCADE STEPS
// -------------------------------
const RADIUS_STEPS = [20, 30, 50, 100];

// -------------------------------
// DATE RANGE LOGIC
// -------------------------------
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
// HELPERS
// -------------------------------
function distanceMiles(lat1, lon1, lat2, lon2) {
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
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}

function formatShowDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function normaliseTitle(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(3d|2d|imax|the movie|movie|film)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesMatch(a, b) {
  const na = normaliseTitle(a);
  const nb = normaliseTitle(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// Apply radius cascade 20→30→50→100
function applyRadiusCascade(list, userLocation) {
  if (!userLocation) {
    return { filtered: list, radiusUsed: null };
  }

  for (const r of RADIUS_STEPS) {
    const within = list.filter(
      (s) =>
        typeof s.distanceMiles === "number" && s.distanceMiles <= r
    );
    if (within.length > 0) {
      return { filtered: within, radiusUsed: r };
    }
  }

  // Nothing within 100 miles → national fallback
  return { filtered: list, radiusUsed: null };
}

// ===============================
// MAIN APP
// ===============================
export default function App() {
  const [nowPlaying, setNowPlaying] = useState([]);
  const [rawShowtimes, setRawShowtimes] = useState([]);

  const [selectedFilm, setSelectedFilm] = useState(null); // TMDB movie object
  const [filmDetails, setFilmDetails] = useState(null);
  const [detailCache, setDetailCache] = useState({});
  const [trailerOpen, setTrailerOpen] = useState(false);

  const [sortMode, setSortMode] = useState("price"); // "price" | "distance"
  const [dateFilter, setDateFilter] = useState("today"); // "today" | "weekend" | "7days"

  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

  const [usedRadius, setUsedRadius] = useState(null);

  const showtimesRef = useRef(null);
  const moviesRef = useRef(null);

  // -------------------------------
  // Load TMDB "Now Playing" (UK)
  // -------------------------------
  useEffect(() => {
    async function loadMovies() {
      try {
        const movies = await getNowPlayingUK();
        setNowPlaying(movies || []);
      } catch (err) {
        console.error("TMDB error loading now playing:", err);
        setNowPlaying([]);
      }
    }

    loadMovies();
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
      () => setLocationError("Location permission denied.")
    );
  }, []);

  // -------------------------------
  // Load UK Cinema showtimes (once)
  // -------------------------------
  useEffect(() => {
    async function loadShowtimesFromApi() {
      try {
        const apiShowtimes = await getShowtimesFromApi();
        console.log("UK Cinema API showtimes for app:", apiShowtimes);

        if (Array.isArray(apiShowtimes)) {
          console.log("✅ Using API showtimes, count:", apiShowtimes.length);
          setRawShowtimes(apiShowtimes);
        } else {
          console.warn("API returned non-array, no showtimes loaded.");
          setRawShowtimes([]);
        }
      } catch (err) {
        console.error("UK Cinema API error:", err);
        setRawShowtimes([]);
      }
    }

    loadShowtimesFromApi();
  }, []);

  // -------------------------------
  // Derived: filtered showtimes (date + radius)
  // -------------------------------
  const { filteredShowtimes, effectiveDateFilter } = useMemo(() => {
    if (!rawShowtimes.length) {
      return { filteredShowtimes: [], effectiveDateFilter: dateFilter };
    }

    // Step 1: add distance if we have location
    let list = rawShowtimes.map((s) => {
      if (
        userLocation &&
        typeof s.lat === "number" &&
        typeof s.lng === "number"
      ) {
        return {
          ...s,
          distanceMiles: distanceMiles(
            userLocation.lat,
            userLocation.lng,
            s.lat,
            s.lng
          ),
        };
      }
      return { ...s, distanceMiles: null };
    });

    // Step 2: apply date filter (today / weekend / 7 days)
    const applyDate = (mode) => {
      const { start, end } = getDateRange(mode);
      const sKey = normaliseDate(start);
      const eKey = normaliseDate(end);

      return list.filter((show) => {
        const k = normaliseDate(show.date);
        return k >= sKey && k <= eKey;
      });
    };

    // Try current dateFilter first
    let filtered = applyDate(dateFilter);
    let eff = dateFilter;

    // If nothing for that dateFilter, fall back to 7 days
    if (filtered.length === 0 && dateFilter !== "7days") {
      console.log(
        `No showtimes for date filter "${dateFilter}", falling back to "7days".`
      );
      filtered = applyDate("7days");
      eff = "7days";
    }

    // Step 3: radius cascade 20→30→50→100
    const { filtered: radiusFiltered, radiusUsed } = applyRadiusCascade(
      filtered,
      userLocation
    );
    if (radiusUsed) {
      console.log(`Using radius ${radiusUsed} miles for local showtimes.`);
      setUsedRadius(radiusUsed);
    } else {
      setUsedRadius(null);
    }

    console.log(
      "After date + radius filtering, showtimes:",
      radiusFiltered.length
    );

    return { filteredShowtimes: radiusFiltered, effectiveDateFilter: eff };
  }, [rawShowtimes, userLocation, dateFilter]);

  // Keep UI in sync if we had to fall back to 7 days
  useEffect(() => {
    if (effectiveDateFilter !== dateFilter) {
      setDateFilter(effectiveDateFilter);
    }
  }, [effectiveDateFilter, dateFilter]);

  // -------------------------------
  // Derived: films that actually have showtimes
  // (match by TMDB id first, fall back to fuzzy title)
// -------------------------------
  const localMovies = useMemo(() => {
    if (!nowPlaying.length || !filteredShowtimes.length) return [];

    return nowPlaying.filter((movie) => {
      const mTitle = movie.title || "";
      const mId = movie.id;

      return filteredShowtimes.some((s) => {
        const tmdbMatch =
          s.tmdbId != null && mId != null &&
          String(s.tmdbId) === String(mId);

        const titleMatch = titlesMatch(mTitle, s.film || "");

        return tmdbMatch || titleMatch;
      });
    });
  }, [nowPlaying, filteredShowtimes]);

  // -------------------------------
  // Movie click → TMDB details + scroll
  // -------------------------------
  async function handleMovieClick(m) {
    setSelectedFilm(m);

    if (detailCache[m.id]) {
      setFilmDetails(detailCache[m.id]);
    } else {
      try {
        const details = await getMovieDetails(m.id);
        setDetailCache((prev) => ({ ...prev, [m.id]: details }));
        setFilmDetails(details);
      } catch (err) {
        console.error("Error loading film details:", err);
        setFilmDetails(null);
      }
    }

    setTrailerOpen(false);

    setTimeout(() => {
      showtimesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 120);
  }

  function clearFilm() {
    setSelectedFilm(null);
    setFilmDetails(null);
    setTrailerOpen(false);

    setTimeout(() => {
      moviesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  }

  // -------------------------------
  // Visible showtimes (only after a film is selected)
  // Match by TMDB id first, then title
  // -------------------------------
  const visibleShowtimes = useMemo(() => {
    if (!selectedFilm) return [];

    let list = filteredShowtimes.slice();
    const filmTitle = selectedFilm.title || "";
    const filmId = selectedFilm.id;

    list = list.filter((s) => {
      const tmdbMatch =
        s.tmdbId != null &&
        filmId != null &&
        String(s.tmdbId) === String(filmId);

      const titleMatch = titlesMatch(filmTitle, s.film || "");

      return tmdbMatch || titleMatch;
    });

    console.log(
      `Showtimes after film filter for "${filmTitle}" (id ${filmId}):`,
      list.length
    );

    // Sort: cheapest or nearest
    list.sort((a, b) => {
      if (sortMode === "price") {
        return a.priceValue - b.priceValue;
      }

      if (sortMode === "distance" && userLocation) {
        const da =
          typeof a.distanceMiles === "number" ? a.distanceMiles : Infinity;
        const db =
          typeof b.distanceMiles === "number" ? b.distanceMiles : Infinity;
        return da - db;
      }

      return a.priceValue - b.priceValue;
    });

    return list;
  }, [filteredShowtimes, selectedFilm, sortMode, userLocation]);

  const cheapest =
    visibleShowtimes.length > 0
      ? Math.min(...visibleShowtimes.map((x) => x.priceValue))
      : null;

  // ===============================
  // RENDER
  // ===============================
  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="header">
        <div className="logo">🎬 MovieMate</div>
        <p className="tagline">Find. Compare. Watch</p>
      </header>

      {/* MOVIES GRID */}
      <section className="now-playing-section" ref={moviesRef}>
        <h2 className="section-title">Now in UK Cinemas (near you)</h2>

        {!localMovies.length && (
          <p className="no-results">
            No local films found for this date range yet. Try changing the date
            filter.
          </p>
        )}

        <div className="movies-grid">
          {localMovies.map((m) => (
            <button
              key={m.id}
              className="movie-card"
              onClick={() => handleMovieClick(m)}
            >
              <div className="movie-poster-wrapper">
                <img
                  className="movie-poster"
                  src={
                    m.poster_path
                      ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
                      : "https://via.placeholder.com/500x750?text=No+Image"
                  }
                  alt={m.title}
                />
                <div className="movie-rating-pill">
                  ★ {m.vote_average?.toFixed(1)}
                </div>
              </div>
              <p className="movie-name">{m.title}</p>
            </button>
          ))}
        </div>
      </section>

      {/* SHOWTIMES */}
      <section className="showtimes-section" ref={showtimesRef}>
        <h2 className="section-title-small">Showtimes near you</h2>

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

        {usedRadius && (
          <p className="radius-indicator">
            Showing films within about {usedRadius} miles of you.
          </p>
        )}

        {/* FILM DETAILS HEADER */}
        {selectedFilm && filmDetails && (
          <div className="film-detail-header">
            <div className="film-detail-text">
              <h3 className="film-detail-title">{filmDetails.title}</h3>

              <div className="film-detail-meta">
                {filmDetails.cert && (
                  <span className="film-cert">{filmDetails.cert}</span>
                )}
                <span className="film-rating">
                  ★ {filmDetails.vote_average?.toFixed(1)}
                </span>
              </div>

              {filmDetails.overview && (
                <p className="film-overview">{filmDetails.overview}</p>
              )}

              {filmDetails.cast && filmDetails.cast.length > 0 && (
                <p className="film-cast">
                  <strong>Cast:</strong> {filmDetails.cast.join(", ")}
                </p>
              )}

              {filmDetails.trailerUrl && (
                <button
                  className="trailer-btn"
                  onClick={() => setTrailerOpen(true)}
                >
                  ▶ View trailer
                </button>
              )}

              <button className="back-btn" onClick={clearFilm}>
                ← Back to all films
              </button>
            </div>

            <img
              className="film-detail-poster"
              src={
                filmDetails.poster_path
                  ? `https://image.tmdb.org/t/p/w500${filmDetails.poster_path}`
                  : "https://via.placeholder.com/300x450?text=No+Image"
              }
              alt={filmDetails.title}
            />
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

        {/* SHOWTIME CARDS – only when a film is selected */}
        <div className="showtime-list">
          {!selectedFilm && (
            <p className="no-results">
              Select a film above to see local showtimes.
            </p>
          )}

          {selectedFilm && visibleShowtimes.length === 0 && (
            <p className="no-results">
              No showtimes match your filters for this film.
            </p>
          )}

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

                {userLocation && s.distanceMiles != null && (
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
                href={s.bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="book-btn"
              >
                Book →
              </a>
            </div>
          ))}
        </div>

        {/* TRAILER MODAL */}
        {trailerOpen && filmDetails?.trailerUrl && (
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
                  src={filmDetails.trailerUrl}
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
