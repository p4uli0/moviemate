// ===============================
// MOVIEMATE – FULL APP FILE
// WITH: Miles • Trailer popup • Date filters
// Mobile-first • Dummy UK showtimes
// ===============================

import { useState, useEffect, useRef } from "react";
import "./index.css";
import { getNowPlayingUK, getMovieDetails } from "./api/tmdb.js";
import AdBanner from "./components/AdBanner.jsx";
import { getShowtimesFromApi } from "./api/ukCinema";


// -------------------------------
// DEMO CINEMAS – UK CITIES
// -------------------------------
const DEMO_CINEMAS = [
  // Leeds
  {
    name: "Odeon Leeds",
    lat: 53.8013,
    lng: -1.5456,
    basePrice: 11.99,
    bookingUrl: "https://www.odeon.co.uk/",
  },
  {
    name: "Vue Kirkstall",
    lat: 53.8203,
    lng: -1.6035,
    basePrice: 10.49,
    bookingUrl: "https://www.myvue.com/",
  },

  // York
  {
    name: "Cineworld York",
    lat: 53.9683,
    lng: -1.085,
    basePrice: 10.99,
    bookingUrl: "https://www.cineworld.co.uk/",
  },

  // Hull
  {
    name: "Cineworld Hull",
    lat: 53.7443,
    lng: -0.3325,
    basePrice: 9.99,
    bookingUrl: "https://www.cineworld.co.uk/",
  },
  {
    name: "Vue Hull Princes Quay",
    lat: 53.7415,
    lng: -0.3375,
    basePrice: 9.49,
    bookingUrl: "https://www.myvue.com/",
  },

  // Newcastle
  {
    name: "Vue Gateshead",
    lat: 54.9606,
    lng: -1.6174,
    basePrice: 9.99,
    bookingUrl: "https://www.myvue.com/",
  },
  {
    name: "Cineworld Newcastle",
    lat: 54.9723,
    lng: -1.6139,
    basePrice: 10.49,
    bookingUrl: "https://www.cineworld.co.uk/",
  },

  // Liverpool / Cheshire
  {
    name: "Odeon Liverpool One",
    lat: 53.4036,
    lng: -2.9856,
    basePrice: 11.49,
    bookingUrl: "https://www.odeon.co.uk/",
  },
  {
    name: "Vue Cheshire Oaks",
    lat: 53.2586,
    lng: -2.8801,
    basePrice: 10.99,
    bookingUrl: "https://www.myvue.com/",
  },

  // Cardiff
  {
    name: "Vue Cardiff",
    lat: 51.4816,
    lng: -3.1791,
    basePrice: 10.99,
    bookingUrl: "https://www.myvue.com/",
  },
  {
    name: "Cineworld Cardiff",
    lat: 51.479,
    lng: -3.1715,
    basePrice: 11.29,
    bookingUrl: "https://www.cineworld.co.uk/",
  },

  // London
  {
    name: "Vue Westfield White City",
    lat: 51.5079,
    lng: -0.2219,
    basePrice: 13.5,
    bookingUrl: "https://www.myvue.com/",
  },
  {
    name: "Cineworld Greenwich O2",
    lat: 51.501,
    lng: 0.0032,
    basePrice: 13.25,
    bookingUrl: "https://www.cineworld.co.uk/",
  },
];

// -------------------------------
// FALLBACK MOVIES
// -------------------------------
const FALLBACK_MOVIES = [
  { id: 99901, title: "Dune: Part Two", poster_path: null, vote_average: 8.4 },
  { id: 99902, title: "Inside Out 2", poster_path: null, vote_average: 7.9 },
  { id: 99903, title: "Deadpool & Wolverine", poster_path: null, vote_average: 8.1 },
  { id: 99904, title: "The Fall Guy", poster_path: null, vote_average: 7.0 },
];

const NEARBY_RADIUS_MILES = 20;
const DAYS_AHEAD = 7;

// -------------------------------
// MILES DISTANCE (Haversine)
// -------------------------------
function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
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
// GENERATE DUMMY SHOWTIMES
// -------------------------------
function generateDemoShowtimes(movies) {
  const times = ["11:10", "13:15", "15:45", "18:30", "20:10", "21:30"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let id = 1;
  const out = [];

  movies.forEach((movie, mIndex) => {
    DEMO_CINEMAS.forEach((cin, cIndex) => {
      for (let d = 0; d < DAYS_AHEAD; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() + d);

        const showCount = 2 + ((mIndex + cIndex + d) % 3);

        for (let i = 0; i < showCount; i++) {
          const tIndex = (i + d + mIndex) % times.length;
          const t = times[tIndex];

          const variance = (Math.random() - 0.5) * 2;
          const priceValue = Number((cin.basePrice + variance).toFixed(2));

          out.push({
            id: id++,
            film: movie.title,
            cinema: cin.name,
            date,
            time: t,
            priceValue,
            price: `£${priceValue.toFixed(2)}`,
            lat: cin.lat,
            lng: cin.lng,
            bookingUrl: cin.bookingUrl,
          });
        }
      }
    });
  });

  return out;
}

