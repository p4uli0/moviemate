// src/api/tmdb.js
const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

if (!API_KEY) {
  console.warn(
    "[TMDB] Missing VITE_TMDB_API_KEY in .env.local – TMDB calls will fail."
  );
}

async function tmdbGet(path, params = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);

  url.searchParams.set("api_key", API_KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[TMDB] ${res.status} ${res.statusText} – ${body}`);
  }
  return res.json();
}

// -------------------------
// Now playing in UK cinemas
// -------------------------
export async function getNowPlayingUK() {
  const data = await tmdbGet("/movie/now_playing", {
    language: "en-GB",
    region: "GB",
    page: 1,
  });

  return data.results || [];
}

// -------------------------
// Full film details for card
// -------------------------
export async function getMovieDetails(movieId) {
  const [movie, credits, releases, videos] = await Promise.all([
    tmdbGet(`/movie/${movieId}`, { language: "en-GB" }),
    tmdbGet(`/movie/${movieId}/credits`, {}),
    tmdbGet(`/movie/${movieId}/release_dates`, {}),
    tmdbGet(`/movie/${movieId}/videos`, { language: "en-GB" }),
  ]);

  // BBFC / UK certificate if present
  let cert = null;
  if (releases?.results) {
    const uk = releases.results.find((r) => r.iso_3166_1 === "GB");
    if (uk?.release_dates?.length) {
      cert = uk.release_dates[0].certification || null;
    }
  }

  // Simple top-billed cast list
  const cast =
    credits?.cast?.slice(0, 6).map((p) => p.name).filter(Boolean) || [];

  // YouTube trailer
  let trailerUrl = null;
  if (videos?.results?.length) {
    const trailer =
      videos.results.find((v) => v.type === "Trailer" && v.site === "YouTube") ||
      videos.results.find((v) => v.site === "YouTube");
    if (trailer?.key) {
      trailerUrl = `https://www.youtube.com/embed/${trailer.key}`;
    }
  }

  return {
    id: movie.id,
    title: movie.title,
    overview: movie.overview,
    poster_path: movie.poster_path,
    vote_average: movie.vote_average,
    runtime: movie.runtime,
    cert,
    cast,
    trailerUrl,
  };
}
