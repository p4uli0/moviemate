// src/api/ukCinema.js

// Call the Netlify function and normalise the data for the app
// Shape returned to App.jsx:
//
// [
//   {
//     id,
//     film,        // string – film title
//     filmId,      // UK Cinema film id (if present)
//     tmdbId,      // TMDB id (if present)
//     cinema,      // string – cinema name
//     date,        // Date object
//     time,        // "HH:MM"
//     priceValue,  // number
//     price,       // "£X.XX"
//     lat,         // number | null
//     lng,         // number | null
//     bookingUrl,  // string
//   },
//   ...
// ]

export async function getShowtimesFromApi() {
  const res = await fetch("/.netlify/functions/ukCinema");

  if (!res.ok) {
    const text = await res.text();
    console.error("UK Cinema proxy error:", res.status, text);
    throw new Error(`UK Cinema API failed: ${res.status}`);
  }

  let raw;
  try {
    raw = await res.json();
  } catch (e) {
    console.error("Failed to parse JSON from Netlify ukCinema function:", e);
    throw new Error("Invalid JSON from ukCinema function");
  }

  console.log("Raw UK Cinema API data:", raw);

  // Some APIs return an array directly, some wrap it in { data: [...] }
  const rawArray = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
    ? raw.data
    : [];

  // Normalise to the shape the app expects
  const normalised = rawArray.map((item, index) => {
    // Many responses look like: { showtime: {...}, film: {...}, cinema: {...} }
    const show = item.showtime || item;
    const film = item.film || {};
    const cinema = item.cinema || {};

    // ---- Film IDs / titles ----
    const filmId = film.id ?? show.film_id ?? null;
    const tmdbId = film.tmdb_id ?? show.tmdb_id ?? null;

    const filmTitle =
      film.title ||
      film.original_title ||
      show.film_title ||
      show.filmName ||
      "Unknown film";

    // ---- Cinema name ----
    const cinemaName =
      cinema.name ||
      show.cinema_name ||
      show.cinemaName ||
      "Unknown cinema";

    // ---- Date + time ----
    const rawDate =
      show.showing_at ||
      show.showingAt ||
      show.date ||
      show.start_time;

    const dt = rawDate ? new Date(rawDate) : new Date();
    const safeDt = isNaN(dt.getTime()) ? new Date() : dt;

    const date = safeDt; // keep as Date object
    const time = safeDt.toTimeString().slice(0, 5); // "HH:MM"

    // ---- Price ----
    // UK Cinema API doesn't give ticket price in many cases, so we fake one if needed
    const basePrice =
      typeof show.price === "number"
        ? show.price
        : typeof show.priceValue === "number"
        ? show.priceValue
        : 9.99;

    const priceValue = Number(basePrice.toFixed(2));

    // ---- Location ----
    const lat =
      show.latitude ??
      cinema.latitude ??
      (typeof show.lat === "number" ? show.lat : null);
    const lng =
      show.longitude ??
      cinema.longitude ??
      (typeof show.lng === "number" ? show.lng : null);

    // ---- Booking link ----
    const bookingUrl =
      show.booking_link ||
      cinema.link ||
      show.bookingUrl ||
      "#";

    return {
      id: show.id ?? item.id ?? index,
      film: filmTitle,
      filmId,
      tmdbId,
      cinema: cinemaName,
      date,
      time,
      priceValue,
      price: `£${priceValue.toFixed(2)}`,
      lat,
      lng,
      bookingUrl,
    };
  });

  console.log("Normalised UK Cinema showtimes:", normalised);
  return normalised;
}