// -------------------------------
// MAIN APP
// -------------------------------
export default function App() {
  const [nowPlaying, setNowPlaying] = useState(FALLBACK_MOVIES);
  const [showtimes, setShowtimes] = useState(generateDemoShowtimes(FALLBACK_MOVIES));

  const [selectedFilm, setSelectedFilm] = useState(null);
  const [filmDetails, setFilmDetails] = useState(null);
  const [detailCache, setDetailCache] = useState({});
  const [trailerOpen, setTrailerOpen] = useState(false);

  const [sortMode, setSortMode] = useState("price");
  const [scope, setScope] = useState("near");
  const [dateFilter, setDateFilter] = useState("today");

  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

  const showtimesRef = useRef(null);
  const moviesRef = useRef(null);

   // Call the UK Cinema API once when the app loads
  // and replace the dummy showtimes with real ones
  useEffect(() => {
    async function loadShowtimesFromApi() {
      try {
        const apiShowtimes = await getShowtimesFromApi();
        console.log("UK Cinema API showtimes for app:", apiShowtimes);

        // getShowtimesFromApi already returns objects in the shape:
        // { id, film, cinema, date, time, priceValue, price, lat, lng, bookingUrl }
        // so we can plug them straight into the app:
        if (Array.isArray(apiShowtimes) && apiShowtimes.length > 0) {
          setShowtimes(apiShowtimes);
        }
      } catch (err) {
        console.error("UK Cinema API error, keeping demo showtimes:", err);
        // If it fails, we leave the existing generated demo showtimes in place
      }
    }

    loadShowtimesFromApi();
  }, []);





  // TMDB load + geo
  useEffect(() => {
    async function loadMovies() {
      try {
        const movies = await getNowPlayingUK();
        if (!movies.length) throw new Error("empty");

        setNowPlaying(movies);
        setShowtimes(generateDemoShowtimes(movies));
      } catch {
        setNowPlaying(FALLBACK_MOVIES);
        setShowtimes(generateDemoShowtimes(FALLBACK_MOVIES));
      }
    }

    loadMovies();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationError("");
        },
        () => setLocationError("Location permission denied.")
      );
    }
  }, []);

  // Movie click → load TMDB details + scroll
  async function handleMovieClick(m) {
    setSelectedFilm(m.title);

    if (detailCache[m.id]) {
      setFilmDetails(detailCache[m.id]);
    } else {
      try {
        const details = await getMovieDetails(m.id);
        setDetailCache((p) => ({ ...p, [m.id]: details }));
        setFilmDetails(details);
      } catch {
        setFilmDetails(null);
      }
    }

    setTrailerOpen(false);

    setTimeout(() => {
      showtimesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 120);
  }

  // FIXED: scroll back properly
  function clearFilm() {
    setSelectedFilm(null);
    setFilmDetails(null);
    setTrailerOpen(false);

    setTimeout(() => {
      moviesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  }

 // TEMP: show all showtimes without filters, just to debug
  const visibleShowtimes = (() => {
    console.log("DEBUG: showtimes in state:", showtimes);
    return showtimes;
  })();

  const cheapest =
    visibleShowtimes.length > 0
      ? Math.min(...visibleShowtimes.map((x) => x.priceValue))
      : null;

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

        {/* FILM DETAILS */}
        {selectedFilm && filmDetails && (
          <div className="film-detail-header">
            <div className="film-detail-text">
              <h3 className="film-detail-title">{filmDetails.title}</h3>

              <div className="film-detail-meta">
                {filmDetails.cert && <span className="film-cert">{filmDetails.cert}</span>}
                <span className="film-rating">★ {filmDetails.vote_average?.toFixed(1)}</span>
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

        {/* SORTING + LOCATION */}
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
        {locationError && <p className="location-error">{locationError}</p>}

        {/* SHOWTIME CARDS */}
        <div className="showtime-list">
          {visibleShowtimes.map((s) => (
            <div
              key={s.id}
              className={`showtime-card ${
                cheapest !== null && s.priceValue === cheapest ? "cheapest" : ""
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
                <span className="showtime-date">{formatShowDate(s.date)}</span>
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

          {visibleShowtimes.length === 0 && (
            <p className="no-results">No showtimes match your filters.</p>
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