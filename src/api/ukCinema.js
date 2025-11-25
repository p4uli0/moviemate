// src/api/ukCinema.js

// Call the Netlify function and normalise the data for the app
export async function getShowtimesFromApi() {
  // Call your Netlify function
  const res = await fetch("/.netlify/functions/ukCinema");

  if (!res.ok) {
    const text = await res.text();
    console.error("UK Cinema proxy error:", res.status, text);
    throw new Error(`UK Cinema API failed: ${res.status}`);
  }

  const raw = await res.json();
  console.log("Raw UK Cinema API data:", raw);

  // Some endpoints return an array, some return { data: [...] }
  const rawArray = Array.isArray(raw) ? raw : Array.isArray(raw.data) ? raw.data : [];

  const normalised = rawArray.map((item, index) => {
    // Many UK Cinema examples use nested objects like:
    // { showtime: {...}, film: {...}, cinema: {...} }
    const show = item.showtime || item;
    const film = item.film || {};
    const cinema = item.cinema || {};

    // ---- Film IDs / titles ----
    const filmId = film.id ?? show.film_id ?? null;
    const tmdbId = film.tmdb_id ?? null;

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

    const date = safeDt; // the app expects a Date object
    const time = safeDt.toTimeString().slice(0, 5); // "HH:MM"

    // ---- Price ----
    // UK Cinema API doesn't give ticket price, so fake one for now
    const basePrice =
      typeof show.price === "number"
        ? show.price
        : typeof show.priceValue === "number"
        ? show.priceValue
        : 9.99;

    const priceValue = Number(basePrice.toFixed(2));

    // ---- Location ----
    const lat = show.latitude ?? cinema.latitude ?? null;
    const lng = show.longitude ?? cinema.longitude ?? null;

    // ---- Booking link ----
    const bookingUrl =
      show.booking_link ||
      cinema.link ||
      show.bookingUrl ||
      "#";

    return {
      id: show.id ?? index,
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
