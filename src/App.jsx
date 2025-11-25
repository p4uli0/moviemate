// ===============================
// MOVIEMATE – MAIN APP
// TMDB posters + UK Cinema showtimes
// - Shows ALL now-playing posters
// - No showtimes until a film is selected
// - When a film is selected, we filter:
//     1) by TMDB ID
//     2) fallback: by fuzzy title
//     3) last resort: show all showtimes
// ===============================

import { useState, useEffect, useRef } from "react";
import "./index.css";
import { getNowPlayingUK, getMovieDetails } from "./api/tmdb.js";
import AdBanner from "./components/AdBanner.jsx";
import { getShowtimesFromApi } from "./api/ukCinema";

// FALLBACK MOVIES (if TMDB fails)
const FALLBACK_MOVIES = [
  { id: 99901, title: "Dune: Part Two", poster_path: null, vote_average: 8.4 },
  { id: 99902, title: "Inside Out 2", poster_path: null, vote_average: 7.9 },
  { id: 99903, title: "Deadpool & Wolverine", poster_path: null, vote_average: 8.1 },
  { id: 99904, title: "The Fall Guy", poster_path: null, vote_average: 7.0 },
];

// Distance steps in miles for "near me" logic
const NEARBY_RADIUS_STEPS = [20, 30, 50, 100];

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
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(3d|2d|imax|the movie|movie|film)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ===============================
// MAIN APP
// ===============================
export default function App() {
  const [nowPlaying, setNowPlaying] = useState(FALLBACK_MOVIES);
  const [showtimes, setShowtimes] = useState([]); // all normalised showtimes from API

  const [selectedFilm, setSelectedFilm] = useState(null); // full TMDB movie object
  const [filmDetails, setFilmDetails] = useState(null);
  const [detailCache, setDetailCache] = useState({});
  const [trailerOpen, setTrailerOpen] = useState(false);

  const [sortMode, setSortMode] = useState("price"); // "price" | "distance"
  const [dateFilter, setDateFilter] = useState("today");

  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

  const showtimesRef = useRef(null);
  const moviesRef = useRef(null);

  // -------------------------------
  // Load TMDB movies
  // -------------------------------
  useEffect(() => {
    async function loadMovies() {
      try {
        const movies = await getNowPlayingUK();
        if (!movies.length) throw new Error("empty");
        setNowPlaying(movies);
      } catch (err) {
        console.error("TMDB error, using fallback movies:", err);
        setNowPlaying(FALLBACK_MOVIES);
      }
    }

    loadMovies();
  }, []);

  // -------------------------------
  // Load UK Cinema showtimes
  // -------------------------------
  useEffect(() => {
    async function loadShowtimesFromApi() {
      try {
        const apiShowtimes = await getShowtimesFromApi();
        console.log("UK Cinema API showtimes for app:", apiShowtimes);

        if (Array.isArray(apiShowtimes)) {
          console.log("✅ Using API showtimes, count:", apiShowtimes.length);
          setShowtimes(apiShowtimes);
        } else {
          console.warn("API returned non-array showtimes.");
          setShowtimes([]);
        }
      } catch (err) {
        console.error("UK Cinema API error:", err);
        setShowtimes([]);
      }
    }

    loadShowtimesFromApi();
  }, []);

  // -------------------------------
  // Geolocation (for distance only)
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
  // Movie click → details + scroll
  // -------------------------------
  async function handleMovieClick(m) {
    setSelectedFilm(m);

    if (detailCache[m.id]) {
      setFilmDetails(detailCache[m.id]);
    } else {
      try {
        const details = await getMovieDetails(m.id);
        setDetailCache((p) => ({ ...p, [m.id]: details }));
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
  // FILTER + SORT SHOWTIMES
  // -------------------------------
  const visibleShowtimes = (() => {
    console.log("DEBUG total showtimes:", showtimes.length);

    // 1) No film selected → show nothing
    if (!selectedFilm) {
      return [];
    }

    let list = showtimes.slice();

    // 2) Filter by TMDB ID first
    const targetId = selectedFilm.id != null ? String(selectedFilm.id) : null;

    let byFilm = [];
    if (targetId) {
      byFilm = list.filter(
        (s) =>
          s.tmdbId != null && String(s.tmdbId) === targetId
      );
      console.log("Matched by tmdbId:", byFilm.length);
    }

    // 3) If no TMDB matches, try fuzzy title
    if (byFilm.length === 0) {
      const key = normaliseTitle(selectedFilm.title);
      byFilm = list.filter((s) => {
        const t = normaliseTitle(s.film);
        return t && key && (t.includes(key) || key.includes(t));
      });
      console.log("Matched by title fallback:", byFilm.length);
    }

    // 4) If STILL nothing, last resort: show everything (so user isn't staring at a blank page)
    if (byFilm.length === 0) {
      console.log(
        "⚠️ No film match by tmdbId or title – falling back to ALL showtimes for now."
      );
      byFilm = list;
    }

    list = byFilm;

    // 5) Filter by date range
    const { start, end } = getDateRange(dateFilter);
    const sKey = normaliseDate(start);
    const eKey = normaliseDate(end);

    list = list.filter((s) => {
      const k = normaliseDate(s.date);
      return k >= sKey && k <= eKey;
    });
    console.log("After date filter:", list.length);

    if (list.length === 0) return [];

    // 6) Add distances if we have location + apply progressive radius
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

      let filteredByRadius = list;
      for (const radius of NEARBY_RADIUS_STEPS) {
        const within = list.filter(
          (s) =>
            typeof s.distanceMiles === "number" &&
            isFinite(s.distanceMiles) &&
            s.distanceMiles <= radius
        );
        if (within.length > 0) {
          filteredByRadius = within;
          console.log(
            `Using radius ${radius} miles, showtimes:`,
            within.length
          );
          break;
        }
      }
      list = filteredByRadius;
    }

    console.log("After date + radius filtering, showtimes:", list.length);

    // 7) Sort list
    list = list.sort((a, b) => {
      if (sortMode === "price") {
        return a.priceValue - b.priceValue;
      }

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
        <h2 className="section-title">Now in UK Cinemas</h2>

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

              {filmDetails.cast && (
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

                {userLocation && s.distanceMiles != null && isFinite(s.distanceMiles) && (
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
              No showtimes found for this film and date range.
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

      {/* ⭐ AD BANNER (Sticky bottom ad) */}
      <AdBanner />
    </div>
  );
}
