// src/api/ukCinema.js

export async function getShowtimesFromApi(lat, lng) {
  // Build URL to Netlify function with lat/lng
  const res = await fetch(
    `/.netlify/functions/ukCinema?lat=${lat}&lng=${lng}`
  );

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

  const rawArray = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
    ? raw.data
    : [];

  const normalised = rawArray.map((item, index) => {
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
    let cinemaName =
      cinema.name ||
      show.cinema_name ||
      show.cinemaName ||
      show.chain ||
      null;

    if (!cinemaName) {
      if (show.cinema_id) {
        cinemaName = `Cinema #${show.cinema_id}`;
      } else {
        cinemaName = "Unknown cinema";
      }
    }

    // ---- Date + time ----
    const rawDate =
      show.showing_at ||
      show.showingAt ||
      show.date ||
      show.start_time;

    const dt = rawDate ? new Date(rawDate) : new Date();
    const safeDt = isNaN(dt.getTime()) ? new Date() : dt;

    const date = safeDt;
    const time = safeDt.toTimeString().slice(0, 5); // "HH:MM"

    // ---- Price (fake for now) ----
    const basePrice =
      typeof show.price === "number"
        ? show.price
        : typeof show.priceValue === "number"
        ? show.priceValue
        : 9.99;

    const priceValue = Number(basePrice.toFixed(2));

    // ---- Location ----
    const latShow =
      typeof show.latitude === "number"
        ? show.latitude
        : typeof cinema.latitude === "number"
        ? cinema.latitude
        : null;

    const lngShow =
      typeof show.longitude === "number"
        ? show.longitude
        : typeof cinema.longitude === "number"
        ? cinema.longitude
        : null;

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
      lat: latShow,
      lng: lngShow,
      bookingUrl,
    };
  });

  console.log("Normalised UK Cinema showtimes:", normalised);
  return normalised;
}
