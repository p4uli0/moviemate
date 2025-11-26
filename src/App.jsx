// ===============================
// MOVIEMATE – FULL PRODUCTION APP
// TMDB + UK Cinema API (joined backend)
// ===============================

import { useState, useEffect, useRef } from "react";
import "./index.css";
import { getNowPlayingUK, getMovieDetails } from "./api/tmdb.js";
import { getShowtimesFromApi } from "./api/ukCinema.js";
import AdBanner from "./components/AdBanner.jsx";

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

  const R = 3958.8;
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

function getDateRange(mode) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (mode === "today") return { start: today, end: today };

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

function normaliseTitle(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(3d|2d|imax|the movie|movie|film)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ===============================
// MAIN APP
// ===============================
export default function App() {
  const [nowPlaying, setNowPlaying] = useState([]);
  const [showtimes, setShowtimes] = useState([]);

  const [selectedFilm, setSelectedFilm] = useState(null);
  const [filmDetails, setFilmDetails] = useState(null);
  const [detailCache, setDetailCache] = useState({});

  const [trailerOpen, setTrailerOpen] = useState(false);

  const [sortMode, setSortMode] = useState("price"); // price | distance
  const [dateFilter, setDateFilter] = useState("today");

  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

  const moviesRef = useRef(null);
  const showtimesRef = useRef(null);

  // -------------------------------
  // Load TMDB movies
  // -------------------------------
  useEffect(() => {
    async function loadMovies() {
      try {
        const movies = await getNowPlayingUK();
        setNowPlaying(movies);
      } catch (err) {
        console.error("TMDB error:", err);
        setNowPlaying([]);
      }
    }
    loadMovies();
  }, []);

  // -------------------------------
  // Load UK Cinema showtimes
  // -------------------------------
  useEffect(() => {
    async function loadShowtimes() {
      try {
        const apiShowtimes = await getShowtimesFromApi();
        setShowtimes(apiShowtimes);
      } catch (err) {
        console.error("UK Cinema load error:", err);
        setShowtimes([]);
      }
    }
    loadShowtimes();
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
      () => {
        setLocationError("Location permission denied.");
      }
    );
  }, []);

  // -------------------------------
  // When clicking a movie
  // -------------------------------
  async function handleMovieClick(movie) {
    setSelectedFilm(movie);

    if (detailCache[movie.id]) {
      setFilmDetails(detailCache[movie.id]);
    } else {
      try {
        const details = await getMovieDetails(movie.id);
        setDetailCache((p) => ({ ...p, [movie.id]: details }));
        setFilmDetails(details);
      } catch (err) {
        console.error("Film detail error:", err);
        setFilmDetails(null);
      }
    }

    // scroll to showtimes
    setTimeout(() => {
      showtimesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  }

  function clearFilm() {
    setSelectedFilm(null);
    setFilmDetails(null);
    setTrailerOpen(false);

    setTimeout(() => {
      moviesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  // -------------------------------
  // Build visible showtimes
  // -------------------------------
  const visibleShowtimes = (() => {
    if (!selectedFilm) return [];

    const key = normaliseTitle(selectedFilm.title);
    let list = [...showtimes];

    // Match by TMDB ID if available
    let matches = list.filter(
      (s) =>
        s.tmdbId &&
        String(s.tmdbId) === String(selectedFilm.id)
    );

    // Fallback fuzzy title
    if (matches.length === 0) {
      matches = list.filter((s) => {
        const t = normaliseTitle(s.filmTitle);
        return t.includes(key) || key.includes(t);
      });
    }

    if (matches.length === 0) return [];

    list = matches;

    // Date filter
    const { start, end } = getDateRange(dateFilter);
    const sKey = normaliseDate(start);
    const eKey = normaliseDate(end);

    list = list.filter((s) => {
      const k = normaliseDate(s.date);
      return k >= sKey && k <= eKey;
    });

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
    }

    // Sorting
    list.sort((a, b) => {
      if (sortMode === "price") {
        return a.priceValue - b.priceValue;
      }
      if (sortMode === "distance" && userLocation) {
        return (a.distanceMiles || Infinity) - (b.distanceMiles || Infinity);
      }
      return 0;
    });

    return list;
  })();

  const cheapest =
    visibleShowtimes.length > 0
      ? Math.min(...visibleShowtimes.map((x) => x.priceValue))
      : null;

  // -------------------------------
  // RENDER
  // -------------------------------
  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="header">
        <div className="logo">🎬 MovieMate</div>
        <p className="tagline">Find. Compare. Watch</p>
      </header>

      {/* MOVIES GRID */}
      <section className="now-playing-section" ref={moviesRef}>
        <h2 className="section-title">Now in cinemas near you</h2>

        <div className="movies-grid">
          {nowPlaying.map((m) => (
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

        {/* FILM DETAIL HEADER */}
        {selectedFilm && filmDetails && (
          <div className="film-detail-header">
            <div className="film-detail-text">
              <h3 className="film-detail-title">
                {filmDetails.title}
              </h3>

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

              {filmDetails.cast && (
                <p className="film-cast">
                  <strong>Cast:</strong>{" "}
                  {filmDetails.cast.join(", ")}
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

        {/* SORT BAR */}
        {selectedFilm && (
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
        )}

        {locationError && (
          <p className="location-error">{locationError}</p>
        )}

        {/* SHOWTIME LIST */}
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
                <h4 className="cinema-name">{s.cinemaName}</h4>
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
                href={s.bookingUrl}
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
              No showtimes found near you for this film.
            </p>
          )}

          {!selectedFilm && (
            <p className="no-results">
              Select a film above to see local showtimes.
            </p>
          )}
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

      <AdBanner />
    </div>
  );
}
