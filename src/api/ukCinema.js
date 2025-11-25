// src/api/ukCinema.js

// 1) Call the Netlify function and get the raw API data
async function fetchRawShowtimes() {
  const res = await fetch("/.netlify/functions/ukCinema");

  if (!res.ok) {
    const text = await res.text();
    console.error("UK Cinema proxy error:", res.status, text);
    throw new Error(`UK Cinema API failed: ${res.status}`);
  }

  const data = await res.json();
  console.log("Raw UK Cinema API data:", data);

  // data should be an array of 20 items
  return Array.isArray(data) ? data : [];
}

/**
 * 2) Map raw UK Cinema showtime objects -> MovieMate's showtime format
 *
 * Assumes each element looks like:
 * { showtime: {...}, film: {...}, cinema: {...} }
 */
function normaliseShowtimes(rawArray) {
  return rawArray.map((item) => {
    const st = item.showtime || item;   // fall back to item itself if not nested
    const film = item.film || {};
    const cinema = item.cinema || {};

    return {
      // IDs
      id: st.id,
      filmId: st.film_id ?? film.id,
      cinemaId: st.cinema_id ?? cinema.id,

      // Labels
      filmTitle: film.title,
      cinemaName: cinema.name,
      chain: st.chain ?? cinema.chain,

      // Times
      showingAt: st.showing_at,       // ISO datetime from API
      onSaleFrom: st.on_sale_from,    // optional

      // Location
      latitude: st.latitude ?? cinema.latitude,
      longitude: st.longitude ?? cinema.longitude,

      // Booking
      bookingLink: st.booking_link,
      soldOut: st.sold_out,

      // Useful extras for later
      runtimeMins: film.runtime,
      tmdbId: film.tmdb_id,
      imdbId: film.imdb_id,
      cinemaAddress: cinema.address,
      cinemaLink: cinema.link,
    };
  });
}

// 3) Public function App.jsx will use
export async function getShowtimesFromApi() {
  const raw = await fetchRawShowtimes();
  const normalised = normaliseShowtimes(raw);
  console.log("Normalised UK Cinema showtimes:", normalised);
  return normalised;
}
